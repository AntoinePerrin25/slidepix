import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const core = resolve(directory, "../core/src/index.ts");

function serveServiceWorker(): Plugin {
      const source = resolve(directory, "public/sw.js");
  return {
    name: "slidepix-service-worker",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/slidepix/sw.js" && path !== "/sw.js") return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.end(readFileSync(source));
      });
    }
  };
}

export default defineConfig({
  base: "/slidepix/",
  plugins: [serveServiceWorker()],
  resolve: {
    alias: [{ find: /^@slidepix\/core$/, replacement: core }]
  },
  server: {
    fs: { allow: [root] }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
