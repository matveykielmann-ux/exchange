// Applies a saved light/dark choice before first paint. Loaded as a file so the page CSP can stay script-src 'self'.
// Customer site defaults to dark; CRM (/admin…) defaults to light. Each side remembers its own toggle.
try {
  var isCrm = location.pathname.indexOf('/admin') === 0;
  var key = isCrm ? 'cryptobit.crm-theme' : 'cryptobit.theme';
  var t = localStorage.getItem(key);
  if (t !== 'light' && t !== 'dark') t = isCrm ? 'light' : 'dark';
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F7F4EE' : '#080808');
  }
} catch {
  // Storage blocked: keep the HTML default (dark), unless this is CRM — set light in markup path below.
  try {
    if (location.pathname.indexOf('/admin') === 0) {
      document.documentElement.dataset.theme = 'light';
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '#F7F4EE');
    }
  } catch {
    /* ignore */
  }
}
