import React from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import Btn from "./Btn";
import { printHTML } from "../lib/print";

export default function PaymentReceipt({ isOpen, onClose, receipt, school }) {
  const schoolInfo = school || {};
  const schoolName = schoolInfo.name || schoolInfo.school_name || "School";
  const logoUrl = schoolInfo.logo_url || "";
  const motto = schoolInfo.motto || schoolInfo.tagline || "";
  const address = schoolInfo.address || "";
  const phone = schoolInfo.phone || "";
  const email = schoolInfo.email || "";
  const hasContact = address || phone || email;

  const handlePrint = () => {
    const html = `
      <div class="print-document">
        <!-- School Header with Branding -->
        <div class="print-header">
          <div class="print-header-content">
            ${logoUrl ? `<div class="print-header-logo"><img src="${logoUrl}" alt="${schoolName} logo" style="max-width:60px;max-height:60px;object-fit:contain;"></div>` : ""}
            <div class="print-header-info ${!logoUrl ? "print-header-info-full" : ""}">
              <h1 class="print-header-school-name">${schoolName}</h1>
              ${motto ? `<p class="print-header-motto">${motto}</p>` : ""}
              ${hasContact ? `
                <div class="print-header-contact">
                  ${address ? `<span>${address}</span>` : ""}
                  ${phone ? `<span>${phone}</span>` : ""}
                  ${email ? `<span>${email}</span>` : ""}
                </div>
              ` : ""}
            </div>
          </div>
          <div class="print-header-title">Payment Receipt</div>
          <div class="print-header-divider"></div>
        </div>

        <!-- Receipt Content -->
        <div class="receipt-content">
          <div class="row"><span>Student</span><strong>${receipt?.studentName || "N/A"}</strong></div>
          <div class="row"><span>Amount</span><strong>KES ${Number(receipt?.amount || 0).toLocaleString()}</strong></div>
          <div class="row"><span>Payment Method</span><strong>${receipt?.method || "N/A"}</strong></div>
          <div class="row"><span>Receipt Number</span><strong>${receipt?.reference || "N/A"}</strong></div>
          <div class="row"><span>Date</span><strong>${receipt?.date || new Date().toLocaleDateString()}</strong></div>
          ${receipt?.receivedBy ? `<div class="row"><span>Received By</span><strong>${receipt.receivedBy}</strong></div>` : ""}
        </div>

        <div class="receipt-footer">
          <p>Thank you for your payment.</p>
          <p class="receipt-stamp">Official Receipt from ${schoolName}</p>
        </div>

        <style>
          .print-document{font-family:'Segoe UI',Arial,sans-serif;padding:20px;max-width:210mm;margin:auto;color:#1f2937;background:white}
          .print-header{margin-bottom:20px;width:100%}
          .print-header-content{display:flex;align-items:center;gap:20px;padding-bottom:16px}
          .print-header-logo{flex-shrink:0}
          .print-header-logo img{max-width:60px;max-height:60px;object-fit:contain;border-radius:4px}
          .print-header-info{flex:1;text-align:center}
          .print-header-info-full{text-align:left}
          .print-header-school-name{font-size:20px;font-weight:800;margin:0 0 4px 0;color:#1f2937;line-height:1.2}
          .print-header-motto{font-size:13px;font-style:italic;color:#6b7280;margin:0 0 8px 0}
          .print-header-contact{font-size:10px;color:#6b7280;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
          .print-header-info-full .print-header-contact{justify-content:flex-start}
          .print-header-title{text-align:center;font-size:14px;font-weight:600;color:#374151;margin:12px 0;text-transform:uppercase;letter-spacing:1px}
          .print-header-divider{height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:12px 0}
          .receipt-content{margin:24px 0}
          .row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e5e7eb;font-size:14px}
          .row span{color:#6b7280}
          .row strong{color:#111827;font-weight:600}
          .receipt-footer{margin-top:40px;text-align:center}
          .receipt-footer p{color:#6b7280;font-size:12px;margin:4px 0}
          .receipt-stamp{margin-top:24px;padding:8px 16px;border:2px solid #c9a84c;border-radius:4px;display:inline-block;color:#c9a84c;font-weight:600;font-size:12px;text-transform:uppercase}
          @media print{
            .print-document{padding:0}
            .print-header-divider{background:#999!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .receipt-stamp{-webkit-print-color-adjust:exact;print-color-adjust:exact}
            body{background:white!important;color:black!important}
          }
        </style>
      </div>
    `;

    printHTML(html, { title: `Receipt - ${receipt?.studentName || "Payment"}` });
  };

  if (!receipt) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Receipt">
      <div style={{ minWidth: "400px", padding: "20px" }}>
        {/* School Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          {logoUrl && (
            <img src={logoUrl} alt={`${schoolName} logo`} style={{ maxWidth: "60px", maxHeight: "60px", marginBottom: "12px" }} />
          )}
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "800", color: "#1f2937" }}>{schoolName}</h2>
          {motto && <p style={{ margin: "0 0 8px 0", fontSize: "13px", fontStyle: "italic", color: "#6b7280" }}>{motto}</p>}
          {hasContact && (
            <div style={{ fontSize: "11px", color: "#6b7280", display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
              {address && <span>{address}</span>}
              {phone && <span>{phone}</span>}
              {email && <span>{email}</span>}
            </div>
          )}
          <div style={{ 
            height: "2px", 
            background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", 
            margin: "16px 0" 
          }}></div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "1px" }}>
            Payment Receipt
          </div>
        </div>

        {/* Receipt Details */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
            <span style={{ color: "#6b7280" }}>Student</span>
            <strong style={{ color: "#111827" }}>{receipt.studentName}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
            <span style={{ color: "#6b7280" }}>Amount</span>
            <strong style={{ color: "#111827", fontSize: "16px" }}>KES {Number(receipt.amount).toLocaleString()}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
            <span style={{ color: "#6b7280" }}>Payment Method</span>
            <strong style={{ color: "#111827" }}>{receipt.method}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
            <span style={{ color: "#6b7280" }}>Receipt Number</span>
            <strong style={{ color: "#111827" }}>{receipt.reference}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
            <span style={{ color: "#6b7280" }}>Date</span>
            <strong style={{ color: "#111827" }}>{receipt.date}</strong>
          </div>
          {receipt.receivedBy && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
              <span style={{ color: "#6b7280" }}>Received By</span>
              <strong style={{ color: "#111827" }}>{receipt.receivedBy}</strong>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <p style={{ color: "#6b7280", fontSize: "12px", margin: "4px 0" }}>Thank you for your payment.</p>
          <div style={{ 
            marginTop: "24px", 
            padding: "8px 16px", 
            border: "2px solid #c9a84c", 
            borderRadius: "4px", 
            display: "inline-block", 
            color: "#c9a84c", 
            fontWeight: "600", 
            fontSize: "12px", 
            textTransform: "uppercase" 
          }}>
            Official Receipt from {schoolName}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "24px" }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={handlePrint}>🖨️ Print Receipt</Btn>
        </div>
      </div>
    </Modal>
  );
}

PaymentReceipt.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  receipt: PropTypes.shape({
    studentName: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    reference: PropTypes.string,
    method: PropTypes.string,
    date: PropTypes.string,
    receivedBy: PropTypes.string
  }),
  school: PropTypes.object
};
