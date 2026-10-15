import {SetupDevice, scanNearbyNetworks} from './device.mjs';
import {copyConfiguration, CONTROL_NAMES} from './model.mjs';
const app = document.querySelector('#app');
const device = new SetupDevice({getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value)});
const clone = copyConfiguration;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let config, draft, page = 'network', networkMode = 'standalone', selectedControl = 0;
let selectedFader = 0, calibration = null, finished = false, busy = false, toastTimer;
let networkHandoff = null;
let networkScan = {state:'idle', networks:[], error:''};
const dialog = document.querySelector('#confirm-dialog');
function confirmAction(title, description, label = 'Continue', destructive = false) {
  return new Promise(resolve => {
    document.querySelector('#dialog-title').textContent = title;
    document.querySelector('#dialog-description').textContent = description;
    const button = document.querySelector('#confirm-button');
    button.textContent = label;
    button.className = destructive ? 'primary danger' : 'primary';
    dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {once:true});
    dialog.showModal();
  });
}
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message; element.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 4200);
}
function dirty() {
  if (!draft || !config) return false;
  return JSON.stringify(draft) !== JSON.stringify(config) || Boolean(calibration) || Boolean(document.querySelector('[name=password]')?.value);
}
async function navigate(next) {
  if (busy) return;
  if (dirty() && !await confirmAction('Discard unsaved changes?', 'Your previously saved settings will stay in place.', 'Discard changes')) return;
  calibration = null; draft = clone(config); networkMode = draft.networkMode;
  page = next; render();
}
function heading(kicker, title, description, back = true) {
  return `
    ${back && config.networkSetupComplete ? `
      <button class="back quiet" data-route="home">
        ← Main menu
      </button>
    ` : ''}

    <div class="page-heading">
      <div>
        ${kicker ? `<div class="eyebrow">${kicker}</div>` : ''}
        <h1 tabindex="-1">${title}</h1>
        ${description ? `<p class="intro">${description}</p>` : ''}
      </div>
    </div>
  `;
}

function formActions(label = 'Save changes') {
  const saveLocation = page === 'network' && device.networkLive
    ? 'Network settings saved on the controller'
    : 'Saved in this browser · preview only';

  return `
    <div class="actions">
      <span class="saved-note">${saveLocation}</span>
      <button type="button" data-action="cancel">Cancel</button>
      <button class="primary" type="submit">${label}</button>
    </div>
  `;
}

function networkConnectionStatus() {
  if (!device.networkLive) {
    return '';
  }

  const status = device.networkStatus;
  if (status.state === 'connected') {
    const hostname = status.activeHostname || config.hostname;
    return `
      <p class="help">
        Connected to ${esc(config.wifiSsid)}.
        Address:
        <a href="http://${esc(status.ip)}/">${esc(status.ip)}</a>
        ${status.mdns ? `
          · <a href="http://${esc(hostname)}.local/">
            ${esc(hostname)}.local
          </a>
        ` : ''}
      </p>
    `;
  }

  const message = status.state === 'failed'
    ? status.error
    : status.state === 'connecting'
      ? 'Connecting to saved Wi-Fi… Direct setup access remains available.'
      : 'Standalone setup access is available.';

  return `<p class="help">${esc(message)}</p>`;
}

