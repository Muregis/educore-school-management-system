import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Btn from '../components/Btn';
import Badge from '../components/Badge';
import Table from '../components/Table';
import { C } from '../lib/theme';
import { money } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

/**
 * CashFlowDashboard - Admin view for cash-flow analytics
 * Shows forecast, collections, pledges, risk students
 */
export default function CashFlowDashboard({ auth }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadPendingApprovals();
  }, [auth]);

  const loadDashboard = async () => {
    try {
      const data = await apiFetch('/cashflow/dashboard', { token: auth.token });
      setDashboard(data.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const data = await apiFetch('/cashflow/reminders/pending-approval', { token: auth.token });
      setPendingApprovals(data.data || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    }
  };

  const approveReminders = async (queueIds) => {
    try {
      await apiFetch('/cashflow/reminders/approve', {
        method: 'POST',
        token: auth.token,
        body: { queueIds }
      });
      loadPendingApprovals();
      alert('Reminders approved and sent');
    } catch (err) {
      alert('Failed to approve: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Loading...</div>;

  const summary = dashboard?.summary || {};
  const weeklyData = dashboard?.forecast?.weekly_breakdown || [];
  const riskStudents = dashboard?.forecast?.risk_students || [];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: C.text }}>Cash-Flow Dashboard</h2>
        {pendingApprovals.length > 0 && (
          <Btn onClick={() => setShowApprovalModal(true)} tone="warning">
            ⚠️ {pendingApprovals.length} Pending Approvals
          </Btn>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPICard
          label="Expected This Term"
          value={money(summary.totalExpected)}
          tone="info"
          icon="💰"
        />
        <KPICard
          label="Collected So Far"
          value={money(summary.totalCollected)}
          tone="success"
          icon="✅"
          subtitle={`${Math.round((summary.totalCollected / summary.totalExpected) * 100) || 0}% collected`}
        />
        <KPICard
          label="Projected"
          value={money(summary.projected)}
          tone="warning"
          icon="📈"
          subtitle={`${summary.confidence}% confidence`}
        />
        <KPICard
          label="At Risk"
          value={money(summary.atRisk)}
          tone="danger"
          icon="⚠️"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {['overview', 'forecast', 'pledges', 'risk', 'reminders'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            style={{
              padding: '12px 20px',
              background: selectedTab === tab ? C.accent : 'transparent',
              color: selectedTab === tab ? '#fff' : C.text,
              border: 'none',
              borderBottom: selectedTab === tab ? `2px solid ${C.accent}` : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div>
          <div style={{ background: C.card, padding: 20, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: C.text }}>Weekly Collection Projection</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="week" stroke={C.textMuted} />
                  <YAxis stroke={C.textMuted} tickFormatter={v => `KES ${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: C.card, border: `1px solid ${C.border}` }}
                    formatter={v => money(v)}
                  />
                  <Bar dataKey="expected" fill={C.accent} opacity={0.3} name="Expected" />
                  <Bar dataKey="projected" fill={C.accent} name="Projected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginTop: 0, color: C.text }}>Active Pledges</h4>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.accent }}>
                {dashboard?.activePledges || 0}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                Parent commitments to pay
              </div>
            </div>

            <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
              <h4 style={{ marginTop: 0, color: C.text }}>Recent Reminders</h4>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {dashboard?.recentReminders?.slice(0, 3).map((rem, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                    {rem.message_type} - {new Date(rem.sent_at).toLocaleDateString()}
                    {rem.was_effective && <Badge text="Effective" tone="success" style={{ marginLeft: 8 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'forecast' && (
        <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: C.text }}>Forecast Details</h3>
            <Btn onClick={() => apiFetch('/cashflow/forecasts/generate', { 
              method: 'POST', 
              token: auth.token,
              body: { term: 'Term 2', academicYear: '2026' }
            }).then(() => loadDashboard())}>
              🔄 Refresh Forecast
            </Btn>
          </div>

          <Table
            headers={['Metric', 'Value']}
            rows={[
              ['Total Expected', money(dashboard?.forecast?.total_expected)],
              ['Total Collected', money(dashboard?.forecast?.total_collected)],
              ['Projected Collection', money(dashboard?.forecast?.projected_collection)],
              ['Confirmed Pledges', money(dashboard?.forecast?.confirmed_pledges_total)],
              ['Pending Pledges (weighted)', money(dashboard?.forecast?.pending_pledges_total)],
              ['Historical Fulfillment Rate', `${dashboard?.forecast?.historical_fulfillment_rate}%`],
              ['Confidence Score', `${dashboard?.forecast?.confidence_score}%`],
            ]}
          />
        </div>
      )}

      {selectedTab === 'risk' && (
        <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: C.text }}>Risk Students</h3>
          <p style={{ color: C.textMuted }}>
            Students with high risk of non-payment based on:
            overdue days, no payment history, broken pledges, large balances
          </p>

          <Table
            headers={['Student', 'Balance', 'Risk Score', 'Factors']}
            rows={riskStudents.map(student => [
              student.student_name,
              money(student.balance),
              <Badge 
                key={student.student_id}
                text={`${student.risk_score}%`} 
                tone={student.risk_score > 80 ? 'danger' : student.risk_score > 50 ? 'warning' : 'info'}
              />,
              student.risk_factors?.join(', ')
            ])}
          />
        </div>
      )}

      {selectedTab === 'pledges' && <PledgesPanel auth={auth} />}
      {selectedTab === 'reminders' && <RemindersPanel auth={auth} />}

      {/* Approval Modal */}
      {showApprovalModal && (
        <Modal onClose={() => setShowApprovalModal(false)} title="Approve Reminders">
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <p style={{ color: C.textMuted, fontSize: 13 }}>
              These reminders require approval before sending (escalated tone or large batch).
            </p>
            
            {pendingApprovals.map(reminder => (
              <div key={reminder.log_id} style={{ 
                padding: 12, 
                border: `1px solid ${C.border}`, 
                borderRadius: 8, 
                marginBottom: 8,
                background: C.surface
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: C.text }}>
                    {reminder.students?.first_name} {reminder.students?.last_name}
                  </strong>
                  <Badge text={reminder.escalation_level} tone="warning" />
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {reminder.channel} | {reminder.message_type}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn onClick={() => setShowApprovalModal(false)} variant="ghost">
                Cancel
              </Btn>
              <Btn onClick={() => approveReminders(pendingApprovals.map(r => r.log_id))}>
                Approve All ({pendingApprovals.length})
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

CashFlowDashboard.propTypes = {
  auth: PropTypes.object.isRequired
};

// Sub-components
function KPICard({ label, value, tone, icon, subtitle }) {
  const colors = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6'
  };

  return (
    <div style={{ 
      background: C.card, 
      padding: 20, 
      borderRadius: 12,
      borderLeft: `4px solid ${colors[tone]}`
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginTop: 4 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function PledgesPanel({ auth }) {
  const [pledges, setPledges] = useState([]);

  useEffect(() => {
    apiFetch('/cashflow/pledges/stats?startDate=2026-01-01', { token: auth.token })
      .then(data => console.log('Pledge stats:', data));
  }, [auth]);

  return (
    <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
      <h3 style={{ marginTop: 0, color: C.text }}>Pledge Management</h3>
      <p style={{ color: C.textMuted }}>Track parent payment commitments and fulfillment.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        <div style={{ textAlign: 'center', padding: 16, background: C.surface, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>0</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Fulfilled</div>
        </div>
        <div style={{ textAlign: 'center', padding: 16, background: C.surface, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>0</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Pending</div>
        </div>
        <div style={{ textAlign: 'center', padding: 16, background: C.surface, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>0</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Broken</div>
        </div>
      </div>
    </div>
  );
}

function RemindersPanel({ auth }) {
  return (
    <div style={{ background: C.card, padding: 20, borderRadius: 12 }}>
      <h3 style={{ marginTop: 0, color: C.text }}>Reminder History</h3>
      <p style={{ color: C.textMuted }}>View all sent reminders and their effectiveness.</p>
      
      <div style={{ marginTop: 16 }}>
        <Btn onClick={() => {}}>📤 Send Batch Reminders</Btn>
      </div>
    </div>
  );
}

// Placeholder Modal component (use your actual Modal)
function Modal({ children, onClose, title }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: C.card,
        padding: 24,
        borderRadius: 12,
        maxWidth: 500,
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
