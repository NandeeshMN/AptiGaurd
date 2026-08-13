import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthPage } from '../pages/auth/AuthPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { Dashboard } from '../pages/Dashboard';
import { TestExecutionView } from '../pages/TestExecutionView';
import { ProtectedRoute } from './ProtectedRoute';
import { ActionConfirmationProvider } from '../context/ActionConfirmationContext';

const GlobalTitleManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    if (path.startsWith('/test/')) {
      document.title = 'AptiGuard | Test';
      return;
    }

    const titleMap: Record<string, string> = {
      '/login': 'AptiGuard | Login',
      '/register': 'AptiGuard | Signup',
      '/reset-password': 'AptiGuard | Reset Password',
      '/dashboard': 'AptiGuard | Dashboard',
      '/available-tests': 'AptiGuard | Available Tests',
      '/completed-tests': 'AptiGuard | Completed Tests',
      '/results': 'AptiGuard | Results',
      '/profile': 'AptiGuard | Profile',
      '/admin/dashboard': 'AptiGuard | Admin Dashboard',
      '/admin/students': 'AptiGuard | Students',
      '/admin/tests': 'AptiGuard | Tests',
      '/admin/results': 'AptiGuard | Results',
      '/admin/profile': 'AptiGuard | Profile',
    };

    if (titleMap[path]) {
      document.title = titleMap[path];
    } else if (path === '/') {
      document.title = 'AptiGuard | Dashboard';
    }
  }, [location.pathname]);

  return null;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  // Determine if navigating to a public auth route
  const isAuthRoute = ['/login', '/register', '/reset-password'].includes(location.pathname);

  if (!isAuthRoute) {
    return (
      <>
        <GlobalTitleManager />
        <Routes location={location} key={location.pathname}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/available-tests"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="available" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/completed-tests"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="completed" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="results" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="profile" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="students" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tests"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="tests" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/results"
            element={
              <ProtectedRoute>
                <Dashboard defaultTab="results" />
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
      </>
    );
  }

  return (
    <>
      <GlobalTitleManager />
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <ActionConfirmationProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ActionConfirmationProvider>
  );
};
