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
  const { state } = useStore();
  const stateName = state.property.stateName || "your state";

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

      <p className="fine-print">
        Arizona is shown as a worked example. Search &ldquo;{stateName} security deposit law&rdquo;
        for the specifics that apply to you.
      </p>
    </>
  );
}
