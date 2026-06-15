/**
 * CSV Export Utility
 */

export const downloadCSV = (data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) => {
  if (!data.length) return;

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const header = cols.map(c => `"${c.label}"`).join(",");
  const rows = data.map(row =>
    cols.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = "";
      if (typeof val === "object") {
        if (val.toDate) val = val.toDate().toLocaleString("th-TH");
        else if (val.seconds) val = new Date(val.seconds * 1000).toLocaleString("th-TH");
        else val = JSON.stringify(val);
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
