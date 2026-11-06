# Theme ambience recordings

These files are served locally; the application does not contact Freesound or another audio service. Playback and downloads begin only after the user activates the sound control. No application dependency was added.

All five source recordings are published under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is provided voluntarily:

- `rain.wav`: [Rain Loop (unfiltered), hargissssound](https://freesound.org/people/hargissssound/sounds/321647/). Stereo field recording; excerpt 20–44 seconds.
- `thunder.wav`: [Thunder 04, olliehahn12](https://freesound.org/people/olliehahn12/sounds/346277/). Stereo outdoor recording; single strike excerpt 13.5–25.5 seconds. Played once for each eligible lightning event, after a short distance delay.
- `wind.wav`: [G55-03-Wind in Trees.wav, craigsmith](https://freesound.org/people/craigsmith/sounds/438857/). Preserved vintage wind recording, mono; first 24 seconds. Used for snow ambience, not a literal sound of falling snow.
- `water.wav`: [running water bubbles-02.aif, kijjaz](https://freesound.org/people/kijjaz/sounds/16740/). Stereo recording of water bubbling around an air-filled bottle; used for the underwater bubble scene.
- `fire.wav`: [Ambiance_Campfire_Loop_Stereo.wav, Nox_Sound](https://freesound.org/people/Nox_Sound/sounds/558967/). Stereo campfire field recording.

Public HQ MP3 previews were decoded, resampled to 24 kHz PCM16 and normalized conservatively (peak at most 0.85). Loops use a 650 ms linear seam crossfade; the thunder one-shot uses short onset and one-second tail fades. No procedural noise or sine-wave substitutes are mixed in. `sources.json` records exact preview URLs, source/output SHA-256 hashes, output duration, channels, level measurements and byte sizes. RMS/peak entries describe the normalization stage before the thunder edge fades.

The complete library is about 7.1 MiB on disk. Only the selected ambience is fetched: at most two files/buffers for a thunderstorm, one for other scenes. Files are not imported into the JavaScript bundle. Decoded buffers, pending requests and sources are released on stop or workspace cleanup; switching presets keeps only the current scene's buffers.

For future replacements, verify the source's license and recording quality, retain provenance here, trim a natural excerpt, crossfade the loop seam, and measure both peak and RMS before testing audibly on headphones and speakers. Do not edit a public asset in place without also updating its manifest hash.
