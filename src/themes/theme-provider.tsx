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
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-generated";
import { loadGoogleFonts } from "./theme-loader";
import { OCEAN_DEFAULT } from "./default-themes";
import { ThemeConfig, ThemeContextValue, ThemeMode } from "./theme-types";
import { clearInjectedVars, injectVars, themeToVars } from "./theme-utils";

const CACHE_KEY = "divedispatch-theme-cache";
const MODE_KEY = "divedispatch-theme-pref";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

function loadCachedTheme(): ThemeConfig {
  if (typeof window === "undefined") return OCEAN_DEFAULT;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as ThemeConfig;
  } catch {
  }
  return OCEAN_DEFAULT;
}

function loadCachedMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(MODE_KEY);
  return stored === "light" ? "light" : "dark";
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(loadCachedTheme);
  const [mode, setModeState] = useState<ThemeMode>(loadCachedMode);

  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.me,
    isAuthenticated ? {} : "skip",
  );
  const themeConfig = useQuery(
    api.themes.getConfig,
    currentUser?.selectedThemeId ? { id: currentUser.selectedThemeId } : "skip",
  );
  const selectThemeMutation = useMutation(api.themes.selectTheme);

  const prevVarsRef = useRef<Record<string, string> | null>(null);

  const [prevThemeConfig, setPrevThemeConfig] = useState(themeConfig);
  if (themeConfig && themeConfig !== prevThemeConfig) {
    setPrevThemeConfig(themeConfig);
    setThemeState(themeConfig as ThemeConfig);
  }

  useEffect(() => {
    if (themeConfig) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(themeConfig));
    }
  }, [themeConfig]);

  const isLoading = isAuthenticated
    ? !(themeConfig || (currentUser && !currentUser.selectedThemeId))
    : false;

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

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
  }, []);

  const selectTheme = useCallback(
    (themeId: string) => {
      if (isAuthenticated) {
        selectThemeMutation({ themeId: themeId as never });
      }
    },
    [isAuthenticated, selectThemeMutation],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode, selectTheme, isLoading }),
    [theme, mode, setMode, selectTheme, isLoading],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
