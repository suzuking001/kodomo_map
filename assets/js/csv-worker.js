(() => {
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

  async function fetchCSV(url, encoding) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
    }
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder(encoding || "shift-jis");
    return decoder.decode(buffer);
  }

  self.onmessage = async event => {
    const { id, facilityUrls, availabilityUrl, encoding } = event.data || {};
    if (!id || !facilityUrls || !availabilityUrl) {
      return;
    }
    try {
      const facilityTexts = await Promise.all(
        facilityUrls.map(url => fetchCSV(url, encoding))
      );
      const availabilityText = await fetchCSV(availabilityUrl, encoding);
      const facilities = facilityTexts.map(parseCSV);
      const availability = parseCSV(availabilityText);
      self.postMessage({
        id,
        ok: true,
        payload: { facilities, availability },
      });
    } catch (error) {
      self.postMessage({
        id,
        ok: false,
        error: error && error.message ? error.message : "Worker failed",
      });
    }
  };
})();
