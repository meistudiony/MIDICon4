import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults, validate, resetConfiguration} from '../../web/model.mjs';
import {PreviewDevice} from '../../web/device.mjs';
function memory() { return {data:null, getItem(){return this.data;}, setItem(key, value){this.data = value;}}; }
test('defaults validate and onboarding contains only network state', () => {
  const config = defaults(); assert.equal(validate(config), config);
  assert.equal(config.networkSetupComplete, false);
  assert.equal(config.networkMode, 'standalone');
  assert.equal(config.calibration.every(c => !c.calibrated), true);
});
test('network reset preserves independent settings, factory reset restores defaults', () => {
  const current = defaults();
  current.networkSetupComplete = true; current.networkMode = 'lan'; current.wifiSsid = 'Studio';
  current.faders[0].cc = 100; current.calibration[0] = {minimum:100,maximum:3700,calibrated:true}; current.screenBrightness = 200;
  const reset = resetConfiguration(current, 'network');
  assert.equal(reset.wifiSsid, ''); assert.equal(reset.networkSetupComplete, false);
  assert.deepEqual(reset.faders, current.faders); assert.deepEqual(reset.calibration, current.calibration);
  assert.equal(reset.screenBrightness, 200); assert.equal(current.networkMode, 'lan');
  assert.deepEqual(resetConfiguration(current, 'factory'), defaults());
});
test('invalid assignment and calibration values cannot be saved', () => {
  for (const mutate of [c => c.faders[0].channel = 17,c => c.faders[0].cc = -1,c => c.faders[1].minimum = 128,c => c.calibration[0].maximum = 100,c => c.faders[2].inverted = 'yes',c => c.encoder.mode = 'relative',c => c.screenBrightness = 256,c => c.hostname = '-invalid',c => c.networkMode = 'unknown']) {
    const c = defaults(); mutate(c); assert.throws(() => validate(c));
  }
});
test('save survives adapter recreation and never saves a supplied password', async () => {
  const storage = memory(), device = new PreviewDevice(storage);
  const config = defaults(); config.networkSetupComplete = true; config.wifiPassword = 'never-store-me';
  await device.save(config);
  assert.equal(storage.data.includes('never-store-me'), false);
  assert.equal((await new PreviewDevice(storage).load()).networkSetupComplete, true);
});
test('failed save leaves previous stored values intact', async () => {
  const storage = memory(), device = new PreviewDevice(storage);
  await device.save(defaults()); const previous = storage.data;
  storage.setItem = () => {throw new Error('quota');};
  const changed = defaults(); changed.faders[0].cc = 99;
  await assert.rejects(device.save(changed), /Could not save/);
  assert.equal(storage.data, previous);
});
test('invalid saved schema loads defaults with explicit warning', async () => {
  const storage = memory(); storage.data = '{"version":999}';
  const device = new PreviewDevice(storage);
  assert.deepEqual(await device.load(), defaults()); assert.match(device.warning, /could not be read/);
});

test('legacy names become fixed without losing fader or encoder assignments', async () => {
  const storage = memory();
  const config = defaults();
  config.faders[0].label = 'VOCAL';
  config.faders[0].cc = 70;
  config.calibration[0] = {
    minimum: 100,
    maximum: 3700,
    calibrated: true
  };
  config.encoder.label = 'CUSTOM';
  config.encoder.cc = 25;
  storage.data = JSON.stringify(config);

  const loaded = await new PreviewDevice(storage).load();

  assert.deepEqual(
    [...loaded.faders, loaded.encoder].map(control => control.label),
    ['Fader 1', 'Fader 2', 'Fader 3', 'Encoder']
  );
  assert.equal(loaded.faders[0].cc, 70);
  assert.equal(loaded.encoder.cc, 25);
  assert.deepEqual(loaded.calibration[0], config.calibration[0]);
});
