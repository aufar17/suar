import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

const integerFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 3595 -> "3.595" */
export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** 0.8213 -> "0,82" */
export function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** 12.5 -> "12,5%" (value already in percent) */
export function formatPercent(value: number, digits = 0): string {
  return `${formatDecimal(value, digits)}%`;
}

/** Signed number, e.g. "+0,42" or "−0,18". */
export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(value), digits)}`;
}

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** "19 Okt 2026" */
export function formatDate(value: string | Date): string {
  return format(toDate(value), "d MMM yyyy", { locale: id });
}

/** "Sel, 20 Okt" */
export function formatDayShort(value: string | Date): string {
  return format(toDate(value), "EEE, d MMM", { locale: id });
}

/** "Selasa, 20 Oktober 2026" */
export function formatDateLong(value: string | Date): string {
  return format(toDate(value), "EEEE, d MMMM yyyy", { locale: id });
}

/** "20 Okt 2026, 13.24 WIB" from an ISO datetime with +07:00 offset. */
export function formatDateTime(value: string): string {
  // Keep the wall-clock time of the source offset (WIB) instead of the viewer's time zone.
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  return `${formatDate(match[1])}, ${match[2]}.${match[3]} WIB`;
}

/** "2026-10" -> "Okt 2026" */
export function formatMonth(value: string, withYear = true): string {
  return format(parseISO(`${value}-01`), withYear ? "MMM yyyy" : "MMM", { locale: id });
}

/** ISO date arithmetic without time zone drift. */
export function addDaysIso(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function diffDaysIso(later: string, earlier: string): number {
  return differenceInCalendarDays(parseISO(later), parseISO(earlier));
}
