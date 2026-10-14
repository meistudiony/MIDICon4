#pragma once
#include <stdint.h>
#include "../config/Configuration.h"
namespace midi_cont {
// Pure processing: independent of ADC hardware and MIDI transport.
class FaderInput {
 public:
  void update(uint16_t raw, const Calibration& calibration) {
    raw_ = raw;
    if (!initialized_) { filtered_ = raw; initialized_ = true; }
    else filtered_ += (static_cast<float>(raw) - filtered_) * 0.125f;
    const float span = static_cast<float>(calibration.maximum) - calibration.minimum;
    float value = span > 0 ? (filtered_ - calibration.minimum) / span : 0;
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    normalized_ = static_cast<uint16_t>(value * 65535.0f + 0.5f);
  }
  uint16_t raw() const { return raw_; }
  float filtered() const { return filtered_; }
  uint16_t normalized() const { return normalized_; }
 private:
  bool initialized_ = false;
  uint16_t raw_ = 0;
  float filtered_ = 0;
  uint16_t normalized_ = 0;
};
}
