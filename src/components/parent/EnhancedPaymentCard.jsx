import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Btn from '../Btn';
import Badge from '../Badge';
import Modal from '../Modal';
import { C } from '../../lib/theme';
import { money } from '../../lib/utils';
import { apiFetch } from '../../lib/api';

/**
 * EnhancedPaymentCard - Parent portal payment component
 * Shows balance, payment progress, installments, quick pay
 */
export default function EnhancedPaymentCard({ auth, student, onPaymentSuccess }) {
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState(student?.parent_phone || '');
  const [processing, setProcessing] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeDate, setPledgeDate] = useState('');

  useEffect(() => {
    loadPaymentData();
  }, [student]);

  const loadPaymentData = async () => {
    if (!student?.student_id) return;

    try {
      // Get active payment plan
      const plan = await apiFetch(`/students/${student.student_id}/payment-plan`, { token: auth.token });
      setPaymentPlan(plan.data);

      // Get current balance
      const balanceData = await apiFetch(`/students/${student.student_id}/balance`, { token: auth.token });
      setBalance(balanceData.balance || 0);

      // Set default pay amount
      if (plan.data?.installments) {
        const nextPending = plan.data.installments.find(i => i.status === 'pending');
        if (nextPending) {
          setPayAmount(String(nextPending.amount));
        }
      } else {
        setPayAmount(String(balanceData.balance || 0));
      }
    } catch (err) {
      console.error('Failed to load payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMpesaSTK = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    if (!mpesaPhone) return;

    setProcessing(true);
    try {
      const result = await apiFetch('/cashflow/mpesa/stk-push', {
        method: 'POST',
        token: auth.token,
        body: {
          studentId: student.student_id,
          amount: parseFloat(payAmount),
          phoneNumber: mpesaPhone,
          invoiceId: paymentPlan?.invoice_id
        }
      });

      alert('M-Pesa STK push sent! Check your phone and enter your PIN to complete payment.');
      setShowPayModal(false);
      
      // Poll for payment completion
      pollForPayment(result.data.transactionId);
    } catch (err) {
      alert('Failed to initiate payment: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const pollForPayment = async (transactionId) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (10 second intervals)

    const check = async () => {
      attempts++;
      try {
        const result = await apiFetch(`/cashflow/mpesa/status/${transactionId}`, { token: auth.token });
        
        if (result.data.status === 'completed') {
          alert('Payment successful! Thank you.');
          loadPaymentData();
          if (onPaymentSuccess) onPaymentSuccess();
          return;
        }

        if (result.data.status === 'failed') {
          alert('Payment failed: ' + result.data.result_desc);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 10000);
        }
      } catch (err) {
        if (attempts < maxAttempts) {
          setTimeout(check, 10000);
        }
      }
    };

    check();
  };

  const handleMakePledge = async () => {
    if (!pledgeAmount || !pledgeDate) return;

    try {
      await apiFetch('/cashflow/pledges', {
        method: 'POST',
        token: auth.token,
        body: {
          studentId: student.student_id,
          invoiceId: paymentPlan?.invoice_id,
          amount: parseFloat(pledgeAmount),
          promisedDate: pledgeDate
        }
      });

      alert('Thank you for your commitment! You will receive a reminder 2 days before your pledged date.');
      setShowPledgeModal(false);
      loadPaymentData();
    } catch (err) {
      alert('Failed to record pledge: ' + err.message);
    }
  };

  if (loading) return <div style={{ color: C.textMuted }}>Loading payment info...</div>;

  const progress = paymentPlan 
    ? (paymentPlan.paid_amount / paymentPlan.total_amount) * 100 
    : 0;

  return (
    <div style={{ 
      background: C.card, 
      borderRadius: 12, 
      padding: 24,
      border: `1px solid ${C.border}`
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: C.text }}>
          💳 School Fees
        </h3>
        <Badge 
          text={balance > 0 ? 'Balance Due' : 'Paid'} 
          tone={balance > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Balance Display */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Current Balance
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: balance > 0 ? C.accent : '#22c55e' }}>
          {money(balance)}
        </div>
        {paymentPlan && (
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
            of {money(paymentPlan.total_amount)} total
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {paymentPlan && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            height: 8, 
            background: C.border, 
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: progress >= 100 ? '#22c55e' : C.accent,
              borderRadius: 4,
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: 8,
            fontSize: 12,
            color: C.textMuted
          }}>
            <span>{Math.round(progress)}% paid</span>
            <span>{money(paymentPlan.paid_amount)} of {money(paymentPlan.total_amount)}</span>
          </div>
        </div>
      )}

      {/* Installment Tracker */}
      {paymentPlan?.installments && paymentPlan.installments.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>Installment Progress</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paymentPlan.installments.map((inst, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: inst.status === 'paid' ? '#22c55e20' : 
                             inst.status === 'overdue' ? '#ef444420' : C.surface,
                  border: `1px solid ${inst.status === 'paid' ? '#22c55e' : 
                                     inst.status === 'overdue' ? '#ef4444' : C.border}`,
                  textAlign: 'center',
                  minWidth: 80
                }}
              >
                <div style={{ fontSize: 11, color: C.textMuted }}>#{idx + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {money(inst.amount)}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted }}>
                  {inst.due_date}
                </div>
                {inst.status === 'paid' && <span style={{ fontSize: 10, color: '#22c55e' }}>✓ Paid</span>}
                {inst.status === 'pending' && <span style={{ fontSize: 10, color: '#f59e0b' }}>⏳ Pending</span>}
                {inst.status === 'overdue' && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠️ Overdue</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {balance > 0 && (
          <Btn onClick={() => setShowPayModal(true)} style={{ flex: 1 }}>
            📱 Pay Now with M-Pesa
          </Btn>
        )}
        
        {!paymentPlan && balance > 0 && (
          <Btn onClick={() => setShowPledgeModal(true)} variant="outline" style={{ flex: 1 }}>
            📝 Make Payment Pledge
          </Btn>
        )}
      </div>

      {/* Communication Preferences */}
      <div style={{ 
        marginTop: 20, 
        padding: 12, 
        background: C.surface, 
        borderRadius: 8,
        fontSize: 12,
        color: C.textMuted
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📢 Reminder preference: {student?.preferred_contact_method || 'SMS'}</span>
          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: C.accent,
              cursor: 'pointer',
              fontSize: 12
            }}
            onClick={() => alert('Preferences can be updated in Settings')}
          >
            Change
          </button>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <Modal onClose={() => setShowPayModal(false)} title="Pay School Fees">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
                Amount (KES)
              </label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                max={balance}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 18
                }}
              />
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                Full balance: {money(balance)} | 
                Suggested: {paymentPlan?.installments?.find(i => i.status === 'pending')?.amount 
                  ? money(paymentPlan.installments.find(i => i.status === 'pending').amount)
                  : money(balance)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={e => setMpesaPhone(e.target.value)}
                placeholder="2547XX XXX XXX"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 16
                }}
              />
            </div>

            <div style={{ 
              padding: 12, 
              background: '#22c55e10', 
              borderRadius: 8,
              fontSize: 13,
              color: '#22c55e'
            }}>
              ✓ You will receive an M-Pesa STK push on your phone. Enter your PIN to confirm.
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Btn onClick={() => setShowPayModal(false)} variant="ghost" style={{ flex: 1 }}>
                Cancel
              </Btn>
              <Btn 
                onClick={handleMpesaSTK} 
                disabled={processing || !payAmount || !mpesaPhone}
                style={{ flex: 2 }}
              >
                {processing ? 'Sending...' : `Pay ${money(parseFloat(payAmount) || 0)}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Pledge Modal */}
      {showPledgeModal && (
        <Modal onClose={() => setShowPledgeModal(false)} title="Make Payment Pledge">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>
              Commit to paying by a specific date. We'll send you a reminder 2 days before.
            </p>

            <div>
              <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
                Amount You Plan to Pay (KES)
              </label>
              <input
                type="number"
                value={pledgeAmount}
                onChange={e => setPledgeAmount(e.target.value)}
                max={balance}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 16
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
                When Will You Pay?
              </label>
              <input
                type="date"
                value={pledgeDate}
                onChange={e => setPledgeDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 16
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Btn onClick={() => setShowPledgeModal(false)} variant="ghost" style={{ flex: 1 }}>
                Cancel
              </Btn>
              <Btn 
                onClick={handleMakePledge}
                disabled={!pledgeAmount || !pledgeDate}
                style={{ flex: 1 }}
              >
                Confirm Pledge
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

EnhancedPaymentCard.propTypes = {
  auth: PropTypes.object.isRequired,
  student: PropTypes.object.isRequired,
  onPaymentSuccess: PropTypes.func
};

// Simple Modal wrapper (use your actual Modal component)
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
        maxWidth: 400,
        width: '90%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.text }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
