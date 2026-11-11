import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";
import { getBuildVersion } from "./build/version";

export default defineConfig({
  define: { __HTTPBIN_GIT_VERSION__: JSON.stringify(getBuildVersion()) },
  plugins: [react(), tailwindcss(), cloudflare({ viteEnvironment: { name: "worker" } })],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  environments: { worker: { build: { sourcemap: true } } },
});
