import React from 'react';

export default function Select({ label, options = [], error, className = '', style = {}, ...props }) {
  return (
    <div className={`ui-select-wrapper ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...style }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </label>
      )}
      <select 
        style={{
          width: '100%',
          background: 'var(--color-bg-card)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0 var(--space-3)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: 'var(--shadow-xs)',
          minHeight: 40,
          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='292.4' height='292.4'%3E%3Cpath fill='%2394A3B8' d='M287 69.4a17.6 17.6 0 0 0-13-5.4H18.4c-5 0-9.3 1.8-12.9 5.4A17.6 17.6 0 0 0 0 82.2c0 5 1.8 9.3 5.4 12.9l128 127.9c3.6 3.6 7.8 5.4 12.8 5.4s9.2-1.8 12.8-5.4L287 95c3.5-3.5 5.4-7.8 5.4-12.8 0-5-1.9-9.2-5.5-12.8z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px top 50%',
          backgroundSize: '10px auto',
        }}
        onFocus={(e) => { 
          if (!error) {
            e.target.style.borderColor = 'var(--color-border-focus)';
            e.target.style.boxShadow = '0 0 0 3px var(--color-primary-ring)';
          }
        }}
        onBlur={(e) => { 
          if (!error) {
            e.target.style.borderColor = 'var(--color-border)';
            e.target.style.boxShadow = 'var(--shadow-xs)';
          }
        }}
        {...props}
      >
        {options.map((opt, i) => {
          const value = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={i} value={value}>
              {label}
            </option>
          );
        })}
      </select>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}