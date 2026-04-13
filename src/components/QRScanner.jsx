import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Html5QrcodeScanner } from "html5-qrcode";
import { C } from "../lib/theme";

const QRScanner = ({ onScan, onClose, title = "Scan QR Code" }) => {
  const [isScanning, setIsScanning] = useState(true);
  const scannerInstance = useRef(null);

  const handleScanSuccess = useCallback(async (decodedText) => {
    try {
      setIsScanning(false);
      if (scannerInstance.current) {
        scannerInstance.current.clear().catch(console.error);
      }
      onScan(decodedText);
    } catch (err) {
      console.error("QR scan error:", err);
    }
  }, [onScan]);

  useEffect(() => {
    if (!scannerInstance.current && isScanning) {
      scannerInstance.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      scannerInstance.current.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore errors, just keep scanning
        }
      );
    }

    return () => {
      if (scannerInstance.current) {
        scannerInstance.current.clear().catch(console.error);
      }
    };
  }, [isScanning, handleScanSuccess]);

  const handleClose = () => {
    setIsScanning(false);
    if (scannerInstance.current) {
      scannerInstance.current.clear().catch(console.error);
    }
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        maxWidth: 500,
        width: "100%",
        maxHeight: "90vh",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: 20,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <h3 style={{ margin: 0, color: C.text }}>{title}</h3>
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              cursor: "pointer",
              fontSize: 24,
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8
            }}
          >
            ×
          </button>
        </div>

        {/* Scanner */}
        <div style={{ padding: 20 }}>
          <div id="qr-reader" style={{
            width: "100%",
            maxWidth: 400,
            margin: "0 auto"
          }}></div>
          <p style={{
            textAlign: "center",
            color: C.textMuted,
            fontSize: 14,
            marginTop: 16
          }}>
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};

QRScanner.propTypes = {
  onScan: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string
};

export default QRScanner;