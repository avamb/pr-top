// CreateSoloClient.jsx — T-06 Solo mode (therapist-only "smart notebook").
//
// Modal that lets a therapist create a "client" entity entirely on their own
// side: no telegram_id, no invite_code, no client-facing flow. Used for
// psychoanalysts whose patients don't use a chatbot, paranoid clients, or
// just personal case-file notebooks.
//
// Lives behind a single "+ Create Solo Client" button on /clients. When the
// therapist toggles "Client will not use the bot (solo mode)" the form
// collapses to first/last name + optional initial note. Hitting save POSTs
// to /api/clients/solo and the parent reloads the client list.
//
// Validation rules (mirror server-side):
//   - At least one of first_name / last_name / email must be non-empty
//   - email is optional but must look like an email if provided
//   - note is optional, ≤2000 chars
//   - language defaults to therapist's UI language (en/ru/es/uk)
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = '/api';

export default function CreateSoloClient({ open, onClose, onCreated }) {
  const { t, i18n } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [language, setLanguage] = useState(i18n.language || 'en');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const firstNameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setNote('');
      setLanguage(i18n.language || 'en');
      setError('');
      // Autofocus the first input
      setTimeout(() => {
        if (firstNameRef.current) firstNameRef.current.focus();
      }, 50);
    }
  }, [open, i18n.language]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedNote = note.trim();

    if (!trimmedFirst && !trimmedLast && !trimmedEmail) {
      setError(t('client.solo.errorNeedIdentifier', 'Provide a first name, last name, or email.'));
      return;
    }
    if (trimmedNote.length > 2000) {
      setError(t('client.solo.errorNoteTooLong', 'Note must be 2000 characters or less.'));
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError(t('client.solo.errorAuth', 'Authentication expired. Please log in again.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/clients/solo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          email: trimmedEmail,
          language: language || 'en',
          note: trimmedNote
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.message || t('client.solo.errorGeneric', 'Failed to create solo client.'));
        setSubmitting(false);
        return;
      }

      // Success — let parent reload the client list and close.
      if (onCreated) onCreated(data.client);
      onClose();
    } catch (err) {
      setError(err.message || t('client.solo.errorGeneric', 'Failed to create solo client.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solo-client-title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      data-testid="create-solo-client-modal"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div>
            <h3 id="solo-client-title" className="text-lg font-semibold text-stone-800">
              {t('client.solo.title', 'New solo client')}
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              {t('client.solo.description', 'A therapist-only notebook. The client never connects to the bot — useful when the client cannot or will not use Telegram. You can still upload session audio, write notes, and run AI queries.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none disabled:opacity-50"
            aria-label={t('common.close', 'Close')}
          >×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="solo-first-name" className="block text-sm font-medium text-stone-700 mb-1">
              {t('client.solo.firstName', 'First name')}
            </label>
            <input
              id="solo-first-name"
              ref={firstNameRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              disabled={submitting}
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
              data-testid="solo-first-name"
            />
          </div>

          <div>
            <label htmlFor="solo-last-name" className="block text-sm font-medium text-stone-700 mb-1">
              {t('client.solo.lastName', 'Last name')}
            </label>
            <input
              id="solo-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              disabled={submitting}
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
              data-testid="solo-last-name"
            />
          </div>

          <div>
            <label htmlFor="solo-email" className="block text-sm font-medium text-stone-700 mb-1">
              {t('client.solo.emailOptional', 'Email (optional)')}
            </label>
            <input
              id="solo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              disabled={submitting}
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
              data-testid="solo-email"
            />
          </div>

          <div>
            <label htmlFor="solo-language" className="block text-sm font-medium text-stone-700 mb-1">
              {t('client.solo.language', 'Language')}
            </label>
            <select
              id="solo-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 bg-white"
              data-testid="solo-language"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="es">Español</option>
              <option value="uk">Українська</option>
            </select>
          </div>

          <div>
            <label htmlFor="solo-note" className="block text-sm font-medium text-stone-700 mb-1">
              {t('client.solo.noteOptional', 'Initial note (optional)')}
            </label>
            <textarea
              id="solo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={2000}
              disabled={submitting}
              placeholder={t('client.solo.notePlaceholder', 'Anything you want to remember about this client — encrypted, therapist-only.')}
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 resize-y"
              data-testid="solo-note"
            />
            <div className="text-xs text-stone-400 mt-1 text-right">
              {note.length} / 2000
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            {t('client.solo.disclaimer', 'Solo clients are invisible to the Telegram bot. Diary, exercises, and SOS alerts are not available — you can still upload sessions, write notes, and run AI queries.')}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700" data-testid="solo-error">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-stone-300 rounded text-sm hover:bg-stone-50 disabled:opacity-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50"
              data-testid="solo-submit"
            >
              {submitting ? t('client.solo.creating', 'Creating…') : t('client.solo.create', 'Create solo client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
