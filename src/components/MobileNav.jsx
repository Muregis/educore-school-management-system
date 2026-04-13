import React from 'react';
import PropTypes from 'prop-types';

export default function MobileNav({ items, activeItem, onItemClick }) {
  return (
    <nav className="mobile-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={`mobile-nav-item ${activeItem === item.id ? 'active' : ''}`}
          onClick={() => onItemClick(item.id)}
          aria-label={item.label}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

MobileNav.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  activeItem: PropTypes.string.isRequired,
  onItemClick: PropTypes.func.isRequired
};