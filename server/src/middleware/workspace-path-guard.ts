import path from "node:path";

/**
 * Validate that a workspace path is within an allowed base directory.
 *
 * In `local_trusted` mode, all paths are allowed (user has local access).
 * In `authenticated` mode, paths must be under an allowed root.
 *
 * Allowed roots come from:
 * 1. PAPERCLIP_ALLOWED_WORKSPACE_ROOTS env var (colon-separated on Linux, semicolon-separated on Windows)
 * 2. Defaults to the user's home directory + "/openclaw-workspaces" if not set
 */

const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";

function getAllowedRoots(): string[] {
  const envRoots = process.env.PAPERCLIP_ALLOWED_WORKSPACE_ROOTS;
  if (envRoots) {
    return envRoots.split(PATH_SEPARATOR).map(r => path.resolve(r.trim())).filter(Boolean);
  }
  // Default: allow common workspace locations
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return [
    path.resolve(home, "openclaw-workspaces"),
    path.resolve(home, ".paperclip"),
    path.resolve(process.cwd(), "data"),
  ];
}

/**
 * Validate a user-supplied workspace path.
 * Returns the normalized absolute path if valid.
 * Throws an error if the path is outside allowed roots.
 */
export function validateWorkspacePath(
  inputPath: string,
  deploymentMode: string,
): string {
  const resolved = path.resolve(inputPath);

  // In local_trusted mode, allow all paths
  if (deploymentMode === "local_trusted") {
    return resolved;
  }

  // In authenticated mode, validate against allowed roots
  const allowedRoots = getAllowedRoots();
  const isAllowed = allowedRoots.some(root =>
    resolved.startsWith(root + path.sep) || resolved === root
  );

  if (!isAllowed) {
    throw Object.assign(
      new Error(
        "Workspace path is not within an allowed directory. " +
        "Set PAPERCLIP_ALLOWED_WORKSPACE_ROOTS to configure allowed base directories."
      ),
      { status: 403 }
    );
  }

  return resolved;
}
