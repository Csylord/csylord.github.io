'use strict';

// ─── Utilities ───────────────────────────────────────────────────────────────
const p2=n=>String(n).padStart(2,'0');
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;};
const parseDate=s=>new Date(s+'T00:00:00');
const addDays=(s,n)=>{const d=parseDate(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;};
const diffDays=(a,b)=>Math.round((parseDate(b)-parseDate(a))/86400000);
const fmtShort=s=>{if(!s)return'';const d=parseDate(s);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
const fmtFull=s=>{if(!s)return'';const d=parseDate(s);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
const isoDate=(y,m,d)=>`${y}-${p2(m+1)}-${p2(d)}`;
const daysInMonth=(y,m)=>new Date(y,m+1,0).getDate();
const firstDOW=(y,m)=>new Date(y,m,1).getDay();
const stdDev=arr=>{if(arr.length<2)return 0;const m=arr.reduce((a,b)=>a+b,0)/arr.length;return Math.sqrt(arr.map(x=>(x-m)**2).reduce((a,b)=>a+b,0)/arr.length);};

// ─── Storage ─────────────────────────────────────────────────────────────────
const load=(k,fb)=>{try{const r=localStorage.getItem('bloom_'+k);return r?JSON.parse(r):fb;}catch{return fb;}};
const save=(k,v)=>{try{localStorage.setItem('bloom_'+k,JSON.stringify(v));}catch{}};

// ─── Prediction Engine ───────────────────────────────────────────────────────
function buildPredictions(periods,settings){
  const sorted=[...periods].sort((a,b)=>a.start.localeCompare(b.start));
  if(!sorted.length)return null;
  const last=sorted[sorted.length-1];
  const gaps=[];
  for(let i=1;i<sorted.length;i++)gaps.push(diffDays(sorted[i-1].start,sorted[i].start));
  let avgCycle=settings.cycleLength;
  if(gaps.length>=1){const w=gaps.map((_,i)=>i+1),ws=w.reduce((a,b)=>a+b,0);avgCycle=Math.round(gaps.reduce((s,g,i)=>s+g*w[i],0)/ws);}
  const avgPeriod=(()=>{const l=sorted.map(p=>diffDays(p.start,p.end)+1).filter(x=>x>0&&x<15);return l.length?Math.round(l.reduce((a,b)=>a+b,0)/l.length):settings.periodLength;})();
  const cycleStd=stdDev(gaps);
  const regularity=gaps.length>=2?Math.max(0,Math.round(100-cycleStd*8)):null;
  const confidence=gaps.length>=3?(cycleStd<3?'high':cycleStd<6?'medium':'low'):'low';
  const nextStart=addDays(last.start,avgCycle);
  const nextEnd=addDays(nextStart,avgPeriod-1);
  const ovulation=addDays(nextStart,-14);
  const fertileStart=addDays(ovulation,-5);
  const fertileEnd=addDays(ovulation,1);
  const pmsStart=addDays(nextStart,-7);
  const today=todayStr();
  const cycleDay=diffDays(last.start,today)+1;
  const daysLeft=diffDays(today,nextStart);
  const isLate=cycleDay>avgCycle+Math.max(3,cycleStd);
  const phase=cycleDay>=1&&cycleDay<=avgPeriod?'menstrual':today>=fertileStart&&today<=fertileEnd?'fertile':today===ovulation?'ovulation':today>=pmsStart&&today<nextStart?'pms':cycleDay<=avgCycle/2?'follicular':'luteal';
  const fertilityMap={};
  for(let i=-5;i<=1;i++){const d=addDays(ovulation,i);fertilityMap[d]=i===-1||i===0?95:i===-2||i===1?75:i===-3?50:i===-4?30:15;}
  return{avgCycle,avgPeriod,cycleStd,regularity,confidence,nextStart,nextEnd,ovulation,fertileStart,fertileEnd,pmsStart,cycleDay,daysLeft,isLate,phase,lastStart:last.start,fertilityMap,totalCycles:sorted.length,gaps};
}

// ─── Contraception Profiles ──────────────────────────────────────────────────
const CONTRA={
  None:{suppressesOvulation:false,mayIrregulate:false,hormonal:false,note:null},
  Pill:{suppressesOvulation:true,mayIrregulate:false,hormonal:true,note:'The combined pill suppresses ovulation. Fertility predictions are not applicable. Withdrawal bleeds are not true periods.',lateNote:'A missed withdrawal bleed on the pill should be discussed with your doctor or pharmacist.'},
  IUD:{suppressesOvulation:false,mayIrregulate:true,hormonal:true,note:'Hormonal IUDs can lighten or stop periods entirely. Copper IUDs are non-hormonal and may make periods heavier.',lateNote:'Absent periods with a hormonal IUD are usually normal, but take a pregnancy test if concerned.'},
  Implant:{suppressesOvulation:true,mayIrregulate:true,hormonal:true,note:'The implant suppresses ovulation and often stops periods. Irregular spotting is common in the first year.',lateNote:'Missed periods on the implant are expected and usually not a concern.'},
  Patch:{suppressesOvulation:true,mayIrregulate:false,hormonal:true,note:'The patch works like the combined pill and suppresses ovulation. Fertility tracking is not applicable.',lateNote:'A missed bleed on the patch should be discussed with your doctor.'},
  Condoms:{suppressesOvulation:false,mayIrregulate:false,hormonal:false,note:'Condoms are non-hormonal and do not affect your cycle. All predictions apply normally.'},
  Other:{suppressesOvulation:false,mayIrregulate:true,hormonal:false,note:'Some methods may affect your cycle. Check with your doctor about how your method impacts predictions.'},
};

// ─── Health Engine ───────────────────────────────────────────────────────────
function analyzeHealth(periods,logs,pred,settings){
  const alerts=[],insights=[];
  const sorted=[...periods].sort((a,b)=>a.start.localeCompare(b.start));
  const today=todayStr();
  const contra=settings.contraception||'None';
  const cp=CONTRA[contra]||CONTRA.None;
  const gaps=pred?.gaps||[];
  if(cp.note)insights.push({id:'contra_note',title:contra+' — What to Expect',body:cp.note,warn:false});
  if(pred?.isLate){
    const dl=pred.cycleDay-pred.avgCycle;
    if(cp.mayIrregulate||cp.suppressesOvulation)insights.push({id:'late',title:'Missed Period',body:cp.lateNote||`You have not had a period in ${pred.cycleDay} days. With your contraceptive method this can be normal, but speak with your doctor if concerned.`,warn:false});
    else alerts.push({id:'late',warn:true,title:`Period is ${dl} Day${dl>1?'s':''} Late`,body:'Your period is overdue based on your average cycle. Stress, illness, weight changes, or travel can cause delays. If it has been over 7 days, consider a pregnancy test or speak with your doctor.'});
  }
  if(gaps.length>=3&&!cp.mayIrregulate){
    const l3=gaps.slice(-3);
    if(l3.every(g=>g<21))alerts.push({id:'short',warn:true,title:'Consistently Short Cycles',body:'Your last 3 cycles were under 21 days. Short cycles can be linked to thyroid issues, low ovarian reserve, or hormonal imbalances. Worth mentioning to your doctor.'});
    else if(l3.every(g=>g>35))alerts.push({id:'long',warn:true,title:'Consistently Long Cycles',body:'Your last 3 cycles exceeded 35 days. This may indicate PCOS, thyroid conditions, or elevated stress hormones. A doctor can help identify the cause.'});
    else if(pred.cycleStd>7)alerts.push({id:'irregular',warn:false,title:'Irregular Cycle Pattern',body:`Your cycle varies by ±${Math.round(pred.cycleStd)} days. Some variation is normal but high variability may be worth discussing with your doctor.`});
  }
  if(cp.suppressesOvulation)insights.push({id:'no_ov',title:'Fertility Tracking Paused',body:`Because the ${contra} suppresses ovulation, ovulation dates and fertility window predictions are not shown. Full tracking resumes automatically if you stop using it.`,warn:false});
  const allLogs=Object.entries(logs);
  const recent=allLogs.filter(([d])=>{const diff=diffDays(d,today);return diff>=0&&diff<=60;});
  const sf={};recent.forEach(([,l])=>(l.symptoms||[]).forEach(s=>sf[s]=(sf[s]||0)+1));
  const mf={};recent.forEach(([,l])=>(l.mood||[]).forEach(m=>mf[m]=(mf[m]||0)+1));
  if((sf.cramps||0)>=8)alerts.push({id:'cramps',warn:cp.hormonal,title:'Frequent Cramping',body:cp.hormonal?'You have logged frequent cramps. While hormonal contraception can reduce cramping, persistent pain may indicate endometriosis, fibroids, or adenomyosis.':'You have logged cramps on 8 or more days in the last 60 days. Persistent cramping could indicate endometriosis or fibroids. Consider speaking with a gynaecologist.'});
  if((sf.headache||0)>=10)insights.push({id:'headache',title:'Frequent Headaches',body:cp.hormonal?`Hormonal contraception like the ${contra} can trigger headaches due to oestrogen fluctuations. If headaches are new or worsening, discuss with your doctor.`:'Hormonal headaches often occur just before or during your period due to oestrogen drops.',warn:false});
  const heavyDays=recent.filter(([,l])=>l.flow==='heavy'||l.flow==='very_heavy').length;
  if(heavyDays>=5){
    if(contra==='IUD')alerts.push({id:'heavy',warn:true,title:'Heavy Flow with IUD',body:'Heavy periods are common with the copper IUD, especially in the first 3 to 6 months. If soaking through protection hourly, consult your doctor about iron monitoring.'});
    else if(cp.hormonal)alerts.push({id:'heavy',warn:true,title:'Heavy Flow Despite Hormonal Contraception',body:`Hormonal methods like the ${contra} typically lighten periods. Unexpectedly heavy flow may warrant a review of your contraceptive or a check for underlying causes.`});
    else alerts.push({id:'heavy',warn:true,title:'Frequently Heavy Flow',body:'Consistently heavy periods can cause anaemia and may signal fibroids, polyps, or a clotting disorder. Please discuss with your doctor.'});
  }
  const lowMood=(mf.anxious||0)+(mf.irritable||0)+(mf.sad||0)+(mf.depressed||0);
  if(lowMood>=12)insights.push({id:'mood',title:'Low Mood Pattern',body:cp.hormonal?`Hormonal contraception can affect mood. You have logged anxiety, irritability, or low mood frequently — this may be related to the ${contra}. Speak with your doctor about alternatives if this affects your quality of life.`:'You have logged anxiety, irritability, or sadness frequently. If these moods cluster before your period, it may be PMDD — a recognised condition that responds well to treatment.',warn:false});
  const temps=recent.map(([,l])=>parseFloat(l.temp)).filter(t=>t>35&&t<40);
  if(temps.length>=5){const avg=temps.reduce((a,b)=>a+b,0)/temps.length;if(!cp.suppressesOvulation&&avg<36.1)insights.push({id:'bbt',title:'Low Basal Temperature',body:`Your average BBT is ${avg.toFixed(2)}°C. A consistently low BBT can sometimes indicate hypothyroidism. Track daily for the most insight.`,warn:false});}
  if(sorted.length>=1){
    const spotting=allLogs.filter(([d,l])=>{const inP=sorted.some(p=>d>=p.start&&d<=p.end);return!inP&&(l.flow==='spotting'||l.flow==='light');});
    if(spotting.length>=3){
      if(cp.mayIrregulate)insights.push({id:'spot',title:'Spotting Between Periods',body:`Irregular spotting is common with the ${contra}. If spotting is heavy or painful, consult your doctor.`,warn:false});
      else alerts.push({id:'spot',warn:true,title:'Spotting Between Periods',body:'You have logged spotting outside your period days multiple times. This could be ovulation spotting or may indicate cervical irritation, polyps, or hormonal shifts. Worth a check-up if it continues.'});
    }
  }
  if(pred?.regularity>=85&&!cp.mayIrregulate)insights.push({id:'regular',title:'Very Regular Cycle',body:`Your cycle is highly regular (±${Math.round(pred.cycleStd)} days variation). This is a great sign of hormonal balance.`,warn:false});
  if(sorted.length>=4&&alerts.length===0&&insights.filter(i=>!['contra_note','no_ov'].includes(i.id)).length===0)insights.push({id:'healthy',title:'No Concerns Detected',body:'Based on your logged data, no major anomalies have been detected. Keep logging for more personalised insights.',warn:false});
  return{alerts,insights};
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const ICONS={
  home:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  pen:'M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  chart:'M18 20V10 M12 20V4 M6 20v-6',
  activity:'M22 12h-4l-3 9L9 3l-3 9H2',
  gear:'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  check:'M20 6L9 17l-5-5',
  close:'M18 6L6 18 M6 6l12 12',
  chevL:'M15 18l-6-6 6-6',
  chevR:'M9 18l6-6-6-6',
  moon:'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  sun:'M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41 M12 17a5 5 0 100-10 5 5 0 000 10z',
  download:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  trash:'M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M10 11v6 M14 11v6 M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2',
  drop:'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
  refresh:'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15',
  alert:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  user:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  save:'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8',
  heart:'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  pill:'M10.5 4.5a6 6 0 018.49 8.49l-9 9a6 6 0 01-8.49-8.49l9-9z M12 12L6.5 17.5',
  info:'M12 22a10 10 0 100-20 10 10 0 000 20z M12 8h.01 M12 12v4',
};
function icon(name,size=20,color='currentColor',sw=1.75){
  const paths=(ICONS[name]||'M0 0').split(' M').map((d,i)=>i===0?d:'M'+d);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
}

// ─── Phase Data ───────────────────────────────────────────────────────────────
const PHASES={
  menstrual:{name:'Menstrual',color:'#f472b6',bg:'#fff0f6',desc:'Your uterine lining sheds. Oestrogen and progesterone are at their lowest.',tips:['Heat pad for cramps','Ibuprofen with food','Iron-rich foods help','Stay hydrated'],energy:'Low',libido:'Low–Medium',skin:'May break out'},
  follicular:{name:'Follicular',color:'#a78bfa',bg:'#f5f3ff',desc:'Oestrogen rises as follicles mature. You will feel more energetic and sociable.',tips:['Great time for intense workouts','Tackle creative projects','Lighter meals feel good','Mood will lift'],energy:'Rising',libido:'Increasing',skin:'Glowing'},
  fertile:{name:'Fertile Window',color:'#10b981',bg:'#f0fdf8',desc:'Your most fertile days. Oestrogen peaks and your body is ready for ovulation.',tips:['High chance of conception','Peak physical performance','Great for social plans','Sharp focus and memory'],energy:'High',libido:'High',skin:'Clear and glowing'},
  ovulation:{name:'Ovulation',color:'#059669',bg:'#ecfdf5',desc:'An egg is released. You may feel a surge of confidence and sex drive today.',tips:['Note any BBT spike','You may feel a brief twinge','Peak fertility today','High energy and confidence'],energy:'Peak',libido:'Peak',skin:'Best it will look'},
  pms:{name:'PMS Phase',color:'#fb923c',bg:'#fff8f2',desc:'Progesterone drops as your period approaches. Mood and physical symptoms may appear.',tips:['Magnesium-rich foods help','Gentle yoga over intense exercise','Reduce caffeine and alcohol','Communicate your needs'],energy:'Declining',libido:'Low',skin:'May bloat or break out'},
  luteal:{name:'Luteal Phase',color:'#7c3aed',bg:'#faf5ff',desc:'Progesterone is high. You may feel calmer but tired.',tips:['Prioritise sleep','Snack on nuts and seeds','Moderate exercise is ideal','Good time for reflection'],energy:'Medium',libido:'Medium',skin:'May get oilier'},
};
const SYMPTOMS=['Cramps','Headache','Bloating','Back Pain','Acne','Fatigue','Nausea','Tender Breasts','Dizziness','Insomnia','Hot Flashes','Cravings'];
const MOODS=['Happy','Sad','Anxious','Irritable','Calm','Energetic','Romantic','Sensitive','Low','Confident','Focused','Social'];
const FLOWS=[{id:'spotting',label:'Spotting',color:'#fda4af'},{id:'light',label:'Light',color:'#f472b6'},{id:'medium',label:'Medium',color:'#ec4899'},{id:'heavy',label:'Heavy',color:'#be185d'},{id:'very_heavy',label:'Very Heavy',color:'#881337'}];
const DISCHARGE=['None','Dry','Sticky','Creamy','Watery','Egg White','Unusual'];
const EXERCISE=['Rest','Walk','Yoga','Gym','Run','Swim','Cycling','Other'];
const SLEEP_Q=['Poor','Fair','Good','Great'];
const SEX=['Protected','Unprotected','None'];

// ─── State Manager ────────────────────────────────────────────────────────────
const state={
  tab:'home',
  periods:load('periods',[]),
  logs:load('logs',{}),
  notes:load('notes',{}),
  settings:load('settings',{cycleLength:28,periodLength:5,name:'',contraception:'None',darkMode:false}),
  dismissed:load('dismissed',[]),
};
function setState(patch){Object.assign(state,patch);render();}
function persistAll(){save('periods',state.periods);save('logs',state.logs);save('notes',state.notes);save('settings',state.settings);save('dismissed',state.dismissed);}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function el(tag,attrs={},children=[]){
  const e=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==='class')e.className=v;
    else if(k==='style'&&typeof v==='object')Object.assign(e.style,v);
    else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);
    else e.setAttribute(k,v);
  });
  children.forEach(c=>{if(c==null)return;e.appendChild(typeof c==='string'?document.createTextNode(c):c);});
  return e;
}
function div(cls,children=[],style={}){return el('div',{class:cls,style},children);}
function btn(cls,html,onClick,style={}){const b=el('button',{class:cls,style});b.innerHTML=html;b.addEventListener('click',onClick);return b;}
function span(cls,text,style={}){const s=el('span',{class:cls,style});s.textContent=text;return s;}
function h(level,text,style={}){const e=el('h'+level,{style});e.textContent=text;return e;}
function p(cls,text){const e=el('p',{class:cls});e.textContent=text;return e;}
function cardEl(children=[],extraClass='',accent=''){
  const c=div('card '+extraClass);
  if(accent)c.style.borderTop=`3px solid ${accent}`;
  children.forEach(ch=>{if(ch)c.appendChild(typeof ch==='string'?document.createTextNode(ch):ch);});
  return c;
}
function cardHead(text){const d=div('card-head');d.textContent=text;return d;}
function mutedEl(text){return p('muted',text);}

