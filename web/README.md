# MIDICon4 setup interface

A buildless, responsive interface intended to be served by the ESP32. The networking adapter uses real firmware APIs; other configuration pages remain
a clearly labeled browser preview: no firmware upload, radio change from the UI,
MIDI output or NVS write happens from these pages. Everything runs locally;
there are no CDN, external font, analytics or internet dependencies.

## Preview

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
```

Open http://127.0.0.1:8080 in a browser. This binds to your own computer only.
For hosting this same preview on the XIAO, see [AP bring-up](../docs/ap-bringup.md). Stop with Ctrl-C.

On first visit, choose standalone or simulate joining Wi-Fi, then go directly to
the main menu. Calibration is optional. Settings are saved in this browser's local
storage under `midicon4.preview.v2`; reload to check persistence. Private browsing
or clearing site data may remove them. On the controller, Connect & save attempts LAN connection and saves successful
network settings in NVS. Localhost refuses network changes. Connection preference/status comes from the controller. Network discovery uses the real scan API
when served by the controller: select a visible SSID from the dropdown and use
Refresh to rescan. The static localhost preview reports that scans need the device.

Main menu: Network Setup, Calibration, CC Configuration, Options, Finish Setup.
CC edits are saved together for all four controls. Per-page Save/Cancel and dirty
navigation confirmation protect unsaved changes. Brightness affects a simulated
OLED until saved. Calibration uses an explicit simulated raw-ADC slider and saves
only accepted endpoints. Factory and network-only reset require confirmation.
Finish Setup closes the simulated session and offers a way to reopen it.

## Structure

- `index.html`, `style.css`: shell, responsive layouts and accessible native inputs.
- `app.mjs`: navigation, per-page drafts, forms, calibration UI and confirmation.
- `model.mjs`: view-model defaults, validation and reset transformations.
- `device.mjs`: device-backed networking and browser-only persistence for other pages.

The JS object is a browser view model, not serialized C++ struct memory or a
finalized wire protocol. Its schema version mirrors the current configuration
concepts. `calibrated` is preview metadata; firmware storage needs a decision on
recording calibration completion. Backend validation remains required.

## Checks

```sh
node --test tests/web/model.test.mjs
node --check web/app.mjs
```

Browser flow checks use optional `playwright-core` with an installed Chrome; no
browser download is needed. For an isolated installation outside this project:

```sh
npm install --prefix /tmp/midicont-browser-qa playwright-core
MIDICONT_PLAYWRIGHT_MODULE=/tmp/midicont-browser-qa/node_modules/playwright-core node tests/web/browser.cjs
```

Start the preview server first. `MIDICONT_BROWSER_PATH` can override the default
macOS Chrome executable; `MIDICONT_PREVIEW_URL` overrides the server address.
The browser test uses its own isolated profile and never clears your normal
browser data. Screenshots are written under `/tmp/midicont-*.png`.
