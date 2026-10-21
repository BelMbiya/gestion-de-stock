import * as XLSX from "xlsx";

import { AssetCondition, AssetStatus } from "../generated/prisma/client";

export function cell(row: unknown[], index: number) {
  const raw = row[index];
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }
  return String(raw).trim();
}

export function serialKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function cleanSerial(value: string) {
  const serial = value.trim();
  if (!serial || serial === "-" || serial === "—") {
    return null;
  }
  return serial;
}

export function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!cleaned) {
    return null;
  }
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount.toFixed(2) : null;
}

export function parseExcelDate(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 10_000 && value < 100_000) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) {
        return new Date(
          parts.y,
          parts.m - 1,
          parts.d,
          parts.H,
          parts.M,
          parts.S,
        );
      }
    }
    return null;
  }

  const text = String(value).trim();
  if (!text || text === "-") {
    return null;
  }

  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const serial = Number.parseFloat(text);
    if (serial > 10_000 && serial < 100_000) {
      return parseExcelDate(serial);
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  if (year < 1990 || year > 2100) {
    return null;
  }

  return parsed;
}

export function mapCondition(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes("bad") || value.includes("out of service")) {
    return AssetCondition.DAMAGED;
  }
  if (value.includes("fair") || value.includes("maintenance")) {
    return AssetCondition.FAIR;
  }
  return AssetCondition.GOOD;
}

export function mapStatus(rawStatus: string, custodian: string | null) {
  const status = rawStatus.toLowerCase();
  if (status.includes("lost")) {
    return { status: AssetStatus.LOST, condition: AssetCondition.DAMAGED };
  }
  if (status.includes("out of service")) {
    return { status: AssetStatus.MAINTENANCE, condition: AssetCondition.DAMAGED };
  }
  if (status.includes("bad")) {
    return { status: AssetStatus.MAINTENANCE, condition: AssetCondition.POOR };
  }
  if (custodian) {
    return { status: AssetStatus.ASSIGNED, condition: mapCondition(rawStatus) };
  }
  return { status: AssetStatus.AVAILABLE, condition: mapCondition(rawStatus) };
}

export function locationCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}
