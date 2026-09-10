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
  FileImage
} from 'lucide-react';
import jsQR from 'jsqr';
import { soundFx } from '../utils/sound';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchQuery?: (query: string) => void;
  onConnectRoom?: (code: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onSearchQuery,
  onConnectRoom
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
      }
    } catch (err: any) {
      console.warn('[Camera Access Error]:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera permissions in browser settings or upload an image.'
          : 'Unable to start camera. You can upload an image file instead.'
      );
      setCameraActive(false);
    }
  }, [stopCamera]);

  // QR decoding loop with jsQR
  const scanQrCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraActive || scannedData) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data && code.data.trim()) {
          soundFx.playClick('ok');
          setScannedData(code.data);
          stopCamera();
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanQrCode);
  }, [cameraActive, scannedData, stopCamera]);

  // Run camera and scan loop when modal opens in camera mode
  useEffect(() => {
    if (isOpen) {
      setScannedData(null);
      setUploadError(null);
      setPreviewImage(null);
      if (activeTab === 'camera') {
        startCamera(facingMode);
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, facingMode, startCamera, stopCamera]);

  // Trigger scan loop when camera becomes active
  useEffect(() => {
    if (cameraActive && !scannedData) {
      animFrameRef.current = requestAnimationFrame(scanQrCode);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraActive, scannedData, scanQrCode]);

  // Toggle Camera Facing
  const toggleCameraFacing = () => {
    soundFx.playClick('switch');
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
        soundFx.playClick('switch');
      }
    } catch (e) {
      console.error('Failed to toggle torch', e);
    }
  };

  // Process Uploaded Image with jsQR
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
            setUploadError('No valid QR code found in this image.');
          }
        }
        setIsProcessingUpload(false);
      };
      img.onerror = () => {
        setUploadError('Failed to decode image file.');
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  const isUrl = scannedData && /^https?:\/\//i.test(scannedData.trim());

  return (
    <div 
      id="qr-scanner-fullscreen-modal"
      className="fixed inset-0 z-[100] h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col bg-black text-white select-none animate-fadeIn"
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

      {/* 1. TOP HEADER BAR: Compact single row, never overflows */}
      <header className="h-13 sm:h-14 shrink-0 px-3 sm:px-5 flex items-center justify-between gap-2 bg-zinc-950/95 border-b border-zinc-800/80 backdrop-blur-md z-20">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Camera className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
            QR Scanner
          </span>
        </div>

        {/* Center: Compact Mode Switch Pills */}
        <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setUploadError(null);
              if (!cameraActive) {
                startCamera(facingMode);
              }
            }}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Camera
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              stopCamera();
            }}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Upload
          </button>
        </div>

        {/* Right: Actions (Flip, Torch, Close) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {activeTab === 'camera' && cameraActive && (
            <button
              id="qr-flip-camera-btn"
              type="button"
              onClick={toggleCameraFacing}
              className="p-1.5 sm:p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer"
              title="Flip camera"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}

          {hasTorch && cameraActive && activeTab === 'camera' && (
            <button
              id="qr-torch-btn"
              type="button"
              onClick={toggleTorch}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer ${
                torchOn 
                  ? 'bg-amber-500 text-black border-amber-300' 
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800'
              }`}
              title={torchOn ? 'Turn off light' : 'Turn on light'}
            >
              {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          )}

          <button
            id="qr-close-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 border border-zinc-800 hover:border-red-800 transition-all cursor-pointer"
            title="Close scanner"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CENTER STAGE: Fully responsive and bounded by available height */}
      <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center p-3 sm:p-4 overflow-hidden">
        {/* TAB 1: LIVE CAMERA VIEW */}
        {activeTab === 'camera' && (
          <>
            <video 
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive && !scannedData ? 'opacity-100' : 'opacity-20'
              }`}
              playsInline
              muted
            />

            {/* Viewfinder Overlay: Scaled to never exceed screen bounds */}
            {!scannedData && cameraActive && (
              <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                {/* Viewfinder Target Box */}
                <div className="relative w-[min(65vw,260px,36dvh)] h-[min(65vw,260px,36dvh)] aspect-square rounded-2xl border-2 border-amber-400/50 shadow-[0_0_40px_rgba(245,158,11,0.25)] flex items-center justify-center pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-amber-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-amber-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-amber-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-amber-400 rounded-br-lg" />

                  {/* Laser line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_#f59e0b] animate-scanLaser" />
                </div>

                <span className="text-[11px] sm:text-xs font-medium text-amber-300/90 tracking-wider bg-black/75 px-3 py-1 rounded-full border border-amber-500/30 backdrop-blur-md">
                  Align QR code within box
                </span>
              </div>
            )}

            {/* Camera Error / Device fallback */}
            {cameraError && !scannedData && (
              <div className="relative z-10 max-w-sm mx-4 p-5 rounded-2xl bg-zinc-900/95 border border-zinc-800 text-center flex flex-col items-center gap-3 shadow-2xl backdrop-blur-xl">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Camera Unavailable
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {cameraError}
                  </p>
                </div>

                <div className="flex gap-2 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                    Upload Image
                  </button>

                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: UPLOAD IMAGE VIEW */}
        {activeTab === 'upload' && !scannedData && (
          <div className="relative z-10 w-full max-w-sm sm:max-w-md mx-4 flex flex-col items-center">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-h-[50dvh] p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer text-center ${
                isDragging 
                  ? 'border-amber-400 bg-amber-500/15' 
                  : 'border-zinc-700 hover:border-amber-500/60 bg-zinc-900/85'
              }`}
            >
              {previewImage ? (
                <div className="w-36 h-36 rounded-xl overflow-hidden border border-amber-500/40">
                  <img src={previewImage} alt="QR Preview" className="w-full h-full object-contain bg-black" />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <FileImage className="w-8 h-8 stroke-[1.5]" />
                </div>
              )}

              <div>
                <p className="text-xs sm:text-sm font-bold text-white mb-0.5">
                  Select or Drag &amp; Drop QR Image
                </p>
                <p className="text-[11px] text-zinc-400">
                  PNG, JPG, WEBP formats supported
                </p>
              </div>

              <div className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-amber-500 text-black font-bold text-xs shadow-md">
                <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Choose Image</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Processing Loader */}
        {isProcessingUpload && (
          <div className="relative z-30 p-4 rounded-xl bg-black/90 border border-amber-500/40 text-center flex flex-col items-center gap-2 backdrop-blur-md shadow-2xl">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent"></div>
            <p className="text-xs font-semibold text-zinc-200">Decoding QR Code...</p>
          </div>
        )}

        {/* Upload Error notification */}
        {uploadError && !scannedData && (
          <div className="absolute top-4 z-30 max-w-xs p-2.5 rounded-xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-center gap-2 shadow-xl backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p>{uploadError}</p>
          </div>
        )}

        {/* Scanned Result Card: Fully scrollable and bounded */}
        {scannedData && (
          <div className="relative z-20 w-full max-w-sm sm:max-w-md mx-3 p-4 sm:p-5 rounded-2xl bg-zinc-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl max-h-[75dvh] overflow-y-auto">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  QR Scanned Successfully!
                </h3>
                <p className="text-[11px] text-zinc-400">Decoded content:</p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-black/70 border border-zinc-800 text-zinc-200 font-mono text-xs break-all max-h-32 overflow-y-auto mb-3 select-text">
              {scannedData}
            </div>

            {/* Room Code Direct Connect */}
            {(() => {
              const matchRoom = scannedData.match(/[?&]room=([0-9a-zA-Z]{4})/i) || scannedData.match(/[?&]code=([0-9a-zA-Z]{4})/i);
              const extractedCode = matchRoom ? matchRoom[1] : /^\d{4}$/.test(scannedData.trim()) ? scannedData.trim() : null;

              if (extractedCode && onConnectRoom) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick('ok');
                      onConnectRoom(extractedCode);
                      onClose();
                    }}
                    className="w-full mb-2.5 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect to TV Room #{extractedCode}</span>
                  </button>
                );
              }
              return null;
            })()}

            <div className="flex flex-wrap gap-2">
              {isUrl && (
                <a
                  href={scannedData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Link</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleSearch}
                className="flex-1 min-w-[100px] py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1 border border-zinc-700 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1 border border-zinc-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetScan}
              className="w-full mt-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Scan another</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM TOOLBAR: Compact, sleek, responsive */}
      <footer className="h-12 sm:h-13 shrink-0 px-3 sm:px-5 bg-zinc-950/95 border-t border-zinc-800/80 flex items-center justify-between gap-2 z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
          <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Scan image from gallery</span>
        </div>

        <button
          id="qr-upload-image-btn"
          type="button"
          onClick={() => {
            setActiveTab('upload');
            fileInputRef.current?.click();
          }}
          className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Upload Image</span>
        </button>
      </footer>
    </div>
  );
};
