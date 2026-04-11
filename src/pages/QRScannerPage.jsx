import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Html5QrcodeScanner } from "html5-qrcode";
import Btn from "../components/Btn";
import { C } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";

export default function QRScannerPage({ auth, students, payments, feeStructures, toast }) {
  const [scannedData, setScannedData] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstance = useRef(null);

  useEffect(() => {
    if (!scannerInstance.current) {
      scannerInstance.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scannerInstance.current.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore errors, just keep scanning
        }
      );
    }

    return () => {
      if (scannerInstance.current) {
        scannerInstance.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleScanSuccess = async (qrText) => {
    try {
      const data = JSON.parse(qrText);
      setScannedData(data);
      setLoading(true);

      // Find student by ID or admission
      const student = students.find(s =>
        (s.id || s.student_id) === data.id ||
        (s.admission || s.admission_number) === data.admission
      );

      if (!student) {
        toast("Student not found", "error");
        setLoading(false);
        return;
      }

      // Get student's payments
      const studentPayments = payments.filter(p =>
        (p.studentId || p.student_id) === (student.id || student.student_id)
      );

      // Calculate balance
      const expectedFees = feeStructures.find(fs =>
        fs.className === student.className || fs.class_name === student.className
      );
      const totalExpected = expectedFees ?
        Number(expectedFees.tuition) + Number(expectedFees.activity) + Number(expectedFees.misc) : 0;
      const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = totalExpected - totalPaid;

      setStudentInfo({
        student,
        payments: studentPayments,
        totalExpected,
        totalPaid,
        balance
      });

      toast("Student data loaded", "success");
    } catch (err) {
      console.error("QR scan error:", err);
      toast("Invalid QR code", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScannedData(null);
    setStudentInfo(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: C.text }}>QR Code Scanner</h2>

      {!scannedData ? (
        <div>
          <p style={{ marginBottom: 20, color: C.textMuted }}>
            Scan a student ID QR code to view their fee balance and payment history.
          </p>
          <div id="qr-reader" style={{ width: "100%", maxWidth: 500 }}></div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ color: C.text }}>Student Information</h3>
            <Btn onClick={resetScan} variant="secondary">Scan Another</Btn>
          </div>

          {loading ? (
            <p>Loading student data...</p>
          ) : studentInfo ? (
            <div style={{ background: C.card, padding: 20, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: C.text, marginBottom: 10 }}>Student Details</h4>
                  <p><strong>Name:</strong> {studentInfo.student.firstName || studentInfo.student.first_name} {studentInfo.student.lastName || studentInfo.student.last_name}</p>
                  <p><strong>Class:</strong> {studentInfo.student.className || studentInfo.student.class_name}</p>
                  <p><strong>Admission:</strong> {studentInfo.student.admission || studentInfo.student.admission_number}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: C.text, marginBottom: 10 }}>Fee Summary</h4>
                  <p><strong>Total Expected:</strong> {money(studentInfo.totalExpected)}</p>
                  <p><strong>Total Paid:</strong> {money(studentInfo.totalPaid)}</p>
                  <p style={{ color: studentInfo.balance > 0 ? C.rose : C.green }}>
                    <strong>Balance:</strong> {money(studentInfo.balance)}
                  </p>
                </div>
              </div>

              <h4 style={{ color: C.text, marginBottom: 10 }}>Payment History</h4>
              {studentInfo.payments.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Date</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Amount</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentInfo.payments.map((payment, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
                          {new Date(payment.date || payment.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
                          {money(payment.amount)}
                        </td>
                        <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
                          {payment.method || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: C.textMuted }}>No payments found</p>
              )}
            </div>
          ) : (
            <p style={{ color: C.rose }}>Failed to load student data</p>
          )}
        </div>
      )}
    </div>
  );
}

QRScannerPage.propTypes = {
  auth: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  payments: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};