// Genera y descarga un Excel con el resumen mensual, los ingresos y los
// gastos del hogar. La librería (exceljs) se carga solo al hacer clic.
import { Card, Category, Expense, HouseholdMember, IncomeEntry, IncomeSource } from "./types";
import { cashDateKey } from "./utils";

type Input = {
  incomes: IncomeEntry[];
  expenses: Expense[];
  categories: Category[];
  cards: Card[];
  sources: IncomeSource[];
  members: HouseholdMember[];
};

const MONEY = '$#,##0.00;($#,##0.00);"-"';
const FONT = { name: "Arial", size: 10 };
const HEAD = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
const HEAD_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4F46E5" } };

function toDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function downloadFinanceExcel({ incomes, expenses, categories, cards, sources, members }: Input) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finanzas Familiares";

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Sin categoría";
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name ?? "Efectivo / débito";
  const memberName = (uid: string | null) =>
    uid ? members.find((m) => m.user_id === uid)?.display_name || "Alguien del hogar" : "Automático";

  const inc = incomes.slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const exp = expenses.slice().sort((a, b) => a.expense_date.localeCompare(b.expense_date));
  const months = Array.from(new Set([...inc.map((i) => i.entry_date.slice(0, 7)), ...exp.map((e) => e.expense_date.slice(0, 7))])).sort();

  // ---------- Resumen mensual (con fórmulas, para que se pueda auditar)
  const wr = wb.addWorksheet("Resumen mensual", { views: [{ state: "frozen", ySplit: 4 }] });
  wr.getCell("A1").value = "Finanzas Familiares — Ingresos y gastos por mes";
  wr.getCell("A1").font = { name: "Arial", size: 14, bold: true };
  wr.getCell("A2").value = `Descargado el ${new Date().toLocaleDateString("es-ES")}. Las compras con tarjeta cuentan el día de la compra, no cuando se paga la tarjeta.`;
  wr.getCell("A2").font = { name: "Arial", size: 10, italic: true, color: { argb: "FF64748B" } };
  const heads = [
    "Mes",
    "Ingresos",
    "Gastos",
    "Balance del mes",
    "Balance acumulado",
    "Gastos con tarjeta",
    "Gastos efectivo / débito",
    "N° de gastos",
    "Gastos según el banco (tarjeta al pagar)",
    "Balance según el banco",
    "Acumulado según el banco",
  ];
  wr.getRow(4).values = heads;
  wr.getRow(4).eachCell((c) => {
    c.font = HEAD;
    c.fill = HEAD_FILL;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  wr.getRow(4).height = 30;
  const nI = inc.length + 1;
  const nG = exp.length + 1;
  months.forEach((m, k) => {
    const r = 5 + k;
    const sumIn = inc.filter((i) => i.entry_date.startsWith(m)).reduce((t, i) => t + Number(i.amount), 0);
    const sumOut = exp.filter((e) => e.expense_date.startsWith(m)).reduce((t, e) => t + Number(e.amount), 0);
    const cash = exp.filter((e) => e.expense_date.startsWith(m) && !e.card_id).reduce((t, e) => t + Number(e.amount), 0);
    const count = exp.filter((e) => e.expense_date.startsWith(m)).length;
    const row = wr.getRow(r);
    row.getCell(1).value = m;
    row.getCell(2).value = { formula: `SUMIFS(Ingresos!$G$2:$G$${nI},Ingresos!$B$2:$B$${nI},A${r})`, result: sumIn };
    row.getCell(3).value = { formula: `SUMIFS(Gastos!$J$2:$J$${nG},Gastos!$B$2:$B$${nG},A${r})`, result: sumOut };
    row.getCell(4).value = { formula: `B${r}-C${r}`, result: sumIn - sumOut };
    row.getCell(5).value = { formula: k === 0 ? `D${r}` : `E${r - 1}+D${r}` };
    row.getCell(6).value = { formula: `C${r}-G${r}`, result: sumOut - cash };
    row.getCell(7).value = {
      formula: `SUMIFS(Gastos!$J$2:$J$${nG},Gastos!$B$2:$B$${nG},A${r},Gastos!$E$2:$E$${nG},"Efectivo / débito")`,
      result: cash,
    };
    row.getCell(8).value = { formula: `COUNTIFS(Gastos!$B$2:$B$${nG},A${r})`, result: count };
    row.getCell(9).value = { formula: `SUMIFS(Gastos!$J$2:$J$${nG},Gastos!$K$2:$K$${nG},A${r})` };
    row.getCell(10).value = { formula: `B${r}-I${r}` };
    row.getCell(11).value = { formula: k === 0 ? `J${r}` : `K${r - 1}+J${r}` };
  });
  const last = 4 + months.length;
  const tot = wr.getRow(last + 1);
  tot.getCell(1).value = "Total";
  ["B", "C", "D", "F", "G", "H", "I", "J"].forEach((L) => {
    tot.getCell(L).value = { formula: `SUM(${L}5:${L}${last})` };
  });
  tot.getCell("E").value = { formula: `E${last}` };
  tot.getCell("K").value = { formula: `K${last}` };
  for (let r = 5; r <= last + 1; r++) {
    const row = wr.getRow(r);
    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = r === last + 1 ? { ...FONT, bold: true } : FONT;
      if ((c >= 2 && c <= 7) || c >= 9) cell.numFmt = MONEY;
      if (r === last + 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    }
  }
  wr.columns = [12, 14, 14, 16, 18, 16, 20, 12, 22, 18, 18].map((width) => ({ width }));
  wr.getCell(`A${last + 3}`).value =
    "Columnas 'según el banco': las compras con tarjeta se cuentan en el mes en que se paga la tarjeta (no el de la compra). Sirven para comparar con el saldo real de sus cuentas.";
  wr.getCell(`A${last + 3}`).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };

  // ---------- Ingresos
  const wi = wb.addWorksheet("Ingresos", { views: [{ state: "frozen", ySplit: 1 }] });
  wi.columns = [
    { header: "Fecha", width: 12 },
    { header: "Mes", width: 10 },
    { header: "Descripción", width: 42 },
    { header: "Fuente", width: 18 },
    { header: "Persona", width: 16 },
    { header: "Extra", width: 8 },
    { header: "Monto", width: 12 },
  ];
  inc.forEach((i) => {
    const src = sources.find((s) => s.id === i.income_source_id);
    wi.addRow([toDate(i.entry_date), i.entry_date.slice(0, 7), i.description.trim(), src?.name ?? "Sin fuente", src?.owner_name ?? "", i.is_extra ? "Sí" : "No", Number(i.amount)]);
  });

  // ---------- Gastos
  const wg = wb.addWorksheet("Gastos", { views: [{ state: "frozen", ySplit: 1 }] });
  wg.columns = [
    { header: "Fecha", width: 12 },
    { header: "Mes", width: 10 },
    { header: "Descripción", width: 40 },
    { header: "Categoría", width: 28 },
    { header: "Tarjeta", width: 18 },
    { header: "Registró", width: 16 },
    { header: "Extra (no planeado)", width: 12 },
    { header: "Fijo automático", width: 12 },
    { header: "Cuota diferida", width: 12 },
    { header: "Monto", width: 12 },
    { header: "Mes en que sale del banco", width: 14 },
  ];
  exp.forEach((e) => {
    wg.addRow([
      toDate(e.expense_date),
      e.expense_date.slice(0, 7),
      e.description.trim(),
      catName(e.category_id),
      cardName(e.card_id),
      memberName(e.created_by),
      e.is_extra ? "Sí" : "No",
      e.recurring_expense_id ? "Sí" : "No",
      e.installment_purchase_id ? "Sí" : "No",
      Number(e.amount),
      cashDateKey(e, cards).slice(0, 7),
    ]);
  });

  for (const [ws, moneyCol, cols] of [
    [wi, 7, 7],
    [wg, 10, 11],
  ] as const) {
    ws.getRow(1).eachCell((c) => {
      c.font = HEAD;
      c.fill = HEAD_FILL;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    ws.getRow(1).height = 30;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      row.eachCell((c) => (c.font = FONT));
      row.getCell(1).numFmt = "dd/mm/yyyy";
      row.getCell(moneyCol).numFmt = MONEY;
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas-familiares-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
