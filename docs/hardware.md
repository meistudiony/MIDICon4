# Hardware decisions (tentative, not configured)

For the standard XIAO ESP32S3, not the C3 or a Plus/Sense peripheral configuration:

| Signal | Proposed XIAO label | GPIO |
| --- | --- | --- |
| Fader 1 | D0/A0 | 1 |
| Fader 2 | D1/A1 | 2 |
| Fader 3 | D3/A3 | 4 |
| Mux SDA | D4 | 5 |
| Mux SCL | D5 | 6 |
| Encoder A | D8 | 7 |
| Encoder B | D9 | 8 |
| Encoder push | D10 | 9 |

These are proposals only. HardwareConfig deliberately uses unassigned values.
All proposed faders use ADC1. Avoid D2/GPIO3 because it is a strapping pin;
GPIO0/45/46 also have boot restrictions. Reserve GPIO19/20 for native USB.
D6/GPIO43 and D7/GPIO44 remain available for UART diagnostics/future work.

Sources: [Seeed pinout](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/),
[Espressif GPIO restrictions](https://docs.espressif.com/projects/esp-idf/en/v5.1/esp32s3/api-reference/peripherals/gpio.html).

## Open assumptions

- ADC: keep the specified wiper -> 1k -> ADC and 0.1uF to ground. At maximum
  attenuation the documented S3 measurable range reaches about 3.1V, below
  the fader's 3.3V supply. Measure endpoint clipping and useful travel before
  deciding whether scaling is needed. Endpoint calibration cannot recover
  motion already clipped by the ADC.
  [ADC reference](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html).
- Encoder: inspect the actual KY-040 board and level shifter, including pullups
  on A/B/button. Confirm direction and transitions per detent experimentally.
  No GPIO signal or I2C pullup may exceed 3.3V.
- Displays: confirm actual SSD1306 compatibility, address, mux address straps,
  reset behavior and pullup voltages before enabling I2C. Mux selection must
  enable one OLED channel at a time. Rotation is software 90 degrees (logical
  32x128); choose clockwise/counterclockwise after physical mounting.
- USB: native USB MIDI and CDC must share the OTG/TinyUSB stack. Core support
  and host enumeration must be checked when implementing the MIDI transport.
- Storage: Preferences/NVS is persistence, not by itself a guarantee that
  credentials are encrypted. Production encryption/provisioning remains a decision.
