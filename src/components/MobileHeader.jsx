import React from 'react';
import PropTypes from 'prop-types';

export default function MobileHeader({
  schoolName,
  studentName,
  avatar,
  onNotificationClick,
  notificationCount = 0
}) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        <div>
          <div className="mobile-header-school">{schoolName}</div>
          {studentName && (
            <div className="mobile-header-student">{studentName}</div>
          )}
        </div>
      </div>

      <div className="mobile-header-right">
        {onNotificationClick && (
          <button
            className="mobile-btn mobile-btn-ghost"
            onClick={onNotificationClick}
            style={{
              width: 40,
              height: 40,
              padding: 0,
              position: 'relative',
              borderRadius: '50%'
            }}
            aria-label="Notifications"
          >
            🔔
            {notificationCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#F43F5E',
                border: '2px solid #0B1120'
              }} />
            )}
          </button>
        )}

        {avatar && (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `linear-gradient(135deg, #3B82F6, #6366f1)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 800,
            color: '#fff'
          }}>
            {avatar}
          </div>
        )}
      </div>
    </header>
  );
}

MobileHeader.propTypes = {
  schoolName: PropTypes.string.isRequired,
  studentName: PropTypes.string,
  avatar: PropTypes.string,
  onNotificationClick: PropTypes.func,
  notificationCount: PropTypes.number
};