import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
          target: "http://13.204.195.88:5002/",
        changeOrigin: true,
      },
    },
  },
});

