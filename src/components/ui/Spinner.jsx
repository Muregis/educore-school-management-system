import React from 'react';

export default function Spinner({ size = '24px', color = 'var(--color-primary)' }) {
  return (
    <div 
      className="ui-spinner"
      style={{
        width: size,
        height: size,
        border: '3px solid var(--color-bg-hover)',
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
