import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

/** Syncs with index.css variables via data-theme on <html> — palette from brand sheets. */

const STORAGE_KEY = "iw_theme_mode";

const ThemeModeContext = createContext({
  mode: "dark",
  toggleMode: () => {},
  setMode: () => {},
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

function buildTheme(mode) {
  const dark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? "#4FD1DD" : "#38B6C1", dark: dark ? "#2CB1BC" : "#2B98A2" },
      secondary: { main: dark ? "#2CB1BC" : "#2B98A2" },
      success: { main: "#22c55e" },
      warning: { main: "#f59e0b" },
      error: { main: "#ef4444" },
      background: {
        default: dark ? "#003366" : "#A3CEF2",
        paper: dark ? "#183845" : "#BEEBFF",
      },
      text: {
        primary: dark ? "#F3F8FB" : "#111827",
        secondary: dark ? "#B7C8D2" : "rgba(17,24,39,0.72)",
      },
      divider: dark ? "rgba(243,248,251,0.12)" : "rgba(17,24,39,0.12)",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial'].join(','),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: dark ? "#003366" : "#A3CEF2",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 12,
            fontWeight: 700,
          },
          containedPrimary: {
            "&:hover": {
              backgroundColor: dark ? "#2CB1BC" : "#2B98A2",
            },
          },
        },
      },
    },
  });
}

export default function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setMode(saved);
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {}
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const ctx = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    }),
    [mode]
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={ctx}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}