function sliderEl(opts){
  const{min,max,value,color,onChange,showValue=false,unit=''}=opts;
  const wrap=div('slider-wrap');
  if(showValue){
    const vd=div('slider-val');
    const big=el('span',{class:'big',style:{color}});big.textContent=value;
    const u=el('span',{class:'unit'});u.textContent=unit;
    vd.appendChild(big);vd.appendChild(u);
    wrap.appendChild(vd);
  }
  const inp=el('input',{type:'range',min,max,value});
  const pct=Math.round(((value-min)/(max-min))*100);
  inp.style.background=`linear-gradient(to right,${color} 0%,${color} ${pct}%,var(--border) ${pct}%,var(--border) 100%)`;
  inp.addEventListener('input',e=>{
    const v=+e.target.value,p2=Math.round(((v-min)/(max-min))*100);
    inp.style.background=`linear-gradient(to right,${color} 0%,${color} ${p2}%,var(--border) ${p2}%,var(--border) 100%)`;
    if(showValue){const b=wrap.querySelector('.big');if(b)b.textContent=v;}
    onChange(v);
  });
  wrap.appendChild(inp);
  const mm=div('slider-minmax');mm.innerHTML=`<span>${min}${unit}</span><span>${max}${unit}</span>`;
  wrap.appendChild(mm);
  return wrap;
}

