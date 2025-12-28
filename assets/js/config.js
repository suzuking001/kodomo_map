(() => {
  window.App = window.App || {};

  const FACILITY_CSV_URLS = [
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_certified_child_institution_nursery_center/221309_certified_child_institution_nursery_center.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_privately_licensed_nursery_school/221309_privately_licensed_nursery_school.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_municipal_licensed_nursery_school/221309_municipal_licensed_nursery_school.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_small_childcare_business/221309_small_childcare_business.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_on-site_childcare_business/221309_on-site_childcare_business.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_company-led_childcare_business/221309_company-led_childcare_business.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_unlicensed_childcare_facility/221309_unlicensed_childcare_facility.csv",
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_unlicensed_childcare_facility_customer_only/221309_unlicensed_childcare_facility_customer_only.csv",
  ];

  const AVAIL_CSV_URL =
    "https://static.hamamatsu.odpf.net/opendata/v01/221309_temporary_custody_business_availability/221309_temporary_custody_business_availability.csv";

  const TILE_URL =
    new URLSearchParams(window.location.search).get("tiles") ||
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)';

  const DATASET_ATTRIBUTION = [
    '<span class="attribution-block">データ(CC BY):',
    `<a href="${AVAIL_CSV_URL}" target="_blank" rel="noopener">一時預かり空き状況</a> /`,
    `<a href="${FACILITY_CSV_URLS[0]}" target="_blank" rel="noopener">認定こども園</a> /`,
    `<a href="${FACILITY_CSV_URLS[1]}" target="_blank" rel="noopener">私立認可保育園</a> /`,
    `<a href="${FACILITY_CSV_URLS[2]}" target="_blank" rel="noopener">市立認可保育園</a> /`,
    `<a href="${FACILITY_CSV_URLS[3]}" target="_blank" rel="noopener">小規模保育事業</a> /`,
    `<a href="${FACILITY_CSV_URLS[4]}" target="_blank" rel="noopener">事業所内保育事業</a> /`,
    `<a href="${FACILITY_CSV_URLS[5]}" target="_blank" rel="noopener">企業主導型保育事業</a> /`,
    `<a href="${FACILITY_CSV_URLS[6]}" target="_blank" rel="noopener">認可外保育施設</a> /`,
    `<a href="${FACILITY_CSV_URLS[7]}" target="_blank" rel="noopener">認可外（顧客児童限定）</a>`,
    "</span>",
    '<span class="attribution-block">提供: <a href="https://opendata.pref.shizuoka.jp/" target="_blank" rel="noopener">静岡県オープンデータポータル</a> / <a href="https://www.city.hamamatsu.shizuoka.jp/opendata/index.html" target="_blank" rel="noopener">浜松市オープンデータ</a></span>',
  ].join(" ");

  const MARKER_STYLE_DEFAULT = { color: "#2563eb", fillColor: "#60a5fa" };
  const MARKER_STYLE_FULL = { color: "#6b7280", fillColor: "#cbd5e1" };
  const MARKER_STYLE_AVAILABLE = { color: "#2f855a", fillColor: "#68d391" };

  window.App.config = {
    FACILITY_CSV_URLS,
    AVAIL_CSV_URL,
    TILE_URL,
    TILE_ATTRIBUTION,
    DATASET_ATTRIBUTION,
    MARKER_STYLE_DEFAULT,
    MARKER_STYLE_FULL,
    MARKER_STYLE_AVAILABLE,
  };
})();
