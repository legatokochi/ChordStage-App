'use strict';
// Run: node tests/analyzer.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sampleRate=22050;
const progression=[['C',[48,60,64,67]],['Am',[45,57,60,64]],['F',[41,53,57,60]],['G',[43,55,59,62]]];
const perChord=3;
const samples=new Float32Array(sampleRate*perChord*progression.length);
for(let i=0;i<samples.length;i++){
  const t=i/sampleRate;
  const pitches=progression[Math.min(progression.length-1,Math.floor(t/perChord))][1];
  let value=0;
  pitches.forEach((midi,j)=>{value+=Math.sin(2*Math.PI*440*Math.pow(2,(midi-69)/12)*t)*(j===0?.22:.10);});
  samples[i]=value;
}
const fakeAudioBuffer={sampleRate,numberOfChannels:1,length:samples.length,duration:samples.length/sampleRate,getChannelData(){return samples;}};
class FakeAudioContext{async decodeAudioData(){return fakeAudioBuffer;}async close(){}}
const sandbox={window:{AudioContext:FakeAudioContext},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),setTimeout,Float64Array,Math,Map};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../analysis.js'),'utf8'),sandbox);
(async()=>{
  const result=await sandbox.window.ChordStageAnalyzer.analyze('synthetic');
  assert.deepEqual(Array.from(result.cues, x=>x.chord),progression.map(x=>x[0]));
  result.cues.forEach((cue,index)=>assert.ok(Math.abs(cue.t-index*perChord)<.6,`Chord ${cue.chord} cue was ${cue.t}s, expected ${index*perChord}s`));
  process.stdout.write('PASS: local audio analyzer recognizes a synthetic C–Am–F–G progression with approximate timings.\n');
})().catch(error=>{console.error(error);process.exitCode=1;});