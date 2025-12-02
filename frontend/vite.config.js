import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Prevents Rollup from breaking on leaflet-routing-machine
      external: ["leaflet-routing-machine"],
    },
  },
});
