// Local calendar-day key (YYYY-MM-DD) for day-bucketed data — the SRS review
// log, the daily new-card allowance, the Activity grid's day columns.
// `date.toISOString().split('T')[0]` looks equivalent but isn't: it reads the
// UTC calendar day, which silently disagrees with the user's own "today" for
// any timezone ahead of UTC (e.g. Asia/Tokyo, UTC+9) — local midnight is
// still the previous day in UTC there, so reviews logged under the correct
// local date never match a grid cell computed the UTC way, and vice versa.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
