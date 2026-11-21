# ChordStage 🎸

A free, mobile-friendly, **local-first, installable chord book** for stage performers.

## What's included in version 0.1

- Song library: add, search, edit, delete, and save chords and lyrics.
- Chords typed as `[C]`, `[Am]`, `[F#m7]` or `[D/F#]` above the following words.
- Instant chord transposition, including slash-chord bass notes, plus adjustable font size.
- Distraction-reduced stage view with optional fullscreen and screen wake lock.
- Auto-scroll by pixels/second or by song BPM × pixels/beat.
- Audio files saved locally using IndexedDB (device storage permitting).
- Play-along: audio transport, seek controls, live current chord, next chord and countdown.
- Timeline corrections: edit chord symbols and start times; tap cues to seek playback.
- Experimental **major/minor triad** chord estimator running in the browser. Not reliable enough for unreviewed live use.
- Offline app-shell cache with a service worker; works after the first online load on HTTPS.
- JSON export/restore of charts and timing cues **without audio**.

## What's not included yet

- **Automatic lyrics transcription**: requires a speech recognition model or service; no transcription happens in v0.1.
- Analysis of advanced chord qualities: seventh, suspended, diminished, etc. The estimator outputs only major/minor triads.
- Cloud sync, shared libraries, streaming music, or multi-device synchronization.
- Guaranteed chord accuracy. Always review chord and timing estimates manually.

## Run

1. Create a **new** GitHub repository named `chordstage-app` (keep it separate from other website projects).
2. Upload the **contents** of this folder, including hidden `.nojekyll` and `icons/`.
3. In your repository go to **Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save**.
4. Open the Pages URL over HTTPS and try it on your phone.
5. In Android Chrome choose **⋮ → Add to Home screen → Install app** (wording differs by device). If installation isn't offered, use the browser shortcut option.

To test locally with service workers, use a local HTTP server (e.g. `python -m http.server 8000`) and open `http://localhost:8000`. Directly opening `index.html` with `file://` won't provide all PWA features.

## How to create a chart

```text
Verse 1:
[C]Sing the first [G]line
[Am]And the next [F]line

Chorus:
[F]Go where the [C]music leads
[G]We can start a[C]gain
```

## Storage and privacy

Charts and uploaded recordings stay in the browser's IndexedDB on the current device. Audio analysis also happens locally. If you clear site data, use private browsing, uninstall in a way that deletes site data, or exceed the browser's storage limits, **songs or recordings may be lost**. Back up your charts regularly and keep original copies of recordings separately. Exported JSON files do NOT contain audio. This app currently needs no sign-in, ads, server, account, API key or recurring hosting charge for a noncommercial prototype.

Do not upload recordings you lack rights to share or distribute. Store private audio only on your own device.

## Technical stack

Vanilla HTML + CSS + JavaScript, IndexedDB, Web Audio API, Service Worker and Web App Manifest. No npm or server required for this first version. Source files can be hosted as static files on GitHub Pages for testing. For a monetized production service, select hosting with terms suited to commercial use.

## Development priorities

1. Test on real Android devices, including airplane mode and very large charts.
2. Improve chord analysis using harmonic/percussive separation, bass tracking, key constraints, onset detection and beat quantization; allow tuning of analyzer sensitivity.
3. Add optional on-device Whisper-based lyric transcription with appropriate memory/storage notices, language selection and a fallback service only if the user opts in.
4. Export/import playable setlists and make multi-device backups safer.

License: currently no license is granted to reuse or redistribute this code beyond rights of the repository owner.