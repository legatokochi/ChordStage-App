/* ChordStage structured chord chart renderer.
   Composer arrangements are musical bars, not chord-over-lyrics text.
   Uses DOM textContent so custom headings and chord names are not treated as markup. */
'use strict';
(() => {
  function groupLines(input) {
    const normalize=window.ChordStageComposer?.normalize;
    const c=typeof normalize==='function'?normalize(input):input;
    if(!c||!Array.isArray(c.sections))return [];
    return c.sections.map(section=>{
      const lines=[[]];
      (Array.isArray(section.bars)?section.bars:[]).forEach((bar,i)=>{
        if(i>0&&bar.lineBreakBefore)lines.push([]);
        lines[lines.length-1].push(bar);
      });
      return {title:String(section.title||'Section'),lines:lines.filter(x=>x.length)};
    });
  }
  function node(tag,cls,text){
    const el=document.createElement(tag);
    el.className=cls;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function render(host,composition,transpose){
    const sections=groupLines(composition);
    host.replaceChildren();
    if(!sections.length)return false;
    for(const section of sections){
      const heading=node('div','chart-section-heading',section.title);
      host.append(heading);
      for(const line of section.lines){
        const row=node('div','notation-line');
        for(const [i,bar] of line.entries()){
          const barEl=node('span','notation-bar');
          if(i===0||bar.lead)barEl.append(node('span','notation-marker',bar.lead||'|'));
          for(const token of (bar.tokens||[])){
            const chord=token.type==='chord';
            barEl.append(node('span',chord?'notation-chord':'notation-symbol',chord?transpose(token.value):token.value));
          }
          barEl.append(node('span','notation-marker',bar.end||'|'));
          row.append(barEl);
        }
        host.append(row);
      }
    }
    return true;
  }
  window.ChordStageNotation={groupLines,render};
})();