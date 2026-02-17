function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);

  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

export function toDownloadFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
