# Architecture and next steps

The `.ino` delegates lifecycle to Application. HardwareConfig owns pins/timing;
FaderInput performs hardware-independent smoothing/calibration to 16-bit values;
MidiManager owns output quantization/hysteresis. Configuration holds factory
settings and a version field. Future storage must validate ranges, labels,
hostnames and versions and use explicit serialization rather than raw struct bytes.

Reserved component folders document future boundaries, without pretending those
features already work:

| Component | Responsibility / planned dependency |
| --- | --- |
| EncoderInput | Quadrature, debounce, click/long press; Arduino GPIO initially |
| ConfigManager | Versioned load/save/migration/factory reset; Preferences |
| DisplayManager | Single-channel PCA9546 selection and rotated OLED rendering; Wire + proposed U8g2 |
| MidiManager | Changed-value transmission and replaceable transport; investigate core USBMIDI first |
| NetworkManager | Saved LAN/standalone setup, NVS network settings, scanning, mDNS and AP handoff implemented; encoder-controlled AP policy pending |
| WebConfigServer | Core WebServer serves embedded UI and network APIs; CC/calibration device API pending |

Only core Arduino/ESP32 APIs are used now; no third-party dependencies installed.
U8g2 is proposed for software 90-degree rotation, pending module verification.
Do not advertise relative/acceleration modes in a future UI before implementing
them. Encoder defaults to bounded absolute mode. Normal button behavior remains
an open product decision; setup long press must consume its click event.

Bring-up milestones: (1) build/upload/serial, (2) ADC measurements and tune filter,
(3) three faders, (4) encoder/button, (5) one OLED, (6) mux/four orientations,
(7) USB MIDI/changed-value output, (8) versioned NVS, (9) AP/browser setup,
(10) LAN/mDNS/fallback, (11) local menu and polish.

The modular skeleton does not depend on sequentially wiring every milestone.
Record real hardware measurements before tuning filters or fixing calibration.

User calibration is an optional setup feature; see [workflow and implementation](calibration.md).

See [setup experience and recovery](setup.md) for onboarding, persistence and reset contracts.

The browser preview is implemented in [web/](../web/README.md); its simulated
adapter is separate from the planned [device API](web-api.md).
