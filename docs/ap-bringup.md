# Phone access-point test

The firmware can now host the same browser preview directly on the XIAO. This
checks the AP radio, phone connection and offline asset loading. It does not yet
implement LAN provisioning, device-side configuration storage or calibration API.
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

Wi-Fi stays off after boot until `w` is received. Reboot or `x` stops the AP.
The setup password stays `midisetup` across AP sessions. Temporary USB serial control will
later be replaced/supplemented by the local encoder/menu flow.

## Verification

USB serial logs connected-client count and every served UI asset. Visiting
`http://192.168.4.1/api/status` returns real AP client count, uptime and asset
request count; the configuration backend is explicitly `browser-only`.
A real phone test must verify page rendering and interaction, not only association.

The preview uses browser storage on the phone, independent of the Mac preview.
Use standalone for this AP test. Selecting LAN only simulates the preference and
does not change the radio connection. Hardware reset actions/NVS remain pending.

## Assets

`scripts/embed-web.py` generates `WebAssets.generated.h` before CLI compilation;
the generated header is ignored in Git. Run that script manually before using
Arduino IDE. Assets live in program flash, so no separate filesystem upload is
needed. The MIME type for `.mjs` is JavaScript. Nothing is fetched from a CDN.
The UI does not rely on secure-context-only `structuredClone` at a plain HTTP IP.
