import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import Field from "./Field";
import Btn from "./Btn";
import { apiFetch } from "../lib/api";
import { C, inputStyle } from "../lib/theme";

const BANK_OPTIONS = [
  "Equity", "KCB", "Co-op", "Absa", "NCBA", "DTB", "Family Bank", "Other"
];

export default function RecordPaymentModal({ 
  isOpen, 
  onClose, 
  students, 
  auth, 
  school, 
  onSuccess,
  toast 
}) {
  const [activeTab, setActiveTab] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    studentId: "",
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountNumber: "",
    referenceNumber: "",
    proofUrl: ""
  });
  const [mpesaForm, setMpesaForm] = useState({
    mpesaCode: "",
    mpesaPhone: ""
  });
  const [studentSearch, setStudentSearch] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);

  useEffect(() => {
    if (studentSearch) {
      const filtered = students.filter(s => {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase();
        const admission = (s.admission_number || s.admission || "").toLowerCase();
        return name.includes(studentSearch.toLowerCase()) || admission.includes(studentSearch.toLowerCase());
      });
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students.slice(0, 20));
    }
  }, [studentSearch, students]);

  useEffect(() => {
    if (isOpen) {
      resetForms();
    }
  }, [isOpen]);

  const resetForms = () => {
    setFormData({
      studentId: "",
      amount: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: ""
    });
    setBankForm({
      bankName: "",
      accountNumber: "",
      referenceNumber: "",
      proofUrl: ""
    });
    setMpesaForm({
      mpesaCode: "",
      mpesaPhone: ""
    });
    setStudentSearch("");
    setActiveTab("cash");
  };

  const handleSubmit = async () => {
    const { studentId, amount, paymentDate, notes } = formData;

    if (!studentId) {
      return toast("Please select a student", "error");
    }
    if (!amount || parseFloat(amount) <= 0) {
      return toast("Please enter a valid amount", "error");
    }

    if (activeTab === "bank_transfer" && !bankForm.referenceNumber) {
      return toast("Bank reference number is required", "error");
    }

    if (activeTab === "mpesa_manual" && !mpesaForm.mpesaCode) {
      return toast("M-Pesa transaction code is required", "error");
    }

    setLoading(true);
    try {
      const payload = {
        studentId: parseInt(studentId),
        amount: parseFloat(amount),
        paymentMethod: activeTab,
        paymentDate,
        notes
      };

      if (activeTab === "bank_transfer") {
        payload.referenceNumber = bankForm.referenceNumber;
        payload.bankName = bankForm.bankName;
        payload.accountNumber = bankForm.accountNumber;
        payload.proofUrl = bankForm.proofUrl;
      } else if (activeTab === "mpesa_manual") {
        payload.mpesaCode = mpesaForm.mpesaCode;
        payload.mpesaPhone = mpesaForm.mpesaPhone;
      }

      const response = await apiFetch("/payments/record-manual", {
        method: "POST",
        body: payload,
        token: auth?.token
      });

      toast(`Payment recorded — Receipt: ${response.receiptNumber}`, "success");
      resetForms();
      onClose();
      
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (err) {
      toast(err.message || "Failed to record payment", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedStudent = students.find(s => 
    (s.id || s.student_id) === parseInt(formData.studentId)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Manual Payment">
      <div style={{ minWidth: "500px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #334155", paddingBottom: 8 }}>
          {[
            { id: "cash", label: "Cash" },
            { id: "bank_transfer", label: "Bank Transfer" },
            { id: "mpesa_manual", label: "M-Pesa Manual" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === tab.id ? "#3b82f6" : "transparent",
                color: activeTab === tab.id ? "white" : "#94a3b8",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Common Fields */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
            Student *
          </label>
          <input
            type="text"
            placeholder="Search by name or admission number..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={inputStyle}
          />
          {studentSearch && filteredStudents.length > 0 && (
            <div style={{
              maxHeight: 150,
              overflowY: "auto",
              border: "1px solid #334155",
              borderRadius: 6,
              marginTop: 4,
              background: "#1e293b"
            }}>
              {filteredStudents.map(s => (
                <div
                  key={s.id || s.student_id}
                  onClick={() => {
                    setFormData({ ...formData, studentId: s.id || s.student_id });
                    setStudentSearch(`${s.first_name} ${s.last_name} (${s.admission_number || s.admission})`);
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #334155",
                    fontSize: 13,
                    color: "#e2e8f0"
                  }}
                >
                  {s.first_name} {s.last_name} ({s.admission_number || s.admission})
                </div>
              ))}
            </div>
          )}
          {selectedStudent && (
            <div style={{ marginTop: 4, color: "#10b981", fontSize: 12 }}>
              Selected: {selectedStudent.first_name} {selectedStudent.last_name}
            </div>
          )}
        </div>

        <Field
          label="Amount (KES) *"
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="Enter amount"
        />

        <Field
          label="Date Received *"
          type="date"
          value={formData.paymentDate}
          onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
        />

        {/* Tab-specific Fields */}
        {activeTab === "bank_transfer" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
                Bank Name
              </label>
              <select
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select bank</option>
                {BANK_OPTIONS.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>

            <Field
              label="Account Number"
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              placeholder="Enter account number"
            />

            <Field
              label="Transaction/Slip Reference Number *"
              value={bankForm.referenceNumber}
              onChange={(e) => setBankForm({ ...bankForm, referenceNumber: e.target.value })}
              placeholder="Enter reference number"
              required
            />

            <Field
              label="Proof Image URL"
              value={bankForm.proofUrl}
              onChange={(e) => setBankForm({ ...bankForm, proofUrl: e.target.value })}
              placeholder="Enter proof URL"
            />
          </>
        )}

        {activeTab === "mpesa_manual" && (
          <>
            <Field
              label="M-Pesa Transaction Code *"
              value={mpesaForm.mpesaCode}
              onChange={(e) => setMpesaForm({ ...mpesaForm, mpesaCode: e.target.value })}
              placeholder="e.g. QHX7Y8Z9AB"
              required
            />

            <Field
              label="Phone Number"
              value={mpesaForm.mpesaPhone}
              onChange={(e) => setMpesaForm({ ...mpesaForm, mpesaPhone: e.target.value })}
              placeholder="Enter phone number"
            />
          </>
        )}

        <Field
          label="Notes (Optional)"
          type="textarea"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional notes..."
          rows={2}
        />

        {/* Received By - Auto-filled */}
        <div style={{ marginBottom: 16, color: "#94a3b8", fontSize: 12 }}>
          Received by: {auth?.user?.full_name || auth?.user?.name || "Current User"}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Btn>
          <Btn 
            onClick={handleSubmit} 
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Recording..." : "Record Payment"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

RecordPaymentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  students: PropTypes.array.isRequired,
  auth: PropTypes.object.isRequired,
  school: PropTypes.object,
  onSuccess: PropTypes.func,
  toast: PropTypes.func.isRequired
};
