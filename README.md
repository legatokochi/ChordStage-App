# ChordStage 🎸

A free, mobile-friendly, **local-first, installable chord book** for stage performers.

## What's included in the base version

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


## Chord Composer (v0.2)

In **Add new song**, choose **Chord Composer** to create a bar-by-bar arrangement without typing chord symbols. Set the song name, optional artist, key, scale (major, natural minor, harmonic minor, melodic minor ascending), time signature and tempo. The scale-aware keypad offers correctly spelled diatonic triads; select a bar and tap to insert chords. Select an inserted chord to modify it with **Major, Minor, 7, m7, Major 7, Add9, Aug, Dim, Sus2, Sus4, 6, 9, or 13**. Custom chords can be typed outside the selected scale.

Bar symbols: `|` adds the next bar, `||` marks a phrase end, `|:` starts a repeated section, `:|` ends it, `%` is a one-bar repeat sign, `/` a beat slash and `—` a held/empty token. **This is chord chart notation, not staff notation or a beat-accurate arranger**; tapping a chord adds it to the selected bar in sequence without automatically counting beats. Existing chord sheets can still be typed using the original free-text editor. New composer arrangements save to local storage, display in Stage View, transpose, and are included in JSON backups along with time signature and bar structures. Audio remains separate.

**Testing:** `node tests/composer.test.cjs` validates C major, A natural/harmonic minor, C# major spelling, chord qualities, custom chords and chart formatting. Run a device test before relying on the new editor live.

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