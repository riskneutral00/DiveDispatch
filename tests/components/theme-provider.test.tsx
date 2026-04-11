// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();
const mockSelectThemeMutation = vi.fn();
const mockLoadGoogleFonts = vi.fn();
const mockInjectVars = vi.fn();
const mockClearInjectedVars = vi.fn();
const mockThemeToVars = vi.fn((_theme: unknown) => ({
  "--color-text-primary": "#fff",
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useConvexAuth: () => mockUseConvexAuth(),
    useQuery: (query: unknown, args?: unknown) => mockUseQuery(query, args),
    useMutation: () => mockSelectThemeMutation,
  };
});

vi.mock("@/themes/theme-loader", () => ({
  loadGoogleFonts: (theme: unknown) => mockLoadGoogleFonts(theme),
}));

vi.mock("@/themes/theme-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/themes/theme-utils")>();
  return {
    ...actual,
    injectVars: (vars: unknown) => mockInjectVars(vars),
    clearInjectedVars: (vars: unknown) => mockClearInjectedVars(vars),
    themeToVars: (theme: unknown) => mockThemeToVars(theme),
  };
});

import { LAGOON_DEFAULT } from "@/themes/default-themes";
import { ThemeProvider } from "@/themes/theme-provider";

describe("ThemeProvider", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
    });
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
    document.documentElement.removeAttribute("data-luminance");
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false });
    mockUseQuery.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the default theme when cached theme JSON is invalid", async () => {
    localStorage.setItem("divedispatch-theme-cache", "{invalid-json");

    render(
      <ThemeProvider>
        <div>theme child</div>
      </ThemeProvider>,
    );

    expect(screen.getByText("theme child")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockThemeToVars).toHaveBeenCalledWith(LAGOON_DEFAULT);
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        LAGOON_DEFAULT.id,
      );
    });
  });
});
