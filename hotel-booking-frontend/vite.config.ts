import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createReadStream, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const languageFile = fileURLToPath(new URL("./node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", import.meta.url));
const ocrLanguage = {
  name: "local-ocr-language",
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use("/ocr/eng.traineddata.gz", (_req, res, next) => {
      res.setHeader("Content-Type", "application/gzip");
      const stream = createReadStream(languageFile);
      stream.on("error", next);
      stream.pipe(res);
    });
  },
  generateBundle(this: import("rollup").PluginContext) {
    this.emitFile({ type: "asset", fileName: "ocr/eng.traineddata.gz", source: readFileSync(languageFile) });
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ocrLanguage],
  // Removed proxy since we're making direct requests to backend
});
