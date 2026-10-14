#pragma once
#include <stdint.h>
#include "../config/Configuration.h"
namespace midi_cont {
// Quantization at the output boundary; USB transport will be added in Phase 7.
inline uint8_t midiValue(uint16_t normalized, const ControlConfig& config) {
  const uint32_t value = config.inverted ? 65535u - normalized : normalized;
  const int32_t span = static_cast<int32_t>(config.maximum) - config.minimum;
  return static_cast<uint8_t>(config.minimum +
      (static_cast<int32_t>(value) * span + (span >= 0 ? 32767 : -32767)) / 65535);
}
// Schmitt margin avoids alternating CCs at a quantization boundary.
class MidiValueTracker {
 public:
  bool update(uint16_t normalized, const ControlConfig& config) {
    const uint8_t candidate = midiValue(normalized, config);
    if (last_ < 0) { last_ = candidate; return true; }
    if (candidate == last_) return false;
    const float value = config.inverted ? 65535u - normalized : normalized;
    const float continuous = config.minimum + value *
        (static_cast<int>(config.maximum) - config.minimum) / 65535.0f;
    if (candidate != config.minimum && candidate != config.maximum &&
        continuous > last_ - 0.75f && continuous < last_ + 0.75f) return false;
    last_ = candidate;
    return true;
  }
  uint8_t value() const { return static_cast<uint8_t>(last_); }
 private:
  int last_ = -1;
};
}
