import {defaults, validate, resetConfiguration} from './model.mjs';
const KEY = 'midicon4.preview.v2';
// Adapter boundary: replace with the ESP32 HTTP API when that firmware exists.
// Browser preview preferences are intentionally separate from real device NVS.
export class PreviewDevice {
  constructor(storage) { this.storage = storage; this.active = true; this.warning = ''; }
  async load() {
    let data;
    try { data = this.storage.getItem(KEY); }
    catch { throw new Error('Browser storage is unavailable. Allow storage to use this preview.'); }
    if (!data) return defaults();
    try { return validate(JSON.parse(data)); }
    catch { this.warning = 'Saved preview settings could not be read. Defaults are loaded; save to replace them.'; return defaults(); }
  }
  async save(config) {
    const candidate = structuredClone(config);
    validate(candidate);
    // A password must never enter preview storage, even if a future caller adds it.
    delete candidate.wifiPassword;
    try { this.storage.setItem(KEY, JSON.stringify(candidate)); }
    catch { throw new Error('Could not save preview settings. Previous settings were kept.'); }
    return candidate;
  }
  async reset(config, scope) { return this.save(resetConfiguration(config, scope)); }
  async finish() { this.active = false; }
}
