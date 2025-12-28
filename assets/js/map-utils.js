(() => {
  window.App = window.App || {};
  const {
    MARKER_STYLE_DEFAULT,
    MARKER_STYLE_FULL,
    MARKER_STYLE_AVAILABLE,
  } = (window.App.config || {});

function resolveMarkerStyle(statusValue) {
  const value = String(statusValue || "").trim();
  if (!value) {
    return MARKER_STYLE_DEFAULT;
  }
  if (value.includes("×") || value.includes("満")) {
    return MARKER_STYLE_FULL;
  }
  if (
    value.includes("午前") ||
    value.includes("午後") ||
    value.includes("○") ||
    value.includes("〇") ||
    value.includes("◯")
  ) {
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

function createRangeLabel(map, center, radiusMeters, label, className, offsetRatio = 0.97) {
  const point = destinationPoint(center.lat, center.lng, radiusMeters * offsetRatio, 45);
  return L.marker([point.lat, point.lon], { opacity: 0, interactive: false })
    .addTo(map)
    .bindTooltip(label, {
      permanent: true,
      direction: "center",
      className,
    });
}

function getPopupOptions() {
  const width = window.innerWidth || 360;
  const height = window.innerHeight || 640;
  return {
    maxWidth: Math.min(360, Math.max(240, width - 40)),
    maxHeight: Math.floor(height * 0.6),
    autoPan: true,
    keepInView: true,
    autoPanPadding: [16, 16],
    closeButton: true,
  };
}

function isMobileView() {
  return window.matchMedia("(max-width: 768px)").matches;
}

  window.App.mapUtils = {
    resolveMarkerStyle,
    getStatusValueForAge,
    destinationPoint,
    createRangeLabel,
    getPopupOptions,
    isMobileView,
  };
})();
