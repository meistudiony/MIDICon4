# Phone access-point test

The firmware can now host the same browser preview directly on the XIAO. This
checks the AP radio, phone connection and offline asset loading. Networking now supports real LAN connection and persistent network settings.
CC assignments, calibration and options still use browser-only preview storage.
The interface still labels browser-only simulated configuration. Finish Setup in
that preview closes its simulated session; use serial `x` to actually stop Wi-Fi.

## Start

1. Compile/upload using `scripts/compile.sh` (it embeds the current `web/` assets).
2. Open the board's current USB serial port at 115200 baud.
3. Type `w` to start Wi-Fi setup. Read the SSID, setup password (`midisetup`) and URL printed
   on USB serial. `s` prints them again. `x` stops the server and turns Wi-Fi off.
4. On the phone, join that SSID using the printed password. Remain connected if
   the phone reports no internet. No internet access is provided by this AP.
5. In a normal browser tab, explicitly open **http://192.168.4.1/**. This is not a
   captive portal and does not require an automatic sign-in popup.
6. Choose standalone in the preview to see the main menu. Try CC editing,
   calibration simulation, brightness and confirmation dialogs on the phone.

A valid saved network configuration automatically starts setup at boot.
A saved standalone choice starts the AP; saved LAN credentials also trigger a
connection attempt, with AP recovery available if the attempt fails. No saved configuration means
Wi-Fi stays off until `w`. `x` stops setup until the next reboot or `w`.
The setup password stays `midisetup` across AP sessions. Temporary USB serial control will
later be replaced/supplemented by the local encoder/menu flow.

## Verification

USB serial logs connected-client count and every served UI asset. Visiting
`http://192.168.4.1/api/status` returns real AP client count, uptime and asset
request count; the configuration backend is explicitly `browser-only`.
A real phone test must verify page rendering and interaction, not only association.

The preview uses browser storage on the phone, independent of the Mac preview.
Selecting LAN now performs a real connection and saves network settings on the
controller. CC/calibration and the Options reset actions remain browser-only.

## Visible network list

Selecting Join my Wi-Fi starts an asynchronous controller scan and populates a
network dropdown; Refresh rescans without clearing the password. Networks below
-80 dBm are excluded by the firmware; -80 dBm is included. The cutoff is defined
as MinimumNetworkRssiDbm in HardwareConfig.h. Empty results,
scan errors and timeouts are shown in place. Hidden networks are omitted.

`POST /api/networks/scan` starts a scan (202). `GET /api/networks` returns 202
while scanning, 200 with results, or 503 on failure. Scanning temporarily enables
station capability alongside the AP; it does not join another network. Stopping
setup still disables the radio. Duplicate SSIDs are collapsed in the browser and
sorted by strongest signal. The controller's own AP is excluded.

LAN connection and credential persistence are implemented; see below. The Mac's static preview has
no scan endpoint and reports that scanning requires the controller; browser tests
explicitly intercept scan requests with test fixtures.

## Assets

`scripts/embed-web.py` generates `WebAssets.generated.h` before CLI compilation;
the generated header is ignored in Git. Run that script manually before using
Arduino IDE. Assets live in program flash, so no separate filesystem upload is
needed. The MIME type for `.mjs` is JavaScript. Nothing is fetched from a CDN.
The UI does not rely on secure-context-only `structuredClone` at a plain HTTP IP.

## Real LAN connection

Choose Join my Wi-Fi, select a scanned SSID, enter its password and choose
Connect & save. Stay connected to the AP until the result appears. The firmware
allows 20 seconds for association/DHCP and saves the network record only after
success. A failure preserves prior saved settings. The AP remains available
during the connection attempt; its channel may move when the STA joins the router, briefly
interrupting the phone. The browser tolerates that interruption while polling.

Successful connection displays the LAN IP and an mDNS link if registration
succeeded. Standalone/fallback uses midicon4.local; connected LAN uses midicon4-001.local.
The AP turns off after successful LAN connection. mDNS still needs
client testing.
You can move your phone back to the LAN and open the displayed address. There is
no promise of internet access while attached to the controller AP.

Standalone and LAN preference, credentials and hostname persist in
one versioned/checksummed NVS record under mc4-network. Credentials are never
returned by HTTP or saved in browser storage. NVS encryption is not enabled by
this change. CC/calibration storage remains separate future work. The existing
Options reset buttons still reset browser preview settings only, as labeled;
device network reset integration remains pending.

On power-on, a saved configuration starts setup automatically. An AP is
available and saved LAN credentials are tried automatically when LAN was selected.
Missing, corrupt or unsupported settings do not trigger automatic startup. Saving standalone
clears stored LAN credentials. Leaving password blank for the same saved SSID
keeps its password; for a new open network, leave the password blank.

GET /api/network exposes current state and non-secret saved settings.
POST /api/network accepts form fields mode, ssid, password
and keepPassword. Browser-supplied deviceName and hostname fields are ignored; naming is
fixed by the unit identity. It returns 202 for an in-progress attempt; poll GET for outcome.
No successful save is reported before the NVS commit succeeds.

## AP shutdown after LAN connection

A successful saved LAN connection at boot disables the setup AP immediately.
A successful connection initiated from the AP page returns its LAN address first.
The page renders reconnection instructions and acknowledges them with
POST /api/network/handoff; firmware then allows 1.5 seconds for the response
before switching to station-only mode. A 30-second maximum handoff window ensures
that a browser which closes or loses contact cannot leave the AP enabled forever.

The HTTP server remains active on the LAN. Failed LAN attempts and standalone
mode retain the AP. If a previously successful LAN connection is lost, the AP is
restored using its existing SSID and setup password. Restoring standalone from
LAN also brings the AP back before the station is disconnected.

Hardware verification must cover saved-LAN boot, success through an AP client,
wrong-password failure, loss of LAN and switching back to standalone.
