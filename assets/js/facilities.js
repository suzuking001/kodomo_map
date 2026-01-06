(() => {
  window.App = window.App || {};
  const { indexOrThrow, normalizeNo } = window.App.utils || {};

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
  const facUrlIndex = facHeaders.findIndex(header => {
    const normalized = header.toUpperCase();
    return (
      normalized.includes("URL") ||
      normalized.includes("WEB") ||
      header.includes("ＵＲＬ") ||
      header.includes("ホームページ") ||
      header.includes("公式サイト") ||
      header.includes("ウェブ")
    );
  });
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
      website: facUrlIndex >= 0 ? row[facUrlIndex] : "",
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

  window.App.facilities = { addFacilitiesFromDataset };
})();