function networkPage() {
  if (networkHandoff) {
    const hostname = networkHandoff.activeHostname || config.hostname;
    return `
      ${heading('NETWORK SETUP', 'Connected to Wi-Fi', '', false)}
      <section class="panel">
        <p>
          Reconnect your phone or computer to ${esc(config.wifiSsid)}.
          The controller’s setup Wi-Fi will turn off.
        </p>
        <p>
          Open <a href="http://${esc(networkHandoff.ip)}/">
            http://${esc(networkHandoff.ip)}/
          </a>
          ${networkHandoff.mdns ? `
            or <a href="http://${esc(hostname)}.local/">
              http://${esc(hostname)}.local/
            </a>
          ` : ''}
          to continue setup.
        </p>
      </section>
    `;
  }

  const initial = !config.networkSetupComplete;
  const usingWifi = networkMode === 'lan';
  const passwordPlaceholder = device.networkStatus?.settings.hasPassword
    ? 'Leave blank to keep saved password'
    : 'Wi-Fi password (blank for open networks)';

  return `
    ${heading(
      initial ? 'WELCOME' : 'NETWORK SETUP',
      'How would you like to connect?',
      '',
      !initial
    )}

    <form id="network-form">
      <div
        class="network-choices"
        role="group"
        aria-label="Connection mode"
      >
        <button
          type="button"
          class="choice ${!usingWifi ? 'selected' : ''}"
          data-network="standalone"
          aria-pressed="${!usingWifi}"
        >
          <span class="check" aria-hidden="true">
            ${!usingWifi ? '✓' : ''}
          </span>
          <span class="icon" aria-hidden="true">⌁</span>
          <h2>Standalone</h2>
          <p>
            Connect straight to the controller’s own Wi-Fi.
            No router or internet needed.
          </p>
        </button>

        <button
          type="button"
          class="choice ${usingWifi ? 'selected' : ''}"
          data-network="lan"
          aria-pressed="${usingWifi}"
        >
          <span class="check" aria-hidden="true">
            ${usingWifi ? '✓' : ''}
          </span>
          <span class="icon" aria-hidden="true">↗</span>
          <h2>Wi-Fi</h2>
          <p>
            Keep your phone or computer on your usual network
            while you configure.
          </p>
        </button>
      </div>

      <section class="panel" aria-label="Network details">
        ${networkConnectionStatus()}

        ${usingWifi ? `
          <h3>Connect to your Wi-Fi network</h3>
          <p>
            Use a 2.4 GHz network. Direct setup access stays available
            if the connection fails.
          </p>

          <div class="fields">
            <div>
              <label for="network-list">Wi-Fi network</label>
              <select
                id="network-list"
                name="ssid"
                required
                aria-describedby="scan-status"
              >
                <option value="">Select a network</option>
              </select>
              <button
                type="button"
                data-action="refresh-networks"
                class="network-refresh"
              >
                Refresh
              </button>
              <p
                id="scan-status"
                role="status"
                aria-live="polite"
                class="help network-scan-status"
              ></p>
            </div>

            <label>
              Wi-Fi password
              <input
                name="password"
                type="password"
                maxlength="63"
                placeholder="${passwordPlaceholder}"
                autocomplete="new-password"
              >
            </label>
          </div>

          <p class="note">
            ${device.networkLive
              ? 'Stay on the setup Wi-Fi until the connection result appears.'
              : 'Open this page on the controller to connect.'}
          </p>
        ` : `
          <h3>Standalone connection</h3>
          <p>
            Connect directly to the controller whenever you need
            to change its settings.
          </p>
        `}

        <div id="form-error" role="alert"></div>
        <p
          id="connection-status"
          role="status"
          aria-live="polite"
          class="help"
        ></p>

        ${formActions(usingWifi ? 'Connect & save' : 'Save standalone')}
      </section>
    </form>
  `;
}
function homePage() {
  const cards = [
    ['network', '01', 'Network Setup', 'Direct connection or studio Wi-Fi.'],
    ['calibration', '02', 'Calibration', 'Match each fader’s physical endpoints.'],
    ['controls', '03', 'CC Configuration', 'Set the assignment behind every movement.'],
    ['options', '04', 'Options', 'Screen brightness and recovery settings.']
  ];
  const menuName = config.deviceName.replace(/^MIDICon4-/, 'MIDICon-');

  return `
    ${heading('', `Configure ${esc(menuName)}`, '', false)}

    <div class="menu-grid">
      ${cards.map(([route, number, title, description]) => `
        <button class="menu-card" data-route="${route}">
          <span class="card-top">
            <span>${number} / SETUP</span>
            <span aria-hidden="true">↗</span>
          </span>
          <h2>${title}</h2>
          <p>${description}</p>
        </button>
      `).join('')}
    </div>

    <div class="menu-bottom">
      <p>Settings are saved individually on each page.</p>
      <button class="primary" data-action="finish">
        Finish setup →
      </button>
    </div>
  `;
}

