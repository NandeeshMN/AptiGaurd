import http from 'http';
import app from './app';
import dotenv from 'dotenv';
import { initSignalingServer } from './services/signalingService';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebRTC Signaling WebSocket server
initSignalingServer(server);

server.listen(PORT, () => {
  console.log(`[server]: AptiGuard backend is running at http://localhost:${PORT}`);
  console.log(`[server]: Health-check available at http://localhost:${PORT}/api/health`);
  console.log(`[server]: WebRTC Signaling initialized on port ${PORT}`);
});
