import { defineNitroConfig } from "nitro";

export default defineNitroConfig({
  preset: process.env.NITRO_PRESET || "node-server",
  compatibilityDate: "2024-12-01",
  esbuild: {
    options: {
      target: "node20",
    },
  },
  minify: true,
});
