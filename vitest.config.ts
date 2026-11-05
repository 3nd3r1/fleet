import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [svelte(), svelteTesting()],
    test: {
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        environment: "jsdom",
        globals: true,
        coverage: {
            include: ["src/**", "server/**"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
});
