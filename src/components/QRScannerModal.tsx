import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  FlipHorizontal, 
  Flashlight, 
  FlashlightOff, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  FileImage
} from 'lucide-react';
import jsQR from 'jsqr';
import { soundFx } from '../utils/sound';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchQuery?: (query: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onSearchQuery
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop current camera stream safely
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Start camera stream with multi-level fallback
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setScannedData(null);
    setUploadError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this browser or platform.');
      }

      let stream: MediaStream | null = null;

      // 1. Try with ideal facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (firstErr) {
        // 2. Fallback to any default video device
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }

      streamRef.current = stream;

      // Check if device supports torch
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        setHasTorch(Boolean(capabilities?.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        setActiveTab('camera');
      }
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      const isNoDevice = err.name === 'NotFoundError' || 
                         err.name === 'DevicesNotFoundError' || 
                         errMsg.includes('device not found') ||
                         errMsg.includes('requested device');
      
      let msg = 'Unable to access camera.';
      if (isNoDevice) {
        msg = 'No physical camera detected on this system. You can easily upload or drag-and-drop a QR code image to scan.';
        setActiveTab('upload'); // Automatically switch to image upload tab
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser, or upload a QR image.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'Camera constraints could not be satisfied. You can upload a QR image below.';
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [stopCamera]);

  // Frame scanning loop using jsqr
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan with jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && code.data.trim()) {
          soundFx.playClick('ok');
          if (navigator.vibrate) {
            try { navigator.vibrate(200); } catch (_) {}
          }
          setScannedData(code.data);
          stopCamera();
          return; // Stop animation loop on match
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera]);

  // Start loop when camera is active and in camera tab
  useEffect(() => {
    if (cameraActive && !scannedData && activeTab === 'camera') {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, scannedData, activeTab, scanFrame]);

  // Manage modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setScannedData(null);
      setCameraError(null);
      setUploadError(null);
      setPreviewImage(null);
      // Attempt camera first
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Listen to paste event (e.g. user captures screenshot of QR and pastes Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          handleFileUpload(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const newTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorch } as any]
        });
        setTorchOn(newTorch);
      } catch (e) {
        console.warn('Torch constraint error:', e);
      }
    }
  };

  // Flip Camera (environment <-> user)
  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Process uploaded QR code image
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setUploadError(null);
    setIsProcessingUpload(true);
    soundFx.playClick('switch');

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewImage(dataUrl);

      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data && code.data.trim()) {
            soundFx.playClick('ok');
            setScannedData(code.data);
            stopCamera();
          } else {
            setUploadError('No valid QR code found in this image. Please upload a clear photo of a QR code.');
          }
        }
        setIsProcessingUpload(false);
      };
      img.onerror = () => {
        setUploadError('Failed to decode image file. Please select another image.');
        setIsProcessingUpload(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
      setIsProcessingUpload(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = () => {
    if (!scannedData) return;
    navigator.clipboard.writeText(scannedData);
    setCopied(true);
    soundFx.playClick('switch');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearch = () => {
    if (!scannedData) return;
    if (onSearchQuery) {
      const query = scannedData.replace(/^https?:\/\//i, '').split('/')[0] || scannedData;
      onSearchQuery(query);
    }
    onClose();
  };

  const handleResetScan = () => {
    setScannedData(null);
    setUploadError(null);
    setPreviewImage(null);
    if (activeTab === 'camera') {
      startCamera(facingMode);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (!isOpen) return null;

  const isUrl = scannedData && /^https?:\/\//i.test(scannedData.trim());

  return (
    <div 
      id="qr-scanner-fullscreen-modal"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white select-none animate-fadeIn"
    >
      {/* Hidden offscreen canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Hidden File Input for QR Image Upload */}
      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* Top Header Bar */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-md border-b border-zinc-800/40">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              QR Scanner
              {cameraActive && activeTab === 'camera' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              Live camera scanner &amp; instant image QR detector
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs (Camera vs Upload) */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setUploadError(null);
              if (!cameraActive) {
                startCamera(facingMode);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              stopCamera();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Flip Camera (Only when camera active in camera tab) */}
          {activeTab === 'camera' && cameraActive && (
            <button
              id="qr-flip-camera-btn"
              type="button"
              onClick={toggleCameraFacing}
              className="p-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer"
              title="Flip camera"
            >
              <FlipHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Torch Toggle */}
          {hasTorch && cameraActive && activeTab === 'camera' && (
            <button
              id="qr-torch-btn"
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                torchOn 
                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                  : 'bg-zinc-850 hover:bg-zinc-750 text-zinc-300 hover:text-white border-zinc-700/60'
              }`}
              title={torchOn ? 'Turn off light' : 'Turn on light'}
            >
              {torchOn ? <Flashlight className="w-4 h-4 sm:w-5 sm:h-5" /> : <FlashlightOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          )}

          {/* Close Button */}
          <button
            id="qr-close-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-zinc-850 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 border border-zinc-700/60 hover:border-red-800 transition-all cursor-pointer"
            title="Close scanner"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* TAB 1: LIVE CAMERA VIEW */}
        {activeTab === 'camera' && (
          <>
            {/* Real-time Video Stream */}
            <video 
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                cameraActive && !scannedData ? 'opacity-100' : 'opacity-20'
              }`}
              playsInline
              muted
            />

            {/* Viewfinder Overlay */}
            {!scannedData && cameraActive && (
              <div className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                {/* Viewfinder Target Borders */}
                <div className="absolute inset-0 rounded-3xl border-2 border-amber-400/40 shadow-[0_0_50px_rgba(245,158,11,0.25)] pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

                  {/* Animated Laser Scanning Line */}
                  <div className="absolute left-2 right-2 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-scanLaser" />
                </div>

                <p className="absolute -bottom-10 text-xs sm:text-sm font-medium text-amber-300/90 tracking-wider bg-black/60 px-4 py-1.5 rounded-full border border-amber-500/30 backdrop-blur-md">
                  Align QR code within box
                </p>
              </div>
            )}

            {/* Camera Error / Device not found friendly fallback */}
            {cameraError && !scannedData && (
              <div className="relative z-10 max-w-md mx-4 p-6 rounded-3xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                    Camera Unavailable
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {cameraError}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-black stroke-[2.5]" />
                    Upload QR Image
                  </button>

                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Camera
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: UPLOAD IMAGE VIEW */}
        {activeTab === 'upload' && !scannedData && (
          <div className="relative z-10 w-full max-w-lg mx-4 flex flex-col items-center">
            {/* Drag & Drop Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer text-center ${
                isDragging 
                  ? 'border-amber-400 bg-amber-500/15 scale-102 shadow-[0_0_30px_rgba(245,158,11,0.3)]' 
                  : 'border-zinc-700 hover:border-amber-500/60 bg-zinc-900/80 hover:bg-zinc-850/90'
              }`}
            >
              {previewImage ? (
                <div className="relative w-48 h-48 rounded-2xl overflow-hidden border border-amber-500/40 shadow-lg">
                  <img src={previewImage} alt="QR Preview" className="w-full h-full object-contain bg-black" />
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <FileImage className="w-10 h-10 stroke-[1.5]" />
                </div>
              )}

              <div>
                <p className="text-sm sm:text-base font-bold text-white mb-1">
                  Click to Browse or Drag &amp; Drop QR Image
                </p>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Supports PNG, JPG, JPEG, WEBP or paste from clipboard (Ctrl+V)
                </p>
              </div>

              <div className="flex items-center gap-2 py-2 px-4 rounded-xl bg-amber-500 text-black font-bold text-xs shadow-md shadow-amber-500/20">
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>Choose Image File</span>
              </div>
            </div>

            {/* Helpful instructions */}
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>You can also take a screenshot of a QR code and press Ctrl+V</span>
            </div>
          </div>
        )}

        {/* Upload Processing Loader */}
        {isProcessingUpload && (
          <div className="relative z-30 p-6 rounded-2xl bg-black/90 border border-amber-500/40 text-center flex flex-col items-center gap-3 backdrop-blur-md shadow-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-400 border-t-transparent"></div>
            <p className="text-sm font-semibold text-zinc-200">Decoding QR Code from image...</p>
          </div>
        )}

        {/* Upload Error notification */}
        {uploadError && !scannedData && (
          <div className="absolute top-24 z-30 max-w-sm mx-4 p-3 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p>{uploadError}</p>
          </div>
        )}

        {/* Scanned Result Modal Card (Displays on successful scan) */}
        {scannedData && (
          <div className="relative z-20 w-full max-w-lg mx-4 p-5 sm:p-6 rounded-3xl bg-zinc-900/95 border border-amber-500/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-scaleUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  QR Code Scanned Successfully!
                </h3>
                <p className="text-xs text-zinc-400">Decoded contents:</p>
              </div>
            </div>

            {/* Decoded Data Display Box */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-black/70 border border-zinc-800 text-zinc-200 font-mono text-xs sm:text-sm break-all max-h-48 overflow-y-auto mb-4 select-text">
              {scannedData}
            </div>

            {/* Action Buttons for Scanned Data */}
            <div className="flex flex-wrap gap-2.5">
              {isUrl && (
                <a
                  href={scannedData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Link</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleSearch}
                className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-zinc-700 transition-all cursor-pointer"
              >
                <Search className="w-4 h-4 text-amber-400" />
                <span>Search in App</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-zinc-700 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Scan Another Button */}
            <button
              type="button"
              onClick={handleResetScan}
              className="w-full mt-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan another QR Code</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Tool Deck: Quick Upload Trigger */}
      <div className="relative z-20 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-t from-black via-black/85 to-transparent backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800/40">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>Need to scan an image from gallery or file?</span>
        </div>

        <button
          id="qr-upload-image-btn"
          type="button"
          onClick={() => {
            setActiveTab('upload');
            fileInputRef.current?.click();
          }}
          className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:brightness-110 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Upload QR Code Image</span>
        </button>
      </div>
    </div>
  );
};
