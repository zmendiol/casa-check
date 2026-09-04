import { Component } from "react";

/**
 * Catches a render crash so the app shows a message instead of a white page.
 *
 * The reassurance matters here specifically: photos live in IndexedDB, not in
 * component state, so a UI crash has not lost anyone's evidence — but a blank
 * screen looks exactly like it has.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Casa Check hit a rendering error.", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="main">
        <div className="content">
          <h1 className="page-title">Something went wrong</h1>
          <p className="page-sub">
            Casa Check hit an unexpected error. <strong>Your photos are safe</strong> — they are
            stored in this browser, not in the page, so reloading should bring everything back.
          </p>
          <div className="room-section">
            <h3 className="card-title">What to try</h3>
            <p className="card-body">
              Reload the page first. If the error returns, open the Generate report step and export
              a backup so your record is safe outside the browser.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Casa Check
          </button>
          <p className="fine-print" style={{ marginTop: 18 }}>
            Technical detail: {String(this.state.error?.message || this.state.error)}
          </p>
        </div>
      </div>
    );
  }
}
