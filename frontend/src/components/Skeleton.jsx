/** Skeleton loading shimmer — §5 spec */
export function SkeletonCard() {
  return (
    <div className="skeleton sk-card" aria-hidden="true">
      <div className="sk-img skeleton" />
      <div className="sk-body">
        <div className="skeleton" style={{ height: 16, width: '80%' }} />
        <div className="skeleton" style={{ height: 14, width: '50%' }} />
        <div className="skeleton" style={{ height: 20, width: '60%' }} />
      </div>
    </div>
  );
}

export function SkeletonCircle({ size = 120 }) {
  return (
    <div
      className="skeleton sk-circle"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBanner() {
  return (
    <div
      className="skeleton"
      style={{ aspectRatio: '21 / 8', borderRadius: 20 }}
      aria-hidden="true"
    />
  );
}
