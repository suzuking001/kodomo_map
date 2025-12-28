(() => {
  window.App = window.App || {};

  function normalizeNo(no) {
    if (no == null) return "";
    const half = String(no).replace(/[０-９]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );
    const trimmed = half.trim();
    const stripped = trimmed.replace(/^0+/, "");
    return stripped || trimmed;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function indexOrThrow(headers, name) {
    const idx = headers.indexOf(name);
    if (idx < 0) {
      throw new Error(`Header not found: ${name}`);
    }
    return idx;
  }

  function findHeadersByPrefix(headers, prefix) {
    return headers
      .map((header, index) => ({ header, index }))
      .filter(item => item.header.startsWith(prefix));
  }

  window.App.utils = { normalizeNo, escapeHtml, indexOrThrow, findHeadersByPrefix };
})();
