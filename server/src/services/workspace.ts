import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FileNode, FileContent } from "@paperclipai/shared";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_DEPTH = 10;

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".mp3", ".mp4", ".wav", ".ogg", ".flac", ".avi", ".mov", ".mkv",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pyc", ".class", ".o", ".obj",
  ".sqlite", ".db",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".hg", ".svn",
  "__pycache__", ".pytest_cache", ".mypy_cache",
  "dist", "build", ".next", ".nuxt",
  ".venv", "venv", "env",
  "coverage", ".nyc_output",
  ".DS_Store", "Thumbs.db",
]);

function getFileType(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".yaml": "yaml", ".yml": "yaml",
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".sh": "shell", ".bash": "shell",
    ".sql": "sql",
    ".xml": "xml",
    ".toml": "toml",
    ".env": "env",
    ".txt": "text",
    ".csv": "csv",
  };
  return map[ext.toLowerCase()] ?? "text";
}

/**
 * Validate that a relative path does not escape the workspace root.
 * Returns the resolved absolute path.
 * Throws if path traversal is detected.
 */
function validateRelativePath(workspaceRoot: string, relativePath: string): string {
  // Normalize both to forward slashes for consistent comparison
  const normalizedRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(normalizedRoot, relativePath);

  // On Windows, path.resolve handles backslashes, but we need consistent comparison
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new WorkspaceError("Path traversal detected", "path_traversal");
  }

  return resolved;
}

export class WorkspaceError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

export function workspaceService() {
  async function resolveWorkspaceRoot(adapterConfig: Record<string, unknown>): Promise<string | null> {
    const candidates = [
      adapterConfig?.cwd,
      adapterConfig?.workspacePath,
      adapterConfig?.workspaceRoot,
      adapterConfig?.openclawWorkspace,
      adapterConfig?.agentWorkspace,
      adapterConfig?.instructionsFilePath,
      adapterConfig?.agentsMdPath,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => path.resolve(value.trim()));

    for (const candidate of candidates) {
      const target = path.extname(candidate) ? path.dirname(candidate) : candidate;
      try {
        const stat = await fsp.stat(target);
        if (stat.isDirectory()) {
          return target;
        }
      } catch {
        // Try next candidate.
      }
    }

    return null;
  }

  async function listDirectory(
    workspaceRoot: string,
    relativePath: string,
    depth: number = 3,
  ): Promise<FileNode[]> {
    const absPath = validateRelativePath(workspaceRoot, relativePath);
    const effectiveDepth = Math.min(depth, MAX_DEPTH);

    try {
      const entries = await fsp.readdir(absPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      // Sort: directories first, then alphabetical
      const sorted = entries
        .filter((e) => !IGNORED_DIRS.has(e.name) && !e.name.startsWith("."))
        .sort((a, b) => {
          const aDir = a.isDirectory() ? 0 : 1;
          const bDir = b.isDirectory() ? 0 : 1;
          if (aDir !== bDir) return aDir - bDir;
          return a.name.localeCompare(b.name);
        });

      for (const entry of sorted) {
        const entryRelPath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          const children =
            effectiveDepth > 1
              ? await listDirectory(workspaceRoot, entryRelPath, effectiveDepth - 1)
              : undefined;

          nodes.push({
            name: entry.name,
            path: entryRelPath,
            type: "directory",
            children,
          });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          let size: number | undefined;
          let modifiedAt: string | undefined;

          try {
            const stat = await fsp.stat(path.join(absPath, entry.name));
            size = stat.size;
            modifiedAt = stat.mtime.toISOString();
          } catch {
            // If stat fails, just skip metadata
          }

          nodes.push({
            name: entry.name,
            path: entryRelPath,
            type: "file",
            size,
            modifiedAt,
            extension: ext || undefined,
          });
        }
      }

      return nodes;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new WorkspaceError(`Directory not found: ${relativePath || "/"}`, "not_found");
      }
      if ((err as NodeJS.ErrnoException).code === "EACCES") {
        throw new WorkspaceError("Permission denied", "permission_denied");
      }
      throw err;
    }
  }

  async function readFile(
    workspaceRoot: string,
    relativePath: string,
  ): Promise<FileContent> {
    if (!relativePath || relativePath.trim().length === 0) {
      throw new WorkspaceError("File path is required", "read_error");
    }

    const absPath = validateRelativePath(workspaceRoot, relativePath);
    const ext = path.extname(absPath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      throw new WorkspaceError(
        `Binary file cannot be displayed: ${path.basename(absPath)}`,
        "binary_file",
      );
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(absPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new WorkspaceError(`File not found: ${relativePath}`, "not_found");
      }
      if ((err as NodeJS.ErrnoException).code === "EACCES") {
        throw new WorkspaceError("Permission denied", "permission_denied");
      }
      throw err;
    }

    if (!stat.isFile()) {
      throw new WorkspaceError(`Not a file: ${relativePath}`, "read_error");
    }

    if (stat.size > MAX_FILE_SIZE) {
      throw new WorkspaceError(
        `File too large: ${(stat.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`,
        "file_too_large",
      );
    }

    let content: string;
    try {
      content = await fsp.readFile(absPath, "utf-8");
    } catch {
      throw new WorkspaceError(
        `Cannot read file: ${relativePath}`,
        "read_error",
      );
    }

    // Detect binary content by checking for null bytes
    if (content.includes("\0")) {
      throw new WorkspaceError(
        `Binary file cannot be displayed: ${path.basename(absPath)}`,
        "binary_file",
      );
    }

    return {
      content,
      path: relativePath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      fileType: getFileType(ext),
    };
  }

  return {
    resolveWorkspaceRoot,
    listDirectory,
    readFile,
  };
}
