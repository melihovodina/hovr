export const STORAGE_KEY = "hovr-theme";

// Runs before paint: a saved choice wins, otherwise the system setting (and it follows system changes).
export const THEME_SCRIPT = `(function(){var k="${STORAGE_KEY}",m=matchMedia("(prefers-color-scheme: dark)");function s(){try{return localStorage.getItem(k)}catch(e){return null}}function a(){var v=s();document.documentElement.classList.toggle("dark",v?v==="dark":m.matches)}a();m.addEventListener("change",a)})()`;
