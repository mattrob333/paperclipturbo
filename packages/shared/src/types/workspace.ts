export interface FileNode {
  name: string;
  /** Relative path from workspace root */
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  extension?: string;
  children?: FileNode[];
}

export interface FileContent {
  content: string;
  path: string;
  size: number;
  modifiedAt: string;
  fileType: string;
}

export interface WorkspaceTree {
  root: string;
  agentId: string;
  nodes: FileNode[];
}

export interface WorkspaceError {
  error: string;
  code: "no_workspace" | "not_found" | "permission_denied" | "path_traversal" | "file_too_large" | "binary_file" | "read_error";
}
