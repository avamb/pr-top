import React from 'react';
import AppLayout from './AppLayout';
import AuthGuard from './guards/AuthGuard';
import TherapistGuard from './guards/TherapistGuard';
import AdminGuard from './guards/AdminGuard';
import NotificationToast from './NotificationToast';

/**
 * GuardedLayout - Wraps content with AuthGuard + TherapistGuard + AppLayout.
 * Used for therapist dashboard routes.
 *
 * Lives in its own module (loaded lazily from App.jsx) so the dashboard shell
 * (sidebar, guards, notifications, websocket hook) stays out of the entry
 * chunk that public marketing pages download.
 */
export function GuardedLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <NotificationToast />
        <AppLayout>{children}</AppLayout>
      </TherapistGuard>
    </AuthGuard>
  );
}

/**
 * AdminLayout - Wraps content with AuthGuard + TherapistGuard + AdminGuard + AppLayout.
 * Used for superadmin routes.
 */
export function AdminLayout({ children }) {
  return (
    <AuthGuard>
      <TherapistGuard>
        <AdminGuard>
          <AppLayout>{children}</AppLayout>
        </AdminGuard>
      </TherapistGuard>
    </AuthGuard>
  );
}
