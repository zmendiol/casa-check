export const STEPS = [
  { id: "setup", label: "Property setup" },
  { id: "capture", label: "Photo walkthrough" },
  { id: "compare", label: "Compare rooms" },
  { id: "law", label: "Renter rights" },
  { id: "report", label: "Generate report" },
];

export const DEFAULT_ROOM_NAMES = ["Kitchen", "Living Room", "Bedroom", "Bathroom"];

/** The two documentation passes. Used as keys on every room object. */
export const MODES = {
  moveIn: { key: "moveIn", label: "Move-in" },
  moveOut: { key: "moveOut", label: "Move-out" },
};

export const MODE_KEYS = ["moveIn", "moveOut"];

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
];

/** Largest edge, in pixels, a stored photo is downscaled to. */
export const MAX_PHOTO_EDGE = 1000;

/** JPEG quality used when re-encoding a captured photo. */
export const PHOTO_QUALITY = 0.72;