function chipEl(label,active,onClick,activeColor){
  const b=el('button',{class:'chip'+(active?' on':'')});
  b.textContent=label;
  if(active&&activeColor){b.style.background=activeColor;b.style.borderColor=activeColor;b.style.color='#fff';}
  b.addEventListener('click',onClick);
  return b;
}
function selChipEl(label,active,onClick,pinkActive=false){
  const b=el('button',{class:'sel-chip'+(active?(pinkActive?' on-pink':' on'):'')});
  b.textContent=label;b.addEventListener('click',onClick);return b;
}

function tagEl(text,bg,color){
  const t=el('span',{class:'tag'});t.textContent=text;
  if(bg)t.style.background=bg;if(color)t.style.color=color;return t;
}

function inputEl(type,value,onChange,attrs={}){
  const i=el('input',{...attrs,type,class:'input',value:value||''});
  i.addEventListener('input',e=>onChange(e.target.value));
  return i;
}
function textareaEl(value,onChange,placeholder=''){
  const t=el('textarea',{class:'input',placeholder,rows:4});
  t.value=value||'';
  t.addEventListener('input',e=>onChange(e.target.value));
  return t;
}

// ─── Cycle Ring SVG ───────────────────────────────────────────────────────────
function cycleRing(progress,color,day,total){
  const r=36,circ=2*Math.PI*r,dash=circ*(progress/100);
  const wrap=div('ring-wrap');
  wrap.innerHTML=`<svg width="90" height="90" viewBox="0 0 90 90"><circle cx="45" cy="45" r="${r}" fill="none" stroke="rgba(0,0,0,.07)" stroke-width="7"/><circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-dasharray="${dash} ${circ}" stroke-linecap="round" transform="rotate(-90 45 45)" style="transition:stroke-dasharray .8s ease"/></svg><div class="ring-label"><div style="font-size:20px;font-weight:700;color:var(--text)">${day}</div><div style="font-size:10px;color:var(--text-soft)">/${total}</div></div>`;
  return wrap;
}

