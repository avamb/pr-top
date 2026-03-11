import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import Subscription from './pages/Subscription';
import ClientDetail from './pages/ClientDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminTherapists from './pages/AdminTherapists';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<ClientList />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/subscription/success" element={<Subscription />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/therapists" element={<AdminTherapists />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
