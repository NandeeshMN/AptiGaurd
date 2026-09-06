import { useState, useEffect, useRef } from 'react';

export interface UseOcclusionDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  onWarningChange?: (isWarning: boolean, message?: string) => void;
  onViolation?: (reason: string) => void;
}

export interface UseOcclusionDetectionResult {
  isOccluded: boolean;
  occlusionMessage: string | null;
}

/**
 * Real-time client-side computer vision hook for detecting Face & Chin occlusion
 * (e.g. holding a smartphone or hand up to chest/chin level to take a screen photo).
 */
export const useOcclusionDetection = ({
  videoRef,
  isActive,
  onWarningChange,
  onViolation,
}: UseOcclusionDetectionOptions): UseOcclusionDetectionResult => {
  const [isOccluded, setIsOccluded] = useState<boolean>(false);
  const [occlusionMessage, setOcclusionMessage] = useState<string | null>(null);

  const occlusionSecondsRef = useRef<number>(0);
  const hasFiredViolationRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep callbacks fresh in refs
  const onWarningChangeRef = useRef(onWarningChange);
  onWarningChangeRef.current = onWarningChange;
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!isActive) {
      setIsOccluded(false);
      setOcclusionMessage(null);
      occlusionSecondsRef.current = 0;
      hasFiredViolationRef.current = false;
      onWarningChangeRef.current?.(false);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 120;
      canvasRef.current.height = 90;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const intervalId = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.readyState < 2 || videoEl.paused || videoEl.videoWidth === 0) {
        return;
      }

      try {
        ctx.drawImage(videoEl, 0, 0, 120, 90);
        const imgData = ctx.getImageData(0, 0, 120, 90);
        const data = imgData.data;

        // Bounding zones
        // Center X range: 30 to 90 (middle 50% of frame where the face is centered)
        const minX = 30;
        const maxX = 90;

        // Upper Face: y from 15 to 45 (eyes/forehead/cheeks)
        const minYUpper = 15;
        const maxYUpper = 45;

        // Lower Face / Chin: y from 47 to 75 (mouth/chin/jawline)
        const minYLower = 47;
        const maxYLower = 75;

        let upperSkinCount = 0;
        let totalUpper = 0;
        let lowerSkinCount = 0;
        let totalLower = 0;

        for (let y = minYUpper; y < maxYLower; y++) {
          for (let x = minX; x < maxX; x++) {
            const idx = (y * 120 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Robust multi-ethnicity human skin-tone detection in RGB space
            const isSkin =
              r > 70 &&
              g > 35 &&
              b > 20 &&
              r > g &&
              r > b &&
              Math.abs(r - g) > 12 &&
              Math.max(r, g, b) - Math.min(r, g, b) > 12;

            if (y <= maxYUpper) {
              totalUpper++;
              if (isSkin) upperSkinCount++;
            } else if (y >= minYLower) {
              totalLower++;
              if (isSkin) lowerSkinCount++;
            }
          }
        }

        const upperRatio = totalUpper > 0 ? upperSkinCount / totalUpper : 0;
        const lowerRatio = totalLower > 0 ? lowerSkinCount / totalLower : 0;

        // Condition 1: Upper face is present (>= 15% skin), but lower face/chin is
        // suddenly blocked by an opaque/dark object (phone, hand, camera) (< 4% or ratio < 0.22)
        const isChinOccluded =
          upperRatio >= 0.15 &&
          (lowerRatio < 0.04 || lowerRatio / upperRatio < 0.22);

        // Condition 2: Entire face is covered or blocked (< 4% skin in both)
        const isFaceFullyBlocked = upperRatio < 0.04 && lowerRatio < 0.04;

        const currentFrameOccluded = isChinOccluded || isFaceFullyBlocked;

        if (currentFrameOccluded) {
          occlusionSecondsRef.current += 1;

          // After 2 seconds of continuous occlusion, show real-time warning
          if (occlusionSecondsRef.current >= 2) {
            const msg = isChinOccluded
              ? 'Chin / lower face blocked. Keep phone and hands away from camera.'
              : 'Face blocked or out of view.';
            setIsOccluded(true);
            setOcclusionMessage(msg);
            onWarningChangeRef.current?.(true, msg);
          }

          // After 5 seconds of sustained blockage, register proctoring violation
          if (occlusionSecondsRef.current >= 5 && !hasFiredViolationRef.current) {
            hasFiredViolationRef.current = true;
            onViolationRef.current?.('face_occlusion');
          }
        } else {
          // Cleared
          if (occlusionSecondsRef.current > 0) {
            occlusionSecondsRef.current = 0;
            hasFiredViolationRef.current = false;
            setIsOccluded(false);
            setOcclusionMessage(null);
            onWarningChangeRef.current?.(false);
          }
        }
      } catch (err) {
        // Silent catch for canvas drawing edge-cases
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, videoRef]);

  return { isOccluded, occlusionMessage };
};

export default useOcclusionDetection;
