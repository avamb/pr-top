import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUserDate } from '../utils/formatDate';

const API_URL = '/api';

const ACTION_COLORS = {
  'consent_granted': 'bg-green-100 text-green-800',
  'consent_revoked': 'bg-red-100 text-red-800',
  'consent_declined': 'bg-amber-100 text-amber-800',
  'sos_triggered': 'bg-red-100 text-red-800',
  'sos_acknowledged': 'bg-blue-100 text-blue-800',
  'sos_notification_sent': 'bg-amber-100 text-amber-800',
  'read_diary': 'bg-blue-50 text-blue-700',
  'read_notes': 'bg-blue-50 text-blue-700',
  'read_timeline': 'bg-blue-50 text-blue-700',
  'read_context': 'bg-blue-50 text-blue-700',
  'read_sessions': 'bg-blue-50 text-blue-700',
  'read_session': 'bg-blue-50 text-blue-700',
  'access_denied': 'bg-red-50 text-red-700',
  'update_platform_settings': 'bg-purple-100 text-purple-800',
  'note_created': 'bg-green-50 text-green-700',
  'session_upload': 'bg-indigo-100 text-indigo-800',
  'exercise_completed': 'bg-teal-100 text-teal-800',
};

export default function AdminAuditLogs() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(todayStr);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    loadActions(token);
    loadLogs(token, 1);
  }, []);

  const loadActions = async (token) => {
    try {
      const res = await fetch(`${API_URL}/admin/logs/audit/actions`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch (err) {
      console.error('Failed to load actions:', err);
    }
  };

  const loadLogs = async (token, pageNum, action, from, to) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum || page,
        per_page: perPage
      });
      const act = action !== undefined ? action : actionFilter;
      const df = from !== undefined ? from : dateFrom;
      const dt = to !== undefined ? to : dateTo;
      if (act) params.append('action', act);
      if (df) params.append('date_from', df);
      if (dt) params.append('date_to', dt);

      const res = await fetch(`${API_URL}/admin/logs/audit?${params}`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newAction) => {
    setActionFilter(newAction);
    loadLogs(null, 1, newAction);
  };

  const handleDateFromChange = (val) => {
    setDateFrom(val);
    loadLogs(null, 1, undefined, val);
  };

  const handleDateToChange = (val) => {
    setDateTo(val);
    loadLogs(null, 1, undefined, undefined, val);
  };

  const handleClearFilters = () => {
    setActionFilter('');
    setDateFrom('');
    setDateTo(todayStr);
    loadLogs(null, 1, '', todayStr, '');
  };

  const handlePageChange = (newPage) => {
    loadLogs(null, newPage);
  };

  const formatDateLocal = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const adjusted = dateStr + (dateStr.includes('T') ? '' : 'Z');
      return formatUserDate(adjusted);
    } catch (e) {
      return dateStr;
    }
  };

  const getActionBadgeClass = (action) => {
    return ACTION_COLORS[action] || 'bg-gray-100 text-gray-700';
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">{t('admin.loadingAuditLogs')}</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text">{t('admin.auditLogsTitle')}</h2>
          <p className="text-secondary mt-1">
            {t('admin.auditLogsSubtitle', { total })}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.actionType')}</label>
              <select
                value={actionFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">{t('admin.allActions')}</option>
                {actions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.dateFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.dateTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-secondary"
              >
                {t('admin.clearFilters')}
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.id')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.timestamp')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.actor')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.action')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.target')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">{t('admin.details')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-secondary">
                      {t('admin.noAuditLogs')}
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-secondary">#{log.id}</td>
                      <td className="px-4 py-3 text-sm text-text whitespace-nowrap">{formatDateLocal(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-text">
                        {log.actor_id ? t('admin.userPrefix', { id: log.actor_id }) : t('admin.system')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary">
                        {log.target_type && (
                          <span>{log.target_type}{log.target_id ? ` #${log.target_id}` : ''}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary max-w-xs truncate">
                        {log.details ? (
                          <span title={log.details} className="cursor-help">
                            {log.details.length > 60 ? log.details.substring(0, 60) + '...' : log.details}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-secondary">
                {t('admin.pageOf', { page, totalPages, total })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('admin.previous')}
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm border rounded ${
                        pageNum === page
                          ? 'bg-primary text-white border-primary'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('admin.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
