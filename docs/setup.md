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
the standalone/LAN choice. After reset clears the saved network configuration, reboot leaves Wi-Fi off.
With a valid saved configuration, reboot automatically starts saved network setup.

ConfigManager implements the shared confirmed-reset operation against an abstract
storage adapter. No actual NVS writes, menu actions or reboot calls are wired yet.
The NVS adapter must replace the full known configuration and remove any legacy
credential keys so factory reset cannot reload stale settings.

## Fixed unit identity

This unit is serial 001 and identifies as MIDICon4-001. The serial is assigned
in hardware/DeviceIdentity.h at build time and is not a user setting. The network
API ignores browser-supplied device names and overrides legacy stored names with
the fixed identity. The device name is displayed as text, with no editable field.
Network preference changes and resets do not change the unit identity. The AP SSID remains unchanged.

Setup hostnames are derived from the connection state, not editable by users:
standalone/fallback uses midicon4.local; connected LAN uses midicon4-001.local.
Successful LAN connection turns off the setup AP. Network failure restores the
AP and generic hostname.
The interface displays the appropriate address instead of a hostname input.

## Control names and encoder behavior

Control names are fixed: Fader 1, Fader 2, Fader 3 and Encoder. There are no
editable label fields. Older browser saves have their names normalized while
retaining CC assignments, ranges and calibration. Fader OLEDs show CC number
and current value. The encoder remains an assignable MIDI control during normal
operation; a long press enters menu mode. Its CC/range settings remain available.

## Automatic startup with saved networking

A completed, valid saved network choice starts setup automatically at boot.
Standalone starts the AP; LAN attempts saved credentials with AP recovery during
the attempt. On LAN success the AP turns off; on failure it remains available. No saved choice, invalid storage or a reset leaves startup
Wi-Fi off until setup is requested. Serial x still stops setup for the current
session and does not erase the saved preference.

## Planned AP policy once the encoder hardware is available

The latest agreed target is automatic connection to saved LAN Wi-Fi, with the
setup AP activated only by an explicit encoder-menu action. Missing credentials
or a failed LAN attempt must not automatically enable the AP in that version.
This is intentionally deferred until the encoder hardware/menu is implemented.
Current bring-up firmware still starts AP recovery while connecting, turns it off
after successful LAN connection, and restores it on LAN failure.
