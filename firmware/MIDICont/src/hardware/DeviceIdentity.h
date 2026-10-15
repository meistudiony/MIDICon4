#pragma once

// Assigned when building firmware for a unit, never from user settings.
#ifndef MIDICONT_UNIT_SERIAL
#define MIDICONT_UNIT_SERIAL "001"
#endif

namespace midi_cont {
namespace identity {

constexpr char SerialNumber[] = MIDICONT_UNIT_SERIAL;
constexpr char DeviceName[] = "MIDICon4-" MIDICONT_UNIT_SERIAL;
constexpr char StandaloneHostname[] = "midicon4";
constexpr char LanHostname[] = "midicon4-" MIDICONT_UNIT_SERIAL;

}  // namespace identity
}  // namespace midi_cont
