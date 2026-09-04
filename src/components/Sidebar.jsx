import { STEPS } from "../lib/constants.js";
import { HouseIcon, STEP_ICONS } from "../lib/icons.jsx";
import { useStore } from "../state/store.jsx";

export function Sidebar() {
  const { state, dispatch } = useStore();

  return (
    <nav className="sidebar" aria-label="Documentation steps">
      <p className="brand">
        <HouseIcon />
        Casa Check
      </p>
      <p className="brand-sub">
        Move-in / move-out documentation for college renters — any campus, any state.
      </p>

      <ul className="steps">
        {STEPS.map((step) => {
          const Icon = STEP_ICONS[step.id];
          const active = state.step === step.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                className={`step-btn${active ? " active" : ""}`}
                aria-current={active ? "step" : undefined}
                onClick={() => dispatch({ type: "SET_STEP", step: step.id })}
              >
                <Icon />
                {step.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        Not legal advice. Renter protection laws vary by state — verify specifics for where you
        live.
      </div>
    </nav>
  );
}
