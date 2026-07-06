<!-- audience: public -->

# How to upload a session recording

PR-TOP can transcribe and summarize an audio or video recording of a
therapy session so that the notes you carry between sessions match what
actually happened in the room. This how-to covers the upload flow on
the Basic plan and above.

## Prerequisites

- Your client has consented in writing to session recording. PR-TOP
  enforces the consent flag on their client record — without it, the
  upload button is disabled.
- You are on the Basic, Pro, or Premium plan. Trial accounts can
  attach an audio file to a manual note, but transcription is gated to
  paid tiers.
- The file is under 100 MB and in a common audio or video container
  (mp3, m4a, wav, mp4, webm).

## Step-by-step

1. Open the client page from Clients in the sidebar.
2. Click **New session**. Enter the session date and (optionally) a short title.
3. Choose **Attach recording** and pick your file.
4. Confirm upload. The file is stored encrypted at rest with an opaque
   identifier — even a server-side viewer cannot read it without the key.
5. Wait for transcription to complete. Small files finish in under a
   minute; a 60-minute session usually takes 3-6 minutes.
6. Review the transcript. Redact anything you want removed by editing the
   text — the encrypted version is rewritten on save.
7. Trigger **Generate summary**. PR-TOP produces a short structured
   summary (themes, homework, risk flags) that you can drop into your
   own note.

## Where the file lives

Recordings are stored encrypted on the backend under a signed-access
stream. They are never exposed at a guessable URL. If you delete the
session, both the recording and its transcript are removed within the
nightly cleanup window.

## Troubleshooting

- **Upload button greyed out** — check the client's consent switch is on.
- **Transcription stuck at 0%** — the AI provider may be unreachable.
  Check Settings → Assistant → Diagnostics to confirm the transcription
  provider is healthy.
- **Summary looks generic** — make sure the transcript is legible; the
  quality of the summary depends on the transcript.

## Edge cases

- **Quota nearly full.** The uploader warns when the batch would
  push you over the session quota. Upgrade, drop overflow files, or
  postpone them to the next billing period.
- **Duplicate upload.** If a file's hash matches an existing session
  on the same client, the upload is skipped and marked "already
  uploaded" without counting against quota.
- **Auto-detect picks the wrong language.** Force the language on the
  upload row before submit. A wrong-language transcript reads as
  gibberish; delete and re-upload with the language forced.
- **Mid-transcription failure.** The session page shows a Retry
  button. Repeated failures on the same file usually mean corrupted
  audio.

## FAQ

**Q: How long does transcription take?**
A: Roughly 0.1× real-time on the default transcription provider —
a 60-minute recording takes about six minutes, plus queue wait.

**Q: Are video files supported?**
A: Yes. mp4 and webm up to 100 MB. Only the audio track is
transcribed; video playback is available on Pro and Premium.

**Q: Where do transcripts live?**
A: On the session page. Both the transcript and the AI summary are
Class-A data — AES-encrypted at rest.

**Q: Can I bulk-upload multiple sessions?**
A: Yes. See the Bulk session upload how-to for the batch flow.

**Q: What if the client withdraws consent after upload?**
A: New uploads are blocked. Existing sessions stay encrypted until
you delete them explicitly or delete the client.

**Q: Do transcripts feed the vector search?**
A: Yes. Transcripts and AI summaries are indexed on Pro/Premium and
retrievable via natural-language queries scoped to that client.
