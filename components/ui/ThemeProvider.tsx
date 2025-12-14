"use client";
import React, { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeProvider({ children }:{ children: React.ReactNode }){
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return saved ?? (prefersDark ? "dark" : "light");
  });

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const ThemeContext = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function useTheme(){
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing");
  return ctx;
}

export function ThemeToggle(){
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const next = theme === "dark" ? "light" : "dark";
  const label = mounted ? (theme === "dark" ? "☀️" : "🌙") : "🌓";
  return (
    <button className="btn ghost" aria-label="Toggle theme" onClick={() => setTheme(next)}>{label}</button>
  );
}
