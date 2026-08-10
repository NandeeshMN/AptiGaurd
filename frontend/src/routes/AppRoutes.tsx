import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthPage } from '../pages/auth/AuthPage';
import { Dashboard } from '../pages/Dashboard';
import { ProtectedRoute } from './ProtectedRoute';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  // If navigating to dashboard, render the dashboard page directly.
  const isAuthRoute = ['/login', '/register'].includes(location.pathname);

  if (!isAuthRoute) {
    return (
      <Routes location={location} key={location.pathname}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Load AuthPage directly (no outer AuthLayout wrapping, since AuthPage contains it statically)
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
};
