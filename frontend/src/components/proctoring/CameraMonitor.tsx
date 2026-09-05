import React, { useRef, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Maximize,
  Minimize,
  AlertTriangle,
  RefreshCw,
  VideoOff,
} from 'lucide-react';

export interface CameraMonitorProps {
  stream: MediaStream | null;
  isActive: boolean;
  error?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const CameraMonitor: React.FC<CameraMonitorProps> = ({
  stream,
  isActive,
  error,
  onRetry,
  isRetrying = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Bind or unbind MediaStream to <video> element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && isActive) {
      videoEl.srcObject = stream;
      videoEl.play().catch((playErr) => {
        console.warn('[CameraMonitor] Video autoplay notice:', playErr);
      });
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream, isActive]);

  // Fullscreen toggle for video preview
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      {/* Header with Title & Status Indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
          CAMERA
        </h3>
        {isActive ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200/60">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Inactive</span>
          </div>
        )}
      </div>

      {/* Video Viewport / Silhouette Placeholder */}
      <div
        ref={containerRef}
        className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-200 border border-slate-200/80 flex items-center justify-center select-none"
      >
        {isActive && stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            {/* Expand / Maximize Control in Top-Right */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit full camera preview' : 'Maximize camera preview'}
              className="absolute top-2.5 right-2.5 p-1.5 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-lg backdrop-blur-xs transition-colors cursor-pointer z-10"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        ) : (
          /* Neutral candidate silhouette placeholder (matching the design) */
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-300 relative overflow-hidden">
            <svg
              className="w-28 h-28 text-white mt-4 drop-shadow-xs"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <div className="absolute inset-0 bg-slate-900/20 flex flex-col items-center justify-center p-3 text-center">
              <VideoOff className="w-6 h-6 text-white mb-1.5" />
              <span className="text-[11px] font-bold text-white tracking-wide">
                {error ? 'Camera Inactive' : 'Waiting for camera...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Message & Controls */}
      {isActive ? (
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px] sm:text-xs">Camera is active and monitoring</span>
          </div>
          <div
            title="AptiGuard Proctoring: Live webcam monitoring candidate presence for test integrity."
            className="text-slate-400 hover:text-slate-600 cursor-help transition-colors"
          >
            <Info className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <div className="pt-1 space-y-2">
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200/80 rounded-xl text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">
              <p className="font-bold">Camera Interrupted</p>
              <p className="text-red-700 mt-0.5">
                {error || 'Camera access has been interrupted. Please restore camera access to continue.'}
              </p>
            </div>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full py-2 px-3 bg-[#0952cc] hover:bg-[#0747a6] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Requesting Camera...' : 'Enable Camera'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
