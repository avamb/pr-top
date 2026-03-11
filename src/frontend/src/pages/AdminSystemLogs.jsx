import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = 'http://localhost:3001/api';

const LEVEL_COLORS = {
  error: 'bg-red-100 text-red-800',
  warn: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  debug: 'bg-gray-100 text-gray-600',
};

const LEVEL_OPTIONS = ['', 'error', 'warn', 'info', 'debug'];

export default function AdminSystemLogs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage] = useState(50);
  const [levelFilter, setLevelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadLogs = useCallback(async (pageNum, level, searchTerm) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pageNum || page,
        per_page: perPage
      });
      const lev = level !== undefined ? level : levelFilter;
      const s = searchTerm !== undefined ? searchTerm : search;
      if (lev) params.append('level', lev);
      if (s) params.append('search', s);

      const res = await fetch(`${API_URL}/admin/logs/system?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error('Failed to load system logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, levelFilter, search]);

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
        loadLogs(1, '', '');
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      });
  }, [navigate]);

  const handleLevelChange = (newLevel) => {
    setLevelFilter(newLevel);
    loadLogs(1, newLevel, undefined);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    loadLogs(1, undefined, searchInput);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearFilters = () => {
    setLevelFilter('');
    setSearch('');
    setSearchInput('');
    loadLogs(1, '', '');
  };

  const handleRefresh = () => {
    loadLogs(page);
  };

  const handlePageChange = (newPage) => {
    loadLogs(newPage);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return ts;
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-lg">{t('admin.loadingSystemLogs')}</p>
      </div>
    );
  }

  return (
    <div>
      <a href="#main-content" className="skip-to-content">
        {t('nav.skipToContent')}
      </a>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">{t('admin.systemLogsTitle')}</h2>
            <p className="text-secondary mt-1">
              {t('admin.systemLogsSubtitle', { total })}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {t('admin.refresh')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t('admin.logLevel')}</label>
              <select
                value={levelFilter}
                onChange={(e) => handleLevelChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">{t('admin.allLevels')}</option>
                {LEVEL_OPTIONS.filter(Boolean).map(l => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-text mb-1">{t('admin.search')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('admin.searchPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  {t('admin.search')}
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-secondary"
              >
                {t('admin.clear')}
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-secondary">
                {t('admin.noSystemLogs')}
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={log.id || idx} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium ${LEVEL_COLORS[log.level] || 'bg-gray-100 text-gray-600'}`}>
                      {(log.level || 'info').toUpperCase().padEnd(5)}
                    </span>
                    <span className="text-xs text-secondary whitespace-nowrap font-mono">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text font-mono break-all">{log.message}</p>
                      {log.stack && (
                        <pre className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded overflow-x-auto font-mono">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
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
