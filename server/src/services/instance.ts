import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import type { Db } from "@paperclipai/db";
import type {
  InstanceManifest,
  InstanceSummary,
  ConnectionCheck,
  ConnectionValidation,
  SyncState,
  CompanyPortabilityManifest,
} from "@paperclipai/shared";
import { portabilityManifestSchema } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { companyPortabilityService } from "./company-portability.js";
import { agentService } from "./agents.js";

const OPENCLAW_FILES = ["SOUL.md", "AGENTS.md", "IDENTITY.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"];

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readYaml<T = unknown>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return yaml.load(raw) as T;
}

function computeFileHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeJoinWorkspace(root: string, child: string): string {
  return path.resolve(root, child);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, ...keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export function instanceService(db: Db) {
  const portability = companyPortabilityService(db);
  const agentsSvc = agentService(db);

  async function applyWorkspaceBindingsFromManifest(manifest: InstanceManifest) {
    const manifestRecord = asRecord(manifest);
    const paperclipRecord = asRecord(manifestRecord?.paperclip);
    const openclawRecord = asRecord(manifestRecord?.openclaw);
    const companyId = readString(paperclipRecord, "companyId", "company_id");
    const rawAgentIdMap = asRecord(paperclipRecord?.agentIdMap) ?? asRecord(paperclipRecord?.agent_id_map) ?? {};
    const agentIdMap = Object.fromEntries(
      Object.entries(rawAgentIdMap).filter(([, value]) => typeof value === "string" && value.length > 0),
    ) as Record<string, string>;
    const workspaceRoot = readString(openclawRecord, "workspacePath", "workspace_path");
    const openclawAgents = Array.isArray(openclawRecord?.agents) ? openclawRecord.agents : [];

    if (!companyId || !workspaceRoot || openclawAgents.length === 0) {
      return;
    }

    for (const agentInfo of openclawAgents) {
      const agentRecord = asRecord(agentInfo);
      const roleId = readString(agentRecord, "roleId", "role_id");
      const folderName = readString(agentRecord, "folderName", "folder_name") || roleId;

      if (!folderName) {
        continue;
      }

      const candidateKeys = [
        roleId,
        folderName,
        normalizeSlug(roleId),
        normalizeSlug(folderName),
      ].filter((value, index, arr) => typeof value === "string" && value.length > 0 && arr.indexOf(value) === index);

      const agentId = candidateKeys
        .map((key) => agentIdMap[key])
        .find((value): value is string => typeof value === "string" && value.length > 0);

      if (!agentId) {
        continue;
      }

      const existing = await agentsSvc.getById(agentId);
      if (!existing || existing.companyId !== companyId) {
        continue;
      }

      const existingAdapterConfig =
        typeof existing.adapterConfig === "object" && existing.adapterConfig !== null && !Array.isArray(existing.adapterConfig)
          ? (existing.adapterConfig as Record<string, unknown>)
          : {};

      const agentWorkspace = safeJoinWorkspace(workspaceRoot, folderName);

      await agentsSvc.update(agentId, {
        adapterConfig: {
          ...existingAdapterConfig,
          workspacePath: agentWorkspace,
          workspaceRoot: agentWorkspace,
          openclawWorkspace: agentWorkspace,
          cwd: agentWorkspace,
          instructionsFilePath: safeJoinWorkspace(agentWorkspace, "SOUL.md"),
          agentsMdPath: safeJoinWorkspace(agentWorkspace, "AGENTS.md"),
        },
      });
    }
  }

  async function listInstances(generatedDir: string): Promise<InstanceSummary[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(generatedDir);
    } catch {
      return [];
    }

    const summaries: InstanceSummary[] = [];

    for (const entry of entries) {
      const manifestPath = path.join(generatedDir, entry, "instance.manifest.yaml");
      if (!(await fileExists(manifestPath))) continue;

      try {
        const manifest = await readYaml<InstanceManifest>(manifestPath);
        summaries.push({
          companyId: manifest.companyId,
          companyName: manifest.companyName,
          openclawStatus: manifest.openclaw?.status ?? "not_provisioned",
          paperclipStatus: manifest.paperclip?.status ?? "not_imported",
          lastSync: manifest.sync?.lastSyncAt ?? null,
        });
      } catch {
        // Skip malformed manifests
      }
    }

    return summaries;
  }

  async function getManifest(generatedDir: string, companySlug: string): Promise<InstanceManifest> {
    const manifestPath = path.join(generatedDir, companySlug, "instance.manifest.yaml");
    if (!(await fileExists(manifestPath))) {
      throw notFound(`Instance manifest not found for ${companySlug}`);
    }
    return readYaml<InstanceManifest>(manifestPath);
  }

  async function getBlueprint(generatedDir: string, companySlug: string): Promise<string> {
    const blueprintPath = path.join(generatedDir, companySlug, "company.blueprint.yaml");
    if (!(await fileExists(blueprintPath))) {
      throw notFound(`Blueprint not found for ${companySlug}`);
    }
    return fs.readFile(blueprintPath, "utf8");
  }

  async function validateConnection(
    generatedDir: string,
    companySlug: string,
    workspacePath: string,
  ): Promise<ConnectionValidation> {
    const checks: ConnectionCheck[] = [];
    const companyDir = path.join(generatedDir, companySlug);

    // Check workspace path exists
    if (await dirExists(workspacePath)) {
      checks.push({ name: "workspace_exists", status: "pass", message: "Workspace directory exists" });
    } else {
      checks.push({ name: "workspace_exists", status: "fail", message: `Workspace not found: ${workspacePath}` });
    }

    // Check openclaw directory exists in generated output
    const openclawDir = path.join(companyDir, "openclaw");
    if (await dirExists(openclawDir)) {
      checks.push({ name: "openclaw_dir_exists", status: "pass", message: "OpenClaw directory exists in generated output" });
    } else {
      checks.push({ name: "openclaw_dir_exists", status: "fail", message: "OpenClaw directory not found in generated output" });
      return { workspacePath, checks, overallStatus: "fail" };
    }

    // Check openclaw-agents-config.json exists
    const configPath = path.join(openclawDir, "openclaw-agents-config.json");
    if (await fileExists(configPath)) {
      checks.push({ name: "agents_config_exists", status: "pass", message: "openclaw-agents-config.json found" });
    } else {
      checks.push({ name: "agents_config_exists", status: "fail", message: "openclaw-agents-config.json not found" });
    }

    // Check role folders and their 6 files
    let roleDirs: string[];
    try {
      const allEntries = await fs.readdir(openclawDir, { withFileTypes: true });
      roleDirs = allEntries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      roleDirs = [];
    }

    if (roleDirs.length === 0) {
      checks.push({ name: "role_folders", status: "fail", message: "No role folders found in openclaw directory" });
    } else {
      checks.push({ name: "role_folders", status: "pass", message: `Found ${roleDirs.length} role folder(s)` });

      for (const role of roleDirs) {
        const roleDir = path.join(openclawDir, role);
        const missingFiles: string[] = [];
        for (const file of OPENCLAW_FILES) {
          if (!(await fileExists(path.join(roleDir, file)))) {
            missingFiles.push(file);
          }
        }
        if (missingFiles.length === 0) {
          checks.push({ name: `role_${role}_files`, status: "pass", message: `All 6 files present for role ${role}` });
        } else {
          checks.push({
            name: `role_${role}_files`,
            status: "fail",
            message: `Missing files for role ${role}: ${missingFiles.join(", ")}`,
          });
        }
      }
    }

    const overallStatus = checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "pass";

    return { workspacePath, checks, overallStatus };
  }

  async function importToPaperclip(
    generatedDir: string,
    companySlug: string,
  ): Promise<{ companyId: string; agentIdMap: Record<string, string> }> {
    const bundlePath = path.join(generatedDir, companySlug, "paperclip", "import_bundle");
    const manifestPath = path.join(bundlePath, "paperclip.manifest.json");

    if (!(await fileExists(manifestPath))) {
      throw notFound(`Import bundle not found for ${companySlug}`);
    }

    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest: CompanyPortabilityManifest = portabilityManifestSchema.parse(JSON.parse(manifestRaw));

    // Read all referenced files
    const files: Record<string, string> = {};
    if (manifest.company?.path) {
      const filePath = path.join(bundlePath, manifest.company.path);
      if (await fileExists(filePath)) {
        files[manifest.company.path] = await fs.readFile(filePath, "utf8");
      }
    }
    for (const agent of manifest.agents) {
      const filePath = path.join(bundlePath, agent.path);
      if (await fileExists(filePath)) {
        files[agent.path] = await fs.readFile(filePath, "utf8");
      }
    }

    const result = await portability.importBundle(
      {
        source: { type: "inline", manifest, files },
        target: { mode: "new_company" },
        collisionStrategy: "replace",
      },
      null,
    );

    const agentIdMap: Record<string, string> = {};
    for (const agent of result.agents) {
      if (agent.id) {
        agentIdMap[agent.slug] = agent.id;
      }
    }

    // Update instance manifest with paperclip linkage
    const instanceManifestPath = path.join(generatedDir, companySlug, "instance.manifest.yaml");
    if (await fileExists(instanceManifestPath)) {
      try {
        const instanceManifest = await readYaml<InstanceManifest>(instanceManifestPath);
        instanceManifest.paperclip = {
          ...instanceManifest.paperclip,
          companyId: result.company.id,
          status: "imported",
          agentIdMap,
        };
        instanceManifest.updatedAt = new Date().toISOString();
        await fs.writeFile(instanceManifestPath, yaml.dump(instanceManifest, { lineWidth: 120 }), "utf8");
        await applyWorkspaceBindingsFromManifest(instanceManifest);
      } catch {
        // Non-fatal: import succeeded but manifest update failed
      }
    }

    return { companyId: result.company.id, agentIdMap };
  }

  async function checkSyncStatus(generatedDir: string, companySlug: string): Promise<SyncState> {
    const companyDir = path.join(generatedDir, companySlug);
    const manifestPath = path.join(companyDir, "instance.manifest.yaml");
    const blueprintPath = path.join(companyDir, "company.blueprint.yaml");
    const driftItems: SyncState["driftItems"] = [];

    if (!(await fileExists(manifestPath))) {
      return { lastSyncAt: null, lastSyncStatus: "never", driftItems: [] };
    }

    const manifest = await readYaml<InstanceManifest>(manifestPath);

    // Check blueprint hash drift
    if (await fileExists(blueprintPath)) {
      const blueprintContent = await fs.readFile(blueprintPath, "utf8");
      const currentHash = computeFileHash(blueprintContent);
      if (manifest.blueprintVersion && manifest.blueprintVersion !== currentHash) {
        driftItems.push({
          type: "blueprint_changed",
          description: "Blueprint file has changed since last sync",
          filePath: blueprintPath,
        });
      }
    } else {
      driftItems.push({
        type: "blueprint_missing",
        description: "Blueprint file is missing",
        filePath: blueprintPath,
      });
    }

    // Check OpenClaw files exist
    const openclawDir = path.join(companyDir, "openclaw");
    if (await dirExists(openclawDir)) {
      const configPath = path.join(openclawDir, "openclaw-agents-config.json");
      if (!(await fileExists(configPath))) {
        driftItems.push({
          type: "config_missing",
          description: "openclaw-agents-config.json is missing",
          filePath: configPath,
        });
      }
    } else {
      driftItems.push({
        type: "openclaw_dir_missing",
        description: "OpenClaw directory is missing from generated output",
        filePath: openclawDir,
      });
    }

    return {
      lastSyncAt: manifest.sync?.lastSyncAt ?? null,
      lastSyncStatus: driftItems.length > 0 ? "partial" : (manifest.sync?.lastSyncStatus ?? "never"),
      driftItems,
    };
  }

  return {
    listInstances,
    getManifest,
    getBlueprint,
    validateConnection,
    importToPaperclip,
    checkSyncStatus,
  };
}
