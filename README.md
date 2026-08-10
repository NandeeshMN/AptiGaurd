# AptiGuard - College Aptitude Test Proctoring System

A secure platform where college students take aptitude tests and placement assessments in a controlled examination environment.

## Project Structure

This project is separated into independent frontend and backend services:

```text
AptiGuard/
│
├── frontend/    # React + TypeScript + Vite + Tailwind CSS Application
└── backend/     # Node.js + Express + TypeScript API Server
```

---

## Getting Started

### 1. Frontend

The frontend is a standalone React application.

**Run locally:**
```bash
cd frontend
npm install
npm run dev
```

---

### 2. Backend

The backend is a standalone Node.js and Express API server built with TypeScript.

**Run locally:**
```bash
cd backend
npm install
npm run dev
```

**Health Check endpoint:**
- URL: `http://localhost:5000/api/health`
- Response format:
  ```json
  {
    "status": "ok",
    "message": "AptiGuard backend is running"
  }
  ```
