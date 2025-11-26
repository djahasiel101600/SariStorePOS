import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Parse ALLOWED_HOSTS from environment variable (comma-separated list)
  const allowedHosts: string[] = [];
  
  if (env.ALLOWED_HOSTS) {
    // Split by comma and clean up each host
    const hosts = env.ALLOWED_HOSTS.split(',').map(host => host.trim());
    hosts.forEach(host => {
      try {
        // Remove protocol if present
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (cleanHost && cleanHost !== 'localhost' && cleanHost !== '127.0.0.1') {
          allowedHosts.push(cleanHost);
        }
      } catch (e) {
        console.warn('Invalid host in ALLOWED_HOSTS:', host);
      }
    });
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
        "/media": {
          target: "http://localhost:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, "/media"),
        },
      },
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
  };
});
