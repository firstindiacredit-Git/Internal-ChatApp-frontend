import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
          // target: "https://internalchat.pizeonfly.com:5001/",
          target: "http://localhost:5002/",
        changeOrigin: true,
      },
    },
  },
});