function controlPage() {
  const encoder = selectedControl === 3;
  const control = encoder ? draft.encoder : draft.faders[selectedControl];
  const tabs = CONTROL_NAMES;

  return `
    ${heading(
      '03 / CC CONFIGURATION',
      'Every move, assigned.',
      'Set each control’s MIDI channel, CC number and output range. Save all four assignments together.'
    )}

    <div class="control-tabs" role="tablist" aria-label="Control">
      ${tabs.map((label, i) => `
        <button
          id="tab-${i}"
          role="tab"
          tabindex="${selectedControl === i ? 0 : -1}"
          aria-selected="${selectedControl === i}"
          aria-controls="control-panel"
          data-control="${i}"
        >
          ${label}
        </button>
      `).join('')}
    </div>

    <form id="controls-form">
      <section
        class="panel"
        id="control-panel"
        role="tabpanel"
        aria-labelledby="tab-${selectedControl}"
      >
        <div class="control-head">
          <h2>${CONTROL_NAMES[selectedControl]}</h2>
          <span class="tag">MIDI 1.0 / CONTROL CHANGE</span>
        </div>

        <div class="fields control-midi-fields">
          <label>
            MIDI channel
            <input
              data-control-field="channel"
              type="number"
              min="1"
              max="16"
              required
              value="${control.channel}"
            >
          </label>
          <label>
            CC number
            <input
              data-control-field="cc"
              type="number"
              min="0"
              max="127"
              required
              value="${control.cc}"
            >
          </label>
        </div>

        <div class="subheading">OUTPUT RANGE</div>
        <div class="fields range-fields">
          <label>
            Minimum
            <input
              data-control-field="minimum"
              type="number"
              min="0"
              max="127"
              required
              value="${control.minimum}"
            >
          </label>
          <label>
            Maximum
            <input
              data-control-field="maximum"
              type="number"
              min="0"
              max="127"
              required
              value="${control.maximum}"
            >
          </label>
          ${!encoder ? `
            <label class="checkbox">
              <input
                data-control-field="inverted"
                type="checkbox"
                ${control.inverted ? 'checked' : ''}
              >
              Invert fader direction
            </label>
          ` : ''}
        </div>

        <p class="note">
          ${encoder ? `
            Turn clockwise to increase the value and counterclockwise to decrease it.
            The value stops at your minimum and maximum settings.
          ` : `
            Calibration sets the physical endpoints. This range sets the MIDI values
            sent at those endpoints.
          `}
        </p>
      </section>

      <div id="form-error" role="alert"></div>
      ${formActions('Save CC configuration')}
    </form>
  `;
}

