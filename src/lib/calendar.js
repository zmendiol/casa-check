import { parseLocalDate } from "./deadline.js";
import { saveFile } from "./download.js";

/**
 * A calendar reminder to do the move-out walkthrough.
 *
 * The move-in pass is worth very little alone — the argument is a comparison —
 * and the gap between the two is about nine months. The in-app reminder only
 * works if someone opens the app, which is exactly what they will not do in
 * May. A calendar entry reaches them without the app being involved at all,
 * and needs no account, no server and no notification permission: it is just
 * a file the phone knows how to open.
 */

const PROMPT_DAYS_BEFORE = 7;

/** Folds to 75 octets per RFC 5545; long descriptions are otherwise invalid. */
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

/** Escapes the characters iCalendar treats as structure. */
function esc(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

const yyyymmdd = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;

/**
 * Builds the .ics text for a given move-out date.
 * Exported separately from the download so it can be asserted on.
 *
 * @returns {{ ics: string, remindOn: Date } | null}
 */
export function buildMoveOutReminder(property, { daysBefore = PROMPT_DAYS_BEFORE } = {}) {
  const moveOut = parseLocalDate(property.moveOutDate);
  if (!moveOut) return null;

  const remindOn = new Date(moveOut.getTime());
  remindOn.setDate(remindOn.getDate() - daysBefore);

  // All-day events end on the following day, exclusive.
  const endOn = new Date(remindOn.getTime());
  endOn.setDate(endOn.getDate() + 1);

  const place = property.communityName || property.address || "your place";
  const summary = `Photograph ${place} before moving out`;
  const description =
    `Do the move-out walkthrough in Casa Check while the place is empty: every room, ` +
    `the same angles as move-in. Without it there is nothing to compare the move-in ` +
    `photos against. Your lease ends ${moveOut.toLocaleDateString([], { dateStyle: "long" })}.`;

  // A stable UID means re-importing updates the entry instead of duplicating it.
  const uid = `casa-check-moveout-${yyyymmdd(moveOut)}@casa-check.local`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Casa Check//Move-out reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    // Floating local date: a walkthrough happens where the flat is, so this
    // deliberately carries no timezone.
    `DTSTAMP:${yyyymmdd(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${yyyymmdd(remindOn)}`,
    `DTEND;VALUE=DATE:${yyyymmdd(endOn)}`,
    fold(`SUMMARY:${esc(summary)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    "BEGIN:VALARM",
    "TRIGGER:PT9H",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${esc(summary)}`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return { ics: lines.join("\r\n") + "\r\n", remindOn };
}

/** Builds the reminder and hands it to the viewer. */
export async function downloadMoveOutReminder(property, options) {
  const built = buildMoveOutReminder(property, options);
  if (!built) throw new Error("Add your move-out date first.");

  const blob = new Blob([built.ics], { type: "text/calendar" });
  const { status } = await saveFile("casa-check-move-out-reminder.ics", blob);
  return { ...built, status };
}
