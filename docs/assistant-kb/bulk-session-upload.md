<!-- audience: public -->
# Bulk session upload

Uploading one session at a time is fine for a couple of clients but
becomes tedious once you catch up on a whole day's recordings or
migrate history from another platform. Bulk session upload lets you
drop up to a batch of session files at once and have PR-TOP queue
them for transcription and AI summarization in the background. Labels
here come from the `sessions` and `bulkImport` i18n namespaces.

## Prerequisites

- Basic, Pro, or Premium plan (transcription is gated). Trial can hold
  a bulk upload of files but transcription remains blocked; each
  session becomes a "manual notes" entry.
- Each client involved in the batch must have the session-recording
  consent flag on. Files for clients without consent are rejected up
  front and highlighted red in the queue.
- Enough session quota left on your plan for the whole batch. Basic
  allows 50 sessions per month, Pro 250, Premium unlimited. The
  uploader warns you if the batch will exceed the quota.
- Each file under 100 MB and in a supported audio or video container
  (mp3, m4a, wav, mp4, webm).

## Step-by-step

1. **Open the Sessions area.** From the sidebar tap **Sessions →
   Bulk upload**.
2. **Assign files to clients.** Drag one or more files into the drop
   zone. For each file, pick the client and the session date from the
   dropdowns; the platform pre-fills the date from the file's
   `last-modified` timestamp when it can.
3. **Confirm consent.** The uploader shows a small green check next
   to each client name that has the session-recording flag on. Any
   client with a red X blocks that file from being submitted.
4. **Choose transcription options.** For each row you can:
   - **Language** — auto-detect (default), or force EN/RU/ES/UK.
   - **Speaker labels** — on by default. Turn off if you know only one
     speaker is audible.
   - **AI summary** — on by default on Basic and above.
5. **Submit.** Files upload in parallel, capped at three concurrent
   uploads per browser tab. The queue shows a per-file progress bar
   and the whole-batch estimated time.
6. **Walk away.** Once every file has uploaded, the batch enters the
   background transcription queue. You can close the tab. When each
   transcript is ready, an activity-feed entry appears and the client
   page updates.

## Edge cases

- **Mid-batch quota exhaustion.** If the batch would push you over
  the plan quota mid-way, the uploader offers three actions before it
  submits: upgrade now, drop the overflow files, or split the batch
  across billing periods (the overflow files are held for later).
- **One file rejected.** A rejection at upload (wrong container, too
  big) does not abort the rest. The failed row shows a red toast; fix
  and retry that row.
- **Very large batches.** More than 40 files at once are chunked into
  40-file windows by the uploader to keep the queue responsive; no
  action needed from you.
- **Duplicate detection.** If a file's hash matches an existing
  session on the same client, the uploader skips it and marks the row
  "already uploaded" rather than double-counting quota.

## Troubleshooting

- **"File too large" error.** The 100 MB limit is per file. Trim the
  file locally (a 60-minute mono AAC at 64 kbps fits comfortably) and
  re-upload.
- **Language auto-detect picks the wrong language.** Force the
  language on the row before submit. Transcripts for the wrong
  language will still complete but read as gibberish; delete and
  re-upload with the language forced.
- **Row shows red X for consent.** Open the client page, tap Consent,
  toggle **Session recording** on, save, then return to the bulk
  upload and refresh the row.
- **Progress bar stuck at 99%.** The last percent is the server
  finalizing the upload and enqueuing the transcription job. Give it
  30 seconds. If it never advances, refresh — the file usually
  finished but the browser missed the completion event.
- **Transcript never appears in the client timeline.** Check the
  Sessions area for a failed job. Transcription failures show a
  retry button; a repeated failure with the same file suggests
  corrupted audio, so try re-exporting the file locally first.

## FAQ

**Q: How long does transcription take?**
A: Roughly 0.1× real-time on the default transcription provider — a
60-minute recording takes about six minutes end-to-end, plus queue
wait if you submitted a big batch.

**Q: Can I upload video as easily as audio?**
A: Yes. Video files (mp4, webm) are accepted up to the same 100 MB
cap. Only the audio track is transcribed; video streaming playback is
available on Pro and Premium via the `player` UI area.

**Q: Are files encrypted before upload?**
A: Uploads travel over HTTPS to the backend and are encrypted at rest
with your account key as soon as they arrive. Encryption also covers
the transcript and AI summary — every Class-A field.

**Q: What if I change my mind about a session mid-batch?**
A: You can remove any row from the queue up to the moment it starts
uploading. Once upload starts, cancel the row to abort; the partial
upload is discarded and does not count against your quota.

**Q: Do bulk-uploaded sessions cost more than one-at-a-time uploads?**
A: No. Each session costs one session credit against your monthly
quota regardless of whether you uploaded it alone or in a batch.

**Q: Can I import from a CSV describing my sessions?**
A: The `bulkImport` flow exists for creating client records; there is
no CSV-driven session import today because each session needs its
audio file. Files still have to be dropped in the browser.

**Q: What happens to the raw audio after transcription?**
A: The audio is retained (encrypted at rest) so you can play it back
from the session page. Delete a session to purge both the transcript
and the raw audio; deletion is subject to the 30-day recovery window.

**Q: My browser tab crashed mid-upload. Did I lose files?**
A: Files whose progress bar had reached 100% before the crash are
already on the server and are being processed. Files that were still
in progress must be re-added to a new batch.
