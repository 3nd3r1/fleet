/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FLEET_SOURCE?: "mock" | "api";
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
