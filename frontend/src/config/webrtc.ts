import { API_BASE_URL } from './api';

export const getWebRTCConfig = (): RTCConfiguration => {
  const defaultStunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
  ];
  const customStun = import.meta.env.VITE_STUN_SERVER_URL;
  const urls = customStun ? [customStun, ...defaultStunServers] : defaultStunServers;

  const iceServers: RTCIceServer[] = [
    { urls },
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
  if (import.meta.env.VITE_SIGNALING_URL) {
    return import.meta.env.VITE_SIGNALING_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }
  return 'http://localhost:5000';
};

