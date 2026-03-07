import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.";

export function OpenCodeLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Agent instructions file" hint={instructionsFileHint}>
        <div className="flex items-center gap-2">
          <DraftInput
            value={
              isCreate
                ? values!.instructionsFilePath ?? ""
                : eff(
                    "adapterConfig",
                    "instructionsFilePath",
                    String(config.instructionsFilePath ?? ""),
                  )
            }
            onCommit={(v) =>
              isCreate
                ? set!({ instructionsFilePath: v })
                : mark("adapterConfig", "instructionsFilePath", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="/absolute/path/to/AGENTS.md"
          />
          <ChoosePathButton />
        </div>
      </Field>

      <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] space-y-1">
        <p className="font-medium text-xs">Provider credentials</p>
        <p className="text-muted-foreground">
          OpenCode discovers models from configured providers. Each provider needs its own API key:
        </p>
        <ul className="text-muted-foreground list-disc ml-4 space-y-0.5">
          <li>
            <span className="font-mono">ANTHROPIC_API_KEY</span> for Claude models
          </li>
          <li>
            <span className="font-mono">OPENAI_API_KEY</span> for OpenAI models
          </li>
          <li>
            <span className="font-mono">OPENROUTER_API_KEY</span> for OpenRouter models
          </li>
          <li>
            <span className="font-mono">GOOGLE_API_KEY</span> for Google models
          </li>
        </ul>
        <p className="text-muted-foreground/80 mt-1">
          Add provider keys as secret references in the Environment Variables section below,
          or run <span className="font-mono">opencode auth login</span> in the agent's working directory.
        </p>
        <p className="text-muted-foreground/80">
          If no models appear in the dropdown, ensure at least one provider is authenticated.
        </p>
      </div>
    </>
  );
}
