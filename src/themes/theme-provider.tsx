"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { loadGoogleFonts } from "./theme-loader";
import { SKINS } from "./skins";
import { ThemeConfig, ThemeContextValue, ThemeMode } from "./theme-types";
import { clearInjectedVars, injectVars, themeToVars } from "./theme-utils";

// ── Context ───────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeConfig;
  // Default dark — most users hit the dashboard at night; dark surfaces work
  // better under glass blur effects with the teal palette.
  initialMode?: ThemeMode;
}

// Provider nesting order per CLAUDE.md:
//   ClerkProvider > ConvexProviderWithClerk > ThemeProvider
export function ThemeProvider({
  children,
  initialTheme = SKINS[0],
  initialMode = "dark",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(initialTheme);
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  // Track the last injected vars so we can clean up stale properties on change.
  const prevVarsRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const vars = themeToVars(theme, mode);

    // Remove any CSS vars from the previous theme that aren't in the new set.
    if (prevVarsRef.current) {
      const stale = Object.keys(prevVarsRef.current).filter(
        (k) => !(k in vars),
      );
      if (stale.length > 0) {
        const toRemove = Object.fromEntries(stale.map((k) => [k, ""]));
        clearInjectedVars(toRemove);
      }
    }

    injectVars(vars);
    prevVarsRef.current = vars;

    // Stamp data attributes so CSS rules can target [data-theme] and [data-mode].
    document.documentElement.setAttribute("data-theme", theme.id);
    document.documentElement.setAttribute("data-mode", mode);
  }, [theme, mode]);

  // Load fonts whenever the theme changes.
  useEffect(() => {
    loadGoogleFonts(theme);
  }, [theme]);

  // Clean up injected vars when the provider unmounts (mostly for testing).
  useEffect(() => {
    return () => {
      if (prevVarsRef.current) {
        clearInjectedVars(prevVarsRef.current);
      }
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-mode");
    };
  }, []);

  const setTheme = useCallback((next: ThemeConfig) => setThemeState(next), []);
  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
