import { STORAGE_KEY } from "./theme-script";

// Flips the theme and remembers the choice; the icons follow the .dark class through CSS.
export function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {}
}
