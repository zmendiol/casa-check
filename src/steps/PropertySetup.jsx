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
