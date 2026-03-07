import { useEffect, useState } from "react";
import { Code2, Eye, AlertCircle, FileWarning, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { useFileContent } from "@/hooks/useWorkspace";
import { EditorTabs } from "./EditorTabs";
import { DiffViewer } from "./DiffViewer";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/client";

function JsonHighlighter({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="font-mono text-sm leading-6">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-12 shrink-0 text-right pr-4 select-none text-[hsl(220,13%,35%)]">
            {i + 1}
          </span>
          <span className="flex-1 whitespace-pre">
            <JsonLine line={line} />
          </span>
        </div>
      ))}
    </div>
  );
}

function JsonLine({ line }: { line: string }) {
  const highlighted = line
    .replace(
      /("(?:[^"\\]|\\.)*")\s*:/g,
      '<span class="text-[hsl(210,60%,70%)]">$1</span>:',
    )
    .replace(
      /:\s*("(?:[^"\\]|\\.)*")/g,
      ': <span class="text-[hsl(120,40%,60%)]">$1</span>',
    )
    .replace(
      /:\s*(true|false)/g,
      ': <span class="text-[hsl(30,80%,65%)]">$1</span>',
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span class="text-[hsl(60,60%,65%)]">$1</span>',
    )
    .replace(
      /:\s*(null)/g,
      ': <span class="text-[hsl(0,50%,60%)]">$1</span>',
    );

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="font-mono text-sm leading-6">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-12 shrink-0 text-right pr-4 select-none text-[hsl(220,13%,35%)]">
            {i + 1}
          </span>
          <span className="flex-1 whitespace-pre-wrap">
            <MdLine line={line} />
          </span>
        </div>
      ))}
    </div>
  );
}

function MdLine({ line }: { line: string }) {
  if (line.startsWith("# "))
    return <span className="text-[hsl(210,70%,70%)] font-bold">{line}</span>;
  if (line.startsWith("## "))
    return <span className="text-[hsl(210,60%,65%)] font-semibold">{line}</span>;
  if (line.startsWith("### "))
    return <span className="text-[hsl(210,50%,60%)]">{line}</span>;
  if (line.startsWith("- **"))
    return (
      <span>
        <span className="text-[hsl(220,13%,55%)]">- </span>
        <span className="text-[hsl(35,60%,65%)]">{line.slice(2)}</span>
      </span>
    );
  if (line.startsWith("- "))
    return (
      <span>
        <span className="text-[hsl(220,13%,55%)]">- </span>
        <span className="text-[hsl(220,13%,80%)]">{line.slice(2)}</span>
      </span>
    );
  if (/^\d+\.\s/.test(line)) {
    const match = line.match(/^(\d+\.)\s(.*)$/);
    if (match)
      return (
        <span>
          <span className="text-[hsl(220,13%,55%)]">{match[1]} </span>
          <span className="text-[hsl(220,13%,80%)]">{match[2]}</span>
        </span>
      );
  }
  return <span className="text-[hsl(220,13%,75%)]">{line}</span>;
}

function CodeHighlighter({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="font-mono text-sm leading-6">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-12 shrink-0 text-right pr-4 select-none text-[hsl(220,13%,35%)]">
            {i + 1}
          </span>
          <span className="flex-1 whitespace-pre text-[hsl(220,13%,75%)]">
            {line}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full items-center justify-center bg-[hsl(220,13%,14%)]">
      <div className="text-center">
        <Code2 className="h-16 w-16 mx-auto text-[hsl(220,13%,25%)] mb-4" />
        <p className="text-[hsl(220,13%,45%)] text-sm">
          Select a file from the explorer to view its contents
        </p>
      </div>
    </div>
  );
}

function FileLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-[hsl(220,13%,14%)]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 mx-auto text-[hsl(220,13%,40%)] mb-3 animate-spin" />
        <p className="text-[hsl(220,13%,45%)] text-sm">Loading file...</p>
      </div>
    </div>
  );
}

function FileErrorState({ error }: { error: unknown }) {
  const apiErr = error as ApiError | undefined;
  const body = apiErr?.body as { code?: string; error?: string } | null;
  const code = body?.code;
  const message = body?.error ?? apiErr?.message ?? "Failed to load file";

  const isBinary = code === "binary_file";
  const isTooLarge = code === "file_too_large";

  return (
    <div className="flex h-full items-center justify-center bg-[hsl(220,13%,14%)]">
      <div className="text-center max-w-md px-4">
        {isBinary ? (
          <FileWarning className="h-12 w-12 mx-auto text-[hsl(35,60%,55%)] mb-3" />
        ) : (
          <AlertCircle className="h-12 w-12 mx-auto text-red-400/60 mb-3" />
        )}
        <p className="text-[hsl(220,13%,60%)] text-sm font-medium mb-1">
          {isBinary
            ? "Binary file"
            : isTooLarge
              ? "File too large"
              : "Cannot read file"}
        </p>
        <p className="text-[hsl(220,13%,40%)] text-[12px]">{message}</p>
      </div>
    </div>
  );
}

export function EditorPane() {
  const { activeFile, selectedAgent, viewMode, setViewMode } = useDeveloperMode();
  const [renderMd, setRenderMd] = useState(false);

  const { data, isLoading, error } = useFileContent(selectedAgent, activeFile);

  const content = data?.content ?? "";
  const fileType = data?.fileType ?? "";

  useEffect(() => {
    setRenderMd(false);
  }, [activeFile]);

  const isMarkdown = activeFile?.endsWith(".md") ?? false;
  const isJson = fileType === "json" || (activeFile?.endsWith(".json") ?? false);

  if (viewMode === "diff" && activeFile) {
    return (
      <div className="flex h-full flex-col bg-[hsl(220,13%,14%)]">
        <EditorTabs />
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(220,13%,20%)] bg-[hsl(220,13%,13%)]">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setViewMode("edit")}
            className="text-[11px] text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,20%)]"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] bg-[hsl(220,13%,22%)] text-white"
          >
            Diff
          </Button>
        </div>
        <DiffViewer filePath={activeFile} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[hsl(220,13%,14%)]">
      <EditorTabs />
      {activeFile ? (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(220,13%,20%)] bg-[hsl(220,13%,13%)]">
            <Button
              variant="ghost"
              size="xs"
              className="text-[11px] bg-[hsl(220,13%,22%)] text-white"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setViewMode("diff")}
              className="text-[11px] text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,20%)]"
            >
              Diff
            </Button>
            {isMarkdown && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setRenderMd((p) => !p)}
                className={cn(
                  "text-[11px] ml-auto",
                  renderMd
                    ? "bg-[hsl(220,13%,22%)] text-white"
                    : "text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,20%)]",
                )}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
            )}
            {data && (
              <span className="ml-auto text-[10px] text-[hsl(220,13%,40%)]">
                {(data.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <FileLoadingState />
            ) : error ? (
              <FileErrorState error={error} />
            ) : isJson ? (
              <JsonHighlighter content={content} />
            ) : isMarkdown && renderMd ? (
              <MarkdownRenderer content={content} />
            ) : isMarkdown && !renderMd ? (
              <div className="font-mono text-sm leading-6 whitespace-pre-wrap text-[hsl(220,13%,75%)]">
                {content}
              </div>
            ) : (
              <CodeHighlighter content={content} />
            )}
          </div>
        </>
      ) : (
        <EmptyEditor />
      )}
    </div>
  );
}
