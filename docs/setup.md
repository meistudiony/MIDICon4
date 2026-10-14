# Setup experience and recovery

This is the agreed product flow. Menu rendering, browser pages, networking,
NVS storage and reboot integration are pending; this document is their contract.

## On the controller

Enter the local setup menu using the encoder. Long press remains the provisional
entry gesture; rotation selects and a click confirms. Entering the menu alone
must not enable Wi-Fi. Local entries include Wi-Fi Setup, Calibrate Faders,
Reset Network Settings, Factory Reset and Exit Setup. Full local CC editing is
undecided; the browser remains the primary detailed configuration interface.

Selecting Wi-Fi Setup enables the radio. With no completed network choice,
start standalone AP access and show SSID/IP on the encoder OLED. Later sessions
use the saved standalone/LAN preference. LAN attempts have a bounded timeout
and fall back to AP without discarding credentials. Wi-Fi stays off during normal
USB MIDI operation.

## Browser first visit

The initial screen handles networking only: choose Use Standalone or Join Wi-Fi.
Standalone is a saved preference, not an incomplete setup. LAN setup collects
credentials, tests connection and shows reconnection instructions before changing
networks. Failed connection retains AP access and allows retry or standalone.
After the network choice is saved, open the main menu directly. Subsequent visits
also open the main menu. LAN failure fallback does not restart onboarding.

No calibration prompt, forced calibration or automatic calibration follows network
setup. Instructions supplied with the unit recommend calibration before first use.

## Browser main menu

- Network Setup: standalone/LAN preference, credentials and connection status.
- Calibration: optional guided per-fader bottom/top capture and save.
- CC Configuration: labels, channels, CCs, output ranges, inversion and implemented
  encoder settings.
- Options: screen brightness, Reset Network Settings and Factory Reset.
- Finish Setup: warn about unsaved edits, stop web services and turn Wi-Fi off.

Pages use explicit Save and Cancel. Save succeeds only after validated settings
are committed to storage; display an error and preserve the previous settings on
failure. Browser requests and hardware menu actions must share configuration logic.

## Persistence

Versioned ESP32 NVS must retain calibration, all control configuration, device
name/hostname, network preference/credentials, completed-network-choice flag and
screen brightness. Load at startup; defaults apply only when no valid configuration
exists. No need to repeat setup on power-on. Serialize fields explicitly, migrate
older schemas and avoid writing flash on every ADC sample or brightness preview.
Schema v2 adds network preference/completion and brightness; migration should infer
LAN mode from existing nonempty credentials and otherwise allow the network choice.

## Recovery from either UI

Factory Reset is accessible on hardware without working networking, and in browser
Options. Require a separate confirmation stating that it erases network settings,
calibration, CC assignments and other preferences. Cancel is the safe initial choice;
opening the menu or a stray encoder click must not reset anything.

Reset Network Settings also requires confirmation. It clears credentials, restores
standalone preference and clears the completed-network-choice flag, while preserving
calibration, CC configuration, brightness and device identity.

Both resets save their replacement configuration before requesting reboot. On a
storage error, show failure and keep current settings; do not report success/reboot.
After successful reset, the next Wi-Fi Setup selection starts AP access and offers
the standalone/LAN choice. Reboot itself returns to normal MIDI mode with Wi-Fi off.

ConfigManager implements the shared confirmed-reset operation against an abstract
storage adapter. No actual NVS writes, menu actions or reboot calls are wired yet.
The NVS adapter must replace the full known configuration and remove any legacy
credential keys so factory reset cannot reload stale settings.
