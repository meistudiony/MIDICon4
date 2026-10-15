import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanNearbyNetworks} from '../../web/device.mjs';
const response = (status, data) => ({status,ok:status >= 200 && status < 300,json:async () => data});
test('polls async scan, deduplicates SSIDs and sorts by strongest signal', async () => {
  const calls = [];
  const replies = [response(202,{state:'scanning'}),response(202,{state:'scanning'}),response(200,{state:'complete',networks:[
    {ssid:'Studio',rssi:-80,secure:true},{ssid:'Guest',rssi:-65,secure:false},
    {ssid:'Studio',rssi:-40,secure:true},{ssid:'',rssi:-20,secure:true},
    {ssid:'Quotes " & Unicode é',rssi:-70,secure:true}
  ]})];
  const result = await scanNearbyNetworks(async (url,options) => {
    calls.push([url,options.method]); return replies.shift();
  },{pollMs:0});
  assert.deepEqual(calls,[['/api/networks/scan','POST'],['/api/networks','GET'],['/api/networks','GET']]);
  assert.deepEqual(result.map(n=>[n.ssid,n.rssi]),[['Studio',-40],['Guest',-65],['Quotes " & Unicode é',-70]]);
});
test('empty results are valid, rather than inventing networks', async () => {
  let calls = 0;
  const result = await scanNearbyNetworks(async () => ++calls === 1 ? response(202,{state:'scanning'}) : response(200,{state:'complete',networks:[]}));
  assert.deepEqual(result,[]);
});
test('scan errors and static-preview failures are explicit', async () => {
  await assert.rejects(scanNearbyNetworks(async () => response(503,{error:'Radio scan failed'})),/Radio scan failed/);
  await assert.rejects(scanNearbyNetworks(async () => response(501,{})),/Scanning is available on the controller/);
  await assert.rejects(scanNearbyNetworks(async () => ({status:200,ok:true,json:async()=>{throw new Error('bad JSON');}})),/invalid scan response/);
});
test('a stalled request times out', async () => {
  await assert.rejects(scanNearbyNetworks((url,{signal}) => new Promise((resolve,reject) => {
    signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  }),{timeoutMs:10}),/timed out/);
});
