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
assert.equal(malicious.sections[0].bars[0].tokens.length,0);
console.log('PASS: scale chords, enharmonic spelling, custom chords, variations, bars, and validation.');

// Song sections: a single-tap chord keypad fills each bar; old v1 charts remain compatible.
assert.equal(c.normalize(input).sections[0].title,'Verse 1');
assert.equal(c.normalize(input).version,3);
const progression={root:'G',mode:'major',timeSignature:'4/4',sections:[
  {title:'Intro',bars:[{tokens:[{type:'chord',value:'G'},{type:'chord',value:'D'}],end:'|'}]},
  {title:'Verse 1',bars:[{tokens:[{type:'chord',value:'Em'},{type:'chord',value:'C'}],end:'||'}]},
  {title:'Pre-Chorus',bars:[{tokens:[{type:'chord',value:'Am'}],end:'|'}]},
  {title:'Chorus',bars:[{tokens:[{type:'chord',value:'D'}],end:'|'}]},
  {title:'Guitar Riff',bars:[{tokens:[{type:'chord',value:'Ebmaj7'}],end:'|'}]},
]};
const sections=c.normalize(progression);
assert.equal(sections.sections.length,5);
assert.deepEqual(Array.from(sections.sections,s=>s.title),['Intro','Verse 1','Pre-Chorus','Chorus','Guitar Riff']);
assert.equal(c.buildChart(sections),'Intro:\n| [G]  [D]  |\n\nVerse 1:\n| [Em]  [C]  ||\n\nPre-Chorus:\n| [Am]  |\n\nChorus:\n| [D]  |\n\nGuitar Riff:\n| [Ebmaj7]  |');
assert.equal(c.normalize({sections:[{title:'Verse 1:<script>',bars:[{tokens:[]}]}]}).sections[0].title,'Verse 1script');
assert.equal(c.buildChart(input),chart);
console.log('PASS: multiple ordered sections, custom headings, legacy migration, and Stage View chart serialization.');
// v0.4 next-line action: bars on the same line stay together; explicit line breaks survive backups.
const newArrangement={version:3,root:'C',sections:[{title:'Verse 2',bars:[
 {tokens:[{type:'chord',value:'C'}],end:'|',lineBreakBefore:false},
 {tokens:[{type:'chord',value:'G'}],end:'|',lineBreakBefore:false},
 {tokens:[{type:'chord',value:'Am'}],end:'||',lineBreakBefore:true}
]}]};
assert.equal(c.buildChart(newArrangement),'Verse 2:\\n| [C]  |  [G]  |\\n| [Am]  ||'.replace(/\\n/g,'\n'));
assert.equal(c.normalize(newArrangement).sections[0].bars[2].lineBreakBefore,true);
const previous={version:2,root:'C',sections:[{title:'Intro',bars:[{tokens:[]},{tokens:[]}]}]};
assert.equal(c.normalize(previous).sections[0].bars[1].lineBreakBefore,true);
console.log('PASS: v0.4 line breaks and legacy bar formatting.');

assert.equal(c.chordTapAction(true),'preview','Preview ON must audition only');
assert.equal(c.chordTapAction(false),'insert','Preview OFF must insert chords');
console.log('PASS: independent chord preview and entry modes.');
