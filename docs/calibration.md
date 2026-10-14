# User fader calibration

Calibration is a repeatable setup operation, not a factory-only procedure.
Each fader retains its own bottom/top raw ADC endpoints, separately from MIDI
channel, CC, output range and inversion. FaderInput maps those endpoints to
0..65535 and clamps outside them; the MIDI layer then maps to the assigned range.
Bottom means physical minimum position (the panel's -inf mark), not a universal
MIDI representation of decibels.

## Planned setup flow

1. Enter setup and choose Calibrate faders (all three, or one selected fader).
2. Move the selected fader fully down, hold still, then choose Capture bottom.
3. Move it fully up, hold still, then choose Capture top.
4. Review endpoints and travel; accept/save or cancel/retry.
5. Save accepted endpoints in versioned NVS and return to normal operation.

MIDI from the fader being calibrated must be suppressed during the procedure.
Changing endpoints must reset the output change tracker before normal operation
resumes. Capture uses raw samples independent of the existing calibration/filter.
Allow a settling period after movement before starting each capture. Do not feed
top samples automatically immediately after accepting bottom: wait for the user's
explicit top capture command. The local OLED/encoder and browser should use the
same calibration session logic.

## Implemented core and future integration

FaderCalibration provides per-fader candidate capture, stable-window averaging,
minimum-span validation, explicit acceptance and cancellation. Initial limits:
64 samples at 200 Hz, maximum 64 ADC counts peak-to-peak, minimum 1024 counts
of travel. These are tuning defaults, not proven electrical specifications.
The application has no calibration commands/UI yet; NVS storage is also pending.
Existing configuration already includes per-fader Calibration endpoints.

An incomplete, reversed, noisy or too-small capture never replaces prior settings.
The eventual UI must show errors/retry guidance and bound the capture timeout.
Saving must validate and persist the entire accepted configuration before reporting
success. Cancel leaves the old calibration unchanged. Factory reset restores defaults.

Endpoint calibration compensates for supply/resistance and ADC endpoint differences.
It does not fix ADC clipping, worn/dead track sections, differing taper curves or
mechanical faults. Check raw travel before accepting calibration; matching intermediate
positions requires evaluating taper/ADC nonlinearity separately. Do not automatically
recalibrate during performance, where incomplete travel could corrupt the range.
