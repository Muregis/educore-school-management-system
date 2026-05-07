import React from 'react';

export default function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-sm)', style = {} }) {
  return (
    <div 
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, rgba(15, 25, 47, 0.3) 25%, rgba(30, 48, 82, 0.5) 50%, rgba(15, 25, 47, 0.3) 75%)",
        ...style
      }}
    />
  );
}

export function SkeletonGroup({ count = 3, className = "" }) {
  return (
    <div className={`stagger-in ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height="16px" style={{ marginBottom: "var(--space-2)" }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ style = {} }) {
  return (
    <div 
      className="ui-card animate-in"
      style={{
        padding: "var(--space-4)",
        ...style
      }}
    >
      <Skeleton height="24px" width="70%" style={{ marginBottom: "var(--space-3)" }} />
      <Skeleton height="16px" width="90%" style={{ marginBottom: "var(--space-2)" }} />
      <Skeleton height="16px" width="80%" style={{ marginBottom: "var(--space-2)" }} />
      <Skeleton height="16px" width="60%" />
    </div>
  );
}