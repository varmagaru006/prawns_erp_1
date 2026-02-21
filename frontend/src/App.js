import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import PreProcessing from './pages/PreProcessing';
import Production from './pages/Production';
import FinishedGoods from './pages/FinishedGoods';
import Agents from './pages/Agents';
import Notifications from './pages/Notifications';
import QualityControl from './pages/QualityControl';
// import ColdStorage from './pages/ColdStorage';
import Sales from './pages/Sales';
import Accounts from './pages/Accounts';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="procurement" element={<Procurement />} />
        <Route path="agents" element={<Agents />} />
        <Route path="preprocessing" element={<PreProcessing />} />
        <Route path="production" element={<Production />} />
        <Route path="finished-goods" element={<FinishedGoods />} />
        <Route path="qc" element={<QualityControl />} />
        <Route path="cold-storage" element={<ColdStorage />} />
        <Route path="sales" element={<Sales />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
