import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SetupDevice} from '../../web/device.mjs';
import {defaults} from '../../web/model.mjs';
const settings = {networkMode:'standalone',networkSetupComplete:false,wifiSsid:'',hostname:'midicon4',deviceName:'MIDICon4-001',hasPassword:false};
const status = (state, fields={}) => ({state,settings:{...settings},...fields});
const reply = data => ({ok:true,status:200,json:async()=>data});
const memory = () => ({getItem:()=>null,setItem:()=>{throw new Error('Network credentials must not enter browser storage');}});
test('network load comes from device, overriding browser defaults', async()=>{
  const device = new SetupDevice(memory(),async()=>reply(status('standalone')));
  const config = await device.load();
  assert.equal(device.networkLive,true); assert.equal(config.hostname,'midicon4');
});
test('posts credentials, polls, applies device settings only after success', async()=>{
  const calls=[];
  const saved={...settings,networkMode:'lan',networkSetupComplete:true,wifiSsid:'Studio',hasPassword:true};
  const responses=[status('standalone'),status('connecting'),status('connected',{settings:saved,ip:'192.168.1.20'})];
  const device = new SetupDevice(memory(),async(url,options)=>{calls.push(options);return reply(responses.shift());});
  const config = await device.load(); config.networkMode='lan';config.wifiSsid='Studio';
  const result = await device.saveNetwork(config,'studio-pass',()=>{},{pollMs:0});
  assert.equal(calls[1].body.has('deviceName'),false);
  assert.equal(calls[1].body.has('hostname'),false);
  assert.equal(calls[1].method,'POST'); assert.equal(calls[1].body.get('password'),'studio-pass');
  assert.equal(result.networkSetupComplete,true); assert.equal(result.wifiPassword,undefined);
  assert.equal(device.networkStatus.ip,'192.168.1.20');
});
test('failed connection leaves config unchanged and surfaces backend error',async()=>{
  const responses=[status('standalone'),status('connecting'),status('failed',{error:'Wrong password'})];
  const device=new SetupDevice(memory(),async()=>reply(responses.shift()));
  const config=await device.load();config.networkMode='lan';config.wifiSsid='Studio';
  await assert.rejects(device.saveNetwork(config,'wrong-pass',()=>{},{pollMs:0}),/Wrong password/);
  assert.equal(config.networkSetupComplete,false);
});
test('no simulated connection on static preview',async()=>{
  const device = new SetupDevice(memory(),async()=>({status:404}));
  await device.load();
  await assert.rejects(device.saveNetwork(defaults(),''),/Open the setup page on the controller/);
});


test('browser acknowledges handoff through its dedicated endpoint', async () => {
  const calls = [];
  const device = new SetupDevice(memory(), async (url, options) => {
    calls.push({url, method: options.method});
    return reply({ok: true});
  });

  await device.finishNetworkHandoff();

  assert.deepEqual(calls, [{
    url: '/api/network/handoff',
    method: 'POST'
  }]);
});
