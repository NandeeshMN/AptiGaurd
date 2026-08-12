import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthPage } from '../pages/auth/AuthPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { Dashboard } from '../pages/Dashboard';
import { TestExecutionView } from '../pages/TestExecutionView';
import { ProtectedRoute } from './ProtectedRoute';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  // Determine if navigating to an public auth route
  const isAuthRoute = ['/login', '/register', '/reset-password'].includes(location.pathname);

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
        <Route
          path="/test/:testId"
          element={
            <ProtectedRoute>
              <TestExecutionView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
