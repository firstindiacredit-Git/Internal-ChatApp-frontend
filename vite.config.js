import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "fs";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "generate-firebase-sw-config",
        buildStart() {
          // Generate service worker config at build time
          const firebaseConfig = {
            apiKey: env.VITE_FIREBASE_API_KEY || "",
            authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
            projectId: env.VITE_FIREBASE_PROJECT_ID || "",
            storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
            messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
            appId: env.VITE_FIREBASE_APP_ID || "",
          };

          const configContent = `// Auto-generated Firebase config - DO NOT EDIT MANUALLY
const FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig, null, 2)};
`;

          writeFileSync(
            resolve(__dirname, "public/firebase-sw-config.js"),
            configContent
          );

          console.log("✅ Generated firebase-sw-config.js");
        },
      },
    ],
    base: "./", // Important for Electron to load assets correctly
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: "http://localhost:5001/",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      // Generate relative paths for Electron
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
