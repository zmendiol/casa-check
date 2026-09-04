/* Inline SVG icons. Paths are unchanged from the original prototype. */

const base = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function SetupIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6M9 15h6M9 7h6" />
    </svg>
  );
}

export function CaptureIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function CompareIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <rect x="13" y="5" width="8" height="14" rx="1.5" />
      <path d="M7 9v6M17 9v6" />
    </svg>
  );
}

export function LawIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v18M7 21h10" />
      <path d="m5 8 3-4 3 4M2 8h6M17 8l3-4 3 4M15 8h6" />
      <path d="M5 8a3 3 0 0 0 6 0M14 8a3 3 0 0 0 6 0" />
    </svg>
  );
}

export function ReportIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function HouseIcon(props) {
  return (
    <svg {...base} width="18" height="18" stroke="#0E6B5C" {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

/** Keyed by step id so the nav can look an icon up by step. */
export const STEP_ICONS = {
  setup: SetupIcon,
  capture: CaptureIcon,
  compare: CompareIcon,
  law: LawIcon,
  report: ReportIcon,
};
