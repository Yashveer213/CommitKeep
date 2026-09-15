export type ExistingScheduleTime = { id: string; localTime: string; status: string };

export function diffScheduleTimes(existing: ExistingScheduleTime[], requested: string[]) {
  const requestedSet = new Set(requested);
  const byTime = new Map(existing.map((row) => [row.localTime, row]));
  return {
    retained: requested.flatMap((time) => byTime.has(time) ? [byTime.get(time)!] : []),
    added: requested.filter((time) => !byTime.has(time)),
    removed: existing.filter((row) => !requestedSet.has(row.localTime)),
  };
}
