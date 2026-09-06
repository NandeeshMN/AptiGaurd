import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCameraOptions {
  onInterrupted?: () => void;
}

export interface UseCameraReturn {
  stream: MediaStream | null;
  isCameraActive: boolean;
  cameraError: string | null;
  isRequesting: boolean;
  requestCameraAccess: () => Promise<MediaStream | null>;
  stopCamera: () => void;
  clearError: () => void;
}

/**
 * Maps browser MediaDevices / getUserMedia errors to clear, user-friendly messages.
 */
export const getFriendlyCameraErrorMessage = (error: unknown): string => {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return 'Your browser does not support camera access. Please use a modern browser such as Chrome, Edge, Firefox, or Safari.';
  }

  if (error instanceof DOMException || (typeof error === 'object' && error !== null && 'name' in error)) {
    const errName = (error as { name?: string }).name;
    switch (errName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Please allow camera access in your browser site permissions and try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on your device. A functional camera is strictly required for this proctored assessment.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera is already in use by another application or tab. Please close other video apps (e.g., Zoom, Teams, Meet) and try again.';
      case 'OverconstrainedError':
        return 'No camera device satisfies the requested video constraints.';
      case 'SecurityError':
        return 'Camera access is blocked by your browser security policy. Please ensure you are accessing via HTTPS or a trusted local origin.';
      case 'AbortError':
        return 'Camera access request was aborted. Please try again.';
      default:
        break;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unable to access camera. Please verify device permissions and try again.';
};

export const useCamera = (options?: UseCameraOptions): UseCameraReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const isExplicitlyStoppedRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onInterruptedRef = useRef<(() => void) | undefined>(options?.onInterrupted);

  // Keep callback ref updated
  useEffect(() => {
    onInterruptedRef.current = options?.onInterrupted;
  }, [options?.onInterrupted]);

  /**
   * Completely stops all active media tracks and clears stream references.
   */
  const stopCamera = useCallback(() => {
    isExplicitlyStoppedRef.current = true;

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.onended = null;
        } catch {
          // Ignore track stop exceptions
        }
      });
      streamRef.current = null;
    }

    setStream(null);
    setIsCameraActive(false);
  }, []);

  /**
   * Handles unexpected track interruption (disconnect, hardware switch-off, permission revocation).
   */
  const handleTrackInterruption = useCallback(() => {
    if (isExplicitlyStoppedRef.current) return;

    setIsCameraActive(false);
    setCameraError('Camera access has been interrupted. Please restore camera access to continue the test.');

    if (onInterruptedRef.current) {
      onInterruptedRef.current();
    }
  }, []);

  /**
   * Requests camera permission with video: true only (never audio).
   */
  const requestCameraAccess = useCallback(async (): Promise<MediaStream | null> => {
    // Check browser compatibility first
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const errorMsg = 'Your browser does not support camera access. Please use a modern browser such as Chrome, Edge, Firefox, or Safari.';
      setCameraError(errorMsg);
      setIsCameraActive(false);
      return null;
    }

    setIsRequesting(true);
    setCameraError(null);
    isExplicitlyStoppedRef.current = false;

    // Clean up any stale stream before requesting a fresh one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.onended = null;
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    try {
      // Strictly request video only, never audio
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 20 },
          facingMode: 'user',
        },
        audio: false,
      });

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No active video track returned from camera device.');
      }

      // Listen for track ending
      videoTrack.onended = () => {
        handleTrackInterruption();
      };

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraActive(true);
      setCameraError(null);

      // Periodically check track readyState in case browser doesn't trigger onended
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = setInterval(() => {
        if (!isExplicitlyStoppedRef.current && streamRef.current) {
          const track = streamRef.current.getVideoTracks()[0];
          if (!track || track.readyState === 'ended' || !track.enabled) {
            handleTrackInterruption();
          }
        }
      }, 1500);

      return mediaStream;
    } catch (err: unknown) {
      const friendlyMsg = getFriendlyCameraErrorMessage(err);
      setCameraError(friendlyMsg);
      setIsCameraActive(false);
      setStream(null);
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [handleTrackInterruption]);

  const clearError = useCallback(() => {
    setCameraError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    isCameraActive,
    cameraError,
    isRequesting,
    requestCameraAccess,
    stopCamera,
    clearError,
  };
};
