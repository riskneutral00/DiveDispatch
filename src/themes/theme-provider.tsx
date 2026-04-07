"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadGoogleFonts } from "./theme-loader";
import { SKINS } from "./skins";
import { ThemeConfig, ThemeContextValue, ThemeMode } from "./theme-types";
import { clearInjectedVars, injectVars, themeToVars } from "./theme-utils";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeConfig;
  initialMode?: ThemeMode;
}

export function ThemeProvider({
  children,
  initialTheme = SKINS[0],
  initialMode = "dark",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(initialTheme);
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const prevVarsRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const vars = themeToVars(theme, mode);

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

    document.documentElement.setAttribute("data-theme", theme.id);
    document.documentElement.setAttribute("data-mode", mode);

    const palette =
      mode === "light" && theme.colors.light
        ? theme.colors.light
        : theme.colors.dark;
    document.documentElement.setAttribute(
      "data-luminance",
      palette.luminanceClass,
    );

    if (!document.documentElement.hasAttribute("data-hover-effect")) {
      const stored = localStorage.getItem("divedispatch-hover-effect");
      document.documentElement.setAttribute(
        "data-hover-effect",
        stored === "off" ? "off" : "on",
      );
    }
  }, [theme, mode]);

  useEffect(() => {
    loadGoogleFonts(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (prevVarsRef.current) {
        clearInjectedVars(prevVarsRef.current);
      }
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-mode");
      document.documentElement.removeAttribute("data-luminance");
    };
  }, []);

  const setTheme = useCallback((next: ThemeConfig) => setThemeState(next), []);
  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  return (
    <ThemeContext.Provider value={useMemo(() => ({ theme, mode, setTheme, setMode }), [theme, mode, setTheme, setMode])}>
      {children}
    </ThemeContext.Provider>
  );
}
