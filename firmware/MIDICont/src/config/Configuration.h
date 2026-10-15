#pragma once
#include <stdint.h>
namespace midi_cont {
struct ControlConfig {
  char label[17]; // Fixed control name; not exposed as a user setting.
  uint8_t channel = 1; // User-facing channels 1..16.
  uint8_t cc = 21;
  uint8_t minimum = 0;
  uint8_t maximum = 127;
  bool inverted = false;
};
struct Calibration { uint16_t minimum = 0; uint16_t maximum = 4095; };
enum class EncoderMode : uint8_t { Absolute, Relative, Wrap };
struct EncoderConfig {
  ControlConfig control{"Encoder", 1, 24, 0, 127, false};
  EncoderMode mode = EncoderMode::Absolute;
  bool acceleration = false;
};
enum class NetworkMode : uint8_t { Standalone, Lan };
struct Configuration {
  uint16_t version = 2;
  ControlConfig faders[3] = {
    {"Fader 1", 1, 21, 0, 127, false},
    {"Fader 2", 1, 22, 0, 127, false},
    {"Fader 3", 1, 23, 0, 127, false}};
  Calibration calibration[3];
  EncoderConfig encoder;
  // Device name/serial belong to hardware/DeviceIdentity.h, not user settings.
  char hostname[33] = "midi-control";
  NetworkMode networkMode = NetworkMode::Standalone;
  bool networkSetupComplete = false;
  uint8_t screenBrightness = 128; // Driver contrast 0..255; UI scale comes later.
  char wifiSsid[33] = "";
  char wifiPassword[65] = "";
};
// RAM defaults only. Versioned NVS serialization belongs in ConfigManager later.
inline Configuration factoryDefaults() { return Configuration{}; }
}
