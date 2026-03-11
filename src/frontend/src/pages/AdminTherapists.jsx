import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

export default function AdminTherapists() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (data.user.role !== 'superadmin') {
          navigate('/dashboard');
          return;
        }
        setUser(data.user);
        loadTherapists(token);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      });
  }, [navigate]);

  const loadTherapists = async (token) => {
    try {
      const res = await fetch(`${API_URL}/admin/therapists`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTherapists(data.therapists || []);
      }
    } catch (err) {
      console.error('Failed to load therapists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (therapistId) => {
    setActionLoading(therapistId);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${therapistId}/block`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Therapist #${therapistId} blocked successfully`);
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage('Failed to block therapist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (therapistId) => {
    setActionLoading(therapistId);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/therapists/${therapistId}/unblock`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Therapist #${therapistId} unblocked successfully`);
        await loadTherapists(token);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage('Failed to unblock therapist');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">Loading therapist management...</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">Therapist Management</h2>
            <p className="text-secondary mt-1">{therapists.length} therapists registered</p>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.startsWith('Error') ? 'bg-red-50 text-error border border-error' : 'bg-green-50 text-green-700 border border-green-300'}`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Telegram ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Invite Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Registered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {therapists.map(t => (
                <tr key={t.id} className={t.is_blocked ? 'bg-red-50/50' : ''}>
                  <td className="px-6 py-4 text-sm text-text">{t.id}</td>
                  <td className="px-6 py-4 text-sm text-text font-medium">{t.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-secondary">{t.telegram_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-secondary font-mono">{t.invite_code || '—'}</td>
                  <td className="px-6 py-4">
                    {t.is_blocked ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {t.is_blocked ? (
                      <button
                        onClick={() => handleUnblock(t.id)}
                        disabled={actionLoading === t.id}
                        className="text-sm px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === t.id ? 'Unblocking...' : 'Unblock'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBlock(t.id)}
                        disabled={actionLoading === t.id}
                        className="text-sm px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === t.id ? 'Blocking...' : 'Block'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {therapists.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-secondary">
                    No therapists registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
