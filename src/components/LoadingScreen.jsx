export default function LoadingScreen({ message = '10問を用意しています' }) {
  return (
    <div className="loading-screen">
      <p className="loading-message">{message}</p>
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-options" />
    </div>
  );
}
