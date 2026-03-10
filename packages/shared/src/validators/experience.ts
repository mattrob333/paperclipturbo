import { z } from "zod";

export const startBuildSchema = z.object({
  force: z.boolean().optional(),
});
export type StartBuild = z.infer<typeof startBuildSchema>;

export const loadDemoSchema = z.object({
  companySlug: z.string().optional().default("meridian-dynamics"),
});
export type LoadDemo = z.infer<typeof loadDemoSchema>;
