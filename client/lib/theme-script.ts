export const STORAGE_KEY = "hovr-theme";

// Runs before paint: a saved choice wins, otherwise the system setting.
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("${STORAGE_KEY}");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
