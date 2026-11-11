import React, { Suspense, Component, type ReactNode } from 'react';
import { useStore } from './store';
import { APP_MAP } from './appRegistry';
import { OwlLogo } from '../components/OwlLogo';
import { Icon } from '../components/Icon';

/* Error boundary: a broken app must never blank the phone. */
class AppErrorBoundary extends Component<{ children: ReactNode; appId: string }, { error: Error | null }> {
  constructor(props: { children: ReactNode; appId: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.warn('[OWL] app crashed', this.props.appId, error);
  }
  render() {
    if (this.state.error) {
      const back = () => useStore.getState().closeApp();
      return (
        <div className="empty" style={{ paddingTop: 60 }}>
          <div className="big">🦉</div>
          <div><strong>This app hit a snag.</strong></div>
          <div className="tiny" style={{ maxWidth: 260 }}>{String(this.state.error.message || this.state.error)}</div>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn primary" onClick={back}>Home screen</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="appFrame">
      <div className="empty" style={{ paddingTop: 80 }}>
        <OwlLogo size={34} glow />
        <div className="spinner" style={{ marginTop: 4 }} />
        <div className="tiny">Loading…</div>
      </div>
    </div>
  );
}

function AppMissing({ id }: { id: string }) {
  return (
    <div className="empty">
      <div className="big">🦉</div>
      <div>Unknown application “{id}”.</div>
      <button className="btn primary" onClick={() => useStore.getState().closeApp()}>Home</button>
    </div>
  );
}

export function AppWindow() {
  const appId = useStore((s) => s.appId);
  const appParams = useStore((s) => s.appParams);
  if (!appId) return null;
  const meta = APP_MAP[appId];
  if (!meta) return <AppMissing id={appId} />;
  const Lazy = React.lazy(meta.load);
  return (
    <AppErrorBoundary appId={appId}>
      <Suspense fallback={<Loading />}>
        <Lazy {...appParams} />
      </Suspense>
    </AppErrorBoundary>
  );
}

export default AppWindow;
