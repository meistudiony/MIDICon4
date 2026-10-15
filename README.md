# MIDICont

Modular USB MIDI controller prototype for the Seeed Studio XIAO ESP32S3:
three faders, one encoder, four OLEDs, and optional browser configuration.

## Current scope

Phase 1 USB serial heartbeat, Phase 2 ADC diagnostics, and an optional
serial-triggered AP/web preview. No MIDI USB interface, displays, encoder decoding,
persistent device configuration, or LAN provisioning yet.
All pins start unassigned; booting the skeleton does not read floating inputs.

## Build and bring-up

Install Arduino CLI and the Espressif Arduino board package:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.12 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
sh scripts/compile.sh
arduino-cli board list
arduino-cli upload -p /dev/cu.YOUR_PORT --fqbn 'esp32:esp32:XIAO_ESP32S3:USBMode=default,CDCOnBoot=default' firmware/MIDICont
arduino-cli monitor -p /dev/cu.YOUR_PORT --config baudrate=115200
```

Toolchain: Arduino CLI 1.5.1 and Espressif Arduino core 3.3.12.
The installation command pins the core version for consistent builds.
USB OTG/TinyUSB mode is intentional for eventual
MIDI support; this stage exposes CDC serial only. If upload recovery is needed,
hold BOOT while connecting USB, then release it and select the new port.

If building on an external drive is slow, use a local temporary build directory:

```sh
MIDICONT_BUILD_DIR=/tmp/midicont-esp32-build sh scripts/compile.sh
```

The scaffold compiles successfully with the toolchain above; upload and USB
enumeration still require a connected board.

Confirm heartbeat first. To enable a wired fader, edit `FaderPins` in
`firmware/MIDICont/src/hardware/HardwareConfig.h` to its confirmed GPIO number.
The same processing path supports all three without duplicated code.

CSV diagnostics report raw ADC, filtered ADC, 16-bit normalized value and
prospective CC value at 10 Hz per enabled fader. Sampling runs at 200 Hz with
an initial 1/8 exponential filter. MIDI quantization includes a hysteresis margin;
serial telemetry intentionally includes unchanged values to measure noise.
Calibration currently uses RAM defaults (0..4095). A user calibration session core
is available; setup UI and persistence are pending. See [calibration](docs/calibration.md).

See [hardware notes](docs/hardware.md) and [architecture/roadmap](docs/architecture.md).
GitHub remote can be added once the repository exists. No credentials belong here.

The agreed [setup and recovery flow](docs/setup.md) includes hardware/browser factory
reset and network-only reset. Shared reset logic is scaffolded; NVS and UI adapters
remain pending.

## Browser setup preview

The first responsive setup interface is in [web/](web/README.md). Run:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
```

Open http://127.0.0.1:8080. This is a browser-only simulation, with settings saved
in that browser; the XIAO serves the same preview when AP setup is started over serial. Network onboarding, the
main menu, CC editing, optional calibration, brightness and reset confirmations
are interactive. See the [firmware integration contract](docs/web-api.md).

See [phone AP bring-up](docs/ap-bringup.md): serial `w` starts setup, `s` prints
connection details, and `x` stops setup. Wi-Fi remains off by default.
