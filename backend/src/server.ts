import app from './app';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[server]: AptiGuard backend is running at http://localhost:${PORT}`);
  console.log(`[server]: Health-check available at http://localhost:${PORT}/api/health`);
});
