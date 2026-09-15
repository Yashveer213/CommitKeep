const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ScheduleCalendar = { timezone: string; times: string[]; startDate: string; endDate?: string | null };
export type Occurrence = { localDate: string; localTime: string; scheduledFor: string; dstAdjustment: "none" | "forward_gap" };

export function isValidTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return true; } catch { return false; }
}

export function normalizeTimes(times: string[]) {
  if (times.length < 1 || times.length > 8) throw new Error("INVALID_TIME_COUNT");
  if (times.some((time) => !TIME_PATTERN.test(time))) throw new Error("INVALID_TIME");
  const sorted = [...new Set(times)].sort();
  if (sorted.length !== times.length) throw new Error("DUPLICATE_TIME");
  return sorted;
}

export function validateDateRange(startDate: string, endDate?: string | null) {
  if (!validDate(startDate) || (endDate && !validDate(endDate))) throw new Error("INVALID_DATE");
  if (endDate && startDate > endDate) throw new Error("INVALID_DATE_RANGE");
}

function validDate(value: string) {
  const match = DATE_PATTERN.exec(value); if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00.000Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10);
}

export function instantForLocal(localDate: string, localTime: string, timezone: string): Occurrence {
  if (!isValidTimezone(timezone) || !validDate(localDate) || !TIME_PATTERN.test(localTime)) throw new Error("INVALID_CALENDAR");
  const anchor = Date.parse(`${localDate}T12:00:00.000Z`);
  let firstAfterGap: Date | null = null;
  for (let offset = -18 * 60; offset <= 18 * 60; offset++) {
    const candidate = new Date(anchor + offset * 60_000); const local = localParts(candidate, timezone);
    if (local.date === localDate && local.time === localTime) return { localDate, localTime, scheduledFor: candidate.toISOString(), dstAdjustment: "none" };
    if (!firstAfterGap && local.date === localDate && local.time > localTime) firstAfterGap = candidate;
  }
  if (firstAfterGap) return { localDate, localTime, scheduledFor: firstAfterGap.toISOString(), dstAdjustment: "forward_gap" };
  throw new Error("LOCAL_TIME_UNRESOLVABLE");
}

export function nextOccurrence(calendar: ScheduleCalendar, after = new Date()) {
  if (!isValidTimezone(calendar.timezone)) throw new Error("INVALID_TIMEZONE");
  const times = normalizeTimes(calendar.times); validateDateRange(calendar.startDate, calendar.endDate);
  const currentLocalDate = localParts(after, calendar.timezone).date;
  let date = calendar.startDate > currentLocalDate ? calendar.startDate : currentLocalDate;
  for (let day = 0; day < 3660; day++, date = addDays(date, 1)) {
    if (calendar.endDate && date > calendar.endDate) return null;
    for (const time of times) {
      const occurrence = instantForLocal(date, time, calendar.timezone);
      if (Date.parse(occurrence.scheduledFor) > after.getTime()) return occurrence;
    }
  }
  throw new Error("SCHEDULE_HORIZON_EXCEEDED");
}

export function occurrenceIdentity(scheduleId: string, version: number, localDate: string, localTime: string) {
  return `${scheduleId}:${version}:${localDate}:${localTime}`;
}
