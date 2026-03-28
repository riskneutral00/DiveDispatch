import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateServerEnv,
  validateClientEnv,
  validateEnv,
} from "@/lib/env";

describe("env validation", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setRequiredEnv() {
    process.env.CONVEX_DEPLOYMENT = "dev:test-deployment";
    process.env.CLERK_SECRET_KEY = "sk_test_abc123";
    process.env.CLERK_ISSUER_URL = "https://clerk.example.com";
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc123";
  }

  function clearAllEnv() {
    delete process.env.CONVEX_DEPLOYMENT;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_ISSUER_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.DEV_MODE;
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }

  describe("server env", () => {
    it("throws when CONVEX_DEPLOYMENT is missing", () => {
      setRequiredEnv();
      delete process.env.CONVEX_DEPLOYMENT;
      expect(() => validateServerEnv()).toThrow("CONVEX_DEPLOYMENT");
    });

    it("throws when CLERK_SECRET_KEY is missing", () => {
      setRequiredEnv();
      delete process.env.CLERK_SECRET_KEY;
      expect(() => validateServerEnv()).toThrow("CLERK_SECRET_KEY");
    });

    it("throws when CLERK_ISSUER_URL is missing", () => {
      setRequiredEnv();
      delete process.env.CLERK_ISSUER_URL;
      expect(() => validateServerEnv()).toThrow("CLERK_ISSUER_URL");
    });

    it("passes with all required server vars present", () => {
      setRequiredEnv();
      expect(() => validateServerEnv()).not.toThrow();
    });

    it("passes when optional server vars are absent", () => {
      setRequiredEnv();
      delete process.env.RESEND_API_KEY;
      delete process.env.DEV_MODE;
      delete process.env.SITE_URL;
      expect(() => validateServerEnv()).not.toThrow();
    });
  });

  describe("client env", () => {
    it("throws when NEXT_PUBLIC_CONVEX_URL is missing", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      expect(() => validateClientEnv()).toThrow("NEXT_PUBLIC_CONVEX_URL");
    });

    it("throws when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      expect(() => validateClientEnv()).toThrow(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
      );
    });

    it("passes with all required client vars present", () => {
      setRequiredEnv();
      expect(() => validateClientEnv()).not.toThrow();
    });

    it("applies default for NEXT_PUBLIC_CLERK_SIGN_IN_URL", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
      const result = validateClientEnv();
      expect(result.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe("/sign-in");
    });

    it("applies default for NEXT_PUBLIC_CLERK_SIGN_UP_URL", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;
      const result = validateClientEnv();
      expect(result.NEXT_PUBLIC_CLERK_SIGN_UP_URL).toBe("/sign-up");
    });

    it("applies default for NEXT_PUBLIC_APP_URL", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_APP_URL;
      const result = validateClientEnv();
      expect(result.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    });

    it("uses provided value over default", () => {
      setRequiredEnv();
      process.env.NEXT_PUBLIC_APP_URL = "https://dive.example.com";
      const result = validateClientEnv();
      expect(result.NEXT_PUBLIC_APP_URL).toBe("https://dive.example.com");
    });

    it("passes when optional client vars are absent", () => {
      setRequiredEnv();
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      expect(() => validateClientEnv()).not.toThrow();
    });
  });

  describe("validateEnv (combined)", () => {
    it("throws listing all missing required vars at once", () => {
      clearAllEnv();
      expect(() => validateEnv()).toThrow(".env.example");
    });

    it("error message names each missing variable", () => {
      clearAllEnv();
      try {
        validateEnv();
        expect.unreachable("should have thrown");
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain("CONVEX_DEPLOYMENT");
        expect(msg).toContain("NEXT_PUBLIC_CONVEX_URL");
      }
    });

    it("passes when all required vars are present", () => {
      setRequiredEnv();
      expect(() => validateEnv()).not.toThrow();
    });
  });
});
