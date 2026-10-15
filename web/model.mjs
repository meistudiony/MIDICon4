export const CONTROL_NAMES = Object.freeze([
  'Fader 1',
  'Fader 2',
  'Fader 3',
  'Encoder'
]);

// Keep legacy saved assignments, replacing only their old editable names.
export function applyFixedControlNames(config) {
  if (Array.isArray(config.faders)) {
    config.faders.forEach((fader, index) => {
      if (fader && index < 3) {
        fader.label = CONTROL_NAMES[index];
      }
    });
  }
  if (config.encoder) {
    config.encoder.label = CONTROL_NAMES[3];
  }
  return config;
}

export const copyConfiguration = value => JSON.parse(JSON.stringify(value));
export const SCHEMA_VERSION = 2;
export function defaults() {
  return {
    version: SCHEMA_VERSION, deviceName: 'MIDICon4-001', hostname: 'midicon4',
    networkMode: 'standalone', networkSetupComplete: false, wifiSsid: '',
    screenBrightness: 128,
    faders: [0, 1, 2].map(i => ({label: CONTROL_NAMES[i], channel: 1, cc: 21 + i, minimum: 0, maximum: 127, inverted: false})),
    encoder: {label: CONTROL_NAMES[3], channel: 1, cc: 24, minimum: 0, maximum: 127, mode: 'absolute', acceleration: false},
    calibration: [0, 1, 2].map(() => ({minimum: 0, maximum: 4095, calibrated: false}))
  };
}
const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
export function validate(config) {
  if (!config || config.version !== SCHEMA_VERSION) throw new Error('Unsupported configuration version.');
  if (typeof config.deviceName !== 'string' || !config.deviceName.trim() || config.deviceName.length > 32) throw new Error('Use a device name of 1–32 characters.');
  if (typeof config.hostname !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(config.hostname)) throw new Error('Use a hostname of 1–32 lowercase letters, numbers or internal hyphens.');
  if (!['standalone', 'lan'].includes(config.networkMode) || typeof config.networkSetupComplete !== 'boolean') throw new Error('Choose a network mode.');
  if (typeof config.wifiSsid !== 'string' || new TextEncoder().encode(config.wifiSsid).length > 32 || (config.networkMode === 'lan' && !config.wifiSsid.trim())) throw new Error('Enter a Wi-Fi name of 1–32 bytes.');
  if (!integer(config.screenBrightness, 0, 255)) throw new Error('Brightness must be between 0 and 255.');
  if (!Array.isArray(config.faders) || config.faders.length !== 3 || !config.encoder) throw new Error('Expected three faders and one encoder.');
  for (const control of [...config.faders, config.encoder]) {
    if (typeof control.label !== 'string' || !control.label.trim() || control.label.length > 16) throw new Error('Each control needs a label of 1–16 characters.');
    if (!integer(control.channel, 1, 16) || !integer(control.cc, 0, 127)) throw new Error('Channels must be 1–16 and CC numbers 0–127.');
    if (!integer(control.minimum, 0, 127) || !integer(control.maximum, 0, 127) || control.minimum > control.maximum) throw new Error('Output ranges must be 0–127, with minimum no greater than maximum.');
  }
  if (config.faders.some(fader => typeof fader.inverted !== 'boolean')) throw new Error('Invalid fader direction.');
  if (config.encoder.mode !== 'absolute' || config.encoder.acceleration !== false) throw new Error('Only bounded absolute encoder mode is available in this version.');
  if (!Array.isArray(config.calibration) || config.calibration.length !== 3) throw new Error('Expected three fader calibrations.');
  for (const endpoint of config.calibration) {
    if (!integer(endpoint.minimum, 0, 4095) || !integer(endpoint.maximum, 0, 4095) || endpoint.maximum - endpoint.minimum < 1024 || typeof endpoint.calibrated !== 'boolean') throw new Error('Calibration needs at least 1024 ADC counts of valid travel.');
  }
  return config;
}
export function resetConfiguration(current, scope) {
  if (scope === 'factory') return defaults();
  if (scope !== 'network') throw new Error('Unknown reset type.');
  return {...copyConfiguration(current), networkMode: 'standalone', networkSetupComplete: false, wifiSsid: ''};
}
