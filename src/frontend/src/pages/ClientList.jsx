import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function ClientRow({ client }) {
  const consentColor = client.consent_therapist_access
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600';
  const consentLabel = client.consent_therapist_access ? 'Consented' : 'No Consent';
  const displayName = client.email || client.telegram_id || `Client #${client.id}`;
  const date = new Date(client.created_at);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-text">{displayName}</td>
      <td className="px-4 py-3 text-sm text-secondary">{client.telegram_id || '—'}</td>
      <td className="px-4 py-3 text-sm text-secondary">{client.language?.toUpperCase() || 'EN'}</td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${consentColor}`}>
          {consentLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-secondary">{date.toLocaleDateString()}</td>
    </tr>
  );
}

export default function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [loadTime, setLoadTime] = useState(null);
  const fetchRef = useRef(0);

  const fetchClients = useCallback(async (searchTerm, pageNum) => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    const fetchId = ++fetchRef.current;
    setLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        per_page: perPage.toString()
      });
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`${API_URL}/clients?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      // Only update if this is the latest fetch
      if (fetchId === fetchRef.current) {
        setClients(data.clients);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.total_pages);
        setPlanInfo({ limit: data.limit, can_add: data.can_add, plan: data.plan, message: data.limit_message });
        setLoadTime(elapsed);
      }
    } catch (err) {
      if (fetchId === fetchRef.current) {
        setError(err.message);
      }
    } finally {
      if (fetchId === fetchRef.current) {
        setLoading(false);
      }
    }
  }, [navigate, perPage]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearch(term);
      setPage(1);
    }, 300),
    []
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    fetchClients(search, page);
  }, [search, page, fetchClients, navigate]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary">PsyLink</h1>
            <nav className="flex gap-2 ml-4">
              <button onClick={() => navigate('/dashboard')} className="text-sm text-secondary hover:text-primary px-3 py-1 rounded transition-colors">Dashboard</button>
              <button className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded">Clients</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-secondary">{user.email}</span>
            <button onClick={handleLogout} className="text-sm text-secondary hover:text-text transition-colors">Log out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text">Clients</h2>
            <p className="text-sm text-secondary mt-1">
              {total} client{total !== 1 ? 's' : ''} total
              {planInfo && planInfo.limit > 0 && ` (limit: ${planInfo.limit})`}
              {loadTime !== null && <span className="ml-2 text-xs text-gray-400">loaded in {loadTime}ms</span>}
            </p>
          </div>
          {planInfo && !planInfo.can_add && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
              {planInfo.message}
            </div>
          )}
        </div>

        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search by email or Telegram ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-sm text-secondary">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Client table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Telegram</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Language</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Consent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-10"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    </tr>
                  ))
                ) : clients.length > 0 ? (
                  clients.map(client => (
                    <ClientRow key={client.id} client={client} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-secondary">
                      {search ? 'No clients match your search.' : 'No clients linked yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-secondary">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {/* Show page numbers */}
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
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded-md transition-colors ${
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
