export default function AppShell({ children }) {
  return (
    <div id="app-scroll" className="app-scroll">
      <div className="app-inner">{children}</div>
    </div>
  );
}

export function AppHeader({ title = '英語マーカー感度トレーナー' }) {
  return (
    <div className="app-header">
      <h1 className="app-title">{title}</h1>
    </div>
  );
}
