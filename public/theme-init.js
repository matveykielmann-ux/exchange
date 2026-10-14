// Applies a saved light/dark preference before first paint. Loaded as a file so the page CSP can stay script-src 'self'.
try {
  var t = localStorage.getItem('arcvale.theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {
  // Storage blocked: keep the system preference.
}
