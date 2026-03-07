import { GitCompare, Loader2 } from "lucide-react";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { useConfigDiff } from "@/hooks/useRuntime";
import { cn } from "@/lib/utils";

export function DiffViewer({ filePath }: { filePath: string }) {
  const { selectedAgent } = useDeveloperMode();
  const { data: diff, isLoading, error } = useConfigDiff(selectedAgent);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(220,13%,14%)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto text-[hsl(220,13%,30%)] mb-3 animate-spin" />
          <p className="text-[12px] text-[hsl(220,13%,45%)]">Loading diff...</p>
        </div>
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(220,13%,14%)]">
        <div className="text-center max-w-sm px-4">
          <GitCompare className="h-12 w-12 mx-auto text-[hsl(220,13%,30%)] mb-3" />
          <p className="text-[13px] text-[hsl(220,13%,50%)] font-medium mb-1">
            Diff view
          </p>
          <p className="text-[11px] text-[hsl(220,13%,40%)]">
            {error
              ? "Failed to load config diff"
              : `No config revisions found for ${filePath.split("/").pop()}`}
          </p>
        </div>
      </div>
    );
  }

  if (diff.changedKeys.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(220,13%,14%)]">
        <div className="text-center max-w-sm px-4">
          <GitCompare className="h-12 w-12 mx-auto text-[hsl(220,13%,30%)] mb-3" />
          <p className="text-[13px] text-[hsl(220,13%,50%)] font-medium mb-1">
            No changes
          </p>
          <p className="text-[11px] text-[hsl(220,13%,40%)]">
            Current config matches the previous revision.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[hsl(220,13%,14%)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[hsl(220,13%,20%)] text-[11px] text-[hsl(220,13%,50%)] shrink-0">
        <span>{diff.changedKeys.length} changed key{diff.changedKeys.length !== 1 ? "s" : ""}</span>
        {diff.source && <span className="text-[hsl(220,13%,35%)]">via {diff.source}</span>}
        {diff.createdAt && (
          <span className="ml-auto text-[hsl(220,13%,35%)]">
            {new Date(diff.createdAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-y-auto scrollbar-auto-hide font-mono text-[12px] p-3">
        {diff.changedKeys.map((key) => {
          const beforeVal = diff.before[key];
          const afterVal = diff.after[key];
          const beforeStr = beforeVal !== undefined ? JSON.stringify(beforeVal, null, 2) : undefined;
          const afterStr = afterVal !== undefined ? JSON.stringify(afterVal, null, 2) : undefined;

          return (
            <div key={key} className="mb-4">
              <div className="text-[11px] font-semibold text-[hsl(220,13%,60%)] mb-1">{key}</div>
              {beforeStr !== undefined && (
                <div className="flex">
                  <span className="text-red-400/70 select-none w-5 shrink-0 text-right mr-2">-</span>
                  <pre className={cn(
                    "text-red-300/80 bg-red-500/10 rounded px-1.5 py-0.5 whitespace-pre-wrap break-all flex-1",
                  )}>
                    {beforeStr}
                  </pre>
                </div>
              )}
              {afterStr !== undefined && (
                <div className="flex mt-0.5">
                  <span className="text-green-400/70 select-none w-5 shrink-0 text-right mr-2">+</span>
                  <pre className={cn(
                    "text-green-300/80 bg-green-500/10 rounded px-1.5 py-0.5 whitespace-pre-wrap break-all flex-1",
                  )}>
                    {afterStr}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
