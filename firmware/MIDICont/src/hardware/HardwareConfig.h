#pragma once
#include <stdint.h>
namespace midi_cont { namespace hardware {
constexpr int Unassigned = -1;
// GPIO numbers, not XIAO D-labels. Assign only after wiring is confirmed.
constexpr int FaderPins[3] = {Unassigned, Unassigned, Unassigned};
constexpr int EncoderA = Unassigned;
constexpr int EncoderB = Unassigned;
constexpr int EncoderButton = Unassigned;
constexpr int I2cSda = Unassigned;
constexpr int I2cScl = Unassigned;
constexpr uint32_t SampleIntervalMs = 5;
constexpr uint32_t ReportIntervalMs = 100;
constexpr uint32_t HeartbeatIntervalMs = 2000;
constexpr uint8_t AdcBits = 12;
constexpr uint16_t AdcMaximum = 4095;
} }
