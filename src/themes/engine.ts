/**
 * PufferChat Theme Engine
 * Manages theme loading and switching.
 * Default: AOL Classic
 */

export type ThemeName = "aol-classic" | "aol-dark";

const THEME_KEY = "pufferchat_theme";

export function getCurrentTheme(): ThemeName {
  return (localStorage.getItem(THEME_KEY) as ThemeName) || "aol-classic";
}

export function setTheme(theme: ThemeName): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme(): void {
  const theme = getCurrentTheme();
  document.documentElement.setAttribute("data-theme", theme);
}
