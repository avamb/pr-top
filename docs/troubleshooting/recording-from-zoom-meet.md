# How to record a Zoom / Google Meet / Teams session for PR-TOP upload

> **Why this guide exists.** PR-TOP does not (yet) embed Zoom or Meet
> directly inside the dashboard — see
> [`docs/decisions/0002-zoom-meet-integration.md`](../decisions/0002-zoom-meet-integration.md)
> for the rationale. Instead, you record locally in your existing
> conferencing tool and drag the file(s) into the **Bulk Upload** page;
> PR-TOP auto-attaches each file to the right client + session by
> filename / mtime metadata (T-20). This page tells you which buttons to
> press in each tool.

The shorter version: **make sure the recording lands as a separate audio
file on your own computer**, not just in the conferencing vendor's cloud
where you'd need an extra download step. If you only have cloud
recording, that works too — download the resulting MP4 / M4A first.

---

## Zoom

### Local recording (recommended — fastest, no Zoom paid plan needed)

1. Before the session: **Settings → Recording → enable "Local Recording"**.
2. (Optional but recommended) **Settings → Recording → enable "Record a separate audio file for each participant"** — this is what lets PR-TOP's single-track mode (T-19) keep only your audio if your client did not consent to recording.
3. In the call: **Record → Record on this Computer** (`Alt+R` on Windows, `⌘+Shift+R` on macOS).
4. End the call as usual. Zoom finishes processing the file — typical 30 s for a 50-min session — and opens the folder. Default location:
   - Windows: `%USERPROFILE%\Documents\Zoom\YYYY-MM-DD HH.MM.SS <Topic>\`
   - macOS: `~/Documents/Zoom/YYYY-MM-DD HH.MM.SS <Topic>/`
5. The folder contains `audio_only.m4a` (mixed) and, if you enabled per-participant tracks, `audio<n>.m4a` per speaker.
6. Drag the **whole folder or just the `.m4a`** into PR-TOP → **Bulk Upload**. The filename's `YYYY-MM-DD` prefix is what T-20 uses to auto-link.

### Cloud recording (Zoom Pro / Business / Enterprise)

1. In the call: **Record → Record to the Cloud**.
2. After the session, Zoom emails you when the recording is ready (typically 30–60 minutes later).
3. Download the **Audio Only (M4A)** version — not the MP4 — to keep the upload small.
4. Drag it into PR-TOP → Bulk Upload.

---

## Google Meet

> Recording in Meet requires Google Workspace **Business Standard or
> higher** ($12+/user/month). The free Meet tier and Workspace Business
> Starter cannot record. If you don't have a recording-eligible
> Workspace plan, use Zoom for recorded sessions or fall back to a
> separate dictaphone / OBS.

1. Start the meeting from the host account (recording is host-only).
2. **Activities (bottom-right) → Recording → Start recording**. Confirm the legal disclaimer Meet shows; consent is your responsibility.
3. End the call. Meet uploads the file to the host's **Google Drive** under `My Drive / Meet Recordings /`. Email notification arrives 10–60 minutes later.
4. Open the recording in Drive, **More (⋮) → Download** — the file lands as `<Topic> (YYYY-MM-DD at HH-MM GMT+TZ).mp4`. T-20 reads the date prefix.
5. Drag into PR-TOP → Bulk Upload.

If you want to skip the Google Drive round-trip entirely, run a local
audio recorder alongside Meet:

- macOS: **QuickTime → File → New Audio Recording** (records the mic; for the system audio side install BlackHole or Loopback).
- Windows: **Voice Recorder** (built-in) or OBS audio-only output.
- Linux: `parec` / `pw-record` to a `.wav`.

---

## Microsoft Teams

1. In the call: **More actions (⋯) → Record and transcribe → Start recording**. Recording is saved to OneDrive (1:1 calls) or SharePoint (channel meetings).
2. After the call, open the recording in Stream / OneDrive → **Download**.
3. Drag the `.mp4` into PR-TOP → Bulk Upload.

---

## In-person sessions / dictaphone / phone call

PR-TOP does not require the audio to come from a video conferencing tool. Any of these work:

- A handheld voice recorder exporting `.wav` / `.mp3` / `.m4a`.
- The **Voice Memos** app on iPhone (`File / Save to Files`).
- The **Recorder** app on Pixel / many Android phones.
- A laptop running Audacity / OBS audio-only output.

Whatever you use, just make sure the file lands on your computer with a sensible filename (`2026-04-20_14-00_alex.m4a` is great, `Untitled (3).m4a` will still work — T-20 falls back to the file's modification timestamp).

---

## File format support

PR-TOP accepts: `.m4a`, `.mp3`, `.mp4`, `.wav`, `.webm`, `.ogg`, `.flac`. Maximum file size: **100 MB** per file. A 50-minute mono `.m4a` at 64 kbps is around 24 MB — well within the limit. If your file is too large, re-export at a lower bitrate or use `ffmpeg`:

```bash
ffmpeg -i input.mp4 -vn -c:a aac -b:a 64k -ac 1 output.m4a
```

(`-vn` = drop video, `-ac 1` = mono — perfect for transcription, halves the size.)

---

## After upload

- PR-TOP's auto-link feature (T-20) attempts to attach the file to an existing session for the right client by **filename date** and, failing that, by **file modification timestamp**.
- When multiple clients have sessions on the same date, PR-TOP shows a conflict-resolution dropdown — pick the right client and continue.
- If no matching session exists, PR-TOP offers to **create a new session** with the metadata it inferred. You can edit the date, title, and inquiry tag at that point.
- If your client did not consent to being recorded, choose **single-track recording mode** before upload. PR-TOP runs speaker-diarisation (T-19) and transcribes only your voice; the client's audio is discarded after diarisation completes.

---

## Troubleshooting

- **"My Zoom file is too big."** Re-export with `ffmpeg -vn -c:a aac -b:a 64k -ac 1` (see above), or download the **Audio Only** version from Zoom Cloud.
- **"PR-TOP didn't auto-link the file."** Check that the filename starts with `YYYY-MM-DD` (e.g. `2026-04-20_session.m4a`). Otherwise PR-TOP falls back to the file's modification time, which is reliable as long as you upload before any process re-saves the file.
- **"My client revoked consent after the session."** Delete the recording immediately via the session detail page — this also wipes the encrypted audio from PR-TOP storage. Audit log entry is retained.
- **"I forgot to start recording."** PR-TOP cannot help. Make a habit of starting the recording before you click 'Admit' on your client. We're considering an in-app reminder; track via [#381](https://github.com/anthropics/dev-psy-bot/issues) if that becomes a pain point.

---

## Why no in-window Zoom / Meet integration today?

See [ADR-0002 Zoom / Google Meet SDK integration](../decisions/0002-zoom-meet-integration.md). Short version: every available SDK either (a) requires the therapist to buy a paid Zoom / Workspace plan we can't control, (b) adds a third-party processor of your client's audio (privacy regression for the therapist segment we serve), or (c) costs more per session than our subscription can absorb. We will revisit when the trigger conditions in section 6 of that ADR fire.
