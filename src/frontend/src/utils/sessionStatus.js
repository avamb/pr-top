// Shared presentation of the session.status values written by the backend
// (routes/sessions.js, services/transcription.js, services/diarization.js).

export const SESSION_STATUS_BADGE = {
  complete: 'bg-green-100 text-green-800',
  transcribing: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  diarizing: 'bg-indigo-100 text-indigo-800',
  awaiting_speaker_selection: 'bg-amber-100 text-amber-800',
  diarization_failed: 'bg-rose-100 text-rose-800',
  transcription_failed: 'bg-rose-100 text-rose-800',
  failed: 'bg-rose-100 text-rose-800',
  // Non-retryable: the recording is over the automatic transcription limit.
  transcription_too_long: 'bg-orange-100 text-orange-800'
};

export function sessionStatusBadge(status) {
  return SESSION_STATUS_BADGE[status] || 'bg-gray-100 text-gray-800';
}

/** Friendly, translated label; unknown statuses fall back to the raw value. */
export function sessionStatusLabel(t, status) {
  if (!status) return '';
  return t(`session.statusLabel.${status}`, { defaultValue: status });
}
