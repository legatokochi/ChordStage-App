/* ChordStage Chord Composer — structured offline bar editor.
 * No frameworks or network requests. A chart is generated for existing Stage View.
 */
'use strict';
(() => {
  const KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B','C#','D#','Gb','G#','A#'];
  const LETTERS = ['C','D','E','F','G','A','B'];
  const NATURAL_PITCH = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const MODES = {
    major: { label:'Major', steps:[0,2,4,5,7,9,11], qualities:['','m','m','','','m','dim'], degrees:['I','ii','iii','IV','V','vi','vii°'] },
    minor: { label:'Natural minor', steps:[0,2,3,5,7,8,10], qualities:['m','dim','','m','m','',''], degrees:['i','ii°','III','iv','v','VI','VII'] },
    harmonic: { label:'Harmonic minor', steps:[0,2,3,5,7,8,11], qualities:['m','dim','aug','m','','','dim'], degrees:['i','ii°','III+','iv','V','VI','vii°'] },
    melodic: { label:'Melodic minor (ascending)', steps:[0,2,3,5,7,9,11], qualities:['m','m','aug','','','dim','dim'], degrees:['i','ii','III+','IV','V','vi°','vii°'] }
  };
  const SIGNATURES = ['2/4','3/4','4/4','5/4','6/8','7/8','9/8','12/8'];
  const MAX_BARS = 256;
  const MAX_TOKENS = 24;
  const $ = id => document.getElementById(id);
  let api=null, work=null, editing=null, activeBar=0, activeToken=-1, busy=false;

  const mod12 = n => ((n%12)+12)%12;
  function chordInScale(root,mode='major') {
    const tonic = /^([A-G])([#b]?)$/.exec(root);
    if(!tonic || !MODES[mode]) return [];
    const base = NATURAL_PITCH[tonic[1]] + (tonic[2]==='#'?1:tonic[2]==='b'?-1:0);
    const letterStart = LETTERS.indexOf(tonic[1]);
    return MODES[mode].steps.map((interval,i) => {
      const letter = LETTERS[(letterStart+i)%7];
      const pitch = mod12(base + interval);
      const natural = NATURAL_PITCH[letter];
      let diff = mod12(pitch-natural);
      if(diff>6) diff-=12;
      const accidental = diff===-2?'bb':diff===-1?'b':diff===1?'#':diff===2?'##':'';
      return {degree:MODES[mode].degrees[i], chord:letter+accidental+MODES[mode].qualities[i]};
    });
  }
  function isChord(raw) {
    return typeof raw==='string' && raw.length<=30 && /^[A-G](?:#{1,2}|b{1,2})?[A-Za-z0-9#b()\/+°Δø+\-]*$/.test(raw);
  }
  function blankBar(){return {lead:'',end:'|',tokens:[]};}
  function normalize(input){
    if(!input||typeof input!=='object') return null;
    const bars = Array.isArray(input.bars) ? input.bars.slice(0,MAX_BARS).map(b=>({
      lead:b?.lead==='|:'?'|:':'',
      end:['|','||',':|'].includes(b?.end)?b.end:'|',
      tokens:(Array.isArray(b?.tokens)?b.tokens:[]).slice(0,MAX_TOKENS).map(t=>{
        if(t?.type==='chord' && isChord(t.value)) return {type:'chord',value:t.value};
        if(t?.type==='symbol' && ['%','/','—'].includes(t.value))return {type:'symbol',value:t.value};
        return null;
      }).filter(Boolean)
    })) : [];
    return {
      version:1,
      root:KEYS.includes(input.root)?input.root:'C',
      mode:MODES[input.mode]?input.mode:'major',
      timeSignature:SIGNATURES.includes(input.timeSignature)?input.timeSignature:'4/4',
      section:String(input.section||'Intro').trim().slice(0,60).replace(/[\[\]\r\n]/g,'')||'Intro',
      bars:bars.length?bars:[blankBar()]
    };
  }
  function buildChart(composition){
    const c=normalize(composition);
    if(!c)return '';
    const rows=[`${c.section}:`];
    for(const bar of c.bars){
      const tokens=bar.tokens.map(t=>t.type==='chord'?`[${t.value}]`:`${t.value}`).join('  ');
      rows.push(`${bar.lead||'|'} ${tokens}${tokens?'  ':''}${bar.end}`);
    }
    return rows.join('\n');
  }
  function changeQuality(chord,quality) {
    const match=/^([A-G](?:#{1,2}|b{1,2})?)(.*)$/.exec(chord);
    if(!match) return chord;
    const root=match[1], old=match[2];
    if(quality==='reset')return root;
    if(quality==='add9')return root+(/^m(?!aj)/.test(old)?'m':'')+'add9';
    if(quality==='maj7')return root+(/^m(?!aj)/.test(old)?'m(maj7)':'maj7');
    if(quality==='m')return root+'m';
    if(quality==='M')return root;
    const suffix={aug:'aug',dim:'dim','7':'7',m7:'m7',sus2:'sus2',sus4:'sus4','6':'6','9':'9','13':'13'}[quality];
    return suffix===undefined?chord:root+suffix;
  }
  function notify(message){if(api?.toast)api.toast(message);}
  function initializeState(song){
    editing=song||null;
    work=normalize(song?.composition)||normalize({root:song?.key||'C',section:'Intro',timeSignature:song?.timeSignature||'4/4',mode:'major'});
    activeBar=0;activeToken=-1;
    $('composerHeading').textContent=song?'Edit chord arrangement':'Chord Composer';
    $('composerTitle').value=song?.title||'';
    $('composerArtist').value=song?.artist||'';
    $('composerTempo').value=song?.bpm||90;
    $('composerRoot').value=work.root;
    $('composerScale').value=work.mode;
    $('composerSignature').value=work.timeSignature;
    $('composerSection').value=work.section;
    $('composerManualBtn').classList.toggle('hidden',!song);
    render();
  }
  function open(song=null){
    if(!api)throw new Error('Chord Composer is not initialized');
    initializeState(song);
    $('composerDialog').showModal();
  }
  function updateStateFromForm(){
    work.root=$('composerRoot').value;
    work.mode=$('composerScale').value;
    work.timeSignature=$('composerSignature').value;
    work.section=$('composerSection').value.slice(0,60);
    render();
  }
  function renderKeypad(){
    const pad=$('composerScaleChords');pad.replaceChildren();
    for(const {degree,chord} of chordInScale(work.root,work.mode)){
      const button=document.createElement('button');button.type='button';button.className='composer-chord-key';
      const name=document.createElement('strong');name.textContent=chord;
      const sub=document.createElement('span');sub.textContent=degree;
      button.append(name,sub);button.setAttribute('aria-label',`Insert ${chord}, scale degree ${degree}`);
      button.addEventListener('click',()=>addToken('chord',chord));pad.append(button);
    }
    $('composerScaleHint').textContent=`${work.root} ${MODES[work.mode].label} · diatonic triads (tap to insert)`;
  }
  function buttonEl(label,cls,onClick){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',onClick);return b;}
  function renderBars(){
    const host=$('composerBars');host.replaceChildren();
    work.bars.forEach((bar,i)=>{
      const card=document.createElement('div');card.className='composer-bar'+(activeBar===i?' selected':'');card.tabIndex=0;
      card.setAttribute('role','group');card.setAttribute('aria-label',`Bar ${i+1}`);
      const heading=document.createElement('div');heading.className='composer-bar-heading';
      heading.append(buttonEl(`BAR ${i+1}`,'composer-bar-select',()=>chooseBar(i)),buttonEl('×','composer-remove-bar',()=>removeBar(i)));
      const content=document.createElement('div');content.className='composer-bar-tokens';
      content.append(buttonEl(bar.lead||'|','composer-bar-marker',()=>chooseBar(i)));
      if(!bar.tokens.length){const empty=document.createElement('span');empty.className='composer-bar-empty';empty.textContent='Tap a chord below';content.append(empty);}
      bar.tokens.forEach((token,j)=>{
        const chip=buttonEl(token.value,'composer-token'+(i===activeBar&&j===activeToken?' active':''),()=>{
          activeBar=i;activeToken=j;renderBars();
          $('composerSelection').textContent=token.type==='chord'?`Selected ${token.value} · choose a variation`:`Selected ${token.value}`;
        });
        chip.title='Select token for modification or removal';content.append(chip);
      });
      content.append(buttonEl(bar.end,'composer-bar-marker',()=>chooseBar(i)));
      content.addEventListener('click',event=>{if(event.target===content)chooseBar(i);});
      card.append(heading,content);host.append(card);
    });
    $('composerBarCount').textContent=`${work.bars.length} ${work.bars.length===1?'bar':'bars'}`;
    $('composerChartPreview').textContent=buildChart(work);
  }
  function render(){renderKeypad();renderBars();}
  function chooseBar(i){activeBar=i;activeToken=-1;$('composerSelection').textContent=`Bar ${i+1} selected`;renderBars();}
  function addToken(type,value){
    const bar=work.bars[activeBar];if(!bar)return;
    if(bar.tokens.length>=MAX_TOKENS){notify('This bar has reached its chord/symbol limit');return;}
    if(bar.tokens.length===1&&bar.tokens[0].value==='%')bar.tokens=[];
    bar.tokens.push({type,value});activeToken=bar.tokens.length-1;
    $('composerSelection').textContent=`Added ${value} to bar ${activeBar+1}`;
    renderBars();
  }
  function newBar(){if(work.bars.length>=MAX_BARS){notify('Maximum of 256 bars per arrangement');return false;}work.bars.splice(activeBar+1,0,blankBar());activeBar+=1;activeToken=-1;renderBars();return true;}
  function removeBar(i){
    if(work.bars.length===1){work.bars[0]=blankBar();activeBar=0;}else{work.bars.splice(i,1);activeBar=Math.min(activeBar,work.bars.length-1);}
    activeToken=-1;renderBars();
  }
  function removeToken(){const bar=work.bars[activeBar];if(!bar||activeToken<0||activeToken>=bar.tokens.length){notify('Select a chord or symbol first');return;}bar.tokens.splice(activeToken,1);activeToken=-1;renderBars();}
  function applyQuality(quality){
    const t=work.bars[activeBar]?.tokens[activeToken];
    if(!t||t.type!=='chord'){notify('Tap an inserted chord in the bar before choosing a variation');return;}
    t.value=changeQuality(t.value,quality);
    if(!isChord(t.value)){notify('This variation is not supported');return;}
    $('composerSelection').textContent=`Changed chord to ${t.value}`;renderBars();
  }
  function symbolAction(s){
    const bar=work.bars[activeBar];if(!bar)return;
    if(s==='|')return void newBar();
    if(s==='||'){bar.end='||';newBar();return;}
    if(s==='|:'){bar.lead='|:';renderBars();return;}
    if(s===':|'){bar.end=':|';newBar();return;}
    if(s==='%'){bar.tokens=[{type:'symbol',value:'%'}];activeToken=0;renderBars();return;}
    if(s==='/'||s==='—')addToken('symbol',s);
  }
  async function save(event){
    event.preventDefault();if(busy)return;
    const title=$('composerTitle').value.trim();
    if(!title){$('composerTitle').focus();notify('Please enter a song name');return;}
    const bpm=Math.round(Number($('composerTempo').value));
    if(!Number.isFinite(bpm)||bpm<30||bpm>300){$('composerTempo').focus();notify('Tempo must be between 30 and 300 BPM');return;}
    work.section=$('composerSection').value;
    const composition=normalize(work);
    const song={id:editing?.id||api.uid(),title:title.slice(0,140),artist:$('composerArtist').value.trim().slice(0,140),key:composition.root,bpm,timeSignature:composition.timeSignature,composition,chart:buildChart(composition),cues:editing?.cues||[],updatedAt:Date.now()};
    busy=true;$('composerSaveBtn').disabled=true;
    try{await api.saveSong(song);$('composerDialog').close();api.onSaved(song);notify(editing?'Arrangement updated':'Chord arrangement saved to library');}
    catch(error){notify('Could not save: '+error.message);}
    finally{busy=false;$('composerSaveBtn').disabled=false;}
  }
  function init(config){
    api=config;
    KEYS.forEach(key=>$('composerRoot').add(new Option(key,key)));
    Object.keys(MODES).forEach(key=>$('composerScale').add(new Option(MODES[key].label,key)));
    SIGNATURES.forEach(sig=>$('composerSignature').add(new Option(sig,sig)));
    $('composerForm').addEventListener('submit',save);
    $('composerCancelBtn').addEventListener('click',()=>$('composerDialog').close());
    $('composerCloseBtn').addEventListener('click',()=>$('composerDialog').close());
    ['composerRoot','composerScale','composerSignature','composerSection'].forEach(id=>$(id).addEventListener('change',updateStateFromForm));
    const qualities=[['Major','M'],['Minor','m'],['7','7'],['m7','m7'],['Major 7','maj7'],['Add9','add9'],['Aug','aug'],['Dim','dim'],['Sus2','sus2'],['Sus4','sus4'],['6','6'],['9','9'],['13','13'],['Reset','reset']];
    const qpad=$('composerQualities');for(const [label,value] of qualities)qpad.append(buttonEl(label,'composer-utility-key',()=>applyQuality(value)));
    for(const sign of ['|','||','|:',':|','%','/','—'])$('composerSymbols').append(buttonEl(sign,'composer-utility-key composer-symbol-key',()=>symbolAction(sign)));
    $('composerCustomBtn').addEventListener('click',()=>{
      const raw=$('composerCustomChord').value.trim();
      if(!isChord(raw)){notify('Enter a chord such as Bbmaj7, F#m7, C#7 or E7(b9)');return;}
      addToken('chord',raw);$('composerCustomChord').value='';
    });
    $('composerCustomChord').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('composerCustomBtn').click();}});
    $('composerAddBar').addEventListener('click',newBar);
    $('composerRemoveToken').addEventListener('click',removeToken);
    $('composerManualBtn').addEventListener('click',()=>{if(!editing)return;$('composerDialog').close();api.openTextEditor();});
  }
  window.ChordStageComposer={init,open,normalize,buildChart,chordInScale,changeQuality,isChord};
})();