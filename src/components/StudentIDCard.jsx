import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import qrcode from "qrcode-generator";
import { C } from "../lib/theme";
import { buildStudentVerificationUrl } from "../lib/qr";
import Btn from "./Btn";

export default function StudentIDCard({ student, school, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const generateQR = async () => {
    try {
      const qrContent = buildStudentVerificationUrl(student);

      const qr = qrcode(0, 'L');
      qr.addData(qrContent);
      qr.make();
      const svg = qr.createSvgTag(4, 0);
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      setQrDataUrl(dataUrl);
      setLoading(false);
    } catch (err) {
      console.error("QR generation failed:", err);
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Student ID - ${student.firstName || student.first_name}</title>
          <style>
            @page { size: 85.6mm 54mm; margin: 0; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            .id-card {
              width: 85.6mm;
              height: 54mm;
              background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
              color: white;
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
            }
            .id-card-front {
              padding: 8px 12px;
              display: flex;
              gap: 10px;
            }
            .photo-area {
              width: 50px;
              height: 60px;
              background: #e2e8f0;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #4a5568;
              font-size: 10px;
              flex-shrink: 0;
              overflow: hidden;
            }
            .photo-area img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .info-area {
              flex: 1;
            }
            .school-name {
              font-size: 9px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
              opacity: 0.9;
            }
            .student-name {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .student-class {
              font-size: 10px;
              opacity: 0.85;
              margin-bottom: 4px;
            }
            .admission-no {
              font-size: 11px;
              font-weight: 600;
              background: rgba(255,255,255,0.2);
              padding: 2px 6px;
              border-radius: 3px;
              display: inline-block;
            }
            .qr-area {
              position: absolute;
              right: 10px;
              bottom: 8px;
              background: white;
              padding: 4px;
              border-radius: 4px;
            }
            .qr-area img {
              width: 50px;
              height: 50px;
            }
            .validity {
              position: absolute;
              bottom: 8px;
              left: 12px;
              font-size: 7px;
              opacity: 0.7;
            }
            .id-type {
              position: absolute;
              top: 8px;
              right: 10px;
              font-size: 8px;
              background: #f6ad55;
              color: #1a202c;
              padding: 2px 6px;
              border-radius: 3px;
              font-weight: bold;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="id-card id-card-front">
            <div class="id-type">STUDENT</div>
            <div class="photo-area">${student.photoUrl ? `<img src="${student.photoUrl}" alt="Photo" />` : 'Photo'}</div>
            <div class="info-area">
              <div class="school-name">
                ${school.logo_url ? `<img src="${school.logo_url}" style="width:16px;height:16px;border-radius:2px;margin-right:4px;vertical-align:middle" />` : ''}
                ${school.name}
              </div>
              <div class="student-name">${student.firstName || student.first_name} ${student.lastName || student.last_name}</div>
              <div class="student-class">${student.className || student.class_name || "Grade 1"}</div>
              <div class="admission-no">${student.admission || student.admission_number}</div>
            </div>
            <div class="qr-area">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="validity">Valid: ${school.year || new Date().getFullYear()}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 324; // 85.6mm at 96 DPI
    const height = 204; // 54mm at 96 DPI
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a365d");
    gradient.addColorStop(1, "#2c5282");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // ID Type badge
    ctx.fillStyle = "#f6ad55";
    ctx.fillRect(width - 70, 10, 60, 18);
    ctx.fillStyle = "#1a202c";
    ctx.font = "bold 10px Arial";
    ctx.fillText("STUDENT", width - 65, 23);

    // Photo
    let photoLoaded = false;
    let qrLoaded = false;
    let photoImg, qrImg;

    const checkComplete = () => {
      if (photoLoaded && qrLoaded) {
        // Validity
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "8px Arial";
        ctx.fillText(`Valid: ${school.year || new Date().getFullYear()}`, 12, height - 15);

        // Download
        const link = document.createElement("a");
        link.download = `ID-${student.admission || student.admission_number}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };

    if (student.photoUrl) {
      photoImg = new Image();
      photoImg.crossOrigin = "anonymous";
      photoImg.onload = () => {
        ctx.drawImage(photoImg, 12, 15, 50, 60);
        photoLoaded = true;
        checkComplete();
      };
      photoImg.onerror = () => {
        // Fallback to placeholder
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(12, 15, 50, 60);
        ctx.fillStyle = "#4a5568";
        ctx.font = "10px Arial";
        ctx.fillText("Photo", 25, 48);
        photoLoaded = true;
        checkComplete();
      };
      photoImg.src = student.photoUrl;
    } else {
      // Photo placeholder
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(12, 15, 50, 60);
      ctx.fillStyle = "#4a5568";
      ctx.font = "10px Arial";
      ctx.fillText("Photo", 25, 48);
      photoLoaded = true;
    }

    // School name
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 9px Arial";
    ctx.fillText((school.name || "School Name").toUpperCase(), 70, 20);

    // Student name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial";
    ctx.fillText(`${student.firstName || student.first_name} ${student.lastName || student.last_name}`, 70, 45);

    // Class
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(student.className || student.class_name || "Grade 1", 70, 62);

    // Admission number
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(70, 70, 100, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(student.admission || student.admission_number, 78, 85);

    // QR Code
    if (qrDataUrl) {
      qrImg = new Image();
      qrImg.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(width - 70, height - 70, 58, 58);
        ctx.drawImage(qrImg, width - 68, height - 68, 54, 54);
        qrLoaded = true;
        checkComplete();
      };
      qrImg.src = qrDataUrl;
    } else {
      qrLoaded = true;
      checkComplete();
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      padding: 20,
    }}>
      <div style={{
        background: C.surface,
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: "100%",
        maxHeight: "90vh",
        overflow: "auto",
      }}>
        <h3 style={{ margin: "0 0 16px", color: C.text }}>Student ID Card</h3>
        
        {/* ID Card Preview */}
        <div style={{
          width: "100%",
          aspectRatio: "1.586", // 85.6mm / 54mm
          background: "linear-gradient(135deg, #1a365d 0%, #2c5282 100%)",
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          padding: "12px 16px",
          boxSizing: "border-box",
          marginBottom: 20,
        }}>
          {/* ID Type Badge */}
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "#f6ad55",
            color: "#1a202c",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
          }}>STUDENT</div>

          {/* Photo Area */}
          <div style={{
            width: 60,
            height: 70,
            background: "#e2e8f0",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4a5568",
            fontSize: 11,
            float: "left",
            marginRight: 12,
            overflow: "hidden",
          }}>
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt="Student photo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              "Photo"
            )}
          </div>

          {/* Info */}
          <div style={{ color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {school.logo_url && (
                <img src={school.logo_url} alt="Logo" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }} />
              )}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.9 }}>
                {school.name || "School Name"}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
              {student.firstName || student.first_name} {student.lastName || student.last_name}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              {student.className || student.class_name || "Grade 1"}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              background: "rgba(255,255,255,0.2)",
              padding: "3px 8px",
              borderRadius: 4,
              display: "inline-block",
            }}>
              {student.admission || student.admission_number}
            </div>
          </div>

          {/* QR Code */}
          <div style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            background: "#fff",
            padding: 6,
            borderRadius: 6,
            width: 60,
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {loading ? (
              <span style={{ fontSize: 10, color: "#666" }}>...</span>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR" style={{ width: "100%", height: "100%" }} />
            ) : (
              <span style={{ fontSize: 10, color: "#999" }}>QR</span>
            )}
          </div>

          {/* Validity */}
          <div style={{
            position: "absolute",
            bottom: 12,
            left: 16,
            fontSize: 9,
            color: "rgba(255,255,255,0.7)",
          }}>
            Valid: {school.year || new Date().getFullYear()}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={handlePrint}>🖨 Print</Btn>
          <Btn onClick={handleDownload} style={{ flex: 1 }}>⬇ Download PNG</Btn>
        </div>
      </div>
    </div>
  );
}

StudentIDCard.propTypes = {
  student: PropTypes.object.isRequired,
  school: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};
