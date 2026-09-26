import { DEADLINE_CAVEAT, responseDue } from "../lib/deadline.js";
import { useStore } from "../state/store.jsx";

/** State-agnostic principles. Kept as data so adding one is a one-line change. */
const PRINCIPLES = [
  {
    title: "Deposit return deadlines",
    body:
      "Nearly every state sets a legal deadline for returning a security deposit after move-out — " +
      "commonly somewhere between 14 and 30 days. Miss it, and landlords often owe more than the " +
      "deposit itself.",
  },
  {
    title: "“Normal wear and tear” is usually protected",
    body:
      "Minor scuffs, small nail holes, faded paint, worn carpet from ordinary use — these typically " +
      "can't be deducted from your deposit anywhere in the U.S. Damage beyond that (holes in walls, " +
      "stains, broken fixtures) usually can be.",
  },
  {
    title: "Written itemization is standard",
    body:
      "Most states require a written, itemized list of deductions — a verbal explanation generally " +
      "isn't enough. Keep any statement your landlord sends you along with your photos.",
  },
];

export function RenterRights() {
  const { state, dispatch } = useStore();
  const stateName = state.property.stateName || "your state";
  const { depositDeadlineDays, depositDeadlineBasis, depositLawSource, moveOutDate } =
    state.property;

  const set = (field) => (e) =>
    dispatch({ type: "SET_PROPERTY_FIELD", field, value: e.target.value });

  const due = responseDue(moveOutDate, depositDeadlineDays, depositDeadlineBasis);
  const search = `https://www.google.com/search?q=${encodeURIComponent(
    `${stateName} security deposit return law landlord deadline itemized statement`
  )}`;

  return (
    <>
      <h1 className="page-title">Renter rights, plain language</h1>
      <p className="page-sub">
        General principles that hold in most states, plus a worked example. Not legal advice — for
        guidance specific to your situation, contact your campus legal resources or your state&rsquo;s
        tenant rights office.
      </p>

      <div className="section-label">Common to most states</div>
      {PRINCIPLES.map((item) => (
        <div className="room-section" key={item.title}>
          <h3 className="card-title">{item.title}</h3>
          <p className="card-body">{item.body}</p>
        </div>
      ))}

      {/* The original labelled this block with the selected state's name while
          always showing Arizona statute, which read as though it were that
          state's law. The heading now says what it actually is. */}
      <div className="section-label">Worked example: Arizona</div>
      <div className="law-panel">
        <h3>What Arizona law specifies (A.R.S. §33-1321)</h3>
        <ul>
          <li>
            Landlords must return the deposit — or an itemized written statement — within{" "}
            <strong>14 business days</strong> of move-out.
          </li>
          <li>
            Deductions must be itemized by category and dollar amount; vague line items like
            &ldquo;cleaning and repairs&rdquo; don&rsquo;t satisfy the law.
          </li>
          <li>
            If a landlord misses the deadline or won&rsquo;t explain deductions, tenants can send a
            written dispute and, if needed, file in small claims court.
          </li>
        </ul>
      </div>

      {/* The app deliberately ships no per-state table. Deposit rules differ
          everywhere, change without notice, and turn on details a table hides.
          What it can do is name exactly what to find, help find it, and keep
          what the renter found so it reaches the report. */}
      <div className="section-label">Find the rule for {stateName}</div>
      <div className="room-section">
        <p className="card-body">
          Casa Check does not ship the law for each state — it changes, and a wrong deadline here
          would be worse than none. Three things decide your case, and all three are in your
          state&rsquo;s statute:
        </p>
        <ol className="lookup-list">
          <li>
            <strong>The deadline.</strong> How long the landlord has after move-out, and whether it
            counts business days or calendar days.
          </li>
          <li>
            <strong>Whether an itemized statement is required</strong> — and whether a vague one
            counts.
          </li>
          <li>
            <strong>The penalty for missing it.</strong> Some states owe you more than the deposit
            when a landlord is late.
          </li>
        </ol>
        <p>
          <a className="lookup-link" href={search} target="_blank" rel="noopener noreferrer">
            Search the current law for {stateName}
          </a>
        </p>

        <div className="section-label">Record what you find</div>
        <p className="card-body">
          Kept with your record and printed on the report, so the deadline travels with the
          evidence.
        </p>
        <div className="field-row">
          <div className="field">
            <label htmlFor="deadlineDays">Landlord must respond within</label>
            <input
              id="deadlineDays"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 14"
              value={depositDeadlineDays}
              onChange={set("depositDeadlineDays")}
            />
          </div>
          <div className="field">
            <label htmlFor="deadlineBasis">Counted as</label>
            <select
              id="deadlineBasis"
              value={depositDeadlineBasis}
              onChange={set("depositDeadlineBasis")}
            >
              <option value="business">business days</option>
              <option value="calendar">calendar days</option>
            </select>
          </div>
        </div>
        <div className="field field-wide">
          <label htmlFor="lawSource">Where you found it</label>
          <input
            id="lawSource"
            type="text"
            placeholder="e.g. A.R.S. §33-1321, or a link"
            value={depositLawSource}
            onChange={set("depositLawSource")}
          />
        </div>

        {due && (
          <p className="deadline-result">
            From your move-out date, that is{" "}
            <strong>
              {due.due.toLocaleDateString([], { dateStyle: "long" })}
            </strong>{" "}
            — {depositDeadlineDays} {due.basis} after move-out.
            <span className="deadline-caveat">{DEADLINE_CAVEAT}</span>
          </p>
        )}
        {!due && depositDeadlineDays && !moveOutDate && (
          <p className="status-line" data-tone="muted">
            Add your move-out date on Property setup and this will work out the date for you.
          </p>
        )}
      </div>
    </>
  );
}
