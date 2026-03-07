import { useState, useCallback, useEffect } from "react";
import { ChevronRight, File, Folder, FolderOpen, AlertCircle, FolderSearch, Settings } from "lucide-react";
import type { FileNode } from "@paperclipai/shared";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { useWorkspaceTree } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/client";

function FileTreeSkeleton() {
  return (
    <div className="px-2 py-3 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
          style={{ paddingLeft: `${(i % 3) * 16 + 8}px` }}
        >
          <div className="h-3 w-3 rounded bg-[hsl(220,13%,22%)] animate-pulse" />
          <div
            className="h-3 rounded bg-[hsl(220,13%,22%)] animate-pulse"
            style={{ width: `${60 + Math.random() * 80}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function FileTreeItem({ node, depth }: { node: FileNode; depth: number }) {
  const { activeFile, openFile } = useDeveloperMode();
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = node.type === "file" && activeFile === node.path;

  const handleClick = useCallback(() => {
    if (node.type === "directory") {
      setExpanded((prev) => !prev);
    } else {
      openFile(node.path);
    }
  }, [node, openFile]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1 py-[3px] pr-2 text-[13px] hover:bg-[hsl(220,13%,18%)] transition-colors",
          isActive && "bg-[hsl(220,13%,20%)] text-white",
          !isActive && "text-[hsl(220,13%,75%)]",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === "directory" ? (
          <>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                expanded && "rotate-90",
              )}
            />
            {expanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-[hsl(35,80%,60%)]" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-[hsl(35,80%,60%)]" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <File className="h-4 w-4 shrink-0 text-[hsl(220,13%,55%)]" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === "directory" && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoAgentState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
      <FolderSearch className="h-10 w-10 text-[hsl(220,13%,30%)] mb-3" />
      <p className="text-[13px] text-[hsl(220,13%,50%)] mb-1 font-medium">
        No agent selected
      </p>
      <p className="text-[11px] text-[hsl(220,13%,40%)]">
        Select an agent to browse its workspace files
      </p>
    </div>
  );
}

function NoWorkspaceState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
      <Settings className="h-10 w-10 text-[hsl(220,13%,30%)] mb-3" />
      <p className="text-[13px] text-[hsl(220,13%,50%)] mb-1 font-medium">
        No workspace configured
      </p>
      <p className="text-[11px] text-[hsl(220,13%,40%)]">
        Configure a workspace path (cwd) in this agent's adapter settings to browse files
      </p>
    </div>
  );
}

function WorkspaceErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
      <AlertCircle className="h-10 w-10 text-red-400/60 mb-3" />
      <p className="text-[13px] text-red-400/80 mb-1 font-medium">
        Workspace error
      </p>
      <p className="text-[11px] text-[hsl(220,13%,40%)]">
        {message}
      </p>
    </div>
  );
}

function EmptyDirectoryState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
      <Folder className="h-10 w-10 text-[hsl(220,13%,30%)] mb-3" />
      <p className="text-[13px] text-[hsl(220,13%,50%)]">
        Workspace is empty
      </p>
    </div>
  );
}

export function FileTree() {
  const { selectedAgent, setWorkspaceRoot, setWorkspaceError } = useDeveloperMode();

  const { data, isLoading, error } = useWorkspaceTree(selectedAgent);

  useEffect(() => {
    if (!selectedAgent) {
      setWorkspaceRoot(null);
      setWorkspaceError(null);
    }
  }, [selectedAgent, setWorkspaceRoot, setWorkspaceError]);

  useEffect(() => {
    if (data?.root) {
      setWorkspaceRoot(data.root);
      setWorkspaceError(null);
      return;
    }

    if (!isLoading && !error) {
      setWorkspaceRoot(null);
      setWorkspaceError(null);
    }
  }, [data?.root, error, isLoading, setWorkspaceRoot, setWorkspaceError]);

  useEffect(() => {
    if (error) {
      setWorkspaceRoot(null);
      const apiErr = error as ApiError;
      const body = apiErr.body as { code?: string; error?: string } | null;
      setWorkspaceError(body?.error ?? apiErr.message ?? "Failed to load workspace");
    }
  }, [error, setWorkspaceRoot, setWorkspaceError]);

  // Determine error state
  const errorBody = error ? ((error as ApiError).body as { code?: string; error?: string } | null) : null;
  const isNoWorkspace = errorBody?.code === "no_workspace";

  return (
    <div className="flex h-full flex-col bg-[hsl(220,13%,12%)]">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-[hsl(220,13%,20%)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,50%)] px-1">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-auto-hide py-1">
        {!selectedAgent ? (
          <NoAgentState />
        ) : isLoading ? (
          <FileTreeSkeleton />
        ) : isNoWorkspace ? (
          <NoWorkspaceState />
        ) : error ? (
          <WorkspaceErrorState message={errorBody?.error ?? "Failed to load workspace"} />
        ) : data && data.nodes.length === 0 ? (
          <EmptyDirectoryState />
        ) : data ? (
          data.nodes.map((node) => (
            <FileTreeItem key={node.path} node={node} depth={0} />
          ))
        ) : null}
      </div>
    </div>
  );
}
