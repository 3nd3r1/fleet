import { describe, expect, it } from "vitest";

import { siteConfigSchema } from "@/validators/config";

import { siteConfig } from "@/lib/config";

describe("siteConfig", () => {
    it("matches the schema", () => {
        expect(siteConfigSchema.safeParse(siteConfig).success).toBe(true);
    });
});
