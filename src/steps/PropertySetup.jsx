import { useState } from "react";
import { buildMoveOutReminder, downloadMoveOutReminder } from "../lib/calendar.js";
import { US_STATES } from "../lib/constants.js";
import { useStore } from "../state/store.jsx";

export function PropertySetup() {
  const { state, dispatch } = useStore();
  const { property } = state;

  // Every field writes straight to the store, which persists on a debounce.
  // The original only copied the form into state when the button was pressed,
  // so navigating away first threw the whole form out.
  const bind = (field) => ({
    value: property[field],
    onChange: (e) => dispatch({ type: "SET_PROPERTY_FIELD", field, value: e.target.value }),
  });

  return (
    <>
      <h1 className="page-title">Property setup</h1>
      <p className="page-sub">
        Start here before your move-in walkthrough. This info goes on the cover page of your report.
      </p>

      {/* Stated before anything is typed, because that is when someone decides
          whether to photograph where they live. Scoped to what the user enters:
          the page itself does fetch webfonts, so a blanket "nothing is sent
          anywhere" would be an overclaim. */}
      <p className="privacy-note">
        <strong>Everything stays on this device.</strong> Your photos, notes and property details
        are not uploaded, and there is no account to create.
      </p>

      <div className="section-label">Where you&rsquo;re living</div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="school">University / college</label>
          <input id="school" type="text" placeholder="e.g. University of Michigan" {...bind("school")} />
        </div>
        <div className="field">
          <label htmlFor="stateName">State</label>
          <select id="stateName" {...bind("stateName")}>
            {US_STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field field-wide">
        <label htmlFor="communityName">Apartment complex / dorm / property name</label>
        <input
          id="communityName"
          type="text"
          placeholder="e.g. The Standard at College Ave"
          {...bind("communityName")}
        />
      </div>

      <div className="field field-wide">
        <label htmlFor="address">Full address</label>
        <input
          id="address"
          type="text"
          placeholder="123 E College Ave, Unit 4B, City, State"
          {...bind("address")}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="moveInDate">Move-in date</label>
          <input id="moveInDate" type="date" {...bind("moveInDate")} />
        </div>
        <div className="field">
          <label htmlFor="moveOutDate">Move-out / lease end date</label>
          <input id="moveOutDate" type="date" {...bind("moveOutDate")} />
        </div>
      </div>

      {/* Offered here because this is the moment the date exists, and it is
          day one — months before the reminder is any use. The in-app prompt
          only reaches someone who opens the app, which in May is precisely
          what they will not do. */}
      <ReminderOffer property={property} />

      <div className="section-label">Property rules &amp; move-out standards</div>
      <div className="field field-wide">
        <label htmlFor="rules">Paste or type this property&rsquo;s specific requirements (optional)</label>
        <textarea
          id="rules"
          placeholder="e.g. Carpets must be professionally cleaned before move-out. Nail holes must be filled and painted. No damage to blinds..."
          {...bind("rules")}
        />
        <p className="field-hint">
          Every complex has its own move-out checklist — keeping it here means you&rsquo;ll have it
          on hand when you document, and it&rsquo;s included in your final report.
        </p>
      </div>

      <div className="law-panel">
        <h3>Why documentation matters</h3>
        <ul>
          <li>Most states require landlords to itemize any deposit deductions in writing.</li>
          <li>
            Deadlines to return a deposit are usually set by state law — often 14 to 30 days after
            move-out.
          </li>
          <li>
            Timestamped photos from move-in are your strongest evidence in a dispute, regardless of
            where you live.
          </li>
        </ul>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => dispatch({ type: "SET_STEP", step: "capture" })}
      >
        Save &amp; continue to walkthrough
      </button>
    </>
  );
}

/**
 * Offers a calendar entry for the move-out walkthrough.
 *
 * Appears only once a usable move-out date exists — there is nothing to
 * schedule before that, and an impossible date parses to nothing.
 */
function ReminderOffer({ property }) {
  const [status, setStatus] = useState(null);
  const reminder = buildMoveOutReminder(property);

  if (!reminder) return null;

  async function handleDownload() {
    try {
      const { status: saveStatus } = await downloadMoveOutReminder(property);
      setStatus(
        saveStatus === "declined"
          ? { tone: "muted", message: "Save cancelled." }
          : {
              tone: "success",
              message: `Saved. Open the file to add it to your calendar — it will remind you on ${reminder.remindOn.toLocaleDateString(
                [],
                { dateStyle: "long" }
              )}.`,
            }
      );
    } catch (err) {
      setStatus({ tone: "error", message: err.message });
    }
  }

  return (
    <div className="reminder-offer">
      <p>
        <strong>Set a reminder for the move-out walkthrough.</strong> The report compares move-in
        against move-out, so the second set of photos is what makes the first ones worth taking —
        and it is months away.
      </p>
      <button type="button" className="btn btn-ghost" onClick={handleDownload}>
        Add a calendar reminder for{" "}
        {reminder.remindOn.toLocaleDateString([], { month: "long", day: "numeric" })}
      </button>
      {status && (
        <p className="status-line" data-tone={status.tone} role="status" aria-live="polite">
          {status.message}
        </p>
      )}
    </div>
  );
}
