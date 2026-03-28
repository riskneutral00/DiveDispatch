import { z } from "zod";

// -- Server env schema --
const serverSchema = z.object({
  // Required
  CONVEX_DEPLOYMENT: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_ISSUER_URL: z.string().min(1),
  // Optional
  RESEND_API_KEY: z.optional(z.string()),
  DEV_MODE: z.optional(z.string()),
  SITE_URL: z.optional(z.string()),
});

// -- Client env schema --
const clientSchema = z.object({
  // Required
  NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  // With defaults
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.optional(z.string()).transform((v) => v ?? "/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.optional(z.string()).transform((v) => v ?? "/sign-up"),
  NEXT_PUBLIC_APP_URL: z.optional(z.string()).transform((v) => v ?? "http://localhost:3000"),
  // Optional
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.optional(z.string()),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.optional(z.string()),
});

function formatErrors(errors: z.ZodError[]): string {
  const issues = errors.flatMap((e) => e.issues);
  const missing = issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean);

  return [
    "Environment variable validation failed:",
    ...missing.map((name) => `  - ${name}`),
    "",
    "See .env.example for required variables.",
  ].join("\n");
}

export function validateServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatErrors([result.error]));
  }
  return result.data;
}

export function validateClientEnv() {
  const result = clientSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatErrors([result.error]));
  }
  return result.data;
}

/**
 * Validate all environment variables (server + client).
 * Called as a side-effect when imported from next.config.ts.
 */
export function validateEnv() {
  const serverResult = serverSchema.safeParse(process.env);
  const clientResult = clientSchema.safeParse(process.env);

  const errors: z.ZodError[] = [];
  if (!serverResult.success) errors.push(serverResult.error);
  if (!clientResult.success) errors.push(clientResult.error);

  if (errors.length > 0) {
    throw new Error(formatErrors(errors));
  }

  return {
    server: serverResult.data!,
    client: clientResult.data!,
  };
}

// Side-effect: validate on import (skipped during test runs)
if (process.env.NODE_ENV !== "test") {
  validateEnv();
}
