import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Code2, Monitor, Save, ShieldCheck } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { DeveloperModeProvider } from "@/context/DeveloperModeContext";
import { FileTree } from "@/components/developer-mode/FileTree";
import { EditorPane } from "@/components/developer-mode/EditorPane";
import { ContextPanel } from "@/components/developer-mode/ContextPanel";
import { ClaudeDock } from "@/components/developer-mode/ClaudeDock";
import { useCompany } from "@/context/CompanyContext";

function DevModeTopBar() {
  const { selectedCompany } = useCompany();

  return (
    <div className="flex items-center h-10 px-3 border-b border-[hsl(220,13%,20%)] bg-[hsl(220,13%,10%)] shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2">
        <Link to="../dashboard">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,18%)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Code2 className="h-4 w-4 text-[hsl(210,70%,55%)]" />
        <span className="text-[13px] font-semibold text-white">Paperclip</span>
        <span className="text-[11px] text-[hsl(220,13%,45%)] font-medium ml-1">
          Developer Mode
        </span>
      </div>

      {/* Center - Breadcrumb */}
      <div className="flex-1 flex items-center justify-center gap-1.5 text-[12px]">
        <span className="text-[hsl(220,13%,50%)]">
          {selectedCompany?.name ?? "Company"}
        </span>
        <span className="text-[hsl(220,13%,30%)]">/</span>
        <span className="text-[hsl(220,13%,70%)]">Cognitive Blueprint</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 mr-3">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-[11px] text-[hsl(220,13%,50%)]">Synced</span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="text-[11px] text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,18%)]"
        >
          <ShieldCheck className="h-3 w-3 mr-1" />
          Validate
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-[11px] text-[hsl(220,13%,55%)] hover:text-white hover:bg-[hsl(220,13%,18%)]"
        >
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Link to="../dashboard">
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] text-[hsl(210,70%,55%)] hover:text-white hover:bg-[hsl(220,13%,18%)]"
          >
            <Monitor className="h-3 w-3 mr-1" />
            Visual Mode
          </Button>
        </Link>
      </div>
    </div>
  );
}

function DevModeLayout() {
  return (
    <div className="flex h-dvh flex-col bg-[hsl(220,13%,14%)] text-[hsl(220,13%,80%)]">
      <DevModeTopBar />
      <div className="flex flex-1 min-h-0">
        {/* File Tree */}
        <div className="w-60 shrink-0 border-r border-[hsl(220,13%,20%)]">
          <FileTree />
        </div>

        {/* Center + Right */}
        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex flex-1 min-h-0">
            {/* Editor */}
            <div className="flex flex-1 min-w-0 flex-col">
              <div className="flex-1 min-w-0 min-h-0">
                <EditorPane />
              </div>

              {/* Claude Dock */}
              <ClaudeDock />
            </div>

            {/* Inspector */}
            <div className="w-[280px] shrink-0 border-l border-[hsl(220,13%,20%)]">
              <ContextPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeveloperMode() {
  const [searchParams] = useSearchParams();
  const agentParam = searchParams.get("agent");

  return (
    <DeveloperModeProvider initialAgent={agentParam}>
      <DevModeLayout />
    </DeveloperModeProvider>
  );
}
