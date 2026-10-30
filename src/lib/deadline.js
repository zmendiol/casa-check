/**
 * The date a landlord's deposit response is due.
 *
 * Deliberately computed from numbers the RENTER looked up and entered, not
 * from a table shipped with the app. Deposit rules differ in every state,
 * change without notice, and turn on details a static table hides — Arizona
 * counts fourteen *business* days, others count calendar days from a
 * different starting event. A wrong number here would be worse than no
 * number: it would be wrong with the app's authority behind it.
 *
 * What the app can do safely is the arithmetic, and say plainly whose figures
 * it used.
 */

/**
 * The field is free text, so every consumer must validate rather than trust it.
 *
 * Whole days only: a fractional count made the UI say "14.9 business days"
 * while the loop actually counted fifteen. Capped at a year because the loop
 * below runs once per day — "1e9" parses as a billion and froze the tab for
 * roughly two minutes, and no deposit statute is measured in centuries.
 *
 * @returns {number|null}
 */
export function parseDeadlineDays(value) {
  const n = Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n <= 0 || n > MAX_DEADLINE_DAYS) return null;
  return n;
}

export const MAX_DEADLINE_DAYS = 365;

/** Weekend-aware, because "business days" is the common statutory wording. */
export function addBusinessDays(start, days) {
  const date = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

export function addCalendarDays(start, days) {
  const date = new Date(start.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * @param {string} moveOutDate  yyyy-mm-dd from the date input
 * @param {string|number} days  what the renter recorded
 * @param {"business"|"calendar"} basis
 * @returns {{ due: Date, basis: string } | null}
 */
export function responseDue(moveOutDate, days, basis) {
  const n = parseDeadlineDays(days);
  if (!moveOutDate || n === null) return null;

  // Date inputs are yyyy-mm-dd; parsing that directly yields UTC midnight,
  // which can land on the previous day west of Greenwich. Build it locally.
  const [y, m, d] = moveOutDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;

  return {
    due: basis === "calendar" ? addCalendarDays(start, n) : addBusinessDays(start, n),
    basis: basis === "calendar" ? "calendar days" : "business days",
  };
}

/** Public holidays are not modelled, so the figure is a floor, not a promise. */
export const DEADLINE_CAVEAT =
  "Weekends are excluded from business-day counts; public holidays are not, so treat this as the earliest date rather than an exact one.";
