import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import Announcements from './pages/Announcements';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AlertProvider>
      <BrowserRouter basename="/super-admin" future={{v7_startTransition: true}}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="announcements" element={<Announcements />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </AlertProvider>
    </AuthProvider>
  );
}

export default App;
// Build timestamp: Sun Feb 22 18:27:37 UTC 2026
// Build timestamp: Sun Feb 22 19:42:28 UTC 2026
