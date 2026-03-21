// Theme Engine for PufferChat
export type ThemeId = 'aol-classic' | 'aol-2026' | 'high-contrast';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'aol-classic', name: 'AOL Classic', description: 'The original 1997 look' },
  { id: 'aol-2026', name: 'AOL 2026', description: 'Modern reimagination with glassmorphism' },
  { id: 'high-contrast', name: 'High Contrast', description: 'Maximum contrast for accessibility' },
];

let currentTheme: ThemeId = 'aol-classic';

export function getCurrentTheme(): ThemeId {
  return currentTheme;
}

export function setTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute('data-theme', themeId);
  currentTheme = themeId;
  localStorage.setItem('pufferchat-theme', themeId);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { themeId } }));
}

export function initTheme(): void {
  const saved = localStorage.getItem('pufferchat-theme') as ThemeId | null;
  const theme = saved && THEMES.some((t) => t.id === saved) ? saved : 'aol-classic';
  setTheme(theme);
}
