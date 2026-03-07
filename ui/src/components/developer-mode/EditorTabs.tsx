import { X, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/context/DeveloperModeContext";

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useDeveloperMode();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center border-b border-[hsl(220,13%,20%)] bg-[hsl(220,13%,14%)] overflow-x-auto scrollbar-auto-hide">
      {openFiles.map((filePath) => {
        const fileName = filePath.split("/").pop() ?? filePath;
        const isActive = filePath === activeFile;

        return (
          <div
            key={filePath}
            className={cn(
              "group flex items-center gap-1.5 border-r border-[hsl(220,13%,20%)] px-3 py-1.5 text-[13px] cursor-pointer shrink-0",
              isActive
                ? "bg-[hsl(220,13%,16%)] text-white border-t-2 border-t-[hsl(210,70%,55%)]"
                : "bg-[hsl(220,13%,12%)] text-[hsl(220,13%,55%)] hover:bg-[hsl(220,13%,15%)] border-t-2 border-t-transparent",
            )}
            onClick={() => setActiveFile(filePath)}
          >
            <File className="h-3.5 w-3.5 shrink-0 text-[hsl(220,13%,45%)]" />
            <span className="truncate max-w-[140px]">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(filePath);
              }}
              className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[hsl(220,13%,25%)] transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
