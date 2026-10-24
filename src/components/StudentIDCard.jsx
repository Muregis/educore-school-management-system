import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import qrcode from "qrcode-generator";
import { buildStudentVerificationUrl } from "../lib/qr";
import { printHTML } from "../lib/print";
import Btn from "./Btn";

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function StudentIDCard({ student, school, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    try {
      const qrContent = buildStudentVerificationUrl(student);
      const qr = qrcode(0, "L");
      qr.addData(qrContent);
      qr.make();
      const svg = qr.createSvgTag(4, 0);
      const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
      if (isMounted) {
        setQrDataUrl(dataUrl);
        setLoading(false);
      }
    } catch (err) {
      console.error("QR generation failed:", err);
      if (isMounted) setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [student]);

  const studentName = [student?.firstName || student?.first_name, student?.lastName || student?.last_name]
    .filter(Boolean)
    .join(" ") || "Student Name";
  const className = student?.className || student?.class_name || student?.class || "Unassigned";
  const rawAdm = student?.admission || student?.admission_number || "";
  const admNo = String(rawAdm).trim().toUpperCase();
  const admDisplay = admNo ? `ADM NO: ${admNo}` : "ADM NO: —";
  const schoolName = (school?.name || school?.school_name || "EduCore Academy").trim();
  const logoUrl = school?.logo_url || school?.logo || "";
  const photoUrl = student?.photoUrl || student?.photo_url || student?.photo || "";
  const academicYear = school?.year || school?.academic_year || new Date().getFullYear();

  const handlePrint = () => {
    const html = `
      <div class="id-card">
        <div class="card-header">
          <div class="school-brand">
            ${logoUrl ? `<img src="${logoUrl}" class="school-logo" alt="Logo" />` : `<div class="logo-fallback">${schoolName.charAt(0) || "E"}</div>`}
            <span class="school-title">${schoolName}</span>
          </div>
          <div class="id-badge">STUDENT ID</div>
        </div>
        <div class="card-body">
          <div class="photo-box">
            ${photoUrl ? `<img src="${photoUrl}" alt="Photo" />` : '<div class="photo-placeholder">PHOTO</div>'}
          </div>
          <div class="details-box">
            <div class="student-name">${studentName}</div>
            <div class="student-class">${className}</div>
            <div class="admission-pill">${admDisplay}</div>
          </div>
          <div class="qr-box">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" />` : ''}
          </div>
        </div>
        <div class="card-footer">
          <span>Valid: ${academicYear}</span>
          <span>OFFICIAL STUDENT CREDENTIAL</span>
        </div>
      </div>
      <style>
        @page { size: 85.6mm 54mm; margin: 0; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .id-card {
          width: 85.6mm;
          height: 54mm;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%);
          color: white;
          padding: 3.5mm 4mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 0.25mm solid rgba(255,255,255,0.18);
          padding-bottom: 1.5mm;
        }
        .school-brand {
          display: flex;
          align-items: center;
          gap: 1.8mm;
          max-width: 58mm;
        }
        .school-logo {
          width: 5mm;
          height: 5mm;
          object-fit: contain;
          border-radius: 1mm;
          background: rgba(255,255,255,0.15);
        }
        .logo-fallback {
          width: 5mm;
          height: 5mm;
          border-radius: 1mm;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6.5pt;
          font-weight: 800;
        }
        .school-title {
          font-size: 7.5pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .id-badge {
          background: #f59e0b;
          color: #0f172a;
          padding: 0.8mm 2.2mm;
          border-radius: 2mm;
          font-size: 5.5pt;
          font-weight: 800;
          letter-spacing: 0.4px;
          flex-shrink: 0;
        }
        .card-body {
          display: flex;
          align-items: center;
          gap: 3mm;
          margin: 1.5mm 0;
        }
        .photo-box {
          width: 17mm;
          height: 21mm;
          background: #e2e8f0;
          border: 0.4mm solid rgba(255,255,255,0.35);
          border-radius: 1.5mm;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .photo-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .photo-placeholder {
          color: #475569;
          font-size: 6pt;
          font-weight: 700;
        }
        .details-box {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.8mm;
        }
        .student-name {
          font-size: 10pt;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
        }
        .student-class {
          font-size: 7.5pt;
          opacity: 0.88;
        }
        .admission-pill {
          font-size: 7pt;
          font-weight: 700;
          background: rgba(255,255,255,0.2);
          border: 0.25mm solid rgba(255,255,255,0.3);
          padding: 0.6mm 2mm;
          border-radius: 1mm;
          display: inline-block;
          font-family: monospace;
          align-self: flex-start;
          margin-top: 0.5mm;
        }
        .qr-box {
          width: 15mm;
          height: 15mm;
          background: white;
          border-radius: 1.5mm;
          padding: 1mm;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .qr-box img {
          width: 100%;
          height: 100%;
          display: block;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 0.25mm solid rgba(255,255,255,0.18);
          padding-top: 1.2mm;
          font-size: 5.5pt;
          opacity: 0.8;
          letter-spacing: 0.3px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    `;

    printHTML(html, { title: `Student ID - ${studentName}`, timeout: 250 });
  };

  const handleDownload = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 428;
    const height = 270;
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    const [photoImg, qrImg, logoImg] = await Promise.all([
      loadImage(photoUrl),
      loadImage(qrDataUrl),
      loadImage(logoUrl),
    ]);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(0.5, "#1e3a8a");
    gradient.addColorStop(1, "#1d4ed8");

    // Clip rounded rectangle for card
    ctx.save();
    ctx.beginPath();
    const radius = 16;
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Accent glow
    const accentGrad = ctx.createRadialGradient(width, 0, 10, width, 0, 180);
    accentGrad.addColorStop(0, "rgba(59, 130, 246, 0.35)");
    accentGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    if (logoImg) {
      ctx.drawImage(logoImg, 18, 16, 26, 26);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(31, 29, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(schoolName.charAt(0) || "E", 31, 33);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillText(schoolName.toUpperCase(), 50, 33);

    // STUDENT ID badge
    const badgeWidth = 76;
    const badgeHeight = 20;
    const badgeX = width - badgeWidth - 18;
    const badgeY = 18;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 10);
    } else {
      ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
    }
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 9px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STUDENT ID", badgeX + badgeWidth / 2, badgeY + 13.5);
    ctx.textAlign = "left";

    // Header divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 52);
    ctx.lineTo(width - 18, 52);
    ctx.stroke();

    // Photo Box
    const photoX = 18;
    const photoY = 62;
    const photoW = 75;
    const photoH = 92;

    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(photoX, photoY, photoW, photoH, 8);
    } else {
      ctx.rect(photoX, photoY, photoW, photoH);
    }
    ctx.clip();
    if (photoImg) {
      ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = "#475569";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PHOTO", photoX + photoW / 2, photoY + photoH / 2 + 4);
      ctx.textAlign = "left";
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(photoX, photoY, photoW, photoH, 8);
    } else {
      ctx.rect(photoX, photoY, photoW, photoH);
    }
    ctx.stroke();

    // Details Column
    const detailsX = 104;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px Arial, sans-serif";
    ctx.fillText(studentName, detailsX, 85);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(className, detailsX, 108);

    // Admission Badge
    ctx.font = "bold 12px monospace, Arial, sans-serif";
    const admMetrics = ctx.measureText(admDisplay);
    const pillW = admMetrics.width + 16;
    const pillH = 24;
    const pillY = 122;

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(detailsX, pillY, pillW, pillH, 5);
    } else {
      ctx.rect(detailsX, pillY, pillW, pillH);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(admDisplay, detailsX + 8, pillY + 16);

    // QR Code Box
    const qrBoxSize = 78;
    const qrBoxX = width - qrBoxSize - 18;
    const qrBoxY = 68;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8);
    } else {
      ctx.rect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
    }
    ctx.fill();

    if (qrImg) {
      ctx.drawImage(qrImg, qrBoxX + 4, qrBoxY + 4, qrBoxSize - 8, qrBoxSize - 8);
    }

    // Footer
    const footerY = height - 28;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, footerY - 8);
    ctx.lineTo(width - 18, footerY - 8);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "10px Arial, sans-serif";
    ctx.fillText(`Valid: ${academicYear}`, 18, footerY + 8);

    ctx.font = "9px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("OFFICIAL STUDENT CREDENTIAL", width - 18, footerY + 8);
    ctx.textAlign = "left";

    ctx.restore();

    // Download file
    const link = document.createElement("a");
    link.download = `ID-${admNo || "student"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
      {/* Visual Card */}
      <div
        style={{
          width: "100%",
          aspectRatio: "85.6 / 54",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
          borderRadius: 14,
          padding: "14px 16px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "#ffffff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: 22, height: 22, borderRadius: 4, objectFit: "contain", background: "rgba(255,255,255,0.15)", padding: 2 }}
              />
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                {schoolName.charAt(0) || "E"}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.95)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {schoolName}
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            color: "#0f172a",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }}>
            STUDENT ID
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
          {/* Photo */}
          <div style={{
            width: 64,
            height: 76,
            borderRadius: 8,
            background: "#e2e8f0",
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#475569",
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Student" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                <div style={{ fontSize: 18 }}>👤</div>
                <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>PHOTO</div>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#ffffff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.2,
            }}>
              {studentName}
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.2,
            }}>
              {className}
            </div>
            <div style={{ marginTop: 2 }}>
              <span style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: 4,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}>
                {admDisplay}
              </span>
            </div>
          </div>

          {/* QR Code */}
          <div style={{
            width: 60,
            height: 60,
            background: "#ffffff",
            borderRadius: 8,
            padding: 4,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}>
            {loading ? (
              <span style={{ fontSize: 10, color: "#64748b" }}>...</span>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 10, color: "#94a3b8" }}>QR</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          paddingTop: 6,
          fontSize: 9,
          color: "rgba(255,255,255,0.75)",
          letterSpacing: "0.3px",
        }}>
          <span>Valid: {academicYear}</span>
          <span style={{ textTransform: "uppercase", fontSize: 8, letterSpacing: "0.5px" }}>Official Student Credential</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        {onClose && <Btn variant="ghost" onClick={onClose}>Close</Btn>}
        <Btn onClick={handlePrint}>🖨 Print</Btn>
        <Btn onClick={handleDownload} style={{ flex: 1 }}>⬇ Download PNG</Btn>
      </div>
    </div>
  );
}

StudentIDCard.propTypes = {
  student: PropTypes.object.isRequired,
  school: PropTypes.object.isRequired,
  onClose: PropTypes.func,
};
