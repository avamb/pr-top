<!-- audience: user -->

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
