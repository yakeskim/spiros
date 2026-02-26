"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "neutral" | "pixel" | "matrix";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "neutral",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>("neutral");

  useEffect(() => {
    const stored = localStorage.getItem("spiros-theme") as Theme | null;
    if (stored && ["neutral", "pixel", "matrix"].includes(stored)) {
      setThemeState(stored);
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.dataset.theme = "neutral";
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("spiros-theme", newTheme);
    document.documentElement.dataset.theme = newTheme;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
