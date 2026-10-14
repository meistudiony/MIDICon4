#pragma once
#include <stdint.h>
namespace midi_cont {
struct ControlConfig {
  char label[17];
  uint8_t channel = 1; // User-facing channels 1..16.
  uint8_t cc = 21;
  uint8_t minimum = 0;
  uint8_t maximum = 127;
  bool inverted = false;
};
struct Calibration { uint16_t minimum = 0; uint16_t maximum = 4095; };
enum class EncoderMode : uint8_t { Absolute, Relative, Wrap };
struct EncoderConfig {
  ControlConfig control{"ENCODER", 1, 24, 0, 127, false};
  EncoderMode mode = EncoderMode::Absolute;
  bool acceleration = false;
};
struct Configuration {
  uint16_t version = 1;
  ControlConfig faders[3] = {
    {"FADER 1", 1, 21, 0, 127, false},
    {"FADER 2", 1, 22, 0, 127, false},
    {"FADER 3", 1, 23, 0, 127, false}};
  Calibration calibration[3];
  EncoderConfig encoder;
  char deviceName[33] = "MIDI Controller";
  char hostname[33] = "midi-control";
  char wifiSsid[33] = "";
  char wifiPassword[65] = "";
};
// RAM defaults only. Versioned NVS serialization belongs in ConfigManager later.
inline Configuration factoryDefaults() { return Configuration{}; }
}
