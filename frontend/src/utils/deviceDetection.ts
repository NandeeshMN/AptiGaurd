import React from 'react';

/**
 * Robust Multi-Layered Mobile/Tablet Device Detection.
 * Correctly identifies mobile & tablet devices even when Chrome "Desktop Site" is enabled.
 * Does NOT classify desktop/laptop browsers with narrow window dimensions as mobile.
 */
export const checkIsMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();

  // 1. User Agent String Inspection (handles Android/iOS/Mobile browsers)
  const mobileUARegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|samsungbrowser|silk|kindle/i;
  if (mobileUARegex.test(ua)) {
    return true;
  }

  // 2. User Agent Client Hints (Chromium modern API)
  if ((navigator as any).userAgentData && typeof (navigator as any).userAgentData.mobile === 'boolean') {
    if ((navigator as any).userAgentData.mobile === true) {
      return true;
    }
  }

  // 3. iPadOS Desktop Site Mode ("Request Desktop Website" on iPad sends Macintosh UA)
  const isMacUA = ua.includes('macintosh') || ua.includes('mac os x');
  const hasTouchScreen = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || 'ontouchstart' in window;
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (isMacUA && hasTouchScreen && isCoarsePointer) {
    return true;
  }

  // 4. Android Chrome "Desktop Site" ON Mode
  const isLinuxUA = ua.includes('linux');
  const isDesktopUAWithoutWinMac = !ua.includes('windows') && !ua.includes('macintosh') && isLinuxUA;
  if (isDesktopUAWithoutWinMac && hasTouchScreen && isCoarsePointer) {
    return true;
  }

  return false;
};

export const useIsMobileDevice = (): boolean => {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => checkIsMobileDevice());

  React.useEffect(() => {
    const handleResizeOrChange = () => {
      setIsMobile(checkIsMobileDevice());
    };

    window.addEventListener('resize', handleResizeOrChange);
    window.addEventListener('orientationchange', handleResizeOrChange);
    return () => {
      window.removeEventListener('resize', handleResizeOrChange);
      window.removeEventListener('orientationchange', handleResizeOrChange);
    };
  }, []);

  return isMobile;
};
