import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version ?? "1.0.0"),
  },
  server: {
    /** Lets you open the dev URL from a real phone on the same Wi‑Fi while you build. */
    host: true,
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      devOptions: {
        /** Avoid stale service-worker cache while developing (common logo “not updating” issue). */
        enabled: false,
      },
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "fabric-flo-logo-widget.jpg",
        "fabric-flo-logo-widget.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-512.png",
      ],
      manifest: {
        name: "Fabric Flo — Production Tracker",
        short_name: "Fabric Flo",
        description: "Track film fabrics and bags across studios, locations, and trucks.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});
