(() => {
  const {
    FACILITY_CSV_URLS,
    AVAIL_CSV_URL,
    TILE_URL,
    TILE_ATTRIBUTION,
    DATASET_ATTRIBUTION,
    MARKER_STYLE_DEFAULT,
    MARKER_STYLE_FULL,
    MARKER_STYLE_AVAILABLE,
  } = window.App.config;
  const { fetchCSV, parseCSV } = window.App.csv;
  const { normalizeNo, indexOrThrow, findHeadersByPrefix } = window.App.utils;
  const { buildTooltipHtml, buildPopupHtml } = window.App.availability;
  const {
    resolveMarkerStyle,
    getStatusValueForAge,
    createRangeLabel,
    getPopupOptions,
    isMobileView,
  } = window.App.mapUtils;
  const { addFacilitiesFromDataset } = window.App.facilities;

let menuToggle = null;
const detailsModal = document.getElementById("details-modal");
const detailsBody = document.getElementById("details-body");
const detailsClose = document.getElementById("details-close");
const aboutModal = document.getElementById("about-modal");
const aboutClose = document.getElementById("about-close");
const aboutButton = document.getElementById("about-button");

function setDetailsOpen(isOpen, htmlContent = "") {
  if (!detailsModal || !detailsBody) {
    return;
  }
  if (isOpen) {
    detailsBody.innerHTML = htmlContent;
    detailsModal.inert = false;
    detailsModal.setAttribute("aria-hidden", "false");
    if (detailsClose) {
      detailsClose.focus();
    }
    detailsModal.classList.toggle("open", true);
    return;
  }
  if (detailsModal.contains(document.activeElement) && menuToggle) {
    menuToggle.focus();
  }
  detailsModal.classList.toggle("open", false);
  detailsModal.setAttribute("aria-hidden", "true");
  detailsModal.inert = true;
}

function setAboutOpen(isOpen) {
  if (!aboutModal) {
    return;
  }
  if (isOpen) {
    setDetailsOpen(false);
    aboutModal.inert = false;
    aboutModal.setAttribute("aria-hidden", "false");
    if (aboutClose) {
      aboutClose.focus();
    }
    aboutModal.classList.toggle("open", true);
    return;
  }
  if (aboutModal.contains(document.activeElement) && aboutButton) {
    aboutButton.focus();
  }
  aboutModal.classList.toggle("open", false);
  aboutModal.setAttribute("aria-hidden", "true");
  aboutModal.inert = true;
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
    } else if (index === 5) {
      source = "company";
    } else if (index === 6) {
      source = "unlicensed";
    } else if (index === 7) {
      source = "unlicensed-limited";
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

  const map = L.map("map", { zoomControl: false, attributionControl: true })
    .setView([34.7108, 137.7266], 12);
  L.tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);
  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a> (MIT)'
  );
  map.attributionControl.setPosition("bottomright");
  map.attributionControl.addAttribution(DATASET_ATTRIBUTION);
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
    } else if (facility.source === "company") {
      labelClass = "marker-label marker-label-company";
    } else if (facility.source === "unlicensed") {
      labelClass = "marker-label marker-label-unlicensed";
    } else if (facility.source === "unlicensed-limited") {
      labelClass = "marker-label marker-label-unlicensed-limited";
    }

    const marker = L.circleMarker([facility.lat, facility.lon], {
      radius: 8,
      color: MARKER_STYLE_DEFAULT.color,
      fillColor: MARKER_STYLE_DEFAULT.fillColor,
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindTooltip(
        buildTooltipHtml(facility, availabilityRows, statusColumns, "", ""),
        {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: labelClass,
        }
      );

    if (isMobileView()) {
      marker.on("click", () => {
        setDetailsOpen(true, buildPopupHtml(facility, availabilityRows, statusColumns, ""));
      });
    } else {
      marker.bindPopup(
        buildPopupHtml(facility, availabilityRows, statusColumns, ""),
        getPopupOptions()
      );
    }

    markers.push({ marker, facility, availabilityRows, availabilityByDate });
  });

  menuToggle = document.getElementById("menu-toggle");
  const menuBackdrop = document.getElementById("menu-backdrop");
  const sideMenu = document.getElementById("side-menu");
  const menuClose = document.getElementById("menu-close");
  const datePicker = document.getElementById("date-picker");
  const dateRangeHint = document.getElementById("date-range-hint");
  const ageSelect = document.getElementById("age-select");
  const filterCertified = document.getElementById("filter-certified");
  const filterPrivate = document.getElementById("filter-private");
  const filterMunicipal = document.getElementById("filter-municipal");
  const filterSmall = document.getElementById("filter-small");
  const filterOnsite = document.getElementById("filter-onsite");
  const filterCompany = document.getElementById("filter-company");
  const filterUnlicensed = document.getElementById("filter-unlicensed");
  const filterUnlicensedLimited = document.getElementById("filter-unlicensed-limited");
  const dateClear = document.getElementById("date-clear");
  const dateInfo = document.getElementById("date-info");
  const statusAvailable = document.getElementById("status-available");
  const statusFull = document.getElementById("status-full");
  const statusSummary = document.getElementById("status-summary");

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
      setDetailsOpen(false);
      setAboutOpen(false);
    }
  });
  if (detailsClose) {
    detailsClose.addEventListener("click", () => setDetailsOpen(false));
  }
  if (detailsModal) {
    detailsModal.addEventListener("click", event => {
      if (event.target === detailsModal) {
        setDetailsOpen(false);
      }
    });
  }
  if (aboutButton) {
    aboutButton.addEventListener("click", () => setAboutOpen(true));
  }
  if (aboutClose) {
    aboutClose.addEventListener("click", () => setAboutOpen(false));
  }
  if (aboutModal) {
    aboutModal.addEventListener("click", event => {
      if (event.target === aboutModal) {
        setAboutOpen(false);
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
    dateInfo.textContent = "未選択 / 全日表示";
    if (dateRangeHint) {
      dateRangeHint.textContent = `確認可能期間: ${dateList[0]} ～ ${dateList[dateList.length - 1]}`;
    }
  } else {
    datePicker.disabled = true;
    dateClear.disabled = true;
    dateInfo.textContent = "日付データがありません。";
    if (dateRangeHint) {
      dateRangeHint.textContent = "日付データがありません。";
    }
  }

  const typeFilters = {
    certified: filterCertified,
    private: filterPrivate,
    municipal: filterMunicipal,
    small: filterSmall,
    onsite: filterOnsite,
    company: filterCompany,
    unlicensed: filterUnlicensed,
    "unlicensed-limited": filterUnlicensedLimited,
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
      "range-label range-label-2km",
      0.985
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
        dateInfo.textContent = `未選択 / 全日表示 / 年齢: ${ageLabel}`;
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
    if (detailsModal && detailsModal.classList.contains("open")) {
      setDetailsOpen(false);
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
})();
