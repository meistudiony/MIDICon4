#pragma once
#include <stdint.h>
#include "../config/Configuration.h"
namespace midi_cont {
// One session per fader. UI explicitly captures bottom, then top while held still.
// All limits are initial bring-up settings, to be tuned against real measurements.
class FaderCalibration {
 public:
  enum class Stage { Idle, Bottom, Top, Ready };
  static constexpr uint16_t Samples = 64; // 320 ms at 200 Hz, after settling.
  static constexpr uint16_t MaximumNoise = 64;
  static constexpr uint16_t MinimumSpan = 1024;
  void begin() { stage_ = Stage::Bottom; resetWindow(); }
  void cancel() { stage_ = Stage::Idle; resetWindow(); }
  Stage stage() const { return stage_; }
  // Feed raw 12-bit ADC samples only during an explicit endpoint capture.
  // Returns true when an endpoint is accepted. A noisy window is retried.
  bool sample(uint16_t raw) {
    if (stage_ != Stage::Bottom && stage_ != Stage::Top) return false;
    if (raw > 4095) { resetWindow(); return false; }
    if (raw < low_) low_ = raw;
    if (raw > high_) high_ = raw;
    sum_ += raw;
    if (++count_ < Samples) return false;
    const uint16_t average = static_cast<uint16_t>((sum_ + Samples / 2) / Samples);
    const bool stable = high_ - low_ <= MaximumNoise;
    resetWindow();
    if (!stable) return false;
    if (stage_ == Stage::Bottom) {
      bottom_ = average;
      stage_ = Stage::Top;
      return true;
    }
    // Reversed endpoints require corrected wiring, not a silently flipped axis.
    if (average <= bottom_ || average - bottom_ < MinimumSpan) return false;
    candidate_.minimum = bottom_;
    candidate_.maximum = average;
    stage_ = Stage::Ready;
    return true;
  }
  // Explicit acceptance only; rejected/incomplete captures preserve old settings.
  bool apply(Calibration& destination) {
    if (stage_ != Stage::Ready) return false;
    destination = candidate_;
    cancel();
    return true;
  }
 private:
  void resetWindow() { sum_ = 0; count_ = 0; low_ = 4095; high_ = 0; }
  Stage stage_ = Stage::Idle;
  uint32_t sum_ = 0;
  uint16_t count_ = 0, low_ = 4095, high_ = 0, bottom_ = 0;
  Calibration candidate_;
};
}
