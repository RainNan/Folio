import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:8000",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ""),
      timeout: 180_000,
      proxyTimeout: 180_000,
    },
  };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});
