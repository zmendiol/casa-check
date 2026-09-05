import { Sidebar } from "./components/Sidebar.jsx";
import { StorageWarning } from "./components/StorageWarning.jsx";
import { UploadBanner } from "./components/UploadBanner.jsx";
import { CompareRooms } from "./steps/CompareRooms.jsx";
import { GenerateReport } from "./steps/GenerateReport.jsx";
import { PhotoWalkthrough } from "./steps/PhotoWalkthrough.jsx";
import { PropertySetup } from "./steps/PropertySetup.jsx";
import { RenterRights } from "./steps/RenterRights.jsx";
import { useStore } from "./state/store.jsx";

/** Step id -> screen. Adding a step means adding it here and in STEPS. */
const SCREENS = {
  setup: PropertySetup,
  capture: PhotoWalkthrough,
  compare: CompareRooms,
  law: RenterRights,
  report: GenerateReport,
};

export function App() {
  const { state } = useStore();
  const Screen = SCREENS[state.step] ?? PropertySetup;

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <div className="content">
          <StorageWarning />
          <UploadBanner />
          <Screen />
        </div>
      </main>
    </div>
  );
}
