import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import Subscription from './pages/Subscription';
import ClientDetail from './pages/ClientDetail';
import SessionDetail from './pages/SessionDetail';
import ExerciseLibrary from './pages/ExerciseLibrary';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminTherapists from './pages/AdminTherapists';
import AdminSettings from './pages/AdminSettings';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminSystemLogs from './pages/AdminSystemLogs';
import TherapistGuide from './pages/TherapistGuide';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - no sidebar */}
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Authenticated routes - with sidebar */}
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/clients" element={<AppLayout><ClientList /></AppLayout>} />
        <Route path="/clients/:id" element={<AppLayout><ClientDetail /></AppLayout>} />
        <Route path="/sessions/:id" element={<AppLayout><SessionDetail /></AppLayout>} />
        <Route path="/exercises" element={<AppLayout><ExerciseLibrary /></AppLayout>} />
        <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
        <Route path="/subscription" element={<AppLayout><Subscription /></AppLayout>} />
        <Route path="/subscription/success" element={<AppLayout><Subscription /></AppLayout>} />
        <Route path="/dashboard/guide" element={<AppLayout><TherapistGuide /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><AdminDashboard /></AppLayout>} />
        <Route path="/admin/therapists" element={<AppLayout><AdminTherapists /></AppLayout>} />
        <Route path="/admin/settings" element={<AppLayout><AdminSettings /></AppLayout>} />
        <Route path="/admin/logs" element={<AppLayout><AdminAuditLogs /></AppLayout>} />
        <Route path="/admin/system-logs" element={<AppLayout><AdminSystemLogs /></AppLayout>} />
        <Route path="/admin/*" element={<AppLayout><AdminDashboard /></AppLayout>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
