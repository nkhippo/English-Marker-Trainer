export default function LoadingScreen({ message = '10問を用意しています' }) {
  return (
    <>
      <header className="top">
        <div className="brand">Marker Trainer</div>
        <div className="brand-name">生成中…</div>
        <div className="brand-sub">{message}</div>
      </header>
      <div className="screen loading-screen">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-options" />
      </div>
    </>
  );
}
