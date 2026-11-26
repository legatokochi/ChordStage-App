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
  const MAX_SECTIONS = 60;
  const SECTION_PRESETS = ['Intro','Verse 1','Verse 2','Verse 3','Verse 4','Pre-Chorus','Chorus','Post-Chorus','Bridge','Instrumental','Solo','Interlude','Breakdown','Outro','Ending'];
  const MAX_TOKENS = 24;
  const $ = id => document.getElementById(id);
  let api=null, work=null, editing=null, activeSection=0, activeBar=0, activeToken=-1, busy=false;

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
  function blankBar(){return {lead:'',end:'|',tokens:[],lineBreakBefore:false};}
  function sectionName(raw){return String(raw||'').trim().replace(/[\[\]\r\n:<>]/g,'').slice(0,60).trim()||'Untitled Section';}
  function blankSection(title='Intro'){return {title:sectionName(title),bars:[blankBar()]};}
  function normalize(input){
    if(!input||typeof input!=='object')return null;
    let totalBars=0;
    const normalizeBars=raw=>{
      const bars=[];
      for(const [barIndex,b] of (Array.isArray(raw)?raw:[]).slice(0,MAX_BARS).entries()){
        if(totalBars>=MAX_BARS)break;
        bars.push({
          lineBreakBefore:b?.lineBreakBefore===undefined?(Number(input.version||0)<3&&barIndex>0):Boolean(b.lineBreakBefore),
          lead:b?.lead==='|:'?'|:':'',
          end:['|','||',':|'].includes(b?.end)?b.end:'|',
          tokens:(Array.isArray(b?.tokens)?b.tokens:[]).slice(0,MAX_TOKENS).map(t=>{
            if(t?.type==='chord'&&isChord(t.value))return {type:'chord',value:t.value};
            if(t?.type==='symbol'&&['%','/','—'].includes(t.value))return {type:'symbol',value:t.value};
            return null;
          }).filter(Boolean)
        });
        totalBars++;
      }
      if(!bars.length&&totalBars<MAX_BARS){bars.push(blankBar());totalBars++;}
      return bars;
    };
    const rawSections=Array.isArray(input.sections)?input.sections.slice(0,MAX_SECTIONS):[
      {title:input.section||'Intro',bars:input.bars}
    ];
    const sections=[];
    for(const section of rawSections){
      if(totalBars>=MAX_BARS)break;
      const bars=normalizeBars(section?.bars);
      if(bars.length)sections.push({title:sectionName(section?.title),bars});
    }
    if(!sections.length)sections.push(blankSection());
    return {
      version:3,
      root:KEYS.includes(input.root)?input.root:'C',
      mode:MODES[input.mode]?input.mode:'major',
      timeSignature:SIGNATURES.includes(input.timeSignature)?input.timeSignature:'4/4',
      sections
    };
  }
  function buildChart(composition){
    const c=normalize(composition);
    if(!c)return '';
    const rows=[];
    for(const section of c.sections){
      if(rows.length)rows.push('');
      rows.push(`${section.title}:`);
      let line='';
      for(const [i,bar] of section.bars.entries()){
        const tokens=bar.tokens.map(t=>t.type==='chord'?`[${t.value}]`:t.value).join('  ');
        if(i>0 && bar.lineBreakBefore){rows.push(line.trim());line='';}
        const marker=(i===0||bar.lineBreakBefore||bar.lead)?(bar.lead||'|')+' ':'';
        const chunk=`${marker}${tokens}${tokens?'  ':''}${bar.end}`;
        line+=(line?'  ':'')+chunk;
      }
      if(line.trim())rows.push(line.trim());
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
  function currentSection(){return work?.sections[activeSection];}
  function currentBar(){return currentSection()?.bars[activeBar];}
  function totalBars(){return work.sections.reduce((n,s)=>n+s.bars.length,0);}
  function initializeState(song){
    editing=song||null;
    work=normalize(song?.composition)||normalize({root:song?.key||'C',section:'Intro',timeSignature:song?.timeSignature||'4/4',mode:'major'});
    activeSection=0;activeBar=0;activeToken=-1;
    $('composerHeading').textContent=song?'Edit chord arrangement':'Chord Composer';
    $('composerTitle').value=song?.title||'';
    $('composerArtist').value=song?.artist||'';
    $('composerTempo').value=song?.bpm||90;
    $('composerRoot').value=work.root;
    $('composerScale').value=work.mode;
    $('composerSignature').value=work.timeSignature;
    $('composerSectionType').value='Verse 1';
    $('composerCustomSection').value='';
    updateCustomVisibility();
    $('composerManualBtn').classList.toggle('hidden',!song);
    $('composerSelection').textContent='Intro · Bar 1 selected';
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
    render();
  }
  function updateCustomVisibility(){
    const show=$('composerSectionType').value==='custom';
    $('composerCustomSectionWrap').classList.toggle('hidden',!show);
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
  function renderSections(){
    const host=$('composerSections');const preservedScroll=host.scrollTop;host.replaceChildren();
    work.sections.forEach((section,si)=>{
      const card=document.createElement('section');card.className='composer-section-card'+(si===activeSection?' selected':'');
      card.setAttribute('aria-label',section.title);
      const top=document.createElement('div');top.className='composer-section-heading';
      const select=buttonEl(section.title,'composer-section-select',()=>chooseSection(si));
      select.setAttribute('aria-label',`Select ${section.title}`);
      const buttons=document.createElement('div');buttons.className='composer-section-actions';
      buttons.append(buttonEl('✎','composer-section-tool',()=>renameSection(si)));
      const up=buttonEl('↑','composer-section-tool',()=>moveSection(si,-1));up.disabled=si===0;up.title='Move section up';
      const down=buttonEl('↓','composer-section-tool',()=>moveSection(si,1));down.disabled=si===work.sections.length-1;down.title='Move section down';
      const remove=buttonEl('×','composer-section-tool danger',()=>removeSection(si));remove.title='Remove section';
      buttons.append(up,down,remove);top.append(select,buttons);
      const bars=document.createElement('div');bars.className='composer-bars';
      section.bars.forEach((bar,i)=>{
        const barCard=document.createElement('div');barCard.className='composer-bar'+(activeSection===si&&activeBar===i?' selected':'');
        barCard.setAttribute('role','group');barCard.setAttribute('aria-label',`${section.title}, bar ${i+1}`);
        const heading=document.createElement('div');heading.className='composer-bar-heading';
        heading.append(buttonEl(`BAR ${i+1}`,'composer-bar-select',()=>chooseBar(si,i)),buttonEl('×','composer-remove-bar',()=>removeBar(si,i)));
        const content=document.createElement('div');content.className='composer-bar-tokens';
        content.append(buttonEl(bar.lead||'|','composer-bar-marker',()=>chooseBar(si,i)));
        if(!bar.tokens.length){const empty=document.createElement('span');empty.className='composer-bar-empty';empty.textContent='Tap a chord on the keypad';content.append(empty);}
        bar.tokens.forEach((token,j)=>{
          const chip=buttonEl(token.value,'composer-token'+(si===activeSection&&i===activeBar&&j===activeToken?' active':''),()=>{
            activeSection=si;activeBar=i;activeToken=j;renderSections();
            $('composerSelection').textContent=token.type==='chord'?`Selected ${token.value} in ${section.title}, bar ${i+1} · choose a variation`:`Selected ${token.value}`;
          });
          chip.title='Select chord or symbol to modify/remove';content.append(chip);
        });
        content.append(buttonEl(bar.end,'composer-bar-marker',()=>chooseBar(si,i)));
        content.addEventListener('click',event=>{if(event.target===content)chooseBar(si,i);});
        barCard.append(heading,content);bars.append(barCard);
      });
      card.append(top,bars);host.append(card);
    });
    const n=totalBars();
    $('composerBarCount').textContent=`${work.sections.length} ${work.sections.length===1?'section':'sections'} · ${n} ${n===1?'bar':'bars'}`;
    $('composerChartPreview').textContent=buildChart(work);
    host.scrollTop=preservedScroll;
  }
  function render(){renderKeypad();renderSections();}
  function chooseSection(si){activeSection=si;activeBar=0;activeToken=-1;$('composerSelection').textContent=`${currentSection().title} · Bar 1 selected`;renderSections();}
  function chooseBar(si,i){activeSection=si;activeBar=i;activeToken=-1;$('composerSelection').textContent=`${currentSection().title} · Bar ${i+1} selected`;renderSections();}
  function addSection(){
    if(work.sections.length>=MAX_SECTIONS||totalBars()>=MAX_BARS){notify('Section/bar limit reached');return;}
    const chosen=$('composerSectionType').value;
    const typed=$('composerCustomSection').value.trim();
    if(chosen==='custom'&&!typed){$('composerCustomSection').focus();notify('Type a custom section name');return;}
    const title=sectionName(chosen==='custom'?typed:chosen);
    work.sections.splice(activeSection+1,0,blankSection(title));activeSection++;
    activeBar=0;activeToken=-1;
    $('composerCustomSection').value='';
    $('composerSelection').textContent=`${title} added · tap a chord to start`;
    renderSections();
    hostScrollSelected();
  }
  function hostScrollSelected(){
    const host=$('composerSections');
    const card=host.children[activeSection];
    if(card&&card.offsetTop!==undefined)host.scrollTop=card.offsetTop-host.offsetTop;
  }
  function renameSection(si){
    const current=work.sections[si];if(!current)return;
    const answer=prompt('Section heading:',current.title);
    if(answer===null)return;
    if(!answer.trim()){notify('Section name cannot be empty');return;}
    current.title=sectionName(answer);renderSections();
  }
  function moveSection(si,delta){
    const next=si+delta;if(next<0||next>=work.sections.length)return;
    const [section]=work.sections.splice(si,1);work.sections.splice(next,0,section);
    if(activeSection===si)activeSection=next;
    else if(activeSection===next)activeSection=si;
    renderSections();hostScrollSelected();
  }
  function removeSection(si){
    const section=work.sections[si];if(!section)return;
    const hasTokens=section.bars.some(b=>b.tokens.length);
    if(hasTokens&&!confirm(`Remove ${section.title} and all its chords?`))return;
    if(work.sections.length===1){work.sections[0]=blankSection('Intro');activeSection=0;}
    else{work.sections.splice(si,1);if(activeSection>si)activeSection--;else if(activeSection===si)activeSection=Math.min(si,work.sections.length-1);}
    activeBar=Math.min(activeBar,currentSection().bars.length-1);activeToken=-1;
    renderSections();
  }
  function addToken(type,value){
    const bar=currentBar();if(!bar)return;
    if(bar.tokens.length>=MAX_TOKENS){notify('This bar has reached its chord/symbol limit');return;}
    if(bar.tokens.length===1&&bar.tokens[0].value==='%')bar.tokens=[];
    bar.tokens.push({type,value});activeToken=bar.tokens.length-1;
    $('composerSelection').textContent=`Added ${value} to ${currentSection().title}, bar ${activeBar+1}`;
    renderSections();
  }
  function newBar(){
    if(totalBars()>=MAX_BARS){notify('Maximum of 256 bars per arrangement');return false;}
    const bars=currentSection()?.bars;if(!bars)return false;
    bars.splice(activeBar+1,0,blankBar());activeBar+=1;activeToken=-1;
    $('composerSelection').textContent=`${currentSection().title} · Bar ${activeBar+1} selected`;
    renderSections();return true;
  }
  function removeBar(si,i){
    const bars=work.sections[si].bars;
    if(bars.length===1){bars[0]=blankBar();activeSection=si;activeBar=0;}
    else{bars.splice(i,1);if(activeSection===si)activeBar=Math.min(activeBar,bars.length-1);}
    activeToken=-1;renderSections();
  }
  function removeToken(){const bar=currentBar();if(!bar||activeToken<0||activeToken>=bar.tokens.length){notify('Select a chord or symbol first');return;}bar.tokens.splice(activeToken,1);activeToken=-1;renderSections();}
  function applyQuality(quality){
    const t=currentBar()?.tokens[activeToken];
    if(!t||t.type!=='chord'){notify('Tap an inserted chord in the bar before choosing a variation');return;}
    const changed=changeQuality(t.value,quality);
    if(!isChord(changed)){notify('This variation is not supported');return;}
    t.value=changed;$('composerSelection').textContent=`Changed chord to ${t.value}`;renderSections();
  }
  function symbolAction(s){
    const bar=currentBar();if(!bar)return;
    if(s==='|')return void newBar();
    if(s==='||'){bar.end='||';newBar();return;}
    if(s==='|:'){bar.lead='|:';renderSections();return;}
    if(s===':|'){bar.end=':|';newBar();return;}
    if(s==='%'){bar.tokens=[{type:'symbol',value:'%'}];activeToken=0;renderSections();return;}
    if(s==='/'||s==='—')addToken('symbol',s);
  }
  async function save(event){
    event.preventDefault();if(busy)return;
    const title=$('composerTitle').value.trim();
    if(!title){$('composerTitle').focus();notify('Please enter a song name');return;}
    const bpm=Math.round(Number($('composerTempo').value));
    if(!Number.isFinite(bpm)||bpm<30||bpm>300){$('composerTempo').focus();notify('Tempo must be between 30 and 300 BPM');return;}
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
    ['composerRoot','composerScale','composerSignature'].forEach(id=>$(id).addEventListener('change',updateStateFromForm));
    $('composerSectionType').addEventListener('change',updateCustomVisibility);
    $('composerAddSection').addEventListener('click',addSection);
    $('composerCustomSection').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSection();}});
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