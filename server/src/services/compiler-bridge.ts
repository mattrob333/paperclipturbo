import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { unprocessable } from "../errors.js";

const COMPILER_ROOT =
  process.env.AGENTORGCOMPILER_ROOT ??
  path.resolve(process.cwd(), "..", "AgentOrgCompiler");

const GENERATED_DIR =
  process.env.AGENTORGCOMPILER_GENERATED_DIR ??
  path.join(COMPILER_ROOT, "generated");

export interface CompileResult {
  status: "success" | "failed";
  outputName: string;
  stdout: string;
  stderr: string;
}

export interface CompiledCompany {
  slug: string;
  hasBlueprint: boolean;
  hasOpenclaw: boolean;
  hasPaperclip: boolean;
  hasDeliveryKit: boolean;
}

export interface ProvisionOptions {
  instanceName?: string;
  environment?: string;
  heartbeatMode?: string;
  fileSyncMode?: string;
}

export interface ProvisionResult {
  status: "success" | "failed";
  stdout: string;
  stderr: string;
}

export interface ValidationResult {
  status: "success" | "failed";
  stdout: string;
  stderr: string;
}

function runPython(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    execFile(
      "python",
      ["-m", "src.main", ...args],
      { cwd, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !("code" in error)) {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: (error as NodeJS.ErrnoException & { code?: number })?.code
            ? 1
            : error
              ? 1
              : 0,
        });
      },
    );
  });
}

export function compilerBridgeService() {
  async function compile(intakePath: string, outputName?: string): Promise<CompileResult> {
    const absoluteIntake = path.isAbsolute(intakePath) ? intakePath : path.resolve(intakePath);
    try {
      await fs.access(absoluteIntake);
    } catch {
      throw unprocessable(`Intake file not found: ${absoluteIntake}`);
    }

    const args = ["compile", absoluteIntake];
    const result = await runPython(args, COMPILER_ROOT);

    const resolvedOutputName = outputName ?? path.basename(absoluteIntake, path.extname(absoluteIntake));

    return {
      status: result.exitCode === 0 ? "success" : "failed",
      outputName: resolvedOutputName,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async function listCompiled(): Promise<CompiledCompany[]> {
    let entries: string[];
    try {
      const dirEntries = await fs.readdir(GENERATED_DIR, { withFileTypes: true });
      entries = dirEntries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }

    const companies: CompiledCompany[] = [];
    for (const slug of entries) {
      const base = path.join(GENERATED_DIR, slug);
      const [hasBlueprint, hasOpenclaw, hasPaperclip, hasDeliveryKit] = await Promise.all([
        fs.access(path.join(base, "company.blueprint.yaml")).then(() => true, () => false),
        fs.access(path.join(base, "openclaw")).then(() => true, () => false),
        fs.access(path.join(base, "paperclip")).then(() => true, () => false),
        fs.access(path.join(base, "delivery-kit")).then(() => true, () => false),
      ]);

      if (hasBlueprint) {
        companies.push({ slug, hasBlueprint, hasOpenclaw, hasPaperclip, hasDeliveryKit });
      }
    }

    return companies;
  }

  async function getBlueprint(companySlug: string): Promise<string> {
    const blueprintPath = path.join(GENERATED_DIR, companySlug, "company.blueprint.yaml");
    try {
      return await fs.readFile(blueprintPath, "utf8");
    } catch {
      throw unprocessable(`Blueprint not found for ${companySlug}`);
    }
  }

  async function provision(
    companySlug: string,
    workspacePath: string,
    options?: ProvisionOptions,
  ): Promise<ProvisionResult> {
    // Invoke the Python CLI provision subcommand (when it exists)
    const args = ["provision", companySlug, "--workspace-path", workspacePath];
    if (options?.instanceName) args.push("--instance-name", options.instanceName);
    if (options?.environment) args.push("--environment", options.environment);
    if (options?.heartbeatMode) args.push("--heartbeat-mode", options.heartbeatMode);
    if (options?.fileSyncMode) args.push("--file-sync-mode", options.fileSyncMode);

    const result = await runPython(args, COMPILER_ROOT);

    return {
      status: result.exitCode === 0 ? "success" : "failed",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async function validate(companySlug: string): Promise<ValidationResult> {
    const args = ["steward", companySlug];
    const result = await runPython(args, COMPILER_ROOT);

    return {
      status: result.exitCode === 0 ? "success" : "failed",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    compile,
    listCompiled,
    getBlueprint,
    provision,
    validate,
  };
}
