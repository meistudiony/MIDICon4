#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include "../hardware/HardwareConfig.h"
#include "../controls/FaderInput.h"
#include "../midi/MidiManager.h"
#include "../network/NetworkManager.h"
namespace midi_cont {
class Application {
 public:
  void begin() {
    Serial.begin(115200);
    network_.begin();
    analogReadResolution(hardware::AdcBits);
    for (int pin : hardware::FaderPins) {
      if (pin != hardware::Unassigned) {
        pinMode(pin, INPUT);
        analogSetPinAttenuation(pin, ADC_11db);
      }
    }
  }
  void tick() {
    // Serial commands stand in for the encoder until it is wired.
    for (unsigned i = 0; i < 16 && Serial.available(); ++i) {
      const char command = Serial.read();
      if (command == 'w') network_.startSetup();
      else if (command == 'x') network_.stopSetup();
      else if (command == 's') network_.printStatus();
    }
    network_.tick();
    const uint32_t now = millis();
    if (!announced_ && Serial) {
      Serial.println(
        "MIDICont bring-up: saved network settings auto-start setup; "
        "unassigned inputs skipped."
      );
      network_.printStatus();
      Serial.println("Commands: w=start AP setup, x=stop setup, s=network status");
      Serial.println("fader,raw,filtered,normalized,cc_value");
      announced_ = true;
    }
    if (now - heartbeat_ >= hardware::HeartbeatIntervalMs) {
      heartbeat_ = now;
      Serial.printf("# alive uptime_ms=%lu\n", static_cast<unsigned long>(now));
    }
    if (now - sampled_ < hardware::SampleIntervalMs) return;
    sampled_ = now;
    for (unsigned i = 0; i < 3; ++i) {
      if (hardware::FaderPins[i] == hardware::Unassigned) continue;
      faders_[i].update(analogRead(hardware::FaderPins[i]), config_.calibration[i]);
      values_[i].update(faders_[i].normalized(), config_.faders[i]);
      if (now - reported_[i] >= hardware::ReportIntervalMs) {
        reported_[i] = now;
        // Always report raw data to support idle-noise and endpoint measurements.
        Serial.printf("%u,%u,%.2f,%u,%u\n", i + 1, faders_[i].raw(),
                      faders_[i].filtered(), faders_[i].normalized(), values_[i].value());
      }
    }
  }
 private:
  NetworkManager network_;
  Configuration config_ = factoryDefaults();
  FaderInput faders_[3];
  MidiValueTracker values_[3];
  uint32_t reported_[3] = {};
  uint32_t sampled_ = 0, heartbeat_ = 0;
  bool announced_ = false;
};
}
