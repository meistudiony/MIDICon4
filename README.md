# MIDICont

Modular USB MIDI controller prototype for the Seeed Studio XIAO ESP32S3:
three faders, one encoder, four OLEDs, and optional browser configuration.

## Current scope

Phase 1 USB serial heartbeat and Phase 2 ADC diagnostics only. No MIDI USB
interface, displays, encoder decoding, persistence, or web server yet.
All pins start unassigned; booting the skeleton does not read floating inputs.

## Build and bring-up

Install Arduino CLI and the Espressif Arduino board package:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
sh scripts/compile.sh
arduino-cli board list
arduino-cli upload -p /dev/cu.YOUR_PORT --fqbn 'esp32:esp32:XIAO_ESP32S3:USBMode=default,CDCOnBoot=cdc' firmware/MIDICont
arduino-cli monitor -p /dev/cu.YOUR_PORT --config baudrate=115200
```

After the first successful build, record the installed core version here before
relying on reproducible builds. USB OTG/TinyUSB mode is intentional for eventual
MIDI support; this stage exposes CDC serial only. If upload recovery is needed,
hold BOOT while connecting USB, then release it and select the new port.

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
