export default function LoadingAnimation() {
  return (
    <div className="page-loading" role="status" aria-label="Loading scoreboard">
      <video className="page-loading-video" autoPlay loop muted playsInline preload="auto" aria-hidden="true">
        <source src="/assets/loading-animation.mp4" type="video/mp4" />
      </video>
      <span>Loading scoreboard…</span>
    </div>
  );
}
