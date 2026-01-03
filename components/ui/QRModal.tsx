"use client";
import React, { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import QrScanner from "qr-scanner";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "display" | "scan";
  accountNumber?: string;
  onAccountScanned?: (accountNumber: string) => void;
}

export function QRModal({ isOpen, onClose, mode, accountNumber, onAccountScanned }: QRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [scanError, setScanError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [isHttps, setIsHttps] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  // Check if we're on HTTPS (required for camera on mobile)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsHttps(window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    }
  }, []);

  // Generate QR code for display mode
  useEffect(() => {
    if (mode === "display" && accountNumber && isOpen) {
      QRCode.toDataURL(accountNumber, {
        width: 200,
        margin: 2,
        color: {
          dark: "#0b1320",
          light: "#ffffff"
        }
      })
        .then(setQrDataUrl)
        .catch(() => setScanError("Failed to generate QR code"));
    }
  }, [mode, accountNumber, isOpen]);

  // Setup QR scanner for scan mode
  useEffect(() => {
    // Don't auto-start, let user click the permission button
    return () => {
      stopScanning();
    };
  }, [mode, isOpen]);

  const requestCameraPermission = async () => {
    setPermissionRequested(true);
    setScanError("");
    setIsScanning(true);

    try {
      // Use QR Scanner's built-in permission handling which works better on mobile
      if (!videoRef.current) return;

      // Check if camera is available first
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setScanError("No camera found on this device");
        setIsScanning(false);
        return;
      }

      // Create QR scanner instance - this will handle permissions internally
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          if (result?.data) {
            const scannedData = result.data.trim();
            if (scannedData && onAccountScanned) {
              onAccountScanned(scannedData);
              onClose();
            }
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
          maxScansPerSecond: 5, // Reduce CPU usage
        }
      );

      // Start scanner - this will trigger permission request on mobile
      await qrScannerRef.current.start();
      setPermissionGranted(true);
      
    } catch (error: any) {
      console.error("Camera permission error:", error);
      setIsScanning(false);
      
      // Handle different types of errors
      if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
        setScanError("Camera permission denied. Please allow camera access and try again.");
      } else if (error.name === 'NotFoundError') {
        setScanError("No camera found on this device.");
      } else if (error.name === 'NotSupportedError') {
        setScanError("Camera not supported on this device or browser.");
      } else {
        setScanError("Unable to access camera. Make sure you're using HTTPS and camera is not being used by another app.");
      }
    }
  };

  const startScanning = async () => {
    // This function is now handled by requestCameraPermission
    // Keeping it for the "Try Again" functionality
    if (!qrScannerRef.current) {
      requestCameraPermission();
      return;
    }

    try {
      setScanError("");
      setIsScanning(true);
      await qrScannerRef.current.start();
    } catch (error) {
      console.error("Scanner restart error:", error);
      setScanError("Failed to restart camera scanner. Please try again.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    setScanError("");
    setQrDataUrl("");
    setPermissionGranted(false);
    setPermissionRequested(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === "display" ? "My QR Code" : "Scan QR Code"}</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          {mode === "display" && (
            <div className="qr-display">
              {qrDataUrl ? (
                <div className="qr-container">
                  <img src={qrDataUrl} alt="QR Code" className="qr-image" />
                  <p className="qr-account">Account: {accountNumber}</p>
                  <p className="qr-instructions">Show this QR code to the sender</p>
                </div>
              ) : (
                <div className="loading">Generating QR code...</div>
              )}
            </div>
          )}
          
          {mode === "scan" && (
            <div className="qr-scanner">
              {!isHttps && (
                <div className="permission-denied">
                  <div className="error-icon">🔒</div>
                  <h4>HTTPS Required</h4>
                  <p>Camera access requires a secure connection (HTTPS) on mobile devices. Please access this site via HTTPS.</p>
                  <button className="btn ghost" onClick={handleClose}>
                    Close
                  </button>
                </div>
              )}

              {isHttps && !permissionRequested && (
                <div className="permission-request">
                  <div className="camera-icon">📷</div>
                  <h4>Camera Access Required</h4>
                  <p>To scan QR codes, we need access to your camera. Make sure no other app is using it.</p>
                  <button className="btn primary" onClick={requestCameraPermission}>
                    Start Camera
                  </button>
                </div>
              )}
              
              {isHttps && permissionRequested && scanError && (
                <div className="permission-denied">
                  <div className="error-icon">❌</div>
                  <h4>Camera Issue</h4>
                  <p>{scanError}</p>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn" onClick={requestCameraPermission}>
                      Try Again
                    </button>
                    <button className="btn ghost" onClick={handleClose}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isHttps && permissionGranted && isScanning && (
                <>
                  <video
                    ref={videoRef}
                    className="scanner-video"
                    playsInline
                    muted
                  />
                  <div className="scan-instructions">
                    <p>Point your camera at a QR code</p>
                    <button className="btn ghost" onClick={handleClose} style={{ marginTop: '12px' }}>
                      Cancel Scan
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add CSS styles
const styles = `
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card);
  border-radius: 12px;
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  border: 1px solid var(--border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  color: var(--text);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: var(--text);
}

.modal-body {
  padding: 20px;
}

.qr-display {
  text-align: center;
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border: 2px solid var(--border);
  border-radius: 8px;
}

.qr-account {
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.qr-instructions {
  color: var(--muted);
  margin: 0;
  font-size: 14px;
}

.qr-scanner {
  text-align: center;
}

.permission-request,
.permission-denied {
  padding: 40px 20px;
  text-align: center;
}

.camera-icon,
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.permission-request h4,
.permission-denied h4 {
  margin: 0 0 12px 0;
  color: var(--text);
}

.permission-request p,
.permission-denied p {
  margin: 0 0 20px 0;
  color: var(--muted);
  line-height: 1.5;
}

.scanner-video {
  width: 100%;
  max-width: 300px;
  height: 300px;
  border-radius: 8px;
  background: #000;
  object-fit: cover;
}

.scan-error {
  margin-top: 16px;
  color: var(--danger);
}

.scan-error p {
  margin: 0 0 12px 0;
}

.scan-instructions {
  margin-top: 16px;
  color: var(--muted);
}

.scan-instructions p {
  margin: 0;
}

.loading {
  color: var(--muted);
  padding: 40px;
}
`;

// Inject styles
if (typeof document !== "undefined" && !document.getElementById("qr-modal-styles")) {
  const styleSheet = document.createElement("style");
  styleSheet.id = "qr-modal-styles";
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}