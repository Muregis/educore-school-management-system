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
    paymentDate: new Date().toISOString().slice(0, 10)
  });
  const [bankForm, setBankForm] = useState({
    bankName: "",
    referenceNumber: ""
  });
  const [mpesaForm, setMpesaForm] = useState({
    mpesaCode: ""
  });
  const [selectedClass, setSelectedClass] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Get unique classes from students
  const classes = [...new Set(students.map(s => s.class_name || s.className).filter(Boolean))].sort();

  useEffect(() => {
    if (isOpen) {
      resetForms();
    }
  }, [isOpen]);

  const resetForms = () => {
    setFormData({
      studentId: "",
      amount: "",
      paymentDate: new Date().toISOString().slice(0, 10)
    });
    setBankForm({
      bankName: "",
      referenceNumber: ""
    });
    setMpesaForm({
      mpesaCode: ""
    });
    setSelectedClass("");
    setFilteredStudents([]);
    setActiveTab("cash");
  };

  // Filter students when class is selected
  useEffect(() => {
    if (selectedClass) {
      const filtered = students.filter(s => 
        (s.class_name || s.className) === selectedClass
      );
      setFilteredStudents(filtered);
      // Reset student selection when class changes
      setFormData(prev => ({ ...prev, studentId: "" }));
    } else {
      setFilteredStudents([]);
    }
  }, [selectedClass, students]);

  const handleSubmit = async () => {
    const { studentId, amount, paymentDate } = formData;

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
        paymentDate
      };

      if (activeTab === "bank_transfer") {
        payload.referenceNumber = bankForm.referenceNumber;
        payload.bankName = bankForm.bankName;
      } else if (activeTab === "mpesa_manual") {
        payload.mpesaCode = mpesaForm.mpesaCode;
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
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
            Class *
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select class</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        {selectedClass && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
              Student *
            </label>
            <select
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select student</option>
              {filteredStudents.map(s => (
                <option key={s.id || s.student_id} value={s.id || s.student_id}>
                  {s.first_name} {s.last_name} ({s.admission_number || s.admission})
                </option>
              ))}
            </select>
          </div>
        )}

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
              label="Transaction/Slip Reference Number *"
              value={bankForm.referenceNumber}
              onChange={(e) => setBankForm({ ...bankForm, referenceNumber: e.target.value })}
              placeholder="Enter reference number"
              required
            />
          </>
        )}

        {activeTab === "mpesa_manual" && (
          <Field
            label="M-Pesa Transaction Code *"
            value={mpesaForm.mpesaCode}
            onChange={(e) => setMpesaForm({ ...mpesaForm, mpesaCode: e.target.value })}
            placeholder="e.g. QHX7Y8Z9AB"
            required
          />
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
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
