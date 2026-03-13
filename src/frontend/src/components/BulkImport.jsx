import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

export default function BulkImport({ onClose, onImportComplete }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  function handleFileSelect(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setParseError('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let clients = [];

        if (selected.name.endsWith('.csv')) {
          clients = parseCSVPreview(text);
        } else if (selected.name.endsWith('.json')) {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            clients = data;
          } else if (data.clients && Array.isArray(data.clients)) {
            clients = data.clients;
          } else {
            setParseError(t('bulkImport.invalidFormat', 'Invalid file format'));
            return;
          }
        } else {
          setParseError(t('bulkImport.unsupportedType', 'Unsupported file type. Use CSV or JSON.'));
          return;
        }

        if (clients.length === 0) {
          setParseError(t('bulkImport.noRecords', 'No client records found in the file'));
          return;
        }

        if (clients.length > 200) {
          setParseError(t('bulkImport.tooMany', 'Maximum 200 clients per import'));
          return;
        }

        setPreview(clients.slice(0, 50)); // Show first 50 for preview
      } catch (err) {
        setParseError(t('bulkImport.parseError', 'Could not parse file: ') + err.message);
      }
    };
    reader.readAsText(selected);
  }

  function parseCSVPreview(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const clients = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
      clients.push(obj);
    }

    return clients;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  async function handleImport() {
    if (!file || importing) return;
    setImporting(true);
    setResult(null);
    setParseError('');

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/clients/import-bulk`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || data.message || 'Import failed' });
        return;
      }

      setResult(data);
      if (data.summary.created > 0 && onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setResult({ success: false, error: 'Network error: ' + err.message });
    } finally {
      setImporting(false);
    }
  }

  function resetForm() {
    setFile(null);
    setPreview(null);
    setParseError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('bulkImport.title', 'Import Clients')}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('bulkImport.subtitle', 'Upload a CSV or JSON file to import multiple clients at once')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* File upload area */}
          {!result && (
            <div className="mb-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-3xl mb-2">📁</div>
                <p className="text-sm text-gray-600 mb-1">
                  {file
                    ? file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)'
                    : t('bulkImport.dropzone', 'Click to select a CSV or JSON file')}
                </p>
                <p className="text-xs text-gray-400">
                  {t('bulkImport.formatHint', 'CSV columns: name, email, phone, notes | JSON: array of objects')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {file && !parseError && (
                <button
                  onClick={resetForm}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  {t('bulkImport.clearFile', 'Clear file')}
                </button>
              )}
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {preview && !result && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('bulkImport.preview', 'Preview')} ({preview.length}{preview.length === 50 ? '+' : ''} {t('bulkImport.records', 'records')})
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                        {t('bulkImport.colName', 'Name')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                        {t('bulkImport.colEmail', 'Email')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                        {t('bulkImport.colPhone', 'Phone')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                        {t('bulkImport.colNotes', 'Notes')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">{row.name || '—'}</td>
                        <td className="px-3 py-2">{row.email || '—'}</td>
                        <td className="px-3 py-2">{row.phone || '—'}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.notes}>{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import results */}
          {result && (
            <div className="space-y-4">
              {result.success === false ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-1">{t('bulkImport.importFailed', 'Import Failed')}</h4>
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">{t('bulkImport.importComplete', 'Import Complete')}</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-700">{result.summary.created}</p>
                        <p className="text-xs text-green-600">{t('bulkImport.created', 'Created')}</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">{result.summary.skipped}</p>
                        <p className="text-xs text-amber-500">{t('bulkImport.skipped', 'Skipped')}</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{result.summary.errors}</p>
                        <p className="text-xs text-red-500">{t('bulkImport.errorsCount', 'Errors')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Created clients with invite codes */}
                  {result.created && result.created.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {t('bulkImport.createdClients', 'Created Clients')}
                      </h4>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">ID</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                {t('bulkImport.colEmail', 'Email')}
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                {t('bulkImport.colName', 'Name')}
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                                {t('bulkImport.inviteCode', 'Invite Code')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.created.map((c) => (
                              <tr key={c.id} className="border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-400">{c.id}</td>
                                <td className="px-3 py-2">{c.email || '—'}</td>
                                <td className="px-3 py-2">{c.name || '—'}</td>
                                <td className="px-3 py-2 font-mono text-teal-600">{c.invite_code}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Skipped */}
                  {result.skipped && result.skipped.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-amber-700 mb-2">
                        {t('bulkImport.skippedClients', 'Skipped')}
                      </h4>
                      <div className="space-y-1">
                        {result.skipped.map((s, i) => (
                          <div key={i} className="text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded">
                            {t('bulkImport.row', 'Row')} {s.row}: {s.email} — {s.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {result.errors && result.errors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2">
                        {t('bulkImport.errorDetails', 'Errors')}
                      </h4>
                      <div className="space-y-1">
                        {result.errors.map((e, i) => (
                          <div key={i} className="text-sm text-red-700 bg-red-50 px-3 py-1 rounded">
                            {t('bulkImport.row', 'Row')} {e.row}: {e.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          {result ? (
            <>
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('bulkImport.importAnother', 'Import Another')}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                {t('common.close', 'Close')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || importing}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t('bulkImport.importing', 'Importing...')}
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    {t('bulkImport.confirmImport', 'Import Clients')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
