import { loadKycInventoryFromExcel } from "../lib/import-kyc-inventory";
import * as XLSX from "xlsx";

const wb = XLSX.readFile("KYC  CALL IT Inventory.xlsx");
const main = XLSX.utils.sheet_to_json<unknown[]>(
  wb.Sheets["PROCO KYC & CALL IT EQUIPEMENT"],
  { header: 1, defval: "" },
);
const store = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["IN STORE"], {
  header: 1,
  defval: "",
});
const other = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Other Assets"], {
  header: 1,
  defval: "",
});
const ws = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Workstations, {
  header: 1,
  defval: "",
});

function countNumbered(rows: unknown[][]) {
  let n = 0;
  for (const row of rows) {
    const no = String(row[0] ?? "").trim();
    const d = String(row[1] ?? "").trim();
    if (/^\d+$/.test(no) && d) n++;
  }
  return n;
}

function workstationSerials(rows: unknown[][]) {
  const set = new Set<string>();
  for (const row of rows) {
    for (const idx of [3, 12]) {
      const raw = row[idx];
      const s =
        typeof raw === "number" && Number.isFinite(raw)
          ? String(raw)
          : String(raw ?? "").trim();
      if (s && s !== "-") set.add(s);
    }
  }
  return set;
}

function serialKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

const items = loadKycInventoryFromExcel();
const itemSerials = new Set(
  items.flatMap((i) => {
    if (!i.serialNumber) return [];
    const base = i.serialNumber.replace(/-DUP\d+$/, "");
    return [serialKey(i.serialNumber), serialKey(base)];
  }),
);
const wsSerials = workstationSerials(ws);
let missingInMain = 0;
for (const s of wsSerials) {
  if (!itemSerials.has(serialKey(s))) missingInMain++;
}

console.log({
  mainNumbered: countNumbered(main),
  storeNumbered: countNumbered(store),
  otherNumbered: countNumbered(other),
  imported: items.length,
  withSerial: items.filter((i) => i.serialNumber).length,
  withCustodian: items.filter((i) => i.custodianName).length,
  withWorkstation: items.filter((i) => i.workstationCode).length,
  wsSerials: wsSerials.size,
  wsSerialsMissingInImport: missingInMain,
});
