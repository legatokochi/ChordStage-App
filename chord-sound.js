/* ChordStage chord audition: offline Web Audio synthesis, no external audio or network. */
'use strict';
(() => {
  const NATURAL={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const mod=n=>((n%12)+12)%12;
  function parseChord(input) {
    if(typeof input!=='string'||input.length>32)return null;
    const m=/^([A-G])([#b]{0,2})([^/]*)((?:\/[A-G][#b]{0,2})?)$/.exec(input.trim());
    if(!m)return null;
    const root=mod(NATURAL[m[1]]+[...m[2]].reduce((n,a)=>n+(a==='#'?1:-1),0));
    const suffix=m[3].toLowerCase().replace(/\s/g,'');
    const basicMinor=/^m(?!aj)/.test(suffix)||suffix.startsWith('min');
    let triad=basicMinor?[0,3,7]:[0,4,7];
    if(suffix.startsWith('dim')||suffix==='°')triad=[0,3,6];
    else if(suffix.includes('aug')||suffix==='+')triad=[0,4,8];
    else if(suffix.startsWith('sus2'))triad=[0,2,7];
    else if(suffix.startsWith('sus4')||suffix==='sus')triad=[0,5,7];
    else if(suffix.includes('m7b5')||suffix.includes('m7(b5)')||suffix.includes('ø'))triad=[0,3,6];
    const extensions=[];
    if(/\(maj7\)/.test(suffix))extensions.push(11);
    else if(/maj7|ma7|Δ7/i.test(suffix))extensions.push(11);
    else if(!suffix.includes('add9') && /7|9|13/.test(suffix))extensions.push(10);
    if(suffix.includes('6')&&!suffix.includes('13'))extensions.push(9);
    if(suffix.includes('add9')||/(?:^|[^0-9])9/.test(suffix)||suffix.includes('13'))extensions.push(suffix.includes('b9')?13:14);
    if(suffix.includes('13'))extensions.push(21);
    const supported=suffix===''||/^(?:m|min|minor|maj|major|dim|aug|\+|°|sus|sus2|sus4|6|m6|7|m7|maj7|ma7|m\(maj7\)|mmaj7|add9|madd9|9|m9|13|m13|m7b5|ø7|7\(b9\)|7b9|5|m7\(b5\))$/i.test(suffix);
    if(!supported)return null;
    if(suffix==='5')triad=[0,7];
    const notes=[...new Set([...triad,...extensions])].sort((a,b)=>a-b);
    let bass=null;
    if(m[4]){const b=/^\/([A-G])([#b]{0,2})$/.exec(m[4]);if(b)bass=mod(NATURAL[b[1]]+[...b[2]].reduce((n,a)=>n+(a==='#'?1:-1),0));}
    return {root,intervals:notes,bass};
  }
  let ctx=null,lastGain=null;
  function stop(){if(ctx&&lastGain){const t=ctx.currentTime;try{lastGain.gain.cancelScheduledValues(t);lastGain.gain.setTargetAtTime(0,t,.025);}catch(e){}lastGain=null;}}
  async function play(chord,opts={}) {
    const parsed=parseChord(chord);if(!parsed)return false;
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return false;
    try{
      if(!ctx)ctx=new Ctx();
      if(ctx.state==='suspended')await ctx.resume();
      stop();
      const t=ctx.currentTime+.008,volume=Math.min(.8,Math.max(0,Number.isFinite(Number(opts.volume))?Number(opts.volume):.45)),instrument=opts.instrument||'piano';
      const gain=ctx.createGain();gain.gain.value=volume*.55;gain.connect(ctx.destination);lastGain=gain;
      const base=instrument==='guitar'?48:instrument==='epiano'?55:60;
      const midiRoot=base+((parsed.root-(base%12)+12)%12);
      const midi=parsed.intervals.map(n=>midiRoot+n);
      if(parsed.bass!==null){let bassMidi=48+((parsed.bass-0+12)%12);if(bassMidi>=midi[0])bassMidi-=12;midi.unshift(bassMidi);}
      const length=instrument==='pad'?1.25:instrument==='guitar'?.95:1.15;
      midi.slice(0,7).forEach((note,i)=>{
        const start=t+(instrument==='guitar'?i*.035:i*.007);
        const voice=ctx.createGain();voice.connect(gain);voice.gain.setValueAtTime(.0001,start);
        voice.gain.exponentialRampToValueAtTime(instrument==='pad'?.13:.23,start+(instrument==='pad'?.13:.018));
        voice.gain.exponentialRampToValueAtTime(.0001,start+length);
        const hz=440*Math.pow(2,(note-69)/12);
        const fundamental=ctx.createOscillator();fundamental.type=instrument==='guitar'?'triangle':'sine';fundamental.frequency.setValueAtTime(hz,start);fundamental.connect(voice);fundamental.start(start);fundamental.stop(start+length+.04);
        const upper=ctx.createOscillator();upper.type='sine';upper.frequency.setValueAtTime(hz*(instrument==='epiano'?3:2),start);const upperGain=ctx.createGain();upperGain.gain.value=instrument==='guitar'?.24:.13;upper.connect(upperGain).connect(voice);upper.start(start);upper.stop(start+length+.04);
      });
      return true;
    }catch(e){return false;}
  }
  window.ChordStageSound={parseChord,play,stop};
})();