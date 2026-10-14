#include <cassert>
#include "../firmware/MIDICont/src/controls/FaderCalibration.h"
#include "../firmware/MIDICont/src/controls/FaderInput.h"
using namespace midi_cont;
bool capture(FaderCalibration& session, uint16_t raw) {
  bool accepted = false;
  for (unsigned i = 0; i < FaderCalibration::Samples; ++i)
    accepted = session.sample(raw);
  return accepted;
}
int main() {
  Calibration stored{100, 3800};
  FaderCalibration session;
  assert(!session.apply(stored));
  session.begin();
  assert(capture(session, 150));
  assert(!capture(session, 140)); // Reversed.
  assert(!capture(session, 500)); // Insufficient span.
  assert(stored.minimum == 100 && stored.maximum == 3800);
  for (unsigned i = 0; i < FaderCalibration::Samples; ++i)
    assert(!session.sample(i % 2 ? 3500 : 3700)); // Unstable.
  assert(capture(session, 3700));
  session.cancel();
  assert(!session.apply(stored));
  assert(stored.minimum == 100 && stored.maximum == 3800);
  session.begin();
  assert(capture(session, 150));
  assert(capture(session, 3700));
  assert(session.apply(stored));
  assert(stored.minimum == 150 && stored.maximum == 3700);
  FaderInput bottom, top, middle, below, above;
  bottom.update(150, stored); assert(bottom.normalized() == 0);
  top.update(3700, stored); assert(top.normalized() == 65535);
  middle.update(1925, stored); assert(middle.normalized() == 32768);
  below.update(0, stored); assert(below.normalized() == 0);
  above.update(4095, stored); assert(above.normalized() == 65535);
}
