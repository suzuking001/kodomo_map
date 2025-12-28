const FACILITY_CSV_URLS = [
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_certified_child_institution_nursery_center/221309_certified_child_institution_nursery_center.csv",
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_privately_licensed_nursery_school/221309_privately_licensed_nursery_school.csv",
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_municipal_licensed_nursery_school/221309_municipal_licensed_nursery_school.csv",
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_small_childcare_business/221309_small_childcare_business.csv",
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_on-site_childcare_business/221309_on-site_childcare_business.csv",
];
const AVAIL_CSV_URL =
  "https://static.hamamatsu.odpf.net/opendata/v01/221309_temporary_custody_business_availability/221309_temporary_custody_business_availability.csv";

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

function buildAvailabilityTable(rows, statusColumns) {
  if (!rows.length) {
    return `<div class="empty">一時預かりの空き情報がありません。</div>`;
  }

  const headerCells = [
    "<th>日付</th>",
    "<th>曜日</th>",
    ...statusColumns.map(col => `<th>${escapeHtml(col.header)}</th>`),
  ].join("");

  const bodyRows = rows.map(row => {
    const statusCells = row.statuses
      .map(value => `<td>${escapeHtml(value || "—")}</td>`)
      .join("");
    return `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.weekday)}</td>
        ${statusCells}
      </tr>
    `;
  }).join("");

  return `
    <div class="availability-wrap">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function buildStatusSummaryHtml(row, statusColumns, selectedAge) {
  const targetAge = selectedAge ? Number(selectedAge) : null;
  const columns = targetAge === null
    ? statusColumns
    : statusColumns.filter(col => col.age === targetAge);

  if (!columns.length) {
    return `<span class="label-empty">対象年齢なし</span>`;
  }

  return columns.map(col => {
    const match = col.header.match(/\((\d+)/);
    const ageLabel = match ? `${match[1]}歳` : col.header;
    const value = row.statuses[col.statusIndex] || "-";
    return `<span>${escapeHtml(ageLabel)}:${escapeHtml(value)}</span>`;
  }).join(" ");
}

function buildTooltipHtml(facility, rows, statusColumns, selectedDate, selectedAge) {
  const name = escapeHtml(facility.name || "名称不明");
  if (!selectedDate) {
    return name;
  }
  if (!rows.length) {
    return `
      <div class="label-title">${name}</div>
      <div class="label-status label-empty">該当日なし</div>
    `;
  }
  const summaryHtml = buildStatusSummaryHtml(rows[0], statusColumns, selectedAge);
  return `
    <div class="label-title">${name}</div>
    <div class="label-status">${summaryHtml}</div>
  `;
}

function buildPopupHtml(facility, availabilityRows, statusColumns, selectedDate) {
  const metaLines = [
    facility.address && `所在地: ${escapeHtml(facility.address)}`,
    facility.phone && `電話番号: ${escapeHtml(facility.phone)}`,
    facility.operator && `設置主体: ${escapeHtml(facility.operator)}`,
    facility.capacity && `定員: ${escapeHtml(facility.capacity)}`,
    facility.type && `事業種別: ${escapeHtml(facility.type)}`,
    facility.days && `利用できる曜日: ${escapeHtml(facility.days)}`,
    (facility.timeStart || facility.timeEnd) &&
      `利用可能時間: ${escapeHtml(facility.timeStart || "")} ～ ${escapeHtml(facility.timeEnd || "")}`,
    (facility.openTime || facility.closeTime) &&
      `開所時間: ${escapeHtml(facility.openTime || "")} ～ ${escapeHtml(facility.closeTime || "")}`,
    (facility.standardStart || facility.standardEnd) &&
      `保育標準時間: ${escapeHtml(facility.standardStart || "")} ～ ${escapeHtml(facility.standardEnd || "")}`,
    (facility.shortStart || facility.shortEnd) &&
      `保育短時間: ${escapeHtml(facility.shortStart || "")} ～ ${escapeHtml(facility.shortEnd || "")}`,
    facility.ages && `対象年齢: ${escapeHtml(facility.ages)}`,
    facility.reserveStart && `予約開始目安: ${escapeHtml(facility.reserveStart)}`,
    facility.fee && `利用料・免除基準: ${escapeHtml(facility.fee)}`,
    facility.notes && `備考: ${escapeHtml(facility.notes)}`,
    facility.recruitMonth && `募集・申込の該当月: ${escapeHtml(facility.recruitMonth)}`,
  ].filter(Boolean).map(line => `<div class="meta">${line}</div>`).join("");

  const selectedDateLine = selectedDate
    ? `<div class="meta">選択日: ${escapeHtml(selectedDate)}</div>`
    : "";

  return `
    <div class="popup">
      <div class="title">${escapeHtml(facility.name || "名称不明")}</div>
      <div class="meta">施設No.: ${escapeHtml(facility.noRaw || facility.no)}</div>
      ${selectedDateLine}
      ${metaLines}
      <div class="section">
        ${buildAvailabilityTable(availabilityRows, statusColumns)}
      </div>
    </div>
  `;
}

const MARKER_STYLE_DEFAULT = { color: "#2563eb", fillColor: "#60a5fa" };
const MARKER_STYLE_FULL = { color: "#6b7280", fillColor: "#cbd5e1" };
const MARKER_STYLE_AVAILABLE = { color: "#2f855a", fillColor: "#68d391" };

function resolveMarkerStyle(statusValue) {
  const value = String(statusValue || "").trim();
  if (!value) {
    return MARKER_STYLE_DEFAULT;
  }
  if (value.includes("×") || value.includes("満")) {
    return MARKER_STYLE_FULL;
  }
  if (value.includes("午前") || value.includes("午後") || value.includes("○")) {
    return MARKER_STYLE_AVAILABLE;
  }
  return MARKER_STYLE_DEFAULT;
}

function getStatusValueForAge(rows, statusColumns, selectedAge) {
  if (!rows.length || !selectedAge) {
    return "";
  }
  const targetAge = Number(selectedAge);
  const column = statusColumns.find(col => col.age === targetAge);
  if (!column) {
    return "";
  }
  return rows[0].statuses[column.statusIndex] || "";
}

function destinationPoint(lat, lon, distanceMeters, bearingDegrees) {
  const radius = 6378137;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angularDistance = distanceMeters / radius;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAd = Math.sin(angularDistance);
  const cosAd = Math.cos(angularDistance);

  const lat2 = Math.asin(
    sinLat1 * cosAd + cosLat1 * sinAd * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAd * cosLat1,
    cosAd - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
}

function createRangeLabel(map, center, radiusMeters, label, className) {
  const point = destinationPoint(center.lat, center.lng, radiusMeters * 0.97, 45);
  return L.marker([point.lat, point.lon], { opacity: 0, interactive: false })
    .addTo(map)
    .bindTooltip(label, {
      permanent: true,
      direction: "center",
      className,
    });
}

function addFacilitiesFromDataset(facilityMap, fac, source) {
  const facHeaders = fac.headers;
  const facRows = fac.rows;

  const facNoIndex = indexOrThrow(facHeaders, "NO");
  const facNameIndex = indexOrThrow(facHeaders, "名称");
  const facLatIndex = indexOrThrow(facHeaders, "緯度");
  const facLonIndex = indexOrThrow(facHeaders, "経度");
  const facAddr1Index = facHeaders.indexOf("所在地1");
  const facAddr2Index = facHeaders.indexOf("所在地2");
  const facPhoneIndex = facHeaders.indexOf("電話番号");
  const facOperatorIndex = facHeaders.indexOf("設置主体");
  const facCapacityIndex = facHeaders.indexOf("定員");
  const facOpenIndex = facHeaders.indexOf("開所時間");
  const facCloseIndex = facHeaders.indexOf("閉所時間");
  const facStdStartIndex = facHeaders.indexOf("保育標準開始時間");
  const facStdEndIndex = facHeaders.indexOf("保育標準終了時間");
  const facShortStartIndex = facHeaders.indexOf("保育短時間開始時間");
  const facShortEndIndex = facHeaders.indexOf("保育短時間終了時間");
  const facTypeIndex = facHeaders.indexOf("一時預かり事業の種類");
  const facDaysIndex = facHeaders.indexOf("基本的な利用できる曜日");
  const facStartIndex = facHeaders.indexOf("基本的な利用できる時間（開始時間）");
  const facEndIndex = facHeaders.indexOf("基本的な利用できる時間（終了時間）");
  const facAgeIndex = facHeaders.indexOf("基本的な利用できる歳児");
  const facReserveIndex = facHeaders.indexOf("予約を開始する概ねの時期");
  const facFeeIndex = facHeaders.indexOf("利用料、免除基準");
  const facNotesIndex = facHeaders.indexOf("備考（一時預かり）");
  const facRecruitMonthIndex = facHeaders.indexOf("募集人数・申込人数の該当月");

  facRows.forEach(row => {
    const noRaw = row[facNoIndex];
    const noKey = normalizeNo(noRaw);
    if (!noKey || facilityMap[noKey]) return;

    const lat = parseFloat(row[facLatIndex]);
    const lon = parseFloat(row[facLonIndex]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    const addr1 = facAddr1Index >= 0 ? row[facAddr1Index] : "";
    const addr2 = facAddr2Index >= 0 ? row[facAddr2Index] : "";
    const address = [addr1, addr2].filter(Boolean).join(" ");

        facilityMap[noKey] = {
          no: noKey,
          noRaw,
          name: row[facNameIndex],
          lat,
          lon,
          address,
          phone: facPhoneIndex >= 0 ? row[facPhoneIndex] : "",
          operator: facOperatorIndex >= 0 ? row[facOperatorIndex] : "",
          capacity: facCapacityIndex >= 0 ? row[facCapacityIndex] : "",
          openTime: facOpenIndex >= 0 ? row[facOpenIndex] : "",
          closeTime: facCloseIndex >= 0 ? row[facCloseIndex] : "",
          standardStart: facStdStartIndex >= 0 ? row[facStdStartIndex] : "",
          standardEnd: facStdEndIndex >= 0 ? row[facStdEndIndex] : "",
          shortStart: facShortStartIndex >= 0 ? row[facShortStartIndex] : "",
          shortEnd: facShortEndIndex >= 0 ? row[facShortEndIndex] : "",
          type: facTypeIndex >= 0 ? row[facTypeIndex] : "",
          days: facDaysIndex >= 0 ? row[facDaysIndex] : "",
          timeStart: facStartIndex >= 0 ? row[facStartIndex] : "",
          timeEnd: facEndIndex >= 0 ? row[facEndIndex] : "",
          ages: facAgeIndex >= 0 ? row[facAgeIndex] : "",
          reserveStart: facReserveIndex >= 0 ? row[facReserveIndex] : "",
          fee: facFeeIndex >= 0 ? row[facFeeIndex] : "",
          notes: facNotesIndex >= 0 ? row[facNotesIndex] : "",
          recruitMonth: facRecruitMonthIndex >= 0 ? row[facRecruitMonthIndex] : "",
          source,
        };
      });
}

async function main() {
  const [facilityTexts, availText] = await Promise.all([
    Promise.all(FACILITY_CSV_URLS.map(url => fetchCSV(url))),
    fetchCSV(AVAIL_CSV_URL),
  ]);

  const facilities = facilityTexts.map(parseCSV);
  const av = parseCSV(availText);
  const avHeaders = av.headers;
  const avRows = av.rows;

  const avFacNoIndex = indexOrThrow(avHeaders, "施設No.");
  const avDateIndex = indexOrThrow(avHeaders, "日付");
  const avWeekdayIndex = avHeaders.indexOf("曜日");
  const statusColumns = findHeadersByPrefix(avHeaders, "一時保育(")
    .map(item => {
      const match = item.header.match(/\((\d+)/);
      return {
        header: item.header,
        index: item.index,
        age: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.age - b.age || a.index - b.index);
  statusColumns.forEach((col, index) => {
    col.statusIndex = index;
  });

  const facilityMap = {};
  facilities.forEach((fac, index) => {
    let source = "certified";
    if (index === 1) {
      source = "private";
    } else if (index === 2) {
      source = "municipal";
    } else if (index === 3) {
      source = "small";
    } else if (index === 4) {
      source = "onsite";
    }
    addFacilitiesFromDataset(facilityMap, fac, source);
  });

  const availabilityMap = {};
  avRows.forEach(row => {
    const facNoRaw = row[avFacNoIndex];
    const facNoKey = normalizeNo(facNoRaw);
    if (!facNoKey) return;

    if (!availabilityMap[facNoKey]) {
      availabilityMap[facNoKey] = [];
    }

    availabilityMap[facNoKey].push({
      date: row[avDateIndex] || "",
      weekday: avWeekdayIndex >= 0 ? row[avWeekdayIndex] || "" : "",
      statuses: statusColumns.map(col => row[col.index] || ""),
    });
  });

  Object.values(availabilityMap).forEach(rows => {
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  });

const map = L.map("map", { zoomControl: false, attributionControl: false })
  .setView([34.7108, 137.7266], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  const locateControl = L.control({ position: "bottomright" });
  locateControl.onAdd = () => {
    const container = L.DomUtil.create("div", "leaflet-control leaflet-control-locate");
    const button = L.DomUtil.create("button", "locate-button", container);
    button.type = "button";
    button.title = "現在地を表示";
    button.setAttribute("aria-label", "現在地を表示");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4"></circle>
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
      </svg>
    `;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, "click", event => {
      L.DomEvent.stop(event);
      map.locate({ setView: true, maxZoom: 16 });
    });
    return container;
  };
  locateControl.addTo(map);

  let hit = 0;
  let miss = 0;
  const markers = [];

  Object.values(facilityMap).forEach(facility => {
    const availabilityRows = availabilityMap[facility.no] || [];
    if (availabilityRows.length) {
      hit++;
    } else {
      miss++;
    }


    const availabilityByDate = {};
    availabilityRows.forEach(row => {
      if (!row.date) {
        return;
      }
      if (!availabilityByDate[row.date]) {
        availabilityByDate[row.date] = [];
      }
      availabilityByDate[row.date].push(row);
    });

    let labelClass = "marker-label";
    if (facility.source === "private") {
      labelClass = "marker-label marker-label-private";
    } else if (facility.source === "municipal") {
      labelClass = "marker-label marker-label-municipal";
    } else if (facility.source === "small") {
      labelClass = "marker-label marker-label-small";
    } else if (facility.source === "onsite") {
      labelClass = "marker-label marker-label-onsite";
    }

    const marker = L.circleMarker([facility.lat, facility.lon], {
      radius: 8,
      color: MARKER_STYLE_DEFAULT.color,
      fillColor: MARKER_STYLE_DEFAULT.fillColor,
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindTooltip(buildTooltipHtml(facility, availabilityRows, statusColumns, "", ""), {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: labelClass,
      })
      .bindPopup(buildPopupHtml(facility, availabilityRows, statusColumns, ""), {
        maxWidth: 520,
      });

    markers.push({ marker, facility, availabilityRows, availabilityByDate });
  });

const menuToggle = document.getElementById("menu-toggle");
const menuBackdrop = document.getElementById("menu-backdrop");
const sideMenu = document.getElementById("side-menu");
const menuClose = document.getElementById("menu-close");
const datePicker = document.getElementById("date-picker");
const ageSelect = document.getElementById("age-select");
const filterCertified = document.getElementById("filter-certified");
const filterPrivate = document.getElementById("filter-private");
const filterMunicipal = document.getElementById("filter-municipal");
const filterSmall = document.getElementById("filter-small");
const filterOnsite = document.getElementById("filter-onsite");
const dateClear = document.getElementById("date-clear");
const dateInfo = document.getElementById("date-info");
const statusAvailable = document.getElementById("status-available");
const statusFull = document.getElementById("status-full");
const statusSummary = document.getElementById("status-summary");
const licenseToggle = document.getElementById("license-toggle");
const licenseModal = document.getElementById("license-modal");
const licenseClose = document.getElementById("license-close");

const setMenuOpen = isOpen => {
  sideMenu.classList.toggle("open", isOpen);
  menuBackdrop.classList.toggle("open", isOpen);
  if (!isOpen && sideMenu.contains(document.activeElement)) {
    menuToggle.focus();
  }
  sideMenu.setAttribute("aria-hidden", String(!isOpen));
  sideMenu.inert = !isOpen;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
};

const setLicenseOpen = isOpen => {
  if (!licenseModal || !licenseToggle) {
    return;
  }
  licenseModal.classList.toggle("open", isOpen);
  licenseModal.setAttribute("aria-hidden", String(!isOpen));
  licenseToggle.setAttribute("aria-expanded", String(isOpen));
};

menuToggle.addEventListener("click", () => {
  setMenuOpen(!sideMenu.classList.contains("open"));
});
if (menuClose) {
  menuClose.addEventListener("click", () => setMenuOpen(false));
}
menuBackdrop.addEventListener("click", () => setMenuOpen(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setMenuOpen(false);
    setLicenseOpen(false);
  }
});
if (licenseToggle && licenseModal) {
  licenseToggle.addEventListener("click", () => {
    setLicenseOpen(true);
  });
}
if (licenseClose) {
  licenseClose.addEventListener("click", () => {
    setLicenseOpen(false);
  });
}
if (licenseModal) {
  licenseModal.addEventListener("click", event => {
    if (event.target === licenseModal) {
      setLicenseOpen(false);
    }
  });
}

  const ageSet = new Set();
  statusColumns.forEach(col => {
    if (Number.isFinite(col.age)) {
      ageSet.add(col.age);
    }
  });
  const ages = Array.from(ageSet).sort((a, b) => a - b);
  ageSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "すべて";
  ageSelect.appendChild(allOption);
  ages.forEach(age => {
    const option = document.createElement("option");
    option.value = String(age);
    option.textContent = `${age}歳`;
    ageSelect.appendChild(option);
  });
  if (!ages.length) {
    ageSelect.disabled = true;
  }

  const dateSet = new Set();
  Object.values(availabilityMap).forEach(rows => {
    rows.forEach(row => {
      if (row.date) {
        dateSet.add(row.date);
      }
    });
  });
const dateList = Array.from(dateSet).sort();
const hasDates = dateList.length > 0;
if (hasDates) {
  datePicker.min = dateList[0];
  datePicker.max = dateList[dateList.length - 1];
  dateInfo.textContent = "未選択: 全日表示";
} else {
  datePicker.disabled = true;
  dateClear.disabled = true;
  dateInfo.textContent = "日付データがありません。";
}

const typeFilters = {
  certified: filterCertified,
  private: filterPrivate,
  municipal: filterMunicipal,
  small: filterSmall,
  onsite: filterOnsite,
};
const isTypeEnabled = source => {
  const control = typeFilters[source];
  return control ? control.checked : true;
};

let userLocationMarker = null;
let userLocationCircle = null;
let userLocationCircle2km = null;
let userLocationCircle5km = null;
let userLocationLabel2km = null;
let userLocationLabel5km = null;
map.on("locationfound", event => {
  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }
  if (userLocationCircle) {
    map.removeLayer(userLocationCircle);
  }
  if (userLocationCircle2km) {
    map.removeLayer(userLocationCircle2km);
  }
  if (userLocationCircle5km) {
    map.removeLayer(userLocationCircle5km);
  }
  if (userLocationLabel2km) {
    map.removeLayer(userLocationLabel2km);
  }
  if (userLocationLabel5km) {
    map.removeLayer(userLocationLabel5km);
  }

  userLocationMarker = L.circleMarker(event.latlng, {
    radius: 7,
    color: "#b91c1c",
      fillColor: "#fca5a5",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map).bindPopup("現在地");

  userLocationCircle = L.circle(event.latlng, {
    radius: event.accuracy,
    color: "#fca5a5",
    fillColor: "#fecaca",
    fillOpacity: 0.2,
    weight: 1,
    interactive: false,
  }).addTo(map);

  userLocationCircle2km = L.circle(event.latlng, {
    radius: 2000,
    color: "#f87171",
    fillColor: "#fecaca",
    fillOpacity: 0.12,
    weight: 2,
    dashArray: "4 6",
    interactive: false,
  }).addTo(map);

  userLocationCircle5km = L.circle(event.latlng, {
    radius: 5000,
    color: "#ef4444",
    fillColor: "#fee2e2",
    fillOpacity: 0.08,
    weight: 2,
    dashArray: "4 6",
    interactive: false,
  }).addTo(map);

  userLocationLabel2km = createRangeLabel(
    map,
    event.latlng,
    2000,
    "2km",
    "range-label range-label-2km"
  );
  userLocationLabel5km = createRangeLabel(
    map,
    event.latlng,
    5000,
    "5km",
    "range-label range-label-5km"
  );
});
  map.on("locationerror", event => {
    console.warn("位置情報の取得に失敗しました。", event.message);
    alert("位置情報の取得に失敗しました。ブラウザの許可設定をご確認ください。");
  });

const updateMarkersForDate = selectedDate => {
  const selectedAge = ageSelect.value;
  const ageLabel = selectedAge ? `${selectedAge}歳` : "全年齢";
  let visible = 0;
  let availableCount = 0;
  let fullCount = 0;
  markers.forEach(item => {
    const filteredRows = selectedDate
      ? (item.availabilityByDate[selectedDate] || [])
      : item.availabilityRows;
    const typeEnabled = isTypeEnabled(item.facility.source);
    const shouldShow = typeEnabled && (!selectedDate || filteredRows.length > 0);

    if (shouldShow) {
      if (!map.hasLayer(item.marker)) {
        item.marker.addTo(map);
      }
      const statusValue = selectedDate && selectedAge
        ? getStatusValueForAge(filteredRows, statusColumns, selectedAge)
        : "";
      const style = resolveMarkerStyle(statusValue);
      item.marker.setStyle(style);
      item.marker.setTooltipContent(
        buildTooltipHtml(item.facility, filteredRows, statusColumns, selectedDate, selectedAge)
      );
      if (style === MARKER_STYLE_AVAILABLE) {
        availableCount++;
      } else if (style === MARKER_STYLE_FULL) {
        fullCount++;
      }
      visible++;
    } else if (map.hasLayer(item.marker)) {
      map.removeLayer(item.marker);
    }
  });

    if (hasDates) {
      if (selectedDate) {
        dateInfo.textContent = `選択日: ${selectedDate} / 年齢: ${ageLabel} / 表示中: ${visible}施設`;
      } else {
        dateInfo.textContent = `未選択: 全日表示 / 年齢: ${ageLabel}`;
      }
  } else {
    dateInfo.textContent = "日付データがありません。";
  }
  if (statusAvailable) {
    statusAvailable.textContent = `${availableCount}`;
  }
  if (statusFull) {
    statusFull.textContent = `${fullCount}`;
  }
  if (statusSummary) {
    const shouldShowSummary = Boolean(selectedDate && selectedAge);
    statusSummary.classList.toggle("hidden", !shouldShowSummary);
  }
};

  datePicker.addEventListener("change", () => {
    updateMarkersForDate(datePicker.value);
  });
  ageSelect.addEventListener("change", () => {
    updateMarkersForDate(datePicker.value);
  });
dateClear.addEventListener("click", () => {
  datePicker.value = "";
  updateMarkersForDate("");
});
Object.values(typeFilters).forEach(control => {
  if (!control) return;
  control.addEventListener("change", () => {
    updateMarkersForDate(datePicker.value);
  });
});

updateMarkersForDate("");

  console.log("JOIN成功件数:", hit, "/ 空き情報なし:", miss);
}

main().catch(console.error);
