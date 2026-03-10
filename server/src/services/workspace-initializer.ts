import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, "../openclaw-baseline");

interface InitWorkspaceParams {
  workspacePath: string;
  companyName: string;
  companySlug: string;
  companyDescription?: string;
  agentName?: string;
}

interface InitWorkspaceResult {
  filesCreated: string[];
  workspacePath: string;
}

function substituteTemplateVars(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export function workspaceInitializerService() {
  function getBaselineDir(): string {
    return BASELINE_DIR;
  }

  function baselineExists(): boolean {
    return fs.existsSync(BASELINE_DIR);
  }

  async function initializeWorkspace(params: InitWorkspaceParams): Promise<InitWorkspaceResult> {
    const {
      workspacePath,
      companyName,
      companySlug,
      companyDescription = "A company managed by Paperclip.",
      agentName = "Executive Assistant",
    } = params;

    const templateVars: Record<string, string> = {
      COMPANY_NAME: companyName,
      COMPANY_SLUG: companySlug,
      COMPANY_DESCRIPTION: companyDescription,
      AGENT_NAME: agentName,
      CREATED_DATE: new Date().toISOString().split("T")[0],
    };

    if (!baselineExists()) {
      throw new Error(`OpenClaw baseline template not found at ${BASELINE_DIR}`);
    }

    // Create workspace directory
    await fs.promises.mkdir(workspacePath, { recursive: true });

    const filesCreated: string[] = [];

    // Recursively copy and substitute
    async function copyDir(srcDir: string, destDir: string): Promise<void> {
      await fs.promises.mkdir(destDir, { recursive: true });
      const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          const content = await fs.promises.readFile(srcPath, "utf-8");
          const substituted = substituteTemplateVars(content, templateVars);
          await fs.promises.writeFile(destPath, substituted, "utf-8");
          filesCreated.push(path.relative(workspacePath, destPath));
        }
      }
    }

    await copyDir(BASELINE_DIR, workspacePath);

    return { filesCreated, workspacePath };
  }

  return {
    getBaselineDir,
    baselineExists,
    initializeWorkspace,
  };
}
