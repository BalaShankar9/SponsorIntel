import React, { Component, Suspense, lazy } from "react";

// Public navigation must not import the dashboard or its management tools.
// Keep this declaration at module scope so navigation preserves React's cache.
const OwnerDashboard = lazy(() =>
  import("./owner").then((module) => ({ default: module.OwnerDashboard })),
);

class OwnerPageBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="career-panel" role="alert">
          <h1>The dashboard couldn’t open.</h1>
          <p>Check your connection and reload this page to try again.</p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Reload dashboard
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

export function OwnerPage({ go }: { go: (view: string) => void }) {
  return (
    <OwnerPageBoundary>
      <Suspense
        fallback={
          <section className="career-panel" role="status" aria-live="polite">
            <h1>Opening your dashboard…</h1>
            <p>Loading your management tools.</p>
          </section>
        }
      >
        <OwnerDashboard go={go} />
      </Suspense>
    </OwnerPageBoundary>
  );
}
