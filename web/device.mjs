import {
  defaults,
  validate,
  resetConfiguration,
  copyConfiguration,
  applyFixedControlNames
} from './model.mjs';
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
    try {
      const config = JSON.parse(data);
      config.deviceName = defaults().deviceName;
      return validate(applyFixedControlNames(config));
    }
    catch { this.warning = 'Saved preview settings could not be read. Defaults are loaded; save to replace them.'; return defaults(); }
  }
  async save(config) {
    const candidate = applyFixedControlNames(copyConfiguration(config));
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

// Actual radio scan, even while configuration persistence remains preview-only.
export async function scanNearbyNetworks(fetcher = globalThis.fetch, {timeoutMs = 15000, pollMs = 350} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const request = async (url, method = 'GET') => {
    const response = await fetcher(url, {method, signal:controller.signal, cache:'no-store'});
    if ([404, 405, 501].includes(response.status)) throw new Error('Scanning is available on the controller. Open its setup page, then try Refresh.');
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The controller returned an invalid scan response. Try Refresh.'); }
    if (!response.ok) throw new Error(data.error || 'Network scan failed. Try Refresh.');
    return data;
  };
  try {
    await request('/api/networks/scan', 'POST');
    while (!controller.signal.aborted) {
      const data = await request('/api/networks');
      if (data.state === 'complete') {
        if (!Array.isArray(data.networks)) throw new Error('Invalid network list. Try Refresh.');
        // One entry per visible SSID, retaining its strongest signal.
        const unique = new Map();
        for (const network of data.networks) {
          if (typeof network.ssid !== 'string' || !network.ssid || !Number.isFinite(network.rssi) || typeof network.secure !== 'boolean') continue;
          if (!unique.has(network.ssid) || network.rssi > unique.get(network.ssid).rssi) unique.set(network.ssid, network);
        }
        return [...unique.values()].sort((a,b) => b.rssi - a.rssi);
      }
      if (data.state !== 'scanning') throw new Error('Invalid scan status. Try Refresh.');
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    throw new Error('Network scan timed out. Try Refresh.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Network scan timed out. Try Refresh.');
    throw error;
  } finally { clearTimeout(timeout); }
}

const applyNetwork = (config, settings) => {
  for (const field of ['networkMode','networkSetupComplete','wifiSsid','hostname','deviceName']) config[field] = settings[field];
  return config;
};
export async function networkRequest(fetcher, options = {}, path = '/api/network') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetcher(path, {...options, cache:'no-store', signal:controller.signal});
    if (options.method !== 'POST' && [404,405,501].includes(response.status)) return null;
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid network response from the controller.'); }
    if (!response.ok) throw new Error(data.error || 'Network request failed.');
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Controller did not respond. Reconnect to its setup Wi-Fi and retry.');
    throw error;
  } finally { clearTimeout(timeout); }
}
// Only networking is device-backed; other pages retain the explicit preview adapter.
export class SetupDevice extends PreviewDevice {
  constructor(storage, fetcher = globalThis.fetch) {
    super(storage); this.fetcher = fetcher; this.networkLive = false; this.networkStatus = null;
  }
  async load() {
    const config = await super.load();
    const status = await networkRequest(this.fetcher);
    if (status) { this.networkLive = true; this.networkStatus = status; applyNetwork(config,status.settings); }
    return config;
  }
  async finishNetworkHandoff() {
    await networkRequest(
      this.fetcher,
      {method: 'POST'},
      '/api/network/handoff'
    );
  }

  async refreshNetwork() {
    const status = await networkRequest(this.fetcher);
    if (status) this.networkStatus = status;
    return status;
  }
  async saveNetwork(config, password, onStatus = () => {}, {pollMs = 600, timeoutMs = 35000} = {}) {
    if (!this.networkLive) throw new Error('Open the setup page on the controller to connect. Localhost cannot change its Wi-Fi.');
    const settings = this.networkStatus.settings;
    const body = new URLSearchParams({mode:config.networkMode,ssid:config.wifiSsid,password,
      keepPassword:String(!password && settings.hasPassword && settings.wifiSsid === config.wifiSsid)});
    let status = await networkRequest(this.fetcher,{method:'POST',body});
    const started = Date.now();
    while (true) {
      this.networkStatus = status; onStatus(status);
      if (status.state === 'failed') throw new Error(status.error || 'Connection failed.');
      if (status.state === 'connected' || status.state === 'standalone')
        return applyNetwork(copyConfiguration(config),status.settings);
      if (Date.now() - started >= timeoutMs) throw new Error('Lost contact while connecting. Stay on the controller Wi-Fi, reload this page and check network status.');
      await new Promise(resolve => setTimeout(resolve,pollMs));
      try { status = await networkRequest(this.fetcher); }
      catch { // AP channel can change when the station joins the router. Allow reconnection.
        if (Date.now() - started >= timeoutMs) throw new Error('Connection status unavailable. Reconnect to the controller Wi-Fi and reload.');
      }
    }
  }
}
