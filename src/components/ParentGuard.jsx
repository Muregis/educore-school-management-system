/**
 * ParentGuard Component
 * 
 * Enforces parent → student binding at the component level.
 * Blocks portal render if no valid linkage exists.
 * 
 * Usage:
 *   <ParentGuard auth={auth} requiredPermission="view_grades">
 *     <ChildDashboard />
 *   </ParentGuard>
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { apiFetch } from '../lib/api';
import { C } from '../lib/theme';

export default function ParentGuard({ 
  auth, 
  children, 
  requiredPermission = 'view',
  fallback = null,
  onError
}) {
  const [isValidating, setIsValidating] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState(null);
  const [linkedStudents, setLinkedStudents] = useState([]);

  useEffect(() => {
    validateParentAccess();
  }, [auth]);

  const validateParentAccess = async () => {
    if (!auth?.token) {
      setError('No authentication token');
      setIsValidating(false);
      if (onError) onError('No authentication');
      return;
    }

    // Only enforce for parent role
    if (auth.role !== 'parent') {
      setHasAccess(true);
      setIsValidating(false);
      return;
    }

    try {
      // Check for linked students
      const result = await apiFetch('/parent/my-students', { 
        token: auth.token 
      });

      const students = result?.data || result || [];
      
      if (students.length === 0) {
        setError('No students linked to your account. Please contact school administration.');
        setHasAccess(false);
        if (onError) onError('No linked students');
      } else {
        setLinkedStudents(students);
        setHasAccess(true);
      }
    } catch (err) {
      console.error('Parent validation error:', err);
      setError('Unable to verify access. Please try again later.');
      setHasAccess(false);
      if (onError) onError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  if (isValidating) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '200px',
        color: C.textMuted 
      }}>
        <div>Verifying access...</div>
      </div>
    );
  }

  if (!hasAccess) {
    // Return custom fallback or default error
    if (fallback) {
      return fallback;
    }

    return (
      <div style={{ 
        padding: '40px 20px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        <div style={{ 
          fontSize: '48px',
          marginBottom: '20px'
        }}>🔒</div>
        <h2 style={{ 
          color: C.text,
          marginBottom: '16px',
          fontSize: '20px'
        }}>
          Access Restricted
        </h2>
        <p style={{ 
          color: C.textMuted,
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          {error || 'Unable to access parent portal.'}
        </p>
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: '16px',
          fontSize: '14px',
          color: C.textMuted,
          textAlign: 'left'
        }}>
          <strong>Need help?</strong>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Ensure your account is linked to your child(ren)</li>
            <li>Contact the school office to verify your account</li>
            <li>Check that you're using the correct login credentials</li>
          </ul>
        </div>
        <button
          onClick={validateParentAccess}
          style={{
            marginTop: '24px',
            padding: '10px 24px',
            background: C.accent,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Pass linked students to children via context or cloneElement
  return (
    <ParentGuardContext.Provider value={{ linkedStudents, hasAccess }}>
      {children}
    </ParentGuardContext.Provider>
  );
}

// Context for child components to access linked students
import { createContext, useContext } from 'react';

const ParentGuardContext = createContext({
  linkedStudents: [],
  hasAccess: false
});

export function useLinkedStudents() {
  return useContext(ParentGuardContext);
}

ParentGuard.propTypes = {
  auth: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
  requiredPermission: PropTypes.string,
  fallback: PropTypes.node,
  onError: PropTypes.func
};
