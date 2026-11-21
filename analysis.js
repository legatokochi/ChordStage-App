/* Experimental browser-side triad estimator. Not a substitute for human listening.
   Inputs are decoded entirely on-device; nothing is uploaded. No N.C. labels are emitted. */
'use strict';
(() => {
  const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FFT_SIZE=8192;
  const hann=Float64Array.from({length:FFT_SIZE},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FFT_SIZE-1)));
  const swaps=[];for(let i=0;i<FFT_SIZE;i++){let j=0;for(let x=i,b=0;b<13;b++,x>>=1)j=(j<<1)|(x&1);if(j>i)swaps.push([i,j]);}
  const stages=[];for(let len=2;len<=FFT_SIZE;len*=2){const wr=new Float64Array(len/2),wi=new Float64Array(len/2);for(let k=0;k<len/2;k++){const angle=-2*Math.PI*k/len;wr[k]=Math.cos(angle);wi[k]=Math.sin(angle);}stages.push({len,wr,wi});}
  function fft(real,imag){for(const [i,j] of swaps){let t=real[i];real[i]=real[j];real[j]=t;}
    for(const stage of stages){const {len,wr,wi}=stage,half=len/2;for(let i=0;i<FFT_SIZE;i+=len){for(let k=0;k<half;k++){const a=i+k,b=a+half,rr=real[b]*wr[k]-imag[b]*wi[k],ii=real[b]*wi[k]+imag[b]*wr[k];real[b]=real[a]-rr;imag[b]=imag[a]-ii;real[a]+=rr;imag[a]+=ii;}}}
  }
  const norm=(a)=>{const sum=a.reduce((s,x)=>s+x,0)||1;return a.map(x=>x/sum);};
  function evaluateFrame(buffer,center){const {sampleRate,numberOfChannels,length}=buffer;const channels=Math.min(2,numberOfChannels),channelData=Array.from({length:channels},(_,i)=>buffer.getChannelData(i)),real=new Float64Array(FFT_SIZE),imag=new Float64Array(FFT_SIZE);let rms=0;const start=Math.floor(center*sampleRate)-FFT_SIZE/2;
    for(let i=0;i<FFT_SIZE;i++){const idx=Math.max(0,Math.min(length-1,Math.floor(start+i)));let s=0;for(let ch=0;ch<channels;ch++)s+=channelData[ch][idx]/channels;real[i]=s*hann[i];rms+=s*s;}
    rms=Math.sqrt(rms/FFT_SIZE);if(rms<.00045)return {t:center,rms,chord:null,score:0};fft(real,imag);
    const mid=new Float64Array(12),bass=new Float64Array(12);let total=0;
    const maxBin=Math.min(FFT_SIZE/2-2,Math.floor(1000*FFT_SIZE/sampleRate));
    for(let k=Math.max(2,Math.floor(65*FFT_SIZE/sampleRate));k<maxBin;k++){
      const p=Math.hypot(real[k],imag[k]);if(p<Math.hypot(real[k-1],imag[k-1])||p<Math.hypot(real[k+1],imag[k+1]))continue;
      const f=k*sampleRate/FFT_SIZE;const midi=69+12*Math.log2(f/440),nearest=Math.round(midi);
      if(Math.abs(midi-nearest)>.43)continue;
      const pitch=((nearest%12)+12)%12;
      const energy=Math.sqrt(p)*Math.pow(Math.max(100,f)/200,-.35);
      if(f<270)bass[pitch]+=energy;if(f>=130)mid[pitch]+=energy*(f>580?.6:1);total+=energy;
    }
    if(total<1)return {t:center,rms,chord:null,score:0};
    const m=norm(mid),b=norm(bass);let best=-Infinity,second=-Infinity,winner=null;
    for(let root=0;root<12;root++)for(const minor of [false,true]){
      const third=(root+(minor?3:4))%12,fifth=(root+7)%12;
      const score=2.0*m[root]+2.15*m[third]+1.2*m[fifth]+1.35*b[root]+.18*b[fifth]-.17*m[(root+1)%12]-.17*m[(root+6)%12];
      if(score>best){second=best;best=score;winner=NOTES[root]+(minor?'m':'');}else if(score>second)second=score;
    }
    return {t:center,rms,chord:winner,score:best,margin:best-second};
  }
  function smoothFrames(frames){if(!frames.length)return[];const loud=[...frames.map(f=>f.rms)].sort((a,b)=>a-b);const reference=loud[Math.floor(loud.length*.75)]||.003;const threshold=Math.max(.0005,reference*.09);
    const usable=frames.map(f=>({...f,chord:f.rms<threshold?null:f.chord}));
    // Five-frame majority voting reduces fast, isolated solo-note guesses.
    const voted=usable.map((f,i)=>{if(!f.chord)return {...f};const votes=new Map();for(let j=Math.max(0,i-2);j<=Math.min(usable.length-1,i+2);j++){const x=usable[j];if(x.chord)votes.set(x.chord,(votes.get(x.chord)||0)+(j===i?1.8:1));}const chord=[...votes].sort((a,b)=>b[1]-a[1])[0]?.[0]||f.chord;return {...f,chord};});
    // Require stability before marking chord changes; hold the preceding chord on unclear frames.
    const minStable=2;let active=null,considered=null,count=0,activeSince=0;const cues=[];
    for(const f of voted){if(!f.chord)continue;if(!active){if(considered===f.chord)count++;else{considered=f.chord;count=1;activeSince=f.t;}if(count>=minStable){active=f.chord;cues.push({t:Math.max(0,+(activeSince-.15).toFixed(2)),chord:active});count=0;considered=null;}continue;}
      if(f.chord===active){considered=null;count=0;continue;}
      if(f.chord===considered)count++;else{considered=f.chord;count=1;activeSince=f.t;}
      if(count>=Math.max(2,Math.round(1.15/(voted[1]?.t-voted[0]?.t||.6)))){const t=Math.max(0,+(activeSince-.15).toFixed(2));if(t-cues[cues.length-1].t>=.85){cues.push({t,chord:considered});active=considered;}considered=null;count=0;}
    }
    return cues;
  }
  async function analyze(url,onProgress=()=>{}){
    const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error('Web Audio is not supported on this browser');
    const response=await fetch(url);if(!response.ok)throw new Error('Could not open the attached audio');const data=await response.arrayBuffer();const context=new AudioContext();let buffer;
    try{buffer=await context.decodeAudioData(data);}finally{await context.close().catch(()=>{});}
    if(!buffer||!buffer.length)throw new Error('Audio is empty or unsupported');
    const duration=buffer.duration;const limit=Math.min(duration,12*60);const interval=Math.max(.55,limit/650);const frames=[];
    for(let time=.2,i=0;time<limit;time+=interval,i++){
      frames.push(evaluateFrame(buffer,time));
      if(i%9===0){onProgress(Math.min(1,time/limit));await new Promise(resolve=>setTimeout(resolve,0));}
    }
    onProgress(1);return {duration,cues:smoothFrames(frames),framesAnalyzed:frames.length,truncated:duration>limit};
  }
  window.ChordStageAnalyzer={analyze};
})();