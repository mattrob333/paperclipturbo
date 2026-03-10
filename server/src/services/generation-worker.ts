import fs from "node:fs";
import path from "node:path";

interface GenerationInput {
  companyName: string;
  companyDescription?: string;
  workspacePath: string;
  anthropicApiKey?: string;
}

interface GenerationProgress {
  phase: string;
  message: string;
  filesWritten: string[];
}

interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  error?: string;
}

export function generationWorkerService() {

  /**
   * Call Claude to generate enhanced workspace content.
   * Uses direct HTTP to Anthropic Messages API.
   */
  async function callClaude(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find(b => b.type === "text");
    return textBlock?.text ?? "";
  }

  /**
   * Generate enhanced SOUL.md for an agent role
   */
  function buildSoulPrompt(companyName: string, companyDescription: string, roleName: string, roleFolder: string): { system: string; user: string } {
    return {
      system: `You are a workspace architect for an AI agent management platform called Paperclip. You generate operating instructions (SOUL.md files) for AI agent roles within company workspaces. Your output should be the FULL content of a SOUL.md file in markdown format. Do not include any preamble or explanation — output ONLY the file content.`,
      user: `Generate a SOUL.md file for the following agent role:

Company: ${companyName}
Company Description: ${companyDescription}
Role: ${roleName}
Role Folder: ${roleFolder}

The SOUL.md should include:
1. A clear role title and mission statement
2. Core responsibilities (3-5 items)
3. Operating principles (how the agent should behave)
4. Decision-making guidelines
5. Communication style
6. Escalation rules (when to involve humans)

Make it specific to the company context and role. Be professional and practical.`,
    };
  }

  /**
   * Generate enhanced IDENTITY.md for an agent role
   */
  function buildIdentityPrompt(companyName: string, companyDescription: string, roleName: string): { system: string; user: string } {
    return {
      system: `You are a workspace architect for an AI agent management platform. You generate identity documents for AI agent roles. Output ONLY the markdown file content, no preamble.`,
      user: `Generate an IDENTITY.md file for this agent role:

Company: ${companyName}
Company Description: ${companyDescription}
Role: ${roleName}

Include:
1. Agent name and title
2. Role summary (2-3 sentences)
3. Key personality traits (professional context)
4. Domain expertise areas
5. Working style preferences

Keep it concise and practical.`,
    };
  }

  /**
   * Run the generation pipeline for a workspace.
   * Reads the openclaw-agents-config.json to discover roles,
   * then generates enhanced content for each role.
   */
  async function generateContent(
    input: GenerationInput,
    onProgress?: (progress: GenerationProgress) => void,
  ): Promise<GenerationResult> {
    const {
      companyName,
      companyDescription = "A company managed by Paperclip.",
      workspacePath,
      anthropicApiKey,
    } = input;

    const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const filesGenerated: string[] = [];

    // If no API key, skip generation and return success with baseline files
    if (!apiKey) {
      onProgress?.({
        phase: "skipped",
        message: "No Anthropic API key configured. Using baseline template files.",
        filesWritten: [],
      });
      return { success: true, filesGenerated: [], error: undefined };
    }

    try {
      // Read agent config to discover roles
      const configPath = path.join(workspacePath, "openclaw-agents-config.json");
      if (!fs.existsSync(configPath)) {
        return {
          success: false,
          filesGenerated: [],
          error: `Agent config not found at ${configPath}`,
        };
      }

      const agentConfig = JSON.parse(await fs.promises.readFile(configPath, "utf-8"));
      const agentDefs: Array<{ name: string; folder: string }> = agentConfig.agents || [];

      onProgress?.({
        phase: "starting",
        message: `Generating content for ${agentDefs.length} agent role(s)`,
        filesWritten: [],
      });

      for (let i = 0; i < agentDefs.length; i++) {
        const agentDef = agentDefs[i];
        const rolePath = path.join(workspacePath, agentDef.folder);

        onProgress?.({
          phase: "generating",
          message: `Generating content for ${agentDef.name} (${i + 1}/${agentDefs.length})`,
          filesWritten: [...filesGenerated],
        });

        // Generate enhanced SOUL.md
        try {
          const soulPrompt = buildSoulPrompt(companyName, companyDescription, agentDef.name, agentDef.folder);
          const soulContent = await callClaude(apiKey, soulPrompt.system, soulPrompt.user);

          if (soulContent.trim()) {
            const soulPath = path.join(rolePath, "SOUL.md");
            await fs.promises.writeFile(soulPath, soulContent, "utf-8");
            filesGenerated.push(`${agentDef.folder}/SOUL.md`);
          }
        } catch (err) {
          onProgress?.({
            phase: "warning",
            message: `Failed to generate SOUL.md for ${agentDef.name}: ${err instanceof Error ? err.message : "unknown error"}`,
            filesWritten: [...filesGenerated],
          });
          // Continue with other files — generation failures are not fatal
        }

        // Generate enhanced IDENTITY.md
        try {
          const identityPrompt = buildIdentityPrompt(companyName, companyDescription, agentDef.name);
          const identityContent = await callClaude(apiKey, identityPrompt.system, identityPrompt.user);

          if (identityContent.trim()) {
            const identityPath = path.join(rolePath, "IDENTITY.md");
            await fs.promises.writeFile(identityPath, identityContent, "utf-8");
            filesGenerated.push(`${agentDef.folder}/IDENTITY.md`);
          }
        } catch (err) {
          onProgress?.({
            phase: "warning",
            message: `Failed to generate IDENTITY.md for ${agentDef.name}: ${err instanceof Error ? err.message : "unknown error"}`,
            filesWritten: [...filesGenerated],
          });
        }
      }

      onProgress?.({
        phase: "complete",
        message: `Generated ${filesGenerated.length} file(s)`,
        filesWritten: [...filesGenerated],
      });

      return { success: true, filesGenerated };

    } catch (err) {
      return {
        success: false,
        filesGenerated,
        error: err instanceof Error ? err.message : "Generation failed",
      };
    }
  }

  return {
    generateContent,
    callClaude,
  };
}
