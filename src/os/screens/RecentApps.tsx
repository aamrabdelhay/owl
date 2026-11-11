import React from 'react';
import { useStore } from '../store';
import { APP_MAP, appName } from '../appRegistry';
import { AppIcon } from '../../components/AppIcon';

export function RecentApps() {
  const open = useStore((s) => s.recentOpen);
  const setOpen = useStore((s) => s.setRecentOpen);
  const recent = useStore((s) => s.recentApps);
  const openApp = useStore((s) => s.openApp);
  const closeApp = useStore((s) => s.closeApp);
  const clear = useStore((s) => s.clearRecent);
  const lang = useStore((s) => s.settings.language);
  if (!open) return null;
  return (
    <div className="recentLayer" role="dialog" aria-label="Switch application">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <strong style={{ fontSize: 11, flex: 1 }}>Switch application</strong>
        <button className="btn" style={{ fontSize: 9 }} onClick={clear}>Clear</button>
        <button className="btn" style={{ fontSize: 9 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      {recent.length === 0 ? (
        <div className="empty" style={{ padding: 20 }}>
          <div className="big">🦉</div>
          <div>No recent apps. Hold <b>Menu</b> to come back here.</div>
        </div>
      ) : (
        <div className="recentRow">
          <button
            className="recentCard"
            onClick={() => { setOpen(false); closeApp(); }}
            style={{ flexBasis: 74 }}
          >
            <span className="rcHead">Home</span>
            <span className="rcBody">🏠</span>
          </button>
          {recent.map((id) => {
            const meta = APP_MAP[id];
            if (!meta) return null;
            return (
              <button
                key={id}
                className="recentCard"
                onClick={() => { setOpen(false); openApp(id); }}
                aria-label={appName(id, lang)}
              >
                <span className="rcHead"><AppIcon id={id} size={14} /> {appName(id, lang)}</span>
                <span className="rcBody" style={{ fontSize: 24 }}>{meta.icon === 'snake' ? '🐍' : ''}<AppIcon id={id} size={30} /></span>
              </button>
            );
          })}
        </div>
      )}
      <div className="tiny" style={{ textAlign: 'center' }}>Hold Menu for this row · Enter opens · Back returns</div>
    </div>
  );
}

export default RecentApps;
