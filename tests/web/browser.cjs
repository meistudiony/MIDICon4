const {chromium} = require(process.env.MIDICONT_PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.MIDICONT_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1050}});
 const page = await context.newPage();
 // Device pages use plain HTTP, where secure-context helpers may be absent.
 await page.addInitScript(() => { window.structuredClone = undefined; });
 let networkState = {state:'standalone',error:'',ip:'',mdns:false,settings:{networkMode:'standalone',networkSetupComplete:false,wifiSsid:'',hostname:'midicon4',deviceName:'MIDICon4-001',hasPassword:false}};
 await page.route('**/api/network', async route => {
   if (route.request().method() === 'POST') {
     const fields = new URLSearchParams(route.request().postData());
     networkState = {...networkState,state:fields.get('mode') === 'lan' ? 'connected' : 'standalone',ip:'192.168.1.20',settings:{...networkState.settings,networkMode:fields.get('mode'),networkSetupComplete:true,wifiSsid:fields.get('ssid'),hostname:fields.get('mode') === 'lan' ? 'midicon4-001' : 'midicon4',deviceName:networkState.settings.deviceName}};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(networkState)});
 });
 let scanPolls = 0;
 await page.route('**/api/networks/scan', route => {
   scanPolls = 0;
   return route.fulfill({status:202, contentType:'application/json', body:JSON.stringify({state:'scanning'})});
 });
 await page.route('**/api/networks', route => route.fulfill({
   status:scanPolls++ === 0 ? 202 : 200, contentType:'application/json',
   body:JSON.stringify(scanPolls === 1 ? {state:'scanning'} : {state:'complete', networks:[{ssid:'Studio',rssi:-45,secure:true}]})
 }));
 const errors = []; page.on('pageerror',e => errors.push(e.message));
 try {
  await page.goto(process.env.MIDICONT_PREVIEW_URL || 'http://127.0.0.1:8080');
  await page.getByRole('heading',{name:'How would you like to connect?'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:/calibrat/i}).count(),0);
  assert.equal(await page.locator('[name="deviceName"]').count(), 0);
  assert.equal(await page.locator('[name="hostname"]').count(), 0);
  await page.screenshot({path:'/tmp/midicont-network-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Save standalone'}).click();
  await page.getByRole('heading',{name:'Configure MIDICon-001'}).waitFor();
  await page.screenshot({path:'/tmp/midicont-menu-desktop.png',fullPage:true});
  await page.getByRole('button',{name:/03 \/ SETUP/}).click();
  assert.equal(await page.locator('[data-control-field="label"]').count(), 0);
  await page.getByRole('tab', {name:'Encoder', exact:true}).click();
  await page.locator('[data-control-field="cc"]').fill('25');
  await page.getByRole('tab', {name:'Fader 1', exact:true}).click();
  await page.locator('[data-control-field="cc"]').fill('70');
  await page.getByRole('tab',{name:'Fader 2'}).click();
  await page.locator('[data-control-field="channel"]').fill('2');
  await page.getByRole('button',{name:'Save CC configuration'}).click();
  await page.reload();
  await page.getByRole('button',{name:/03 \/ SETUP/}).click();
  assert.equal(await page.locator('[data-control-field="label"]').count(), 0);
  assert.equal(await page.locator('[data-control-field="cc"]').inputValue(),'70');
  await page.locator('[data-control-field="cc"]').fill('80');
  await page.getByRole('button',{name:'Main menu'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.locator('[data-control-field="cc"]').inputValue(),'80');
  await page.getByRole('button',{name:'Main menu'}).click();
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await page.getByRole('button',{name:/02 \/ SETUP/}).click();
  await page.getByRole('button',{name:'Calibrate this fader'}).click();
  await page.getByRole('button',{name:'Capture bottom'}).click();
  await page.locator('#adc-slider').fill('200');
  await page.getByRole('button',{name:'Capture top'}).click();
  await page.getByRole('alert').filter({hasText:'Not enough travel'}).waitFor();
  await page.locator('#adc-slider').fill('3700');
  await page.getByRole('button',{name:'Capture top'}).click();
  await page.getByRole('button',{name:'Save calibration'}).click();
  await page.getByText('CALIBRATED IN PREVIEW',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Main menu'}).click();
  await page.getByRole('button',{name:/04 \/ SETUP/}).click();
  await page.locator('#brightness').fill('200');
  await page.getByRole('button',{name:'Save brightness'}).click();
  await page.getByRole('button',{name:/04 \/ SETUP/}).click();
  await page.getByRole('button',{name:'Reset network',exact:true}).click();
  await page.locator('#confirm-button').click();
  await page.getByRole('heading',{name:'How would you like to connect?'}).waitFor();
  await page.getByRole('button',{name:'Save standalone'}).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('midicon4.preview.v2')));
  assert.equal(saved.faders[0].cc,70); assert.equal(saved.calibration[0].maximum,3700); assert.equal(saved.screenBrightness,200);
  await page.getByRole('button',{name:'Finish setup'}).click();
  await page.locator('#confirm-button').click();
  await page.getByRole('heading',{name:'Back to making music.'}).waitFor();
  await page.getByRole('button',{name:'Reopen setup preview'}).click();
  await page.getByRole('button',{name:/04 \/ SETUP/}).click();
  await page.getByRole('button',{name:'Factory reset',exact:true}).click();
  await page.locator('#confirm-button').click();
  await page.getByRole('heading',{name:'How would you like to connect?'}).waitFor();
  await page.getByRole('button',{name:/Wi-Fi Keep your phone/}).click();
  await page.getByRole('combobox',{name:'Wi-Fi network',exact:true}).selectOption('Studio');
  await page.getByLabel('Wi-Fi password').fill('keep-during-refresh');
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('combobox',{name:'Wi-Fi network',exact:true}).selectOption('Studio');
  assert.equal(await page.getByLabel('Wi-Fi password').inputValue(),'keep-during-refresh');
  await page.getByLabel('Wi-Fi password').fill('not-stored');
  await page.getByRole('region', {name:'Network details'})
    .getByRole('button', {name:'Connect & save'}).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('midicon4.preview.v2').includes('not-stored')),false);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/midicont-menu-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await page.getByRole('button',{name:/03 \/ SETUP/}).click();
  await page.screenshot({path:'/tmp/midicont-controls-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await page.getByRole('button', {name: 'Main menu'}).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', {name: /04 \/ SETUP/}).click();
  await page.getByRole('heading', {name: 'Set the finishing touches.'}).waitFor();
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  assert.deepEqual(errors,[]);
  console.log('PASS: onboarding, assignments/reload, unsaved edits, calibration, brightness, both resets, finish, LAN preview and mobile overflow; no browser errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
