import { z } from "zod";

export const discoverWorkspaceSchema = z.object({
  gatewayUrl: z.string().url("Gateway URL must be a valid URL"),
  workspacePath: z.string().min(1, "Workspace path is required"),
});

export const confirmAttachSchema = z.object({
  gatewayUrl: z.string().url("Gateway URL must be a valid URL"),
  workspacePath: z.string().min(1, "Workspace path is required"),
  companyName: z.string().min(1).max(200),
  companyDescription: z.string().max(2000).optional(),
  selectedAgentFolders: z
    .array(z.string().min(1))
    .refine(
      (folders) => new Set(folders).size === folders.length,
      "Selected agent folders must be unique",
    )
    .optional(),
});

export type DiscoverWorkspaceInput = z.infer<typeof discoverWorkspaceSchema>;
export type ConfirmAttachInput = z.infer<typeof confirmAttachSchema>;
