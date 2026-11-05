import { z } from "zod";

export const siteConfigSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    url: z.url(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
