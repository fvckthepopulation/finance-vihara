import ExcelJS from "exceljs";

export type XlsxColumn<T> = {
  header: string;
  value: (row: T) => string | number;
  width?: number;
  numeric?: boolean;
};

/**
 * Export an array of rows to a real .xlsx file client-side (ExcelJS).
 * Header row is bold; numeric columns get a thousands format + right align.
 */
export async function exportXlsx<T>(opts: {
  filename: string;
  sheet?: string;
  columns: XlsxColumn<T>[];
  rows: T[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheet ?? "Sheet1");
  ws.columns = opts.columns.map((c) => ({ header: c.header, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true };

  for (const row of opts.rows) {
    ws.addRow(opts.columns.map((c) => c.value(row)));
  }

  opts.columns.forEach((c, i) => {
    if (!c.numeric) return;
    const col = ws.getColumn(i + 1);
    col.numFmt = "#,##0";
    col.alignment = { horizontal: "right" };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