function calibrationPage() {
  const endpoint = config.calibration[selectedFader];
  const step = calibration?.step ?? 0;
  return `${heading('02 / CALIBRATION', 'Full travel. Matched range.', 'Teach the controller where each fader starts and ends. Calibration is optional and can be repeated anytime.')}
    <div class="control-tabs" aria-label="Select fader">${config.faders.map((f,i) => `<button data-fader="${i}" aria-pressed="${selectedFader === i}">Fader ${i+1}</button>`).join('')}</div>
    <section class="panel"><div class="control-head"><h2>${CONTROL_NAMES[selectedFader]}</h2><span class="tag">${endpoint.calibrated ? 'CALIBRATED IN PREVIEW' : 'DEFAULT RANGE'}</span></div>
      ${!calibration ? `<p>Move this fader to both physical stops and capture each endpoint. Other faders and your CC assignments stay unchanged.</p><div class="endpoint-values"><div><span class="metric-label">BOTTOM / RAW ADC</span><span>${endpoint.minimum}</span></div><div><span class="metric-label">TOP / RAW ADC</span><span>${endpoint.maximum}</span></div></div><p class="note">This preview uses a simulated ADC slider. The device version will read the actual fader.</p><div class="actions"><button class="primary" data-action="start-calibration">Calibrate this fader →</button></div>` : `
      <div class="stepper">${['Bottom', 'Top', 'Review'].map((title,i) => `<span class="step ${step === i ? 'active' : ''}" ${step === i ? 'aria-current="step"' : ''}><b>${i+1}</b>${title}</span>`).join('')}</div>
      <div class="cal-layout"><div class="fader-visual" aria-hidden="true"><div class="fader-track"><div class="fader-cap" style="bottom:${(calibration.raw / 4095) * 82}%"></div></div></div><div><h2>${['Move fully down.', 'Move fully up.', 'Ready to save.'][step]}</h2><p>${['Hold the fader still at its bottom stop, then capture the reading.', 'Hold the fader still at its top stop, then capture the reading.', 'These endpoints will map to the full configured MIDI range.'][step]}</p>${step < 2 ? `<div class="simulation"><label>SIMULATED RAW ADC <output id="adc-value">${calibration.raw}</output><input id="adc-slider" type="range" min="0" max="4095" value="${calibration.raw}" aria-label="Simulated fader ADC value"></label><small>Move this slider to try valid or invalid captures.</small></div>` : `<div class="endpoint-values"><div><span class="metric-label">BOTTOM</span><span>${calibration.bottom}</span></div><div><span class="metric-label">TOP</span><span>${calibration.top}</span></div></div>`}</div></div>
      <div id="form-error" role="alert"></div><div class="actions"><button data-action="cancel-calibration">Cancel</button>${step === 2 ? '<button data-action="start-calibration">Retry</button><button class="primary" data-action="save-calibration">Save calibration</button>' : `<button class="primary" data-action="capture">Capture ${step === 0 ? 'bottom' : 'top'}</button>`}</div>`}
    </section><p class="help" style="margin-top:18px">Recalibration adjusts endpoints. Worn tracks, clipping or uneven taper may still need hardware attention.</p>`;
}
function optionsPage() {
  return `${heading('04 / OPTIONS', 'Set the finishing touches.', 'Keep the screens comfortable for your space, or restore settings when you need a fresh start.')}
    <form id="options-form"><section class="panel"><div class="brightness-layout"><div><h2>Screen brightness</h2><p>One brightness setting for all four OLEDs.</p><label>Brightness <output class="value-readout" id="brightness-value">${Math.round(draft.screenBrightness / 255 * 100)}%</output><input id="brightness" type="range" min="0" max="255" value="${draft.screenBrightness}" aria-label="Screen brightness"></label></div><div><div class="oled" id="oled" style="opacity:${.1 + draft.screenBrightness / 255 * .9}" aria-label="Simulated OLED brightness"><span>CC 21</span><strong>064</strong></div><p class="help" style="margin-top:12px">Visual preview · actual OLED contrast may differ</p></div></div></section><div id="form-error" role="alert"></div>${formActions('Save brightness')}</form>
    <div class="section-break"></div><div class="eyebrow">RECOVERY</div><div class="reset-row"><div><h3>Reset network settings</h3><p>Clear Wi-Fi credentials and return to the network choice. Keep calibration, CC assignments and brightness.</p></div><button data-reset="network">Reset network</button></div><div class="reset-row"><div><h3>Factory reset</h3><p>Restore all defaults, including network settings, calibration, CC assignments and brightness.</p></div><button class="danger" data-reset="factory">Factory reset</button></div><p class="note">Both recovery actions will also be available from the controller’s hardware setup menu, without network access.</p>`;
}
function render(focus = true) {
  document.querySelector('#session-state').textContent = finished ? '○ SETUP CLOSED' : '● SETUP ACTIVE';
  app.innerHTML = `<main>${finished ? '<div class="empty"><div class="icon" aria-hidden="true">✓</div><div class="eyebrow">PREVIEW SESSION COMPLETE</div><h1 tabindex="-1">Back to making music.</h1><p>On the controller, finishing setup stops the web server and turns Wi-Fi off. Your saved settings stay in place.</p><button class="primary" data-action="reopen">Reopen setup preview</button></div>' : ({home:homePage, network:networkPage, controls:controlPage, calibration:calibrationPage, options:optionsPage}[page] || homePage)()}</main>`;
  if (page === 'network' && networkMode === 'lan' && !finished) {
    updateNetworkList();
    if (networkScan.state === 'idle') void refreshNetworks();
  }
  if (focus) {
    app.querySelector('h1')?.focus({preventScroll: true});
    window.scrollTo(0, 0);
  }
}
function updateNetworkList() {
  const select = document.querySelector('#network-list');
  if (!select) return;
  const selected = draft.wifiSsid;
  select.replaceChildren(new Option(networkScan.state === 'loading' ? 'Scanning…' : 'Select a network', ''));
  for (const network of networkScan.networks) {
    const strength = network.rssi >= -60 ? 'strong' : network.rssi >= -75 ? 'fair' : 'weak';
    select.add(new Option(`${network.ssid} (${strength}${network.secure ? '' : ', open'})`, network.ssid));
  }
  select.value = selected;
  const loading = networkScan.state === 'loading';
  select.disabled = loading;
  const refresh = document.querySelector('[data-action="refresh-networks"]');
  refresh.disabled = loading; refresh.textContent = loading ? 'Scanning…' : 'Refresh';
  const status = document.querySelector('#scan-status');
  status.textContent = loading ? 'Scanning for networks…' : networkScan.error || (networkScan.state === 'complete' && !networkScan.networks.length ? 'No visible networks found. Try Refresh.' : '');
}
async function refreshNetworks() {
  if (networkScan.state === 'loading') return;
  networkScan.state = 'loading'; networkScan.error = ''; updateNetworkList();
  try {
    networkScan.networks = await scanNearbyNetworks(); networkScan.state = 'complete';
  } catch (error) {
    networkScan.state = 'error'; networkScan.error = error.message;
  }
  updateNetworkList();
}
function showError(error) {
  const target = document.querySelector('#form-error');
  if (target) { target.className = 'error'; target.textContent = error.message; target.scrollIntoView({block:'nearest'}); }
  else toast(error.message);
}
async function save(candidate, message) {
  const saved = await device.save(candidate);
  config = saved; draft = clone(saved); calibration = null;
  page = 'home'; render(); toast(message);
}
app.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.controlField) {
    const control = selectedControl === 3 ? draft.encoder : draft.faders[selectedControl];
    control[input.dataset.controlField] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? NaN : Number(input.value)) : input.value;
  }
  if (page === 'network') {
    if (input.name === 'ssid') draft.wifiSsid = input.value;
  }
  if (input.id === 'brightness') {
    draft.screenBrightness = Number(input.value);
    document.querySelector('#brightness-value').textContent = `${Math.round(input.value / 255 * 100)}%`;
    document.querySelector('#oled').style.opacity = .1 + input.value / 255 * .9;
  }
  if (input.id === 'adc-slider') {
    calibration.raw = Number(input.value);
    document.querySelector('#adc-value').textContent = input.value;
    document.querySelector('.fader-cap').style.bottom = `${input.value / 4095 * 82}%`;
  }
});
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    if (event.target.id === 'network-form') {
      if (networkMode === 'lan') {
        const selected = document.querySelector('#network-list');
        if (networkScan.state === 'loading' || !selected?.value) throw new Error('Select a visible Wi-Fi network first.');
        draft.wifiSsid = selected.value;
      }
      draft.networkMode = networkMode;
      draft.networkSetupComplete = true;
      const controls = [...event.target.querySelectorAll('input, select, button')];
      const previousDisabled = controls.map(input => input.disabled);
      const password = event.target.elements.password?.value || '';
      controls.forEach(input => { input.disabled = true; });
      try {
        const saved = await device.saveNetwork(draft, password, status => {
          document.querySelector('#connection-status').textContent = status.state === 'connecting' ? 'Connecting… Keep this page open (up to 20 seconds).' : status.error || '';
        });
        config = saved;
        draft = clone(saved);
        const status = device.networkStatus;
        if (networkMode === 'lan' && status.viaAp) {
          networkHandoff = status;
          page = 'network';
          render();
          // Render the destination before asking the AP to shut down.
          await new Promise(resolve => requestAnimationFrame(resolve));
          try {
            await device.finishNetworkHandoff();
          } catch {
            // The firmware also closes the AP after a bounded handoff timeout.
          }
        } else {
          page = 'home';
          render();
          toast(networkMode === 'lan'
            ? 'Connected. Network settings saved on the controller.'
            : 'Standalone preference saved on the controller.');
        }
      } finally { controls.forEach((input,i) => { if (input.isConnected) input.disabled = previousDisabled[i]; }); }
    } else if (event.target.id === 'controls-form') await save(draft, 'CC configuration saved in this browser.');
    else if (event.target.id === 'options-form') await save(draft, 'Brightness saved in this browser.');
  } catch (error) { showError(error); }
  finally { busy = false; if (submit?.isConnected) submit.disabled = false; }
});
async function handleClick(event) {
  const target = event.target.closest('button, a');
  if (!target || busy) return;
  if (target.dataset.route) { event.preventDefault(); if (!finished) await navigate(config.networkSetupComplete ? target.dataset.route : 'network'); return; }
  if (target.dataset.network) {
    networkMode = target.dataset.network; draft.networkMode = networkMode;
    render(false); app.querySelector(`[data-network="${networkMode}"]`).focus(); return;
  }
  if (target.dataset.control !== undefined) {
    selectedControl = Number(target.dataset.control); render(false); document.querySelector(`#tab-${selectedControl}`).focus(); return;
  }
  if (target.dataset.fader !== undefined) {
    if (calibration && !await confirmAction('Cancel this calibration?', 'Saved endpoints will stay in place.', 'Cancel calibration')) return;
    selectedFader = Number(target.dataset.fader); calibration = null; render(false); app.querySelector(`[data-fader="${selectedFader}"]`).focus(); return;
  }
  if (target.dataset.reset) {
    const scope = target.dataset.reset;
    const pendingWarning = dirty() ? ' Unsaved edits on this page will be discarded.' : '';
    const confirmed = await confirmAction(scope === 'factory' ? 'Restore factory defaults?' : 'Reset network settings?', scope === 'factory' ? 'This clears all preview settings: network, calibration, CC assignments and brightness. The real controller is unaffected.' + pendingWarning : 'This clears preview network settings. Calibration, CC assignments and brightness are kept. The real controller is unaffected.' + pendingWarning, scope === 'factory' ? 'Restore defaults' : 'Reset network', true);
    if (!confirmed) return;
    busy = true;
    try {
      config = await device.reset(config, scope); draft = clone(config);
      calibration = null; networkMode = config.networkMode; page = 'network'; render();
      toast(scope === 'factory' ? 'Preview restored to factory defaults.' : 'Preview network settings reset.');
    } finally { busy = false; }
    return;
  }
  switch (target.dataset.action) {
    case 'refresh-networks': await refreshNetworks(); break;
    case 'cancel':
      if (!config.networkSetupComplete) {
        if (dirty() && !await confirmAction('Discard unsaved changes?', 'Return to the initial network choice.', 'Discard changes')) return;
        draft = clone(config); networkMode = draft.networkMode; render();
      } else await navigate('home');
      break;
    case 'finish':
      if (!await confirmAction('Finish setup?', 'On the controller, Wi-Fi and the setup page will turn off. To reconnect, select Wi-Fi Setup on the controller.', 'Finish setup')) return;
      await device.finish(); finished = true; render(); break;
    case 'reopen': device.active = true; finished = false; page = config.networkSetupComplete ? 'home' : 'network'; render(); break;
    case 'start-calibration': calibration = {step:0, raw:100, bottom:null, top:null}; render(); break;
    case 'cancel-calibration':
      if (!await confirmAction('Cancel this calibration?', 'Your saved endpoints will stay in place.', 'Cancel calibration')) return;
      calibration = null; render(); break;
    case 'capture':
      if (calibration.step === 0) { calibration.bottom = calibration.raw; calibration.step = 1; calibration.raw = 3700; render(); }
      else {
        if (calibration.raw - calibration.bottom < 1024) throw new Error('Not enough travel, or endpoints are reversed. Set the simulated top at least 1024 counts above the bottom, then retry.');
        calibration.top = calibration.raw; calibration.step = 2; render();
      }
      break;
    case 'save-calibration': {
      const candidate = clone(config);
      candidate.calibration[selectedFader] = {minimum:calibration.bottom, maximum:calibration.top, calibrated:true};
      busy = true;
      try {
        const saved = await device.save(candidate);
        config = saved; draft = clone(saved); calibration = null; render();
        toast(`Fader ${selectedFader + 1} calibration saved in preview.`);
      } finally { busy = false; }
      break;
    }
  }
}
app.addEventListener('keydown', event => {
  const tab = event.target.closest('[role=tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = Number(tab.dataset.control);
  selectedControl = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
  render(false); document.querySelector(`#tab-${selectedControl}`).focus();
});
document.addEventListener('click', event => { handleClick(event).catch(showError); });
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
try {
  config = await device.load(); draft = clone(config); networkMode = config.networkMode;
  page = config.networkSetupComplete ? 'home' : 'network'; render(false);
  if (device.networkLive && device.networkStatus.state === 'connecting') {
    void (async () => {
      while (device.networkStatus.state === 'connecting') {
        await new Promise(resolve => setTimeout(resolve,1000));
        if (busy) continue;
        try {
          await device.refreshNetwork();
          if (page === 'home' && !busy && !finished) render(false);
        } catch { break; }
      }
    })();
  }
  if (device.warning) toast(device.warning);
} catch (error) {
  app.innerHTML = '<main><div class="eyebrow">PREVIEW UNAVAILABLE</div><h1>Could not open setup.</h1><p id="startup-error"></p></main>';
  document.querySelector('#startup-error').textContent = error.message;
}
