import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 25,
        functions: 35,
        branches: 35,
        statements: 25,
      },
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/.svelte-kit/**",
        "src/lib/components/**",
        "src/lib/test-utils/**",
        "src/lib/supabaseClient.ts",
        "src/lib/types.ts",
        "src/lib/components/index.ts",
        "src/routes/**",
        "src/hooks.server.ts",
        "src/app.d.ts",
        "src/app.html",
        "**/e2e/**",
        "**/playwright.config.ts",
        "*.config.js",
        "*.config.ts",
      ],
    },
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
