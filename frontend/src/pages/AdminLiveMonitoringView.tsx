import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { getWebRTCConfig, getSignalingUrl } from '../config/webrtc';
import {
  Video,
  VideoOff,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  X,
  User,
  Clock,
  Shield,
  AlertOctagon,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  Play,
  Pause,
} from 'lucide-react';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ActiveStudentSession {
  attemptId: string;
  testId: string;
  studentId: string;
  studentName: string;
  uucmsNo?: string;
  testTitle?: string;
  socketId: string;
  cameraStatus: 'active' | 'inactive';
  joinedAt: number;
}

export interface StudentAttemptData {
  id: string;
  userId?: string;
  userName?: string;
  candidateName?: string;
  name?: string;
  userEmail?: string;
  uucmsNo?: string;
  testId?: string;
  testTitle?: string;
  status: string;
  cameraStatus?: string;
  exitCount?: number;
  violationBreakdown?: {
    camera?: number;
    fullscreen?: number;
    tab?: number;
    blur?: number;
    occlusion?: number;
  };
  startedAtMs?: number;
}

export interface MergedStudentFeed {
  attemptId: string;
  studentName: string;
  uucmsNo: string;
  testTitle: string;
  testId: string;
  startedAtMs: number;
  exitCount: number;
  violationBreakdown: {
    camera: number;
    fullscreen: number;
    tab: number;
    blur: number;
    occlusion: number;
  };
  cameraStatus: string;
  stream: MediaStream | null;
  peerState: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  isSocketConnected: boolean;
}

// ─── Student Live Card Subcomponent ─────────────────────────────────────────

interface StudentLiveFeedCardProps {
  feed: MergedStudentFeed;
  onInspect: (feed: MergedStudentFeed) => void;
}