// ─── Fertility Strip ──────────────────────────────────────────────────────────
function fertilityStrip(pred){
  const today=todayStr();
  const wrap=div('fert-strip');
  for(let i=-5;i<=5;i++){
    const d=addDays(pred.ovulation,i);
    const score=pred.fertilityMap[d]||0;
    const isToday=d===today,isOv=d===pred.ovulation;
    const h=Math.round((score/100)*44)+4;
    const day=div('fert-day');
    const bar=div('fert-bar');
    bar.style.height=h+'px';
    bar.style.background=isOv?'#10b981':score>70?'#34d399':score>30?'#a7f3d0':'var(--border)';
    if(isToday)bar.style.boxShadow='0 0 8px #10b981';
    const lbl=div('fert-lbl');
    lbl.textContent=parseDate(d).getDate();
    lbl.style.color=isToday?'#10b981':'var(--text-soft)';
    if(isToday)lbl.style.fontWeight='700';
    day.appendChild(bar);day.appendChild(lbl);
    if(isOv){const ov=div('fert-ov');ov.textContent='OV';day.appendChild(ov);}
    wrap.appendChild(day);
  }
  return wrap;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function metricCard(label,value,sub,accent,iconName){
  const c=div('metric-card');
  c.style.borderTop=`3px solid ${accent}`;
  c.innerHTML=icon(iconName,16,accent,2);
  const v=div('metric-value');v.textContent=value;v.style.color=accent;
  const l=div('metric-label');l.textContent=label;
  const s=div('metric-sub');s.textContent=sub||'';
  c.appendChild(v);c.appendChild(l);if(sub)c.appendChild(s);
  return c;
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function renderHome(pred,periods,logs,alerts,settings,suppressOv){
  const today=todayStr();
  const todayLog=logs[today]||{};
  const wrap=div('scroll');

  if(!pred){
    const e=div('empty');
    e.innerHTML=`<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#fce7f3,#ede9fe);display:flex;align-items:center;justify-content:center">${icon('heart',36,'#ec4899',1.5)}</div>`;
    const t=el('h2',{style:{color:'var(--text)',fontWeight:'700',fontSize:'22px'}});t.textContent='Welcome, '+settings.name;
    e.appendChild(t);e.appendChild(mutedEl('Log your first period in the Calendar tab, or tap Log to track today.'));
    wrap.appendChild(e);return wrap;
  }

  const ph=PHASES[pred.phase]||PHASES.follicular;

  // Alert banners
  alerts.forEach(a=>{
    const banner=div('alert-banner');
    banner.style.background=a.warn?'#fff5f7':'#f5f3ff';
    banner.style.borderLeft=`4px solid ${a.warn?'#f472b6':'#a78bfa'}`;
    const head=div('alert-banner-head');
    head.innerHTML=icon('alert',14,a.warn?'#f472b6':'#a78bfa',2)+' ';
    const t=el('span');t.textContent=a.title;head.appendChild(t);
    const x=el('button',{style:{background:'none',border:'none',cursor:'pointer',padding:'2px',marginLeft:'auto'}});
    x.innerHTML=icon('close',14,'var(--text-soft)');
    x.onclick=()=>{state.dismissed.push(a.id);save('dismissed',state.dismissed);render();};
    head.appendChild(x);
    const body=mutedEl(a.body);
    banner.appendChild(head);banner.appendChild(body);
    wrap.appendChild(banner);
  });

  // Phase hero
  const hero=div('phase-hero');hero.style.background=ph.bg;
  hero.style.boxShadow=`0 4px 28px rgba(0,0,0,.08)`;
  const top=div('',[],'',{display:'flex',gap:'16px',alignItems:'flex-start',marginBottom:'18px'});
  top.style.cssText='display:flex;gap:16px;align-items:flex-start;margin-bottom:18px';
  const left=div('');
  const tag=div('phase-tag');tag.textContent=ph.name+' · Day '+pred.cycleDay;
  tag.style.background=ph.color+'18';tag.style.color=ph.color;
  const desc=el('p',{style:{fontSize:'14px',color:'#6b5c8a',lineHeight:'1.65',margin:'0'}});
  desc.textContent=ph.desc;
  left.appendChild(tag);left.appendChild(desc);
  top.appendChild(left);
  top.appendChild(cycleRing(Math.min((pred.cycleDay/pred.avgCycle)*100,100),ph.color,pred.cycleDay,pred.avgCycle));
  hero.appendChild(top);
  const vitals=div('phase-vitals');
  [['Energy',ph.energy],['Libido',ph.libido],['Skin',ph.skin]].forEach(([l,v])=>{
    const vt=div('vital');
    const vl=div('vital-label');vl.textContent=l;
    const vv=div('vital-value');vv.textContent=v;vv.style.color=ph.color;
    vt.appendChild(vl);vt.appendChild(vv);vitals.appendChild(vt);
  });
  hero.appendChild(vitals);
  ph.tips.forEach(t=>{const tr=div('tip-row');tr.textContent=t;hero.appendChild(tr);});
  wrap.appendChild(hero);

  // Metrics
  const mg=div('metrics-grid');
  const fertScore=pred.fertilityMap[today]||0;
  mg.appendChild(metricCard('Next Period',pred.daysLeft<=0?'Today':pred.daysLeft+'d',fmtShort(pred.nextStart),'#f43f5e','drop'));
  mg.appendChild(suppressOv?metricCard('Method',settings.contraception,'adjusted','#a78bfa','pill'):metricCard('Ovulation',fmtShort(pred.ovulation),'predicted','#10b981','heart'));
  mg.appendChild(metricCard('Avg Cycle',pred.avgCycle+'d','± '+Math.round(pred.cycleStd)+'d','#818cf8','refresh'));
  mg.appendChild(suppressOv?metricCard('Regularity',pred.regularity!=null?pred.regularity+'%':'—','cycle score','#7c3aed','activity'):metricCard('Fertility',fertScore+'%','today',fertScore>70?'#10b981':fertScore>30?'#fb923c':'#94a3b8','activity'));
  wrap.appendChild(mg);

  // Fertility strip
  if(!suppressOv&&fertScore>0){
    const fc=cardEl([cardHead('Fertility Forecast'),fertilityStrip(pred)]);
    wrap.appendChild(fc);
  }

  // Today log
  const tc=cardEl([cardHead('Today')]);
  if(todayLog.flow||todayLog.mood?.length||todayLog.symptoms?.length){
    const tr=div('',[],'',{display:'flex',flexWrap:'wrap',gap:'4px'});tr.style.cssText='display:flex;flex-wrap:wrap;gap:4px';
    if(todayLog.flow){const f=FLOWS.find(x=>x.id===todayLog.flow);tr.appendChild(tagEl(f?.label+' flow','#fce7f3','#db2777'));}
    (todayLog.mood||[]).forEach(m=>tr.appendChild(tagEl(m,'var(--chip-on)','var(--chip-on-text)')));
    (todayLog.symptoms||[]).forEach(s=>tr.appendChild(tagEl(s,'#fff0f6','#db2777')));
    tc.appendChild(tr);
  } else tc.appendChild(mutedEl('Nothing logged today — tap Log to track how you feel.'));
  wrap.appendChild(tc);

  // History
  if(periods.length){
    const hc=cardEl([cardHead('Recent Periods')]);
    [...periods].sort((a,b)=>b.start.localeCompare(a.start)).slice(0,3).forEach(p=>{
      const row=div('hist-row');
      const s=el('span');s.textContent=fmtFull(p.start);
      const d=el('span',{class:'muted'});d.textContent=diffDays(p.start,p.end)+1+' days';
      row.appendChild(s);row.appendChild(d);hc.appendChild(row);
    });
    wrap.appendChild(hc);
  }
  return wrap;
}

function renderCalendar(periods,pred,logs){
  const now=new Date();
  let yr=now.getFullYear(),mo=now.getMonth(),sel=null;
  const wrap=div('scroll');

  function rebuild(){
    wrap.innerHTML='';
    const card=cardEl([]);
    // Month nav
    const nav=div('month-nav');
    const prev=el('button',{class:'arrow-btn'});prev.innerHTML=icon('chevL',18,'var(--text-mid)');
    prev.onclick=()=>{if(mo===0){yr--;mo=11;}else mo--;rebuild();};
    const next=el('button',{class:'arrow-btn'});next.innerHTML=icon('chevR',18,'var(--text-mid)');
    next.onclick=()=>{if(mo===11){yr++;mo=0;}else mo++;rebuild();};
    const title=el('span',{style:{fontSize:'17px',fontWeight:'700',color:'var(--text)',letterSpacing:'-.01em'}});
    title.textContent=new Date(yr,mo).toLocaleDateString('en-US',{month:'long',year:'numeric'});
    nav.appendChild(prev);nav.appendChild(title);nav.appendChild(next);card.appendChild(nav);

    const grid=div('cal-grid');
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{const l=div('cal-day-label');l.textContent=d;grid.appendChild(l);});
    for(let i=0;i<firstDOW(yr,mo);i++)grid.appendChild(div(''));
    const today=todayStr();
    for(let d=1;d<=daysInMonth(yr,mo);d++){
      const ds=isoDate(yr,mo,d);
      const inPeriod=periods.some(p=>ds>=p.start&&ds<=p.end);
      let bg='transparent',color='var(--text)',border='transparent',dash=false;
      if(inPeriod){bg='#f43f5e';color='#fff';}
      else if(pred){
        if(ds>=pred.nextStart&&ds<=pred.nextEnd){bg='rgba(244,63,94,.15)';color='#f43f5e';dash=true;}
        else if(ds===pred.ovulation){bg='#10b981';color='#fff';}
        else if(ds>=pred.fertileStart&&ds<=pred.fertileEnd){bg='rgba(16,185,129,.15)';color='#10b981';}
        else if(ds>=pred.pmsStart&&ds<pred.nextStart){bg='rgba(251,146,60,.15)';color='#fb923c';}
      }
      const cell=el('button',{class:'cal-day'});
      cell.textContent=d;
      cell.style.background=bg;cell.style.color=color;
      cell.style.borderColor=dash?'rgba(244,63,94,.5)':border;
      if(dash)cell.style.borderStyle='dashed';
      if(ds===today)cell.style.outline='2px solid #a78bfa';
      if(ds===sel)cell.style.outline='2.5px solid var(--text)';
      if(logs[ds]){const dot=div('');dot.style.cssText='width:3px;height:3px;background:#a78bfa;border-radius:50%;position:absolute;bottom:3px';cell.style.position='relative';cell.appendChild(dot);}
      cell.onclick=()=>{sel=sel===ds?null:ds;rebuild();};
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    wrap.appendChild(card);

    // Legend
    const leg=div('legend');
    [['#f43f5e','Period'],['rgba(244,63,94,.4)','Predicted',true],['#10b981','Ovulation'],['rgba(16,185,129,.4)','Fertile'],['rgba(251,146,60,.4)','PMS']].forEach(([c,l,d])=>{
      const it=div('legend-item');
      const dot=div('legend-dot');dot.style.background=c;if(d)dot.style.border='1.5px dashed #f43f5e';
      it.appendChild(dot);const lt=el('span');lt.textContent=l;it.appendChild(lt);leg.appendChild(it);
    });
    wrap.appendChild(leg);

    // Selected date
    if(sel){
      const sp=periods.find(p=>sel>=p.start&&sel<=p.end);
      const sc=cardEl([]);
      const sh=cardHead(fmtFull(sel));sc.appendChild(sh);
      if(sp){
        const rb=btn('btn-danger',icon('trash',14,'#e11d48',2)+' Remove period entry',()=>{
          state.periods=state.periods.filter(p=>p.id!==sp.id);save('periods',state.periods);sel=null;rebuild();
        });sc.appendChild(rb);
      } else {
        const ab=btn('btn-primary','Mark as period start',()=>{
          const end=addDays(sel,state.settings.periodLength-1);
          state.periods=[...state.periods.filter(p=>Math.abs(diffDays(p.start,sel))>state.settings.periodLength),{start:sel,end,id:Date.now()}].sort((a,b)=>a.start.localeCompare(b.start));
          save('periods',state.periods);sel=null;rebuild();
        });sc.appendChild(ab);
      }
      if(logs[sel]){
        const tg=div('');tg.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:10px';
        const fl=FLOWS.find(f=>f.id===logs[sel].flow);
        if(fl)tg.appendChild(tagEl(fl.label+' flow','#fce7f3','#db2777'));
        (logs[sel].symptoms||[]).forEach(s=>tg.appendChild(tagEl(s,'#fff0f6','#db2777')));
        (logs[sel].mood||[]).forEach(m=>tg.appendChild(tagEl(m,'var(--chip-on)','var(--chip-on-text)')));
        sc.appendChild(tg);
      }
      wrap.appendChild(sc);
    }
  }
  rebuild();
  return wrap;
}

function renderLog(logs,notes){
  let date=todayStr();let dirty=false;let savedTimeout=null;
  const wrap=div('scroll');
  wrap.style.paddingBottom='100px';

  function rebuild(){
    wrap.innerHTML='';
    const log=logs[date]||{};
    const note=notes[date]||'';
    const pred=buildPredictions(state.periods,state.settings);
    const isPeriod=state.periods.some(p=>date>=p.start&&date<=p.end);
    const fertScore=pred?.fertilityMap[date]||0;
    const phaseLabel=pred?(date>=pred.nextStart&&date<=pred.nextEnd?'Predicted period day':date===pred.ovulation?'Predicted ovulation':date>=pred.fertileStart&&date<=pred.fertileEnd?'Fertile window':date>=(pred.pmsStart||'')&&date<(pred.nextStart||'')?'PMS window':null):null;

    function setLog(field,val){logs[date]={...log,[field]:val};state.logs=logs;save('logs',logs);dirty=true;rebuildSaveBar();}
    function toggleLog(field,item){const arr=log[field]||[];logs[date]={...log,[field]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]};state.logs=logs;save('logs',logs);dirty=true;rebuildSaveBar();}

    // Date
    const dc=cardEl([]);dc.appendChild(cardHead('Date'));
    const di=inputEl('date',date,v=>{date=v;dirty=false;rebuildSaveBar();rebuild();},{max:todayStr()});
    dc.appendChild(di);
    if(phaseLabel){const ph=div('phase-hint');ph.textContent=phaseLabel;dc.appendChild(ph);}
    if(fertScore>0){const fs=div('fert-score');fs.textContent='Fertility today: '+fertScore+'%';dc.appendChild(fs);}
    wrap.appendChild(dc);

    // Period
    const pc=cardEl([]);pc.appendChild(cardHead('Period'));
    const pb=chipEl(isPeriod?'Period day logged':'Mark as period start',isPeriod,()=>{
      if(!isPeriod){const end=addDays(date,state.settings.periodLength-1);state.periods=[...state.periods.filter(p=>Math.abs(diffDays(p.start,date))>state.settings.periodLength),{start:date,end,id:Date.now()}].sort((a,b)=>a.start.localeCompare(b.start));save('periods',state.periods);dirty=true;rebuildSaveBar();rebuild();}
    },'#fce7f3');
    if(isPeriod){pb.style.color='#db2777';pb.style.borderColor='#fda4af';}
    pc.appendChild(pb);wrap.appendChild(pc);

    // Flow
    const fc=cardEl([]);fc.style.borderTop='3px solid #fda4af';fc.appendChild(cardHead('Flow'));
    const fr=div('chip-row');
    FLOWS.forEach(f=>{
      const b=el('button',{class:'chip'+(log.flow===f.id?' on':'')});
      b.textContent=f.label;
      if(log.flow===f.id){b.style.background=f.color;b.style.borderColor=f.color;b.style.color='#fff';}
      b.onclick=()=>{setLog('flow',log.flow===f.id?null:f.id);rebuild();};
      fr.appendChild(b);
    });
    fc.appendChild(fr);wrap.appendChild(fc);

    // Pain
    const painC=cardEl([]);painC.style.borderTop='3px solid #c4b5fd';painC.appendChild(cardHead('Pain Level'));
    const painRow=div('');painRow.style.cssText='display:flex;align-items:center;gap:14px;margin-bottom:12px';
    const pb2=div('pain-badge');
    pb2.style.background=log.pain>=7?'#fce7f3':log.pain>=4?'#fff7ed':'#f0fdf8';
    pb2.textContent=log.pain||'–';pb2.style.color=log.pain>=7?'#db2777':log.pain>=4?'#ea580c':'#059669';
    const pl=mutedEl(log.pain>=8?'Severe':log.pain>=6?'Moderate–Severe':log.pain>=4?'Moderate':log.pain>=2?'Mild':'No pain selected');
    painRow.appendChild(pb2);painRow.appendChild(pl);painC.appendChild(painRow);
    painC.appendChild(sliderEl({min:0,max:10,value:log.pain||0,color:'#a78bfa',onChange:v=>{setLog('pain',v);painRow.querySelector('.pain-badge').textContent=v;painRow.querySelector('.pain-badge').style.background=v>=7?'#fce7f3':v>=4?'#fff7ed':'#f0fdf8';painRow.querySelector('.pain-badge').style.color=v>=7?'#db2777':v>=4?'#ea580c':'#059669';pl.textContent=v>=8?'Severe':v>=6?'Moderate–Severe':v>=4?'Moderate':v>=2?'Mild':'No pain selected';}}));
    wrap.appendChild(painC);

    // Mood
    const mc=cardEl([]);mc.style.borderTop='3px solid #c4b5fd';mc.appendChild(cardHead('Mood'));
    const mg=div('sel-grid');
    MOODS.forEach(m=>mg.appendChild(selChipEl(m,(log.mood||[]).includes(m),()=>{toggleLog('mood',m);rebuild();})));
    mc.appendChild(mg);wrap.appendChild(mc);

    // Symptoms
    const sc=cardEl([]);sc.style.borderTop='3px solid #fda4af';sc.appendChild(cardHead('Symptoms'));
    const sg=div('sel-grid');
    SYMPTOMS.forEach(s=>sg.appendChild(selChipEl(s,(log.symptoms||[]).includes(s),()=>{toggleLog('symptoms',s);rebuild();},true)));
    sc.appendChild(sg);wrap.appendChild(sc);

    // Discharge
    const ddc=cardEl([]);ddc.appendChild(cardHead('Discharge'));
    const ddr=div('chip-row');
    DISCHARGE.forEach(d=>ddr.appendChild(chipEl(d,log.discharge===d,()=>{setLog('discharge',log.discharge===d?null:d);rebuild();})));
    ddc.appendChild(ddr);wrap.appendChild(ddc);

    // BBT
    const bc=cardEl([]);bc.appendChild(cardHead('Basal Body Temperature'));
    const br=div('');br.style.cssText='display:flex;align-items:center;gap:12px';
    const bw=div('bbt-wrap');
    const bi=el('input',{class:'bbt-input',type:'number',step:'0.01',min:'35',max:'40.5',placeholder:'36.50',value:log.temp||''});
    bi.oninput=e=>{setLog('temp',e.target.value);};
    const bu=div('bbt-unit');bu.textContent='°C';
    bw.appendChild(bi);bw.appendChild(bu);
    const bm=mutedEl('Measure immediately after waking, before getting up.');bm.style.flex='1';bm.style.fontSize='12px';
    br.appendChild(bw);br.appendChild(bm);bc.appendChild(br);wrap.appendChild(bc);

    // Water
    const wc=cardEl([]);wc.style.borderTop='3px solid #7dd3fc';wc.appendChild(cardHead('Water Intake'));
    const wr=div('');wr.style.cssText='display:flex;align-items:center;gap:14px;margin-bottom:12px';
    const wb=div('water-badge');wb.id='water-badge';wb.textContent=log.water||0;
    const wm=mutedEl((log.water||0)+' glass'+((log.water||0)!==1?'es':'')+' today');wm.id='water-muted';
    wr.appendChild(wb);wr.appendChild(wm);wc.appendChild(wr);
    wc.appendChild(sliderEl({min:0,max:12,value:log.water||0,color:'#38bdf8',onChange:v=>{setLog('water',v);const badge=wrap.querySelector('#water-badge');if(badge)badge.textContent=v;const mut=wrap.querySelector('#water-muted');if(mut)mut.textContent=v+' glass'+(v!==1?'es':'')+' today';}}));
    wrap.appendChild(wc);

    // Sleep
    const slc=cardEl([]);slc.appendChild(cardHead('Sleep'));
    const slr=div('chip-row');slr.style.marginBottom='12px';
    SLEEP_Q.forEach(q=>slr.appendChild(chipEl(q,log.sleep===q,()=>{setLog('sleep',log.sleep===q?null:q);rebuild();})));
    slc.appendChild(slr);
    const shr=div('');shr.style.cssText='display:flex;align-items:center;gap:14px;margin-bottom:12px';
    const shb=div('sleep-badge');shb.id='sleep-badge';shb.textContent=log.sleepHours!=null?log.sleepHours:7;
    const shm=mutedEl((log.sleepHours!=null?log.sleepHours:7)+' hour'+((log.sleepHours!=null?log.sleepHours:7)!==1?'s':'')+' of sleep');shm.id='sleep-muted';shm.style.fontSize='12px';
    shr.appendChild(shb);shr.appendChild(shm);slc.appendChild(shr);
    slc.appendChild(sliderEl({min:0,max:13,value:log.sleepHours!=null?log.sleepHours:7,color:'#818cf8',unit:'h',onChange:v=>{setLog('sleepHours',v);const badge=wrap.querySelector('#sleep-badge');if(badge)badge.textContent=v;const mut=wrap.querySelector('#sleep-muted');if(mut)mut.textContent=v+' hour'+(v!==1?'s':'')+' of sleep';}}));
    wrap.appendChild(slc);

    // Exercise
    const ec=cardEl([]);ec.appendChild(cardHead('Exercise'));
    const er=div('chip-row');
    EXERCISE.forEach(ex=>{
      const b=chipEl(ex,log.exercise===ex,()=>{setLog('exercise',log.exercise===ex?null:ex);rebuild();});
      if(log.exercise===ex){b.style.background='#ecfdf5';b.style.borderColor='#6ee7b7';b.style.color='#059669';}
      er.appendChild(b);
    });
    ec.appendChild(er);wrap.appendChild(ec);

    // Intimacy
    const ic=cardEl([]);ic.appendChild(cardHead('Intimacy'));
    const ir=div('chip-row');
    SEX.forEach(s=>ir.appendChild(chipEl(s,log.sex===s,()=>{setLog('sex',log.sex===s?null:s);rebuild();})));
    ic.appendChild(ir);wrap.appendChild(ic);

    // Journal
    const jc=cardEl([]);jc.appendChild(cardHead('Journal'));
    const ta=textareaEl(note,v=>{notes[date]=v;state.notes=notes;save('notes',notes);dirty=true;rebuildSaveBar();},);
    jc.appendChild(ta);wrap.appendChild(jc);
  }

  // Save bar
  const saveBar=div('save-bar');saveBar.id='save-bar';
  let isSaved=false;
  function rebuildSaveBar(){
    const sb=saveBar.querySelector('.save-btn')||el('button',{class:'save-btn'});
    if(isSaved){sb.style.background='linear-gradient(135deg,#10b981,#34d399)';sb.style.color='#fff';sb.style.border='none';sb.style.boxShadow='0 4px 16px rgba(16,185,129,.3)';sb.innerHTML=icon('check',16,'#fff',2)+' Saved';}
    else if(dirty){sb.style.background='linear-gradient(135deg,#ec4899,#f472b6)';sb.style.color='#fff';sb.style.border='none';sb.style.boxShadow='0 4px 16px rgba(236,72,153,.25)';sb.innerHTML=icon('save',16,'#fff',2)+' Save Entry';}
    else{sb.style.background='var(--surface)';sb.style.color='var(--text-soft)';sb.style.border='1.5px solid var(--border)';sb.style.boxShadow='none';sb.innerHTML=icon('save',16,'var(--text-soft)',2)+' Save Entry';}
    sb.onclick=()=>{isSaved=true;dirty=false;rebuildSaveBar();if(savedTimeout)clearTimeout(savedTimeout);savedTimeout=setTimeout(()=>{isSaved=false;rebuildSaveBar();},2500);};
    saveBar.innerHTML='';saveBar.appendChild(sb);
  }
  rebuildSaveBar();
  document.getElementById('app').appendChild(saveBar);

  rebuild();
  return wrap;
}

function renderInsights(periods,logs,pred,settings){
  const wrap=div('scroll');
  if(!periods.length){const e=div('empty');e.innerHTML=icon('chart',40,'var(--text-soft)',1.5);e.appendChild(mutedEl('Log at least one period to unlock insights.'));wrap.appendChild(e);return wrap;}
  const gaps=pred?.gaps||[];
  const allLogs=Object.entries(logs);
  const sf={};SYMPTOMS.forEach(s=>sf[s]=0);allLogs.forEach(([,l])=>(l.symptoms||[]).forEach(s=>sf[s]=(sf[s]||0)+1));
  const topS=Object.entries(sf).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).slice(0,6);
  const mf={};MOODS.forEach(m=>mf[m]=0);allLogs.forEach(([,l])=>(l.mood||[]).forEach(m=>mf[m]=(mf[m]||0)+1));
  const topM=Object.entries(mf).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).slice(0,6);
  const maxS=Math.max(...topS.map(([,v])=>v),1),maxM=Math.max(...topM.map(([,v])=>v),1);
  const bbtData=allLogs.filter(([,l])=>l.temp&&+l.temp>35&&+l.temp<40.5).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
  const painVals=allLogs.map(([,l])=>l.pain).filter(Boolean);
  const avgPain=painVals.length?Math.round(painVals.reduce((a,b)=>a+b,0)/painVals.length*10)/10:null;
  const mg=div('metrics-grid');
  mg.appendChild(metricCard('Avg Cycle',(pred?.avgCycle||settings.cycleLength)+'d',pred?'± '+Math.round(pred.cycleStd)+'d':'','#818cf8','refresh'));
  mg.appendChild(metricCard('Avg Period',(pred?.avgPeriod||settings.periodLength)+'d','','#f43f5e','drop'));
  mg.appendChild(metricCard('Cycles',periods.length,'logged','#10b981','calendar'));
  const reg=pred?.regularity;
  mg.appendChild(metricCard('Regularity',reg!=null?reg+'%':'—',reg>=80?'Regular':reg>=60?'Moderate':'Irregular',reg>=80?'#10b981':reg>=60?'#fb923c':'#f43f5e','activity'));
  wrap.appendChild(mg);
  if(gaps.length){
    const bc=cardEl([cardHead('Cycle Length History')]);
    const bch=div('bar-chart');
    gaps.forEach(g=>{const col=div('bar-col');const fill=div('bar-fill');fill.style.height=Math.min(100,Math.round((g/50)*100))+'%';fill.style.background=g<21||g>35?'#f43f5e':g<24||g>32?'#fb923c':'#818cf8';const lbl=div('bar-lbl');lbl.textContent=g;col.appendChild(fill);col.appendChild(lbl);bch.appendChild(col);});
    bc.appendChild(bch);bc.appendChild(mutedEl('Days between cycles. Normal range: 21–35 days'));wrap.appendChild(bc);
  }
  if(bbtData.length>2){
    const btc=cardEl([cardHead('Body Temperature (BBT)')]);
    const temps=bbtData.map(([,l])=>+l.temp);
    const mn=Math.min(...temps)-.2,mx=Math.max(...temps)+.2,w=260,h=70;
    const pts=temps.map((t,i)=>`${Math.round((i/(temps.length-1))*w)},${Math.round(h-((t-mn)/(mx-mn))*h)}`).join(' ');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${w} ${h+20}`);svg.setAttribute('width',w);svg.setAttribute('height',h+20);svg.style.overflow='visible';
    svg.innerHTML=`<polyline points="${pts}" fill="none" stroke="#818cf8" stroke-width="2" stroke-linejoin="round"/>${temps.map((t,i)=>`<circle cx="${Math.round((i/(temps.length-1))*w)}" cy="${Math.round(h-((t-mn)/(mx-mn))*h)}" r="3" fill="#818cf8"/>`).join('')}<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="var(--border)" stroke-width="1"/>`;
    btc.appendChild(svg);btc.appendChild(mutedEl('A rise of ~0.2–0.5°C after ovulation is normal'));wrap.appendChild(btc);
  }
  if(avgPain){
    const pc=cardEl([cardHead('Average Pain')]);
    const pr=div('');pr.style.cssText='display:flex;align-items:center;gap:14px';
    const pb=div('pain-badge');pb.style.background=avgPain>=7?'#fce7f3':avgPain>=4?'#fff7ed':'#f0fdf8';pb.style.color=avgPain>=7?'#db2777':avgPain>=4?'#ea580c':'#059669';pb.textContent=avgPain;
    pr.appendChild(pb);pr.appendChild(mutedEl('out of 10 across '+painVals.length+' logged days'));pc.appendChild(pr);wrap.appendChild(pc);
  }
  if(topS.length){const sc=cardEl([cardHead('Symptom Frequency')]);topS.forEach(([s,c])=>{const r=div('ins-row');const l=div('ins-label');l.textContent=s;const t=div('ins-track');const b=div('ins-bar');b.style.width=Math.round((c/maxS)*100)+'%';b.style.background='#f43f5e';t.appendChild(b);const ct=div('ins-count');ct.textContent=c;r.appendChild(l);r.appendChild(t);r.appendChild(ct);sc.appendChild(r);});wrap.appendChild(sc);}
  if(topM.length){const mc=cardEl([cardHead('Mood Frequency')]);topM.forEach(([m,c])=>{const r=div('ins-row');const l=div('ins-label');l.textContent=m;const t=div('ins-track');const b=div('ins-bar');b.style.width=Math.round((c/maxM)*100)+'%';b.style.background='#818cf8';t.appendChild(b);const ct=div('ins-count');ct.textContent=c;r.appendChild(l);r.appendChild(t);r.appendChild(ct);mc.appendChild(r);});wrap.appendChild(mc);}
  if(pred){
    const pc=cardEl([cardHead('Upcoming Predictions')]);
    const conf=pred.confidence;
    const cm=mutedEl('Confidence: '+conf.charAt(0).toUpperCase()+conf.slice(1)+' ('+pred.totalCycles+' cycle'+(pred.totalCycles!==1?'s':'')+' logged)');
    cm.style.marginBottom='12px';cm.querySelector&&null;
    const confSpan=el('span');confSpan.textContent=conf.charAt(0).toUpperCase()+conf.slice(1);confSpan.style.color=conf==='high'?'#10b981':conf==='medium'?'#fb923c':'#94a3b8';confSpan.style.fontWeight='700';
    pc.appendChild(cm);
    for(let i=0;i<3;i++){const st=addDays(pred.nextStart,i*pred.avgCycle),en=addDays(st,pred.avgPeriod-1),ov=addDays(st,-14);const r=div('');r.style.cssText='display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)';const dot=div('pred-dot');const info=div('');const ttl=el('div',{style:{fontWeight:'700',color:'var(--text)',marginBottom:'4px',fontSize:'14px'}});ttl.textContent='Period: '+fmtShort(st)+' – '+fmtShort(en);const sub=mutedEl('Ovulation: ~'+fmtShort(ov));sub.style.fontSize='12px';info.appendChild(ttl);info.appendChild(sub);r.appendChild(dot);r.appendChild(info);pc.appendChild(r);}
    wrap.appendChild(pc);
  }
  return wrap;
}

function renderHealth(alerts,insights,settings){
  const wrap=div('scroll');
  const intro=cardEl([]);intro.style.background='#f0fdf8';intro.style.borderColor='#a7f3d0';
  const ihead=div('');ihead.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:10px';
  ihead.innerHTML=icon('activity',18,'#10b981',2);const iht=cardHead('Health Intelligence');ihead.appendChild(iht);
  intro.appendChild(ihead);intro.appendChild(mutedEl('Bloom analyses your cycle data and adjusts insights based on your contraceptive method. This is not medical diagnosis — always consult a doctor for concerns.'));
  if(settings.contraception&&settings.contraception!=='None'){const badge=div('');badge.style.cssText='margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:99px;padding:4px 12px;font-size:12px;font-weight:600;color:#059669';badge.innerHTML=icon('pill',12,'#059669',2)+' Tracking adjusted for: '+settings.contraception;intro.appendChild(badge);}
  wrap.appendChild(intro);
  if(!alerts.length&&!insights.length){const e=div('empty');e.innerHTML=icon('heart',36,'#10b981',1.5);e.appendChild(mutedEl('No alerts right now. Keep logging to build your health picture.'));wrap.appendChild(e);}
  if(alerts.length){
    const ac=cardEl([cardHead('Alerts')]);
    alerts.forEach(a=>{
      const hc=div('health-card');hc.style.background=a.warn?'#fff8fa':'#faf8ff';hc.style.borderColor=a.warn?'#fecdd3':'var(--border)';
      const ht=div('');ht.style.cssText='display:flex;align-items:flex-start;gap:10px;margin-bottom:8px';
      const dot=div('health-dot');dot.style.background=a.warn?'#f472b6':'#a78bfa';
      const title=el('b',{style:{flex:'1',color:'var(--text)',fontSize:'14px'}});title.textContent=a.title;
      const xb=el('button',{style:{background:'none',border:'none',cursor:'pointer',padding:'2px'}});xb.innerHTML=icon('close',14,'var(--text-soft)');xb.onclick=()=>{state.dismissed.push(a.id);save('dismissed',state.dismissed);render();};
      ht.appendChild(dot);ht.appendChild(title);ht.appendChild(xb);
      const body=mutedEl(a.body);body.style.paddingLeft='18px';
      hc.appendChild(ht);hc.appendChild(body);ac.appendChild(hc);
    });
    wrap.appendChild(ac);
  }
  if(insights.length){
    const ic=cardEl([cardHead('Insights')]);
    insights.forEach(ins=>{
      const hc=div('health-card');hc.style.background='var(--surface)';
      const ht=div('');ht.style.cssText='display:flex;align-items:flex-start;gap:10px;margin-bottom:8px';
      const dot=div('health-dot');dot.style.background='#a78bfa';
      const title=el('b',{style:{flex:'1',color:'var(--text)',fontSize:'14px'}});title.textContent=ins.title;
      ht.appendChild(dot);ht.appendChild(title);
      const body=mutedEl(ins.body);body.style.paddingLeft='18px';
      hc.appendChild(ht);hc.appendChild(body);ic.appendChild(hc);
    });
    wrap.appendChild(ic);
  }
  const rc=cardEl([cardHead('When to See a Doctor')]);
  ['Periods lasting more than 7 days','Soaking through protection every hour for several hours','Severe pain that prevents daily activities','Bleeding between periods regularly','No period for 90+ days and not pregnant','A sudden change in your usual cycle pattern'].forEach(txt=>{
    const r=div('');r.style.cssText='padding:8px 0;font-size:13px;color:var(--text-mid);border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start';
    const dot=div('');dot.style.cssText='width:6px;height:6px;border-radius:50%;background:#f472b6;margin-top:5px;flex-shrink:0';
    const t=el('span');t.textContent=txt;r.appendChild(dot);r.appendChild(t);rc.appendChild(r);
  });
  wrap.appendChild(rc);
  return wrap;
}

function renderSettings(){
  const s=state.settings;
  const wrap=div('scroll');
  function upd(k,v){state.settings={...s,[k]:v};save('settings',state.settings);render();}

  // Profile
  const pc=cardEl([]);pc.appendChild(cardHead('Profile'));
  const nl=el('label',{class:'settings-label'});nl.textContent='Your Name';
  const ni=inputEl('text',s.name,v=>upd('name',v));
  pc.appendChild(nl);pc.appendChild(ni);wrap.appendChild(pc);

  // Cycle
  const cc=cardEl([]);cc.appendChild(cardHead('Cycle'));
  const cl=div('');cl.style.cssText='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px';
  const clt=el('span',{class:'settings-label',style:{margin:'0'}});clt.textContent='Average Cycle Length';
  const clv=el('span',{style:{fontSize:'22px',fontWeight:'700',color:'#ec4899',id:'cl-val'}});clv.textContent=s.cycleLength+' days';
  cl.appendChild(clt);cl.appendChild(clv);cc.appendChild(cl);
  cc.appendChild(sliderEl({min:18,max:50,value:s.cycleLength,color:'#ec4899',onChange:v=>{clv.textContent=v+' days';upd('cycleLength',v);}}));
  const pl=div('');pl.style.cssText='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;margin-top:20px';
  const plt=el('span',{class:'settings-label',style:{margin:'0'}});plt.textContent='Average Period Length';
  const plv=el('span',{style:{fontSize:'22px',fontWeight:'700',color:'#f472b6'}});plv.textContent=s.periodLength+' days';
  pl.appendChild(plt);pl.appendChild(plv);cc.appendChild(pl);
  cc.appendChild(sliderEl({min:1,max:10,value:s.periodLength,color:'#f472b6',onChange:v=>{plv.textContent=v+' days';upd('periodLength',v);}}));
  wrap.appendChild(cc);

  // Contraception
  const contc=cardEl([]);contc.appendChild(cardHead('Contraception'));
  const contr=div('chip-row');
  ['None','Pill','IUD','Implant','Patch','Condoms','Other'].forEach(c=>contr.appendChild(chipEl(c,s.contraception===c,()=>upd('contraception',c))));
  contc.appendChild(contr);wrap.appendChild(contc);

  // Dark mode
  const dc=cardEl([]);
  const dtw=div('toggle-wrap');
  const dleft=div('');dleft.style.cssText='display:flex;align-items:center;gap:10px';
  dleft.innerHTML=icon(s.darkMode?'moon':'sun',18,s.darkMode?'#a78bfa':'#fb923c',1.75);
  const dinfo=div('');const dtitle=el('div',{style:{fontSize:'14px',fontWeight:'600',color:'var(--text)'}});dtitle.textContent='Dark Mode';const dsub=mutedEl(s.darkMode?'Dark theme active':'Light theme active');dsub.style.fontSize='12px';dinfo.appendChild(dtitle);dinfo.appendChild(dsub);dleft.appendChild(dinfo);
  const tog=el('button',{class:'toggle'});tog.style.background=s.darkMode?'#7c3aed':'#e9e3ff';
  const thumb=div('toggle-thumb');thumb.style.left=s.darkMode?'26px':'3px';tog.appendChild(thumb);
  tog.onclick=()=>upd('darkMode',!s.darkMode);
  dtw.appendChild(dleft);dtw.appendChild(tog);dc.appendChild(dtw);wrap.appendChild(dc);

  // Export
  const ec=cardEl([]);ec.appendChild(cardHead('Export Data'));ec.appendChild(mutedEl('Download your full data as JSON for backup or to share with a doctor.'));
  ec.style.marginTop='4px';
  const db=btn('btn-secondary',icon('download',14,'#7c3aed',2)+' Download My Data',()=>{
    try{const d={periods:state.periods,logs:state.logs,notes:state.notes,settings:state.settings,exported:new Date().toISOString()};const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='bloom-health-data.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);document.body.removeChild(a);},1000);}catch(e){alert('Download failed. Try a different browser.');}
  });
  ec.appendChild(db);wrap.appendChild(ec);

  // About
  const ab=cardEl([cardHead('About Bloom')]);ab.appendChild(mutedEl('Bloom v2 — Free, private period and health tracker. All data is stored only on your device. No servers, no subscriptions, no tracking.'));wrap.appendChild(ab);

  // Delete
  const del=cardEl([cardHead('Data')]);
  const delb=btn('btn-danger',icon('trash',14,'#e11d48',2)+' Delete All Data',()=>{
    if(confirm('Delete all Bloom data? This cannot be undone.')){['periods','logs','notes','settings','dismissed'].forEach(k=>{try{localStorage.removeItem('bloom_'+k);}catch(e){}});state.periods=[];state.logs={};state.notes={};state.dismissed=[];state.settings={cycleLength:28,periodLength:5,name:'',contraception:'None',darkMode:false};state.tab='home';render();}
  });
  del.appendChild(delb);wrap.appendChild(del);
  return wrap;
}

function renderOnboard(){
  let step=0;
  const form={name:'',cycleLength:28,periodLength:5,lastPeriod:''};
  const root=div('ob-root');
  const card=div('ob-card');root.appendChild(card);

  function buildDots(){
    const d=div('ob-dots');
    for(let i=0;i<5;i++){const dot=div('ob-dot');dot.style.width=i===step?'22px':'7px';dot.style.background=i===step?'#ec4899':'#f0ebff';d.appendChild(dot);}
    return d;
  }

  function finish(){
    const merged={...state.settings,...form};state.settings=merged;save('settings',merged);
    if(form.lastPeriod){const p=[{start:form.lastPeriod,end:addDays(form.lastPeriod,form.periodLength-1),id:Date.now()}];state.periods=p;save('periods',p);}
    render();
  }

  const steps=[
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='linear-gradient(135deg,#fce7f3,#ede9fe)';ic.innerHTML=icon('heart',30,'#ec4899');card.appendChild(ic);
      const t=el('h1',{style:{fontSize:'26px',fontWeight:'700',color:'#1e1235',letterSpacing:'-.02em',margin:'0'}});t.textContent='Welcome to Bloom';card.appendChild(t);
      const s=el('p',{style:{fontSize:'15px',color:'#6b5c8a',lineHeight:'1.65',margin:'0'}});s.textContent='Your private, intelligent period and health tracker. No subscriptions. Your data never leaves your device.';card.appendChild(s);
      const b=btn('btn-primary','Get Started',()=>{step=1;steps[step]();});card.appendChild(b);
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='linear-gradient(135deg,#ede9fe,#fce7f3)';ic.innerHTML=icon('user',28,'#7c3aed');card.appendChild(ic);
      const t=el('h2',{style:{fontSize:'22px',fontWeight:'700',color:'#1e1235',margin:'0'}});t.textContent='What should we call you?';card.appendChild(t);
      const inp=inputEl('text',form.name,v=>{form.name=v;});inp.placeholder='Your first name';inp.style.marginTop='4px';card.appendChild(inp);
      const b=btn('btn-primary','Continue',()=>{if(!inp.value.trim()){inp.focus();return;}form.name=inp.value.trim();step=2;steps[step]();});card.appendChild(b);
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='linear-gradient(135deg,#fce7f3,#ede9fe)';ic.innerHTML=icon('refresh',28,'#ec4899');card.appendChild(ic);
      const t=el('h2',{style:{fontSize:'22px',fontWeight:'700',color:'#1e1235',margin:'0'}});t.textContent='Your cycle length';card.appendChild(t);
      const sub=el('p',{style:{fontSize:'14px',color:'#6b5c8a',margin:'0'}});sub.textContent='Average days from the start of one period to the next';card.appendChild(sub);
      const sw=sliderEl({min:18,max:50,value:form.cycleLength,color:'#ec4899',showValue:true,unit:' days',onChange:v=>form.cycleLength=v});card.appendChild(sw);
      const b=btn('btn-primary','Continue',()=>{step=3;steps[step]();});card.appendChild(b);
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='linear-gradient(135deg,#fce7f3,#fff0f6)';ic.innerHTML=icon('drop',28,'#f472b6');card.appendChild(ic);
      const t=el('h2',{style:{fontSize:'22px',fontWeight:'700',color:'#1e1235',margin:'0'}});t.textContent='Period length';card.appendChild(t);
      const sub=el('p',{style:{fontSize:'14px',color:'#6b5c8a',margin:'0'}});sub.textContent='How many days does your period usually last?';card.appendChild(sub);
      const sw=sliderEl({min:1,max:10,value:form.periodLength,color:'#f472b6',showValue:true,unit:' days',onChange:v=>form.periodLength=v});card.appendChild(sw);
      const b=btn('btn-primary','Continue',()=>{step=4;steps[step]();});card.appendChild(b);
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='linear-gradient(135deg,#ede9fe,#f5f0ff)';ic.innerHTML=icon('calendar',28,'#7c3aed');card.appendChild(ic);
      const t=el('h2',{style:{fontSize:'22px',fontWeight:'700',color:'#1e1235',margin:'0'}});t.textContent='Last period start date';card.appendChild(t);
      const inp=inputEl('date',form.lastPeriod,v=>form.lastPeriod=v);inp.max=todayStr();card.appendChild(inp);
      const b=btn('btn-primary','Start Tracking',()=>{if(!inp.value){inp.focus();return;}form.lastPeriod=inp.value;finish();});card.appendChild(b);
      const sk=btn('btn-ghost','Skip for now',finish);card.appendChild(sk);
      card.appendChild(buildDots());
    },
  ];
  steps[0]();
  return root;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
function render(){
  const app=document.getElementById('app');
  const existingSaveBar=document.getElementById('save-bar');if(existingSaveBar)existingSaveBar.remove();
  app.innerHTML='';

  // Apply theme
  app.dataset.theme=state.settings.darkMode?'dark':'light';
  document.querySelector('meta[name=theme-color]').content=state.settings.darkMode?'#0e0920':'#faf7ff';

  // Blobs
  const blob1=div('blob');blob1.style.cssText='top:-160px;right:-120px;width:420px;height:420px';
  const phaseColors={menstrual:'#fda4af',follicular:'#c4b5fd',fertile:'#6ee7b7',ovulation:'#6ee7b7',pms:'#fdba74',luteal:'#c4b5fd'};
  const pred=buildPredictions(state.periods,state.settings);
  const col=pred&&phaseColors[pred.phase]?phaseColors[pred.phase]:'#e9d5ff';
  blob1.style.background=`radial-gradient(circle,${col}44 0%,transparent 65%)`;
  const blob2=div('blob');blob2.style.cssText='bottom:-100px;left:-100px;width:340px;height:340px;background:radial-gradient(circle,#e9d5ff30 0%,transparent 65%)';
  app.appendChild(blob1);app.appendChild(blob2);

  if(!state.settings.name){app.appendChild(renderOnboard());return;}

  const health=analyzeHealth(state.periods,state.logs,pred,state.settings);
  const activeAlerts=health.alerts.filter(a=>!state.dismissed.includes(a.id));
  const suppressOv=['Pill','Implant','Patch'].includes(state.settings.contraception);

  // Header
  const header=div('header');
  const brand=div('brand');
  const bi=div('brand-icon');bi.innerHTML=icon('heart',16,'#ec4899',2);
  const bn=div('brand-name');bn.textContent='bloom';
  brand.appendChild(bi);brand.appendChild(bn);header.appendChild(brand);
  const right=div('');right.style.cssText='display:flex;align-items:center;gap:8px';
  const greet=el('span',{style:{fontSize:'13px',color:'var(--text-soft)',fontWeight:'500'}});greet.textContent='Hey, '+state.settings.name;
  right.appendChild(greet);
  if(activeAlerts.length){const badge=div('alert-badge');badge.textContent=activeAlerts.length;right.appendChild(badge);}
  header.appendChild(right);app.appendChild(header);

  // Screen
  const screen=div('screen');
  const t=state.tab;
  let content;
  if(t==='home')content=renderHome(pred,state.periods,state.logs,activeAlerts,state.settings,suppressOv);
  else if(t==='calendar')content=renderCalendar(state.periods,pred,state.logs);
  else if(t==='log')content=renderLog(state.logs,state.notes);
  else if(t==='insights')content=renderInsights(state.periods,state.logs,pred,state.settings);
  else if(t==='health')content=renderHealth(activeAlerts,health.insights,state.settings);
  else if(t==='settings')content=renderSettings();
  if(content)screen.appendChild(content);
  app.appendChild(screen);

  // Nav
  const nav=div('nav');
  const tabs=[{id:'home',icon:'home',label:'Home'},{id:'calendar',icon:'calendar',label:'Calendar'},{id:'log',icon:'pen',label:'Log'},{id:'insights',icon:'chart',label:'Insights'},{id:'health',icon:'activity',label:'Health',badge:activeAlerts.length},{id:'settings',icon:'gear',label:'Settings'}];
  tabs.forEach(tb=>{
    const b=el('button',{class:'nav-btn'+(state.tab===tb.id?' active':'')});
    const ic=div('');ic.style.position='relative';ic.innerHTML=icon(tb.icon,20,state.tab===tb.id?'#ec4899':'var(--text-soft)',state.tab===tb.id?2:1.75);
    if(tb.badge){const dot=div('nav-dot');dot.textContent=tb.badge;ic.appendChild(dot);}
    const lbl=el('span',{class:'nav-label'});lbl.textContent=tb.label;
    b.appendChild(ic);b.appendChild(lbl);
    b.onclick=()=>{state.tab=tb.id;render();};
    nav.appendChild(b);
  });
  app.appendChild(nav);
}

// Boot
render();
