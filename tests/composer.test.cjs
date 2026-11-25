'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../composer.js'),'utf8'),sandbox);
const c=sandbox.window.ChordStageComposer;
assert.deepEqual(Array.from(c.chordInScale('C','major'),x=>x.chord),['C','Dm','Em','F','G','Am','Bdim']);
assert.deepEqual(Array.from(c.chordInScale('A','minor'),x=>x.chord),['Am','Bdim','C','Dm','Em','F','G']);
assert.deepEqual(Array.from(c.chordInScale('A','harmonic'),x=>x.chord),['Am','Bdim','Caug','Dm','E','F','G#dim']);
assert.deepEqual(Array.from(c.chordInScale('C#','major'),x=>x.chord),['C#','D#m','E#m','F#','G#','A#m','B#dim']);
assert.equal(c.changeQuality('Dm','add9'),'Dmadd9');
assert.equal(c.changeQuality('F','maj7'),'Fmaj7');
assert.equal(c.changeQuality('Bm','maj7'),'Bm(maj7)');
assert.equal(c.changeQuality('Bb','aug'),'Bbaug');
assert.equal(c.changeQuality('B','dim'),'Bdim');
assert.equal(c.isChord('Bbmaj7'),true);
assert.equal(c.isChord('F#m7b5'),true);
assert.equal(c.isChord('C#7/G#'),true);
assert.equal(c.isChord('[C]'),false);
assert.equal(c.isChord('Not a chord'),false);
const input={root:'C',mode:'major',section:'Verse 1',timeSignature:'6/8',bars:[
 {lead:'|:',end:'|',tokens:[{type:'chord',value:'C'},{type:'chord',value:'Amadd9'}]},
 {lead:'',end:':|',tokens:[{type:'symbol',value:'%'}]}
]};
const chart=c.buildChart(input);
assert.equal(chart,'Verse 1:\n|: [C]  [Amadd9]  |\n| %  :|');
assert.equal(c.normalize(input).timeSignature,'6/8');
const malicious=c.normalize({root:'BLAH',bars:[{tokens:[{type:'chord',value:'<img>'}]}]});
assert.equal(malicious.root,'C');
assert.equal(malicious.bars[0].tokens.length,0);
console.log('PASS: scale chords, enharmonic spelling, custom chords, variations, bars, and validation.');