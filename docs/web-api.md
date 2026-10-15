# Setup firmware integration contract (planned)

The first interface is in `web/`, with a browser-only preview adapter. Firmware
still runs serial bring-up. None of the routes below are implemented or exposed.
No extra network services are started by the existing firmware.

The embedded implementation should serve these same local assets and replace
PreviewDevice with an HTTP adapter. It must explicitly identify the live device
mode so the UI can remove preview badges and browser-only save claims. Never
silently use simulated success after a real device error.

| Operation | Planned firmware behavior |
| --- | --- |
| Load configuration | Return validated settings and a revision; omit credentials/passwords from responses. Include session network state separately from saved preference. |
| Save page | Validate the changed fields and expected revision; atomically persist the accepted configuration before success. On failure retain previous stored/live settings. |
| Join LAN | Keep AP recovery available while testing credentials; expose pending/success/failure status. Save completed LAN setup only after success, show hostname/IP and reconnection instructions. Never return the password. |
| Start/capture calibration | Select one fader, suppress its MIDI, settle and collect stable raw samples using FaderCalibration. Capture bottom and top only on explicit requests. Bound timeout and show noise/span/reversed-endpoint errors. |
| Save/cancel calibration | Save accepted endpoints only; cancel/timeout preserves old settings and restores normal control behavior. Reset the output tracker when applying new endpoints. |
| Reset network/factory | Require explicit confirmation, use shared ConfigManager reset scope, persist replacement, acknowledge and reboot. Provide equivalent hardware-menu actions without networking. |
| Finish setup | Warn about unsaved edits, acknowledge before stopping web services, then turn Wi-Fi off and resume normal operation. |

NVS persistence, HTTP request handling, LAN/AP state transitions and hardware menu
remain separate implementation work. Define concrete routes and payloads when
adding those handlers; the browser adapter is intentionally isolated for this.
Device-side hostname, string-length/encoding, MIDI-range and calibration checks
must enforce firmware limits even if a browser bypasses validation. Reject stale
revision writes rather than losing another client's changes.

Brightness preview must be distinguished from saved brightness, and the actual
OLED driver may need a contrast mapping. Encoder mode choices stay limited to
implemented bounded absolute mode; reserve relative/wrap/acceleration for later.
An eventual browser API must use firmware-reported capabilities rather than imply
an unfinished control feature works.
