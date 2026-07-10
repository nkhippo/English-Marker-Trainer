export default function AppShell({ children }) {
  return (
    <div id="app-scroll" className="app-scroll">
      <div className="app-inner">{children}</div>
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="brand">
        <svg className="loom" viewBox="0 0 38 38" aria-hidden="true">
          <g stroke="var(--t1)" strokeWidth="3">
            <line x1="8" y1="4" x2="8" y2="34" />
            <line x1="16" y1="4" x2="16" y2="34" />
            <line x1="24" y1="4" x2="24" y2="34" />
            <line x1="32" y1="4" x2="32" y2="34" />
          </g>
          <g stroke="var(--t2)" strokeWidth="3">
            <line x1="4" y1="9" x2="34" y2="9" />
            <line x1="4" y1="17" x2="34" y2="17" />
            <line x1="4" y1="25" x2="34" y2="25" />
            <line x1="4" y1="33" x2="34" y2="33" />
          </g>
        </svg>
        <div>
          <div className="eyebrow">English · Marker Trainer</div>
          <div className="wordmark">英語マーカー感度トレーナー</div>
        </div>
      </div>
    </header>
  );
}

export function ProgressRail({ phase }) {
  return (
    <div className="rail" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i <= phase ? 'on' : ''} />
      ))}
    </div>
  );
}
