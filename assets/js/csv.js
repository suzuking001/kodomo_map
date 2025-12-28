(() => {
  window.App = window.App || {};

  async function fetchCSV(url, encoding = "shift-jis") {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
    }
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  // RFC4180-ish CSV parser with quoted fields support.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === "\"") {
          if (text[i + 1] === "\"") {
            field += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    const headers = rows.shift() || [];
    const cleanedRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
    return { headers, rows: cleanedRows };
  }

  window.App.csv = { fetchCSV, parseCSV };
})();
