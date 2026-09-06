import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getWebRTCConfig, getSignalingUrl } from '../config/webrtc';

export type PublisherConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface UseWebRTCPublisherOptions {
  stream: MediaStream | null;
  isActive: boolean;
  attemptId: string | null;
  testId: string | null;
  studentName: string;
  uucmsNo?: string;
  testTitle?: string;
}

export interface UseWebRTCPublisherResult {
  connectionStatus: PublisherConnectionStatus;
  connectedAdminsCount: number;
}

export const useWebRTCPublisher = ({
  stream,
  isActive,
  attemptId,
  testId,
  studentName,
  uucmsNo,
  testTitle,
}: UseWebRTCPublisherOptions): UseWebRTCPublisherResult => {
  const { currentUser } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<PublisherConnectionStatus>('idle');
  const [connectedAdminsCount, setConnectedAdminsCount] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  // Map of adminSocketId -> RTCPeerConnection
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Queue candidate if remote description is not yet set
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Store active stream in ref to avoid stale closures
  const streamRef = useRef<MediaStream | null>(stream);
  streamRef.current = stream;

  useEffect(() => {
    if (!isActive || !stream || !attemptId || !testId || !currentUser) {
      // Clean up if inactive
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      peerConnectionsRef.current.clear();
      candidateQueuesRef.current.clear();

      if (socketRef.current) {
        if (attemptId) {
          socketRef.current.emit('student:end_stream', { attemptId });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setConnectionStatus('idle');
      setConnectedAdminsCount(0);
      return;
    }

    let isMounted = true;
    setConnectionStatus('connecting');

    const initSignaling = async () => {
      try {
        const token = await currentUser.getIdToken();
        if (!isMounted) return;

        const signalingUrl = getSignalingUrl();
        const socket = io(signalingUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        // ── Helper: Create and configure PeerConnection for a specific admin ──
        const createPeerForAdmin = async (adminSocketId: string) => {
          if (!streamRef.current) return;

          // Close existing if duplicate
          const existing = peerConnectionsRef.current.get(adminSocketId);
          if (existing) {
            try {
              existing.close();
            } catch {}
          }

          const pc = new RTCPeerConnection(getWebRTCConfig());
          peerConnectionsRef.current.set(adminSocketId, pc);
          candidateQueuesRef.current.set(adminSocketId, []);

          // Add local video track only (strictly NO audio)
          const videoTrack = streamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            pc.addTrack(videoTrack, streamRef.current);
          }

          pc.onicecandidate = (event) => {
            if (event.candidate && socket.connected) {
              socket.emit('webrtc:ice_candidate', {
                targetSocketId: adminSocketId,
                attemptId,
                candidate: event.candidate,
              });
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(
              `[WebRTC-Publisher] Connection state with admin ${adminSocketId}: ${pc.connectionState}`
            );
            if (pc.connectionState === 'connected') {
              setConnectionStatus('connected');
              setConnectedAdminsCount(
                Array.from(peerConnectionsRef.current.values()).filter(
                  (p) => p.connectionState === 'connected'
                ).length
              );
            } else if (
              pc.connectionState === 'disconnected' ||
              pc.connectionState === 'failed'
            ) {
              setConnectedAdminsCount(
                Array.from(peerConnectionsRef.current.values()).filter(
                  (p) => p.connectionState === 'connected'
                ).length
              );
              if (
                Array.from(peerConnectionsRef.current.values()).every(
                  (p) => p.connectionState === 'disconnected' || p.connectionState === 'failed'
                )
              ) {
                setConnectionStatus('reconnecting');
              }
            }
          };

          try {
            const offer = await pc.createOffer({
              offerToReceiveAudio: false,
              offerToReceiveVideo: false,
            });
            await pc.setLocalDescription(offer);

            socket.emit('webrtc:offer', {
              targetSocketId: adminSocketId,
              attemptId,
              offer,
            });
            console.log(`[WebRTC-Publisher] Sent offer to admin ${adminSocketId}`);
          } catch (err) {
            console.error('[WebRTC-Publisher] Failed to create offer:', err);
          }
        };

        // ── Socket Events ──
        socket.on('connect', () => {
          if (!isMounted) return;
          console.log('[WebRTC-Publisher] Connected to signaling server');
          setConnectionStatus('connecting');

          // Register streaming session
          socket.emit('student:start_stream', {
            testId,
            attemptId,
            studentName,
            uucmsNo,
            testTitle,
          });
        });

        // An admin joined or connected (supports late-joining admin)
        socket.on('admin:connected', ({ adminSocketId }: { adminSocketId: string }) => {
          if (!isMounted || !adminSocketId) return;
          console.log(`[WebRTC-Publisher] Admin connected (${adminSocketId}), initiating offer...`);
          createPeerForAdmin(adminSocketId);
        });

        // Admin answered our offer
        socket.on(
          'webrtc:answer',
          async ({
            fromSocketId,
            answer,
          }: {
            fromSocketId: string;
            answer: RTCSessionDescriptionInit;
          }) => {
            if (!isMounted) return;
            const pc = peerConnectionsRef.current.get(fromSocketId);
            if (!pc) return;

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              console.log(`[WebRTC-Publisher] Remote description set for admin ${fromSocketId}`);

              // Flush queued candidates
              const queue = candidateQueuesRef.current.get(fromSocketId) || [];
              for (const cand of queue) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
              candidateQueuesRef.current.set(fromSocketId, []);
            } catch (err) {
              console.error('[WebRTC-Publisher] Error setting remote description:', err);
            }
          }
        );

        // ICE candidate from admin
        socket.on(
          'webrtc:ice_candidate',
          async ({
            fromSocketId,
            candidate,
          }: {
            fromSocketId: string;
            candidate: RTCIceCandidateInit;
          }) => {
            if (!isMounted || !candidate) return;
            const pc = peerConnectionsRef.current.get(fromSocketId);
            if (!pc) return;

            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                candidateQueuesRef.current.get(fromSocketId)?.push(candidate);
              }
            } catch (err) {
              console.error('[WebRTC-Publisher] Error adding ICE candidate:', err);
            }
          }
        );

        socket.on('disconnect', (reason) => {
          if (!isMounted) return;
          console.log('[WebRTC-Publisher] Signaling socket disconnected:', reason);
          setConnectionStatus('reconnecting');
        });

        socket.on('connect_error', (err) => {
          if (!isMounted) return;
          console.warn('[WebRTC-Publisher] Signaling connection error:', err.message);
          setConnectionStatus('error');
        });
      } catch (err) {
        console.error('[WebRTC-Publisher] Failed to initialize signaling:', err);
        if (isMounted) setConnectionStatus('error');
      }
    };

    initSignaling();

    return () => {
      isMounted = false;
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current.clear();
      candidateQueuesRef.current.clear();

      if (socketRef.current) {
        if (attemptId) {
          socketRef.current.emit('student:end_stream', { attemptId });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isActive, stream, attemptId, testId, currentUser, studentName, uucmsNo, testTitle]);

  return { connectionStatus, connectedAdminsCount };
};

export default useWebRTCPublisher;
