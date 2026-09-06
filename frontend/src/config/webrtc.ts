export const getWebRTCConfig = (): RTCConfiguration => {
  const stunUrl = import.meta.env.VITE_STUN_SERVER_URL || 'stun:stun.l.google.com:19302';
  const iceServers: RTCIceServer[] = [
    { urls: stunUrl },
  ];

  if (import.meta.env.VITE_TURN_SERVER_URL) {
    iceServers.push({
      urls: import.meta.env.VITE_TURN_SERVER_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 4,
  };
};

export const getSignalingUrl = (): string => {
  return (
    import.meta.env.VITE_SIGNALING_URL ||
    (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : '') ||
    'http://localhost:5000'
  );
};
