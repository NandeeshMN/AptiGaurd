import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { adminAuth, adminDb } from '../config/firebase';

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

export const initSignalingServer = (httpServer: HttpServer): Server => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://apti-gaurd.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.includes('vercel.app') ||
          origin.includes('localhost')
        ) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Track currently active streaming student sessions: attemptId -> session info
  const activeSessions = new Map<string, ActiveStudentSession>();
  // Map socketId -> Set of attemptIds (in case a student has an active session)
  const socketToAttempts = new Map<string, Set<string>>();

  // ── Authentication Middleware ─────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    if (!adminAuth) {
      return next(new Error('Authentication service unavailable'));
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const email = (decodedToken.email || '').toLowerCase().trim();
      let role: 'admin' | 'student' =
        email === 'nandeeshmn12@gmail.com' ||
        email === 'cbshubli75@gmail.com' ||
        (decodedToken as any).role === 'admin' ||
        (decodedToken as any).admin === true
          ? 'admin'
          : 'student';

      if (role !== 'admin' && adminDb) {
        try {
          const uSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
          if (uSnap.exists) {
            const uData = uSnap.data() || {};
            if (
              uData.role === 'admin' ||
              uData.isAdmin === true ||
              (uData.email &&
                ['nandeeshmn12@gmail.com', 'cbshubli75@gmail.com'].includes(
                  uData.email.toLowerCase()
                ))
            ) {
              role = 'admin';
            }
          }
        } catch {
          // Fallback silently
        }
      }

      socket.data.user = {
        uid: decodedToken.uid,
        email,
        role,
      };

      next();
    } catch (err) {
      console.error('[signaling] Token verification failed:', err);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // ── Connection Handling ───────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[signaling] Connected: ${socket.id} (user: ${user?.uid}, role: ${user?.role})`);

    // ── 1. Admin Monitoring Subscription ────────────────────────────────────
    socket.on('admin:subscribe', ({ testId }: { testId?: string }) => {
      if (socket.data.user?.role !== 'admin') {
        socket.emit('error:unauthorized', { message: 'Only authorized administrators can access live monitoring' });
        return;
      }

      socket.join('admin_monitoring');
      if (testId) {
        socket.join(`monitoring_${testId}`);
      }

      // Return current active sessions matching testId filter (or all if omitted)
      const matchingSessions: ActiveStudentSession[] = [];
      activeSessions.forEach((session) => {
        if (!testId || session.testId === testId) {
          matchingSessions.push(session);
        }
      });

      socket.emit('admin:active_sessions', { sessions: matchingSessions });

      // Notify all active student broadcasters that an admin is listening
      // This enables late-joining admins to immediately receive offers!
      const targetRoom = testId ? `test_${testId}` : 'all_students';
      io.to(targetRoom).emit('admin:connected', {
        adminSocketId: socket.id,
        testId: testId || null,
      });

      console.log(`[signaling] Admin ${socket.id} subscribed to monitoring (filter: ${testId || 'ALL'})`);
    });

    // ── 2. Student Broadcaster Session ──────────────────────────────────────
    socket.on(
      'student:start_stream',
      ({
        testId,
        attemptId,
        studentName,
        uucmsNo,
        testTitle,
      }: {
        testId: string;
        attemptId: string;
        studentName: string;
        uucmsNo?: string;
        testTitle?: string;
      }) => {
        if (!testId || !attemptId) {
          socket.emit('error:invalid_params', { message: 'Missing testId or attemptId' });
          return;
        }

        const sessionData: ActiveStudentSession = {
          attemptId,
          testId,
          studentId: socket.data.user?.uid || 'unknown',
          studentName: studentName || 'Candidate',
          uucmsNo: uucmsNo || '',
          testTitle: testTitle || '',
          socketId: socket.id,
          cameraStatus: 'active',
          joinedAt: Date.now(),
        };

        activeSessions.set(attemptId, sessionData);

        if (!socketToAttempts.has(socket.id)) {
          socketToAttempts.set(socket.id, new Set());
        }
        socketToAttempts.get(socket.id)?.add(attemptId);

        // Join student rooms
        socket.join(`test_${testId}`);
        socket.join('all_students');
        socket.join(`student_${attemptId}`);

        // Broadcast to admins
        io.to('admin_monitoring').emit('student:joined', sessionData);
        io.to(`monitoring_${testId}`).emit('student:joined', sessionData);

        // Notify this new student of any already-connected admin monitoring sockets
        const adminRoom = io.sockets.adapter.rooms.get('admin_monitoring');
        if (adminRoom && adminRoom.size > 0) {
          adminRoom.forEach((adminSocketId) => {
            socket.emit('admin:connected', {
              adminSocketId,
              testId,
            });
          });
        }

        console.log(`[signaling] Student ${studentName} (${attemptId}) started camera stream`);
      }
    );

    // ── 2b. Admin manual stream request / re-sync ───────────────────────────
    socket.on('admin:request_stream', ({ targetAttemptId }: { targetAttemptId?: string } = {}) => {
      if (socket.data.user?.role !== 'admin') return;
      if (targetAttemptId) {
        io.to(`student_${targetAttemptId}`).emit('admin:connected', {
          adminSocketId: socket.id,
        });
      } else {
        io.to('all_students').emit('admin:connected', {
          adminSocketId: socket.id,
        });
      }
    });

    // ── 3. WebRTC Signaling: Offer (Student -> Admin) ────────────────────────
    socket.on(
      'webrtc:offer',
      ({
        targetSocketId,
        attemptId,
        offer,
      }: {
        targetSocketId: string;
        attemptId: string;
        offer: any;
      }) => {
        if (!targetSocketId || !offer) return;
        io.to(targetSocketId).emit('webrtc:offer', {
          fromSocketId: socket.id,
          attemptId,
          offer,
        });
      }
    );

    // ── 4. WebRTC Signaling: Answer (Admin -> Student) ───────────────────────
    socket.on(
      'webrtc:answer',
      ({
        targetSocketId,
        attemptId,
        answer,
      }: {
        targetSocketId: string;
        attemptId: string;
        answer: any;
      }) => {
        if (!targetSocketId || !answer) return;
        io.to(targetSocketId).emit('webrtc:answer', {
          fromSocketId: socket.id,
          attemptId,
          answer,
        });
      }
    );

    // ── 5. WebRTC Signaling: ICE Candidate ──────────────────────────────────
    socket.on(
      'webrtc:ice_candidate',
      ({
        targetSocketId,
        attemptId,
        candidate,
      }: {
        targetSocketId: string;
        attemptId: string;
        candidate: any;
      }) => {
        if (!targetSocketId || !candidate) return;
        io.to(targetSocketId).emit('webrtc:ice_candidate', {
          fromSocketId: socket.id,
          attemptId,
          candidate,
        });
      }
    );

    // ── 6. Student Camera Status Update ─────────────────────────────────────
    socket.on(
      'student:camera_status',
      ({
        attemptId,
        status,
      }: {
        attemptId: string;
        status: 'active' | 'inactive';
      }) => {
        const session = activeSessions.get(attemptId);
        if (session) {
          session.cameraStatus = status;
          io.to('admin_monitoring').emit('student:camera_status', { attemptId, status });
        }
      }
    );

    // ── 7. Student End Stream ───────────────────────────────────────────────
    socket.on('student:end_stream', ({ attemptId }: { attemptId: string }) => {
      if (activeSessions.has(attemptId)) {
        activeSessions.delete(attemptId);
        socketToAttempts.get(socket.id)?.delete(attemptId);
        io.to('admin_monitoring').emit('student:left', { attemptId });
        console.log(`[signaling] Student stream ended for attempt ${attemptId}`);
      }
    });

    // ── 8. Disconnect Cleanup ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[signaling] Disconnected: ${socket.id}`);
      const attempts = socketToAttempts.get(socket.id);
      if (attempts) {
        attempts.forEach((attId) => {
          activeSessions.delete(attId);
          io.to('admin_monitoring').emit('student:left', { attemptId: attId });
        });
        socketToAttempts.delete(socket.id);
      }
    });
  });

  return io;
};
