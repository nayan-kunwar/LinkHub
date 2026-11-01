import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      next: {
        // Next.js lives in apps/web, not at the repository root.
        rootDir: "apps/web/",
      },
    },
  },
  {
    // These React Compiler rules flag long-standing state/effect patterns
    // across the existing UI. Keep the rest of the hooks rules enabled and
    // revisit these in a dedicated React Compiler migration.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/refs": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "e2e/.fixtures.json",
  ]),
]);