const StudentLiveFeedCard: React.FC<StudentLiveFeedCardProps> = ({ feed, onInspect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (feed.stream) {
      videoEl.srcObject = feed.stream;
      videoEl.play().catch((err) => {
        console.warn('[AdminLiveFeed] Video autoplay prevented:', err);
      });
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [feed.stream]);

  const hasHighViolations = feed.exitCount >= 3;
  const hasMediumViolations = feed.exitCount === 2;

  // Format elapsed time
  const elapsedMinutes = feed.startedAtMs
    ? Math.max(0, Math.floor((Date.now() - feed.startedAtMs) / 60000))
    : 0;

  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md flex flex-col ${
        hasHighViolations
          ? 'border-red-300 ring-2 ring-red-500/20'
          : hasMediumViolations
          ? 'border-amber-300'
          : 'border-slate-200/80 hover:border-blue-300'
      }`}
    >
      {/* Card Header: Student Identification & Status */}
      <div className="p-3.5 border-b border-slate-100 flex items-start justify-between gap-2 bg-slate-50/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-slate-900 truncate" title={feed.studentName}>
              {feed.studentName}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono font-semibold text-slate-500 truncate">
              {feed.uucmsNo || 'Candidate'}
            </span>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
              <Clock className="w-3 h-3 text-slate-400" />
              {elapsedMinutes}m elapsed
            </span>
          </div>
        </div>

        {/* Live Camera Status Badge */}
        <div className="flex-shrink-0">
          {feed.stream ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          ) : feed.isSocketConnected || feed.peerState === 'connecting' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Connecting
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Video Viewport / Offline Placeholder */}
      <div className="relative aspect-4/3 w-full bg-slate-950 flex items-center justify-center overflow-hidden select-none">
        {feed.stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Subtle Watermark HUD Overlay */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/70 backdrop-blur-xs text-[9px] font-mono text-white/80 border border-white/10 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>PROCTORING</span>
            </div>

            {/* Enlarge / Full View Action Button */}
            <button
              onClick={() => onInspect(feed)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white/90 hover:text-white backdrop-blur-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Inspect Candidate Stream"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          /* Informative Placeholder when Disconnected or Offline */
          <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <div className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-2 text-slate-500">
              <VideoOff className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-bold text-slate-300">Camera Disconnected</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Candidate camera feed offline</p>
            {feed.isSocketConnected && (
              <span className="mt-2 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-medium">
                Awaiting video stream...
              </span>
            )}
          </div>
        )}

        {/* Warning Banner if Violations Exceeded Threshold */}
        {hasHighViolations && (
          <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-red-600/95 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1.5 shadow-lg animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-white" />
            <span className="truncate">Limit Exceeded ({feed.exitCount}/3 violations)</span>
          </div>
        )}
      </div>

      {/* Card Footer: Test Title, Violations Count & Details */}
      <div className="p-3 bg-white space-y-2 border-t border-slate-100">
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <span className="text-slate-500 font-medium truncate flex-1" title={feed.testTitle}>
            {feed.testTitle || 'Aptitude Test'}
          </span>
          <button
            onClick={() => onInspect(feed)}
            className="text-[10px] font-bold text-[#0952cc] hover:text-[#0747a6] hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <Eye className="w-3 h-3" />
            Details
          </button>
        </div>

        {/* Violation Count Badge */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-[10px] font-semibold text-slate-500">Violations</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              hasHighViolations
                ? 'bg-red-100 text-red-700 border border-red-200'
                : hasMediumViolations
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : feed.exitCount > 0
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {hasHighViolations ? (
              <AlertOctagon className="w-3 h-3" />
            ) : feed.exitCount > 0 ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {feed.exitCount} / 3
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Admin Live Monitoring View Component ─────────────────────────────

export const AdminLiveMonitoringView: React.FC = () => {
  const { currentUser } = useAuth();

  // Socket and WebRTC Refs
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Component States
  const [activeSessions, setActiveSessions] = useState<Map<string, ActiveStudentSession>>(new Map());
  const [firestoreAttempts, setFirestoreAttempts] = useState<Map<string, StudentAttemptData>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, 'connected' | 'connecting' | 'reconnecting' | 'offline'>>(new Map());

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestId, setSelectedTestId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'violations' | 'offline'>('all');
  const [testsList, setTestsList] = useState<Array<{ id: string; title: string }>>([]);

  // UI / Modal States
  const [inspectedFeed, setInspectedFeed] = useState<MergedStudentFeed | null>(null);
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination & Smart Sorting States (Engineered for 70+ Students)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [sortMode, setSortMode] = useState<'priority' | 'recent' | 'name'>('priority');
  const [isAutoCycle, setIsAutoCycle] = useState<boolean>(false);
  const [cycleIntervalSeconds] = useState<number>(20);
  const [isHoveredOverGrid, setIsHoveredOverGrid] = useState<boolean>(false);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Fetch available tests for filter dropdown
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTests = async () => {
      try {
        const snap = await getDocs(collection(db, 'tests'));
        const list: Array<{ id: string; title: string }> = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.status !== 'draft') {
            list.push({ id: d.id, title: data.title || 'Untitled Assessment' });
          }
        });
        setTestsList(list);
      } catch (err) {
        console.warn('[AdminLiveMonitoring] Error loading tests for filter:', err);
      }
    };
    fetchTests();
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Real-time Firestore Listener for active testAttempts (status == 'in_progress')
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'testAttempts'), where('status', '==', 'in_progress'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const attemptsMap = new Map<string, StudentAttemptData>();
        snapshot.forEach((d) => {
          const data = d.data() as any;
          attemptsMap.set(d.id, {
            id: d.id,
            userId: data.userId,
            userName: data.userName || data.candidateName || data.name,
            candidateName: data.candidateName || data.userName || data.name,
            name: data.name || data.userName || data.candidateName,
            userEmail: data.userEmail,
            uucmsNo: data.uucmsNo,
            testId: data.testId,
            testTitle: data.testTitle,
            status: data.status || 'in_progress',
            cameraStatus: data.cameraStatus || 'active',
            exitCount: typeof data.exitCount === 'number' ? data.exitCount : 0,
            violationBreakdown: data.violationBreakdown || {
              camera: 0,
              fullscreen: 0,
              tab: 0,
              blur: 0,
              occlusion: 0,
            },
            startedAtMs: data.startedAtMs || (data.startedAt?.seconds ? data.startedAt.seconds * 1000 : undefined),
          });
        });
        setFirestoreAttempts(attemptsMap);
      },
      (err) => {
        console.error('[AdminLiveMonitoring] Firestore testAttempts listener error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Socket.IO Signaling Server Connection & WebRTC Receiver Handlers
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;

    const initSignaling = async () => {
      try {
        const token = await currentUser.getIdToken();
        if (!isMounted) return;

        const signalingUrl = getSignalingUrl();
        const socket = io(signalingUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        // ── Helper: Handle incoming WebRTC offer from student ──
        const handleIncomingOffer = async (
          fromSocketId: string,
          attemptId: string,
          offer: RTCSessionDescriptionInit
        ) => {
          try {
            // If connection exists, close it cleanly
            const existingPc = peerConnectionsRef.current.get(attemptId);
            if (existingPc) {
              try {
                existingPc.close();
              } catch {}
            }

            const pc = new RTCPeerConnection(getWebRTCConfig());
            peerConnectionsRef.current.set(attemptId, pc);

            // Handle ICE Candidate generated locally -> send to student
            pc.onicecandidate = (event) => {
              if (event.candidate && socket.connected) {
                socket.emit('webrtc:ice_candidate', {
                  targetSocketId: fromSocketId,
                  attemptId,
                  candidate: event.candidate,
                });
              }
            };

            // Handle incoming remote MediaStream track from student
            pc.ontrack = (event) => {
              console.log(`[AdminLiveMonitoring] Received video track for attempt ${attemptId}`);
              const stream =
                event.streams && event.streams[0]
                  ? event.streams[0]
                  : new MediaStream([event.track]);
              setRemoteStreams((prev) => new Map(prev).set(attemptId, stream));
              setPeerStates((prev) => new Map(prev).set(attemptId, 'connected'));
            };

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
              const state = pc.connectionState;
              console.log(`[AdminLiveMonitoring] PeerConnection state for ${attemptId}: ${state}`);
              if (state === 'connected') {
                setPeerStates((prev) => new Map(prev).set(attemptId, 'connected'));
              } else if (state === 'connecting') {
                setPeerStates((prev) => new Map(prev).set(attemptId, 'connecting'));
              } else if (state === 'disconnected' || state === 'failed') {
                setPeerStates((prev) => new Map(prev).set(attemptId, 'offline'));
              }
            };

            // Set remote offer description
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            // Flush any queued candidate arrivals
            const queue = candidateQueuesRef.current.get(attemptId) || [];
            for (const cand of queue) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            candidateQueuesRef.current.delete(attemptId);

            // Create answer strictly without requesting audio
            const answer = await pc.createAnswer({
              offerToReceiveAudio: false,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);

            // Send answer back to student broadcaster
            socket.emit('webrtc:answer', {
              targetSocketId: fromSocketId,
              attemptId,
              answer,
            });
            console.log(`[AdminLiveMonitoring] Answer sent for attempt ${attemptId}`);
          } catch (err) {
            console.error(`[AdminLiveMonitoring] Error handling offer for ${attemptId}:`, err);
          }
        };

        // ── Socket Events ──
        socket.on('connect', () => {
          if (!isMounted) return;
          console.log('[AdminLiveMonitoring] Connected to signaling server');
          setIsSignalingConnected(true);

          // Subscribe to admin monitoring
          socket.emit('admin:subscribe', {
            testId: selectedTestId === 'all' ? undefined : selectedTestId,
          });
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          console.log('[AdminLiveMonitoring] Disconnected from signaling server');
          setIsSignalingConnected(false);
        });

        // Received initial active student sessions from server
        socket.on(
          'admin:active_sessions',
          ({ sessions }: { sessions: ActiveStudentSession[] }) => {
            if (!isMounted) return;
            console.log(`[AdminLiveMonitoring] Active sessions received: ${sessions.length}`);
            const map = new Map<string, ActiveStudentSession>();
            sessions.forEach((s) => map.set(s.attemptId, s));
            setActiveSessions(map);
          }
        );

        // Student joined live stream
        socket.on('student:joined', (session: ActiveStudentSession) => {
          if (!isMounted) return;
          console.log(`[AdminLiveMonitoring] Student joined: ${session.studentName} (${session.attemptId})`);
          setActiveSessions((prev) => new Map(prev).set(session.attemptId, session));
        });

        // Student left or submitted test
        socket.on('student:left', ({ attemptId }: { attemptId: string }) => {
          if (!isMounted) return;
          console.log(`[AdminLiveMonitoring] Student left: ${attemptId}`);
          setActiveSessions((prev) => {
            const next = new Map(prev);
            next.delete(attemptId);
            return next;
          });

          // Clean up WebRTC peer connection
          const pc = peerConnectionsRef.current.get(attemptId);
          if (pc) {
            try {
              pc.close();
            } catch {}
            peerConnectionsRef.current.delete(attemptId);
          }

          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(attemptId);
            return next;
          });

          setPeerStates((prev) => {
            const next = new Map(prev);
            next.delete(attemptId);
            return next;
          });
        });

        // Camera status changed (e.g. stopped/active)
        socket.on(
          'student:camera_status',
          ({ attemptId, status }: { attemptId: string; status: 'active' | 'inactive' }) => {
            if (!isMounted) return;
            setActiveSessions((prev) => {
              const existing = prev.get(attemptId);
              if (existing) {
                const updated = { ...existing, cameraStatus: status };
                return new Map(prev).set(attemptId, updated);
              }
              return prev;
            });
          }
        );

        // WebRTC Offer received from student
        socket.on(
          'webrtc:offer',
          async ({
            fromSocketId,
            attemptId,
            offer,
          }: {
            fromSocketId: string;
            attemptId: string;
            offer: RTCSessionDescriptionInit;
          }) => {
            if (!isMounted) return;
            await handleIncomingOffer(fromSocketId, attemptId, offer);
          }
        );

        // ICE candidate from student
        socket.on(
          'webrtc:ice_candidate',
          async ({
            attemptId,
            candidate,
          }: {
            attemptId: string;
            candidate: RTCIceCandidateInit;
          }) => {
            if (!isMounted || !candidate) return;
            const pc = peerConnectionsRef.current.get(attemptId);
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error(`[AdminLiveMonitoring] Error adding ICE candidate:`, err);
              }
            } else {
              if (!candidateQueuesRef.current.has(attemptId)) {
                candidateQueuesRef.current.set(attemptId, []);
              }
              candidateQueuesRef.current.get(attemptId)?.push(candidate);
            }
          }
        );
      } catch (err) {
        console.error('[AdminLiveMonitoring] Signaling init error:', err);
      }
    };

    initSignaling();

    return () => {
      isMounted = false;
      // Close all peer connections cleanly
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current.clear();
      candidateQueuesRef.current.clear();

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser, selectedTestId]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Merge Firestore Attempts + Socket Active Sessions
  // ──────────────────────────────────────────────────────────────────────────
  const mergedFeeds: MergedStudentFeed[] = useMemo(() => {
    // Collect all unique attempt IDs from both Firestore and Socket
    const allAttemptIds = new Set<string>();
    firestoreAttempts.forEach((_, id) => allAttemptIds.add(id));
    activeSessions.forEach((_, id) => allAttemptIds.add(id));

    const feeds: MergedStudentFeed[] = [];

    allAttemptIds.forEach((attemptId) => {
      const fDoc = firestoreAttempts.get(attemptId);
      const sSession = activeSessions.get(attemptId);

      // If neither has valid active test data, skip
      if (!fDoc && !sSession) return;

      const studentName =
        fDoc?.candidateName ||
        fDoc?.userName ||
        fDoc?.name ||
        sSession?.studentName ||
        'Candidate';

      const uucmsNo =
        fDoc?.uucmsNo ||
        sSession?.uucmsNo ||
        (fDoc?.userEmail ? fDoc.userEmail.split('@')[0] : '—');

      const testTitle =
        fDoc?.testTitle || sSession?.testTitle || 'Aptitude Assessment';

      const testId = fDoc?.testId || sSession?.testId || '';
      const startedAtMs = fDoc?.startedAtMs || sSession?.joinedAt || Date.now();
      const exitCount = fDoc?.exitCount ?? 0;
      const cameraStatus = fDoc?.cameraStatus || sSession?.cameraStatus || 'active';
      const stream = remoteStreams.get(attemptId) || null;
      const peerState = peerStates.get(attemptId) || (stream ? 'connected' : 'offline');

      feeds.push({
        attemptId,
        studentName,
        uucmsNo,
        testTitle,
        testId,
        startedAtMs,
        exitCount,
        violationBreakdown: {
          camera: fDoc?.violationBreakdown?.camera ?? 0,
          fullscreen: fDoc?.violationBreakdown?.fullscreen ?? 0,
          tab: fDoc?.violationBreakdown?.tab ?? 0,
          blur: fDoc?.violationBreakdown?.blur ?? 0,
          occlusion: fDoc?.violationBreakdown?.occlusion ?? 0,
        },
        cameraStatus,
        stream,
        peerState,
        isSocketConnected: Boolean(sSession),
      });
    });

    return feeds;
  }, [firestoreAttempts, activeSessions, remoteStreams, peerStates]);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Filter & Search Feeds
  // ──────────────────────────────────────────────────────────────────────────
  const filteredFeeds = useMemo(() => {
    return mergedFeeds.filter((feed) => {
      // Test ID Filter
      if (selectedTestId !== 'all' && feed.testId !== selectedTestId) {
        return false;
      }

      // Search Query Filter (name or uucms)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesName = feed.studentName.toLowerCase().includes(queryLower);
        const matchesUucms = feed.uucmsNo.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesUucms) return false;
      }

      // Status Filter
      if (statusFilter === 'live') {
        return feed.peerState === 'connected' && Boolean(feed.stream);
      }
      if (statusFilter === 'violations') {
        return feed.exitCount > 0;
      }
      if (statusFilter === 'offline') {
        return feed.peerState === 'offline' || !feed.stream;
      }

      return true;
    });
  }, [mergedFeeds, selectedTestId, searchQuery, statusFilter]);

  // ─── 5b. Smart Sorting (Priority: High Violations First) ───────────────────
  const sortedFeeds = useMemo(() => {
    return [...filteredFeeds].sort((a, b) => {
      if (sortMode === 'priority') {
        // 1. Highest violations count first (critical risk bubbles to Page 1)
        if (b.exitCount !== a.exitCount) {
          return b.exitCount - a.exitCount;
        }
        // 2. Active video feeds before offline
        const aLive = a.peerState === 'connected' && Boolean(a.stream) ? 1 : 0;
        const bLive = b.peerState === 'connected' && Boolean(b.stream) ? 1 : 0;
        if (bLive !== aLive) {
          return bLive - aLive;
        }
        // 3. Fallback: started time (most recent first)
        return b.startedAtMs - a.startedAtMs;
      }

      if (sortMode === 'recent') {
        return b.startedAtMs - a.startedAtMs;
      }

      if (sortMode === 'name') {
        return a.studentName.localeCompare(b.studentName);
      }

      return 0;
    });
  }, [filteredFeeds, sortMode]);

  // ─── 5c. Pagination Calculations ──────────────────────────────────────────
  const effectivePerPage = itemsPerPage === 0 ? Math.max(1, sortedFeeds.length) : itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(sortedFeeds.length / effectivePerPage));

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTestId, statusFilter, sortMode, itemsPerPage]);

  // Ensure currentPage is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Sliced feeds for the current page only (saves browser video decoders!)
  const pagedFeeds = useMemo(() => {
    if (itemsPerPage === 0) return sortedFeeds;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedFeeds.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedFeeds, currentPage, itemsPerPage]);

  // ─── 5d. Auto-Cycle Timer (Cycles through pages hands-free) ───────────────
  useEffect(() => {
    if (!isAutoCycle || totalPages <= 1 || isHoveredOverGrid || Boolean(inspectedFeed)) return;

    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev >= totalPages ? 1 : prev + 1));
    }, cycleIntervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [isAutoCycle, totalPages, isHoveredOverGrid, inspectedFeed, cycleIntervalSeconds]);

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Statistics Calculations
  // ──────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = mergedFeeds.length;
    const live = mergedFeeds.filter(
      (f) => f.peerState === 'connected' && Boolean(f.stream)
    ).length;
    const withViolations = mergedFeeds.filter((f) => f.exitCount > 0).length;
    const highRisk = mergedFeeds.filter((f) => f.exitCount >= 3).length;
    return { total, live, withViolations, highRisk };
  }, [mergedFeeds]);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Manual Refresh / Re-sync Action
  // ──────────────────────────────────────────────────────────────────────────
  const handleRefreshFeeds = () => {
    setIsRefreshing(true);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('admin:request_stream', {});
      socketRef.current.emit('admin:subscribe', {
        testId: selectedTestId === 'all' ? undefined : selectedTestId,
      });
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0952cc] border border-blue-100">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Live Camera Monitoring
                </h2>
                {isSignalingConnected && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Signaling Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time WebRTC video streams and proctoring status of active test candidates
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshFeeds}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Re-request video streams from all active students"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Re-sync Feeds</span>
          </button>
        </div>
      </div>

      {/* ── Key Metrics & Statistics Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Candidates
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#0952cc]">
              <User className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[10px] font-medium text-slate-400">Taking assessments now</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Live Video Feeds
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Video className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{stats.live}</p>
          <span className="text-[10px] font-medium text-slate-400">Streaming peer-to-peer</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              With Violations
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{stats.withViolations}</p>
          <span className="text-[10px] font-medium text-slate-400">Recorded 1+ events</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Critical (≥3 Violations)
            </span>
            <span className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-red-600 mt-2">{stats.highRisk}</p>
          <span className="text-[10px] font-medium text-slate-400">Exceeded warning threshold</span>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Candidate Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or UUCMS..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0952cc]"
          />
        </div>

        {/* Filter & View Controls */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
          {/* Test Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-semibold text-[11px]">Test:</span>
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Assessments</option>
              {testsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Smart Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-semibold text-[11px]">Sort:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="priority">Priority (Violations First)</option>
              <option value="recent">Most Recent</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          {/* Items Per Page Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-semibold text-[11px]">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value={8}>8 / page</option>
              <option value={12}>12 / page (Recommended)</option>
              <option value={16}>16 / page</option>
              <option value={24}>24 / page</option>
              <option value={0}>All ({sortedFeeds.length})</option>
            </select>
          </div>

          {/* Auto-Cycle Pages Button */}
          <button
            onClick={() => setIsAutoCycle(!isAutoCycle)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isAutoCycle
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Automatically cycle through pages of student video feeds every 20 seconds"
          >
            {isAutoCycle ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Pause className="w-3 h-3 text-emerald-600" />
                <span>Auto-Cycle ({cycleIntervalSeconds}s)</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-slate-400" />
                <span>Auto-Cycle Pages</span>
              </>
            )}
          </button>

          {/* Status Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({mergedFeeds.length})
            </button>
            <button
              onClick={() => setStatusFilter('live')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === 'live'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live ({stats.live})
            </button>
            <button
              onClick={() => setStatusFilter('violations')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === 'violations'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Violations ({stats.withViolations})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === 'offline'
                  ? 'bg-white text-red-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* ── Multi-Student Responsive Video Grid (Paged to Protect Browser Performance) ── */}
      {pagedFeeds.length > 0 ? (
        <div className="space-y-4">
          <div
            onMouseEnter={() => setIsHoveredOverGrid(true)}
            onMouseLeave={() => setIsHoveredOverGrid(false)}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {pagedFeeds.map((feed) => (
              <StudentLiveFeedCard
                key={feed.attemptId}
                feed={feed}
                onInspect={(f) => setInspectedFeed(f)}
              />
            ))}
          </div>

          {/* ── Pagination Footer Bar ── */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>
                Showing{' '}
                <strong className="text-slate-900 font-bold">
                  {Math.min(sortedFeeds.length, (currentPage - 1) * (itemsPerPage || sortedFeeds.length) + 1)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-900 font-bold">
                  {Math.min(sortedFeeds.length, currentPage * (itemsPerPage || sortedFeeds.length))}
                </strong>{' '}
                of <strong className="text-slate-900 font-bold">{sortedFeeds.length}</strong> candidates
              </span>
              {isAutoCycle && isHoveredOverGrid && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/60">
                  Auto-cycle paused while inspecting
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      totalPages > 7 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - currentPage) > 1
                    ) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return (
                          <span key={pageNum} className="px-1 text-slate-400 text-xs">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-[#0952cc] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <VideoOff className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {mergedFeeds.length === 0
              ? 'No Active Test Sessions'
              : 'No Students Match Current Filters'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {mergedFeeds.length === 0
              ? 'When students begin their aptitude assessments with camera enabled, their live peer-to-peer video streams will instantly appear here.'
              : 'Try clearing the search query or changing the filter options above.'}
          </p>
        </div>
      )}

      {/* ── Detailed Candidate Inspection Modal ── */}
      {inspectedFeed && (() => {
        const liveFeed = mergedFeeds.find((f) => f.attemptId === inspectedFeed.attemptId) || inspectedFeed;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#0952cc]" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {liveFeed.studentName}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      {liveFeed.uucmsNo} • {liveFeed.testTitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectedFeed(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Video Viewport */}
              <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                {liveFeed.stream ? (
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (el && liveFeed.stream) {
                        el.srcObject = liveFeed.stream;
                        el.play().catch(() => {});
                      }
                    }}
                    className="w-full h-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="text-center text-slate-400 p-6">
                    <VideoOff className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs font-bold text-slate-300">Camera Stream Unavailable</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {liveFeed.isSocketConnected
                        ? 'Connecting candidate video stream...'
                        : 'Candidate video disconnected or session stopped'}
                    </p>
                  </div>
                )}
              </div>

            {/* Modal Proctoring Details */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">
                  Proctoring Violation Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Camera Off</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {liveFeed.violationBreakdown.camera}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Fullscreen Exit</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {liveFeed.violationBreakdown.fullscreen}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Tab Switch</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {liveFeed.violationBreakdown.tab}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Focus Loss</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {liveFeed.violationBreakdown.blur}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Occlusion</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {liveFeed.violationBreakdown.occlusion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Total Proctoring Strikes:</span>
                  <span className="ml-2 font-mono font-black text-slate-900">
                    {liveFeed.exitCount} / 3
                  </span>
                </div>
                {liveFeed.exitCount >= 3 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                    Exceeded Allowed Strikes
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setInspectedFeed(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
};

export default AdminLiveMonitoringView;
