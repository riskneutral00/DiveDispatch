import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
  // Profile form DRY enforcement — force barrel imports, prevent bypassing shared components
  {
    files: ["src/components/profiles/*-profile-form.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/lib/profile-form/types",
              "@/lib/profile-form/location",
              "@/lib/profile-form/languages",
              "@/lib/profile-form/save-feedback",
            ],
            message: "Import from '@/lib/profile-form' (barrel) instead of individual submodules.",
          },
        ],
      }],
    },
  },
]);

export default eslintConfig;
