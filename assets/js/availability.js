(() => {
  window.App = window.App || {};
  const { escapeHtml } = window.App.utils || {};

function buildAvailabilityTable(rows, statusColumns) {
  if (!rows.length) {
    return '<div class="empty">一時預かりの空き情報がありません。</div>';
  }

  const headerCells = [
    "<th>日付</th>",
    "<th>曜日</th>",
    ...statusColumns.map(col => `<th>${escapeHtml(col.header)}</th>`),
  ].join("");

  const bodyRows = rows
    .map(row => {
      const statusCells = row.statuses
        .map(value => `<td>${escapeHtml(value || "-")}</td>`)
        .join("");
      return `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.weekday)}</td>
        ${statusCells}
      </tr>
    `;
    })
    .join("");

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
    return '<span class="label-empty">対象年齢なし</span>';
  }

  return columns
    .map(col => {
      const match = col.header.match(/\((\d+)/);
      const ageLabel = match ? `${match[1]}歳` : col.header;
      const value = row.statuses[col.statusIndex] || "-";
      return `<span>${escapeHtml(ageLabel)}:${escapeHtml(value)}</span>`;
    })
    .join(" ");
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
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    `${facility.lat},${facility.lon}`
  )}`;
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
  ]
    .filter(Boolean)
    .map(line => `<div class="meta">${line}</div>`)
    .join("");

  const selectedDateLine = selectedDate
    ? `<div class="meta">選択日: ${escapeHtml(selectedDate)}</div>`
    : "";

  return `
        <div class="popup">
          <div class="title">${escapeHtml(facility.name || "名称不明")}</div>
          <div class="meta">施設No.: ${escapeHtml(facility.noRaw || facility.no)}</div>
          ${selectedDateLine}
          ${metaLines}
          <div class="section popup-actions">
            <a class="popup-link" href="${mapsUrl}" target="_blank" rel="noopener">Google Mapで開く</a>
          </div>
          <div class="section">
            ${buildAvailabilityTable(availabilityRows, statusColumns)}
          </div>
        </div>
      `;
}

  window.App.availability = {
    buildAvailabilityTable,
    buildStatusSummaryHtml,
    buildTooltipHtml,
    buildPopupHtml,
  };
})();
