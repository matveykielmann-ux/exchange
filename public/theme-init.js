// Applies a saved light/dark choice before first paint. Loaded as a file so the page CSP can stay script-src 'self'.
try {
  var t = localStorage.getItem('cryptobit.theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    if (t === 'light') document.querySelector('meta[name="theme-color"]').setAttribute('content', '#F7F4EE');
  }
} catch {
  // Storage blocked: keep the dark default.
}
