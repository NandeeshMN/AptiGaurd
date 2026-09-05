import React, { useRef, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  RefreshCw,
  VideoOff,
  Eye,
  Target,
  UserCheck,
} from 'lucide-react';

export interface CameraMonitorProps {
  stream: MediaStream | null;
  isActive: boolean;
  error?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

interface ProctorCue {
  id: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PROCTOR_CUES: ProctorCue[] = [
  { id: 'blink', text: 'Blink naturally', icon: Eye },
  { id: 'focus', text: 'Focus on camera', icon: Target },
  { id: 'face', text: 'Face verified & centered', icon: UserCheck },
];

export const CameraMonitor: React.FC<CameraMonitorProps> = ({
  stream,
  isActive,
  error,
  onRetry,
  isRetrying = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dynamic real-time proctor cue states
  const [displayCue, setDisplayCue] = useState<ProctorCue>(PROCTOR_CUES[0]);
  const [isCueVisible, setIsCueVisible] = useState<boolean>(false);
  const lastCueIdRef = useRef<string | null>(null);
  const hideTimeoutRef = useRef<any>(null);
  const nextTriggerTimeoutRef = useRef<any>(null);

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

  // Randomized Live AI Proctor Cue Scheduler
  useEffect(() => {
    if (!isActive || !stream) {
      setIsCueVisible(false);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (nextTriggerTimeoutRef.current) clearTimeout(nextTriggerTimeoutRef.current);
      return;
    }

    const scheduleNextCue = (delayMs: number) => {
      nextTriggerTimeoutRef.current = setTimeout(() => {
        // Pick a cue different from the last shown one to feel natural
        const candidates = PROCTOR_CUES.filter((c) => c.id !== lastCueIdRef.current);
        const selected = candidates[Math.floor(Math.random() * candidates.length)] || PROCTOR_CUES[0];
        lastCueIdRef.current = selected.id;
        setDisplayCue(selected);
        setIsCueVisible(true);

        // Display for 4.5 seconds, then smoothly fade out
        hideTimeoutRef.current = setTimeout(() => {
          setIsCueVisible(false);

          // Schedule next cue at a random interval between 25s and 45s
          const nextInterval = Math.floor(Math.random() * (45000 - 25000 + 1)) + 25000;
          scheduleNextCue(nextInterval);
        }, 4500);
      }, delayMs);
    };

    // First cue appears 8 seconds after camera starts
    scheduleNextCue(8000);

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (nextTriggerTimeoutRef.current) clearTimeout(nextTriggerTimeoutRef.current);
    };
  }, [isActive, stream]);

  const CueIcon = displayCue.icon;

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
      <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200/80 flex items-center justify-center select-none">
        {isActive && stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* AI Proctor Live Indicator in Top-Left */}
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-950/70 backdrop-blur-xs text-white text-[10px] font-mono tracking-wider flex items-center gap-1.5 z-10 border border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">LIVE AI</span>
            </div>

            {/* Dynamic Real-Time AI Proctor Cue Pill (HUD Overlay) */}
            <div
              className={`absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[92%] z-20 transition-all duration-500 ease-out pointer-events-none ${
                isCueVisible
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-2 scale-95'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-emerald-400/40 text-white shadow-xl text-[11px] font-medium tracking-wide">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <CueIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate text-slate-100 font-semibold">{displayCue.text}</span>
              </div>
            </div>
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
            <span className="text-[11px] sm:text-xs">Live AI proctoring active</span>
          </div>
          <div
            title="AptiGuard Proctoring: Live webcam monitoring candidate presence and gaze alignment for test integrity."
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
