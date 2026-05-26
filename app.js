'use strict';

// ─── Utilities ───────────────────────────────────────────────────────────────
const p2=n=>String(n).padStart(2,'0');
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;};
const parseDate=s=>new Date(s+'T00:00:00');
const addDays=(s,n)=>{const d=parseDate(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;};
const diffDays=(a,b)=>Math.round((parseDate(b)-parseDate(a))/86400000);
const fmtShort=s=>{if(!s)return'';const d=parseDate(s);return d.toLocaleDateString('en-GB',{month:'short',day:'numeric'});};
const fmtFull=s=>{if(!s)return'';const d=parseDate(s);return d.toLocaleDateString('en-GB',{month:'short',day:'numeric',year:'numeric'});};
const fmtDay=s=>{if(!s)return'';const d=parseDate(s);const t=todayStr();if(s===t)return'Today';if(s===addDays(t,-1))return'Yesterday';return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});};
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
  if((sf.Cramps||0)>=8)alerts.push({id:'cramps',warn:cp.hormonal,title:'Frequent Cramping',body:cp.hormonal?'You have logged frequent cramps. While hormonal contraception can reduce cramping, persistent pain may indicate endometriosis, fibroids, or adenomyosis.':'You have logged cramps on 8 or more days in the last 60 days. Persistent cramping could indicate endometriosis or fibroids. Consider speaking with a gynaecologist.'});
  if((sf.Headache||0)>=10)insights.push({id:'headache',title:'Frequent Headaches',body:cp.hormonal?`Hormonal contraception like the ${contra} can trigger headaches due to oestrogen fluctuations. If headaches are new or worsening, discuss with your doctor.`:'Hormonal headaches often occur just before or during your period due to oestrogen drops.',warn:false});
  const heavyDays=recent.filter(([,l])=>l.flow==='heavy'||l.flow==='very_heavy').length;
  if(heavyDays>=5){
    if(contra==='IUD')alerts.push({id:'heavy',warn:true,title:'Heavy Flow with IUD',body:'Heavy periods are common with the copper IUD, especially in the first 3 to 6 months. If soaking through protection hourly, consult your doctor about iron monitoring.'});
    else if(cp.hormonal)alerts.push({id:'heavy',warn:true,title:'Heavy Flow Despite Hormonal Contraception',body:`Hormonal methods like the ${contra} typically lighten periods. Unexpectedly heavy flow may warrant a review of your contraceptive or a check for underlying causes.`});
    else alerts.push({id:'heavy',warn:true,title:'Frequently Heavy Flow',body:'Consistently heavy periods can cause anaemia and may signal fibroids, polyps, or a clotting disorder. Please discuss with your doctor.'});
  }
  const lowMood=(mf.Anxious||0)+(mf.Irritable||0)+(mf.Sad||0)+(mf.Low||0);
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

// ─── Icons ───────────────────────────────────────────────────────────────────
const ICONS={
  home:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  plus:'M12 5v14 M5 12h14',
  chart:'M18 20V10 M12 20V4 M6 20v-6',
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
  activity:'M22 12h-4l-3 9L9 3l-3 9H2',
  spark:'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
};
function icon(name,size=20,color='currentColor',sw=1.75){
  const paths=(ICONS[name]||'M0 0').split(' M').map((d,i)=>i===0?d:'M'+d);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PHASES={
  menstrual:{name:'Menstrual',emoji:'🌹',color:'#e879b8',bg:'#fff0f6',desc:'Your uterine lining sheds. Oestrogen and progesterone are at their lowest. Rest and gentle self-care are key.',tips:['🌡️ Heat pad eases cramps','💊 Ibuprofen with food','🥦 Iron-rich foods help','💧 Stay well hydrated'],energy:'Low',libido:'Low–Medium',skin:'May break out'},
  follicular:{name:'Follicular',emoji:'🌸',color:'#9d5cf6',bg:'#f5f3ff',desc:'Oestrogen rises as follicles mature. You\'ll feel more energetic, creative, and sociable.',tips:['💪 Great for intense workouts','🎨 Tackle creative projects','🥗 Lighter meals feel good','☀️ Your mood will lift'],energy:'Rising',libido:'Increasing',skin:'Glowing'},
  fertile:{name:'Fertile Window',emoji:'🌿',color:'#10b981',bg:'#f0fdf8',desc:'Your most fertile days. Oestrogen peaks and your body is ready for ovulation.',tips:['✨ Peak physical performance','👯 Great for social plans','🧠 Sharp focus and memory','💃 High confidence'],energy:'High',libido:'High',skin:'Clear and glowing'},
  ovulation:{name:'Ovulation',emoji:'⭐',color:'#059669',bg:'#ecfdf5',desc:'An egg is released. You may notice a surge of confidence and energy today.',tips:['🌡️ Note any BBT rise','💫 You may feel a brief twinge','🏆 Peak fertility today','⚡ High energy — use it'],energy:'Peak',libido:'Peak',skin:'Best it\'ll look'},
  pms:{name:'PMS Phase',emoji:'🌤️',color:'#f59e0b',bg:'#fff8f0',desc:'Progesterone drops as your period approaches. Mood and physical symptoms may appear.',tips:['🥜 Magnesium-rich foods help','🧘 Gentle yoga over gym','☕ Reduce caffeine & alcohol','💬 Communicate your needs'],energy:'Declining',libido:'Low',skin:'May bloat or break out'},
  luteal:{name:'Luteal Phase',emoji:'🌙',color:'#8b5cf6',bg:'#faf5ff',desc:'Progesterone is high. You may feel calmer but tire more easily.',tips:['😴 Prioritise your sleep','🌰 Snack on nuts & seeds','🚶 Moderate exercise ideal','✍️ Good time for reflection'],energy:'Medium',libido:'Medium',skin:'May get oilier'},
};
const MOODS=[
  {id:'Happy',emoji:'😊'},{id:'Sad',emoji:'😢'},{id:'Anxious',emoji:'😰'},{id:'Irritable',emoji:'😤'},
  {id:'Calm',emoji:'😌'},{id:'Energetic',emoji:'⚡'},{id:'Romantic',emoji:'💕'},{id:'Sensitive',emoji:'🥺'},
  {id:'Low',emoji:'😞'},{id:'Confident',emoji:'💪'},{id:'Focused',emoji:'🎯'},{id:'Social',emoji:'🌟'},
];
const SYMPTOMS=[
  {id:'Cramps',emoji:'🤕'},{id:'Headache',emoji:'🤯'},{id:'Bloating',emoji:'🫃'},{id:'Back Pain',emoji:'😣'},
  {id:'Acne',emoji:'😅'},{id:'Fatigue',emoji:'😴'},{id:'Nausea',emoji:'🤢'},{id:'Tender Breasts',emoji:'💗'},
  {id:'Dizziness',emoji:'😵'},{id:'Insomnia',emoji:'🌙'},{id:'Hot Flashes',emoji:'🔥'},{id:'Cravings',emoji:'🍫'},
];
const FLOWS=[
  {id:'spotting',label:'Spotting',color:'#fda4af',size:6},
  {id:'light',label:'Light',color:'#f472b6',size:10},
  {id:'medium',label:'Medium',color:'#ec4899',size:14},
  {id:'heavy',label:'Heavy',color:'#be185d',size:18},
  {id:'very_heavy',label:'Very Heavy',color:'#881337',size:22},
];
const DISCHARGE=['None','Dry','Sticky','Creamy','Watery','Egg White','Unusual'];
const EXERCISE=['Rest 🛌','Walk 🚶','Yoga 🧘','Gym 💪','Run 🏃','Swim 🏊','Cycling 🚴','Other'];
const SLEEP_Q=['Poor 😴','Fair 😐','Good 🙂','Great 😄'];
const SEX=['Protected','Unprotected','None'];

// ─── State ────────────────────────────────────────────────────────────────────
const state={
  tab:'home',
  periods:load('periods',[]),
  logs:load('logs',{}),
  notes:load('notes',{}),
  settings:load('settings',{cycleLength:28,periodLength:5,name:'',contraception:'None',darkMode:false}),
  dismissed:load('dismissed',[]),
};

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
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
const div=(cls,ch=[])=>{const e=document.createElement('div');if(cls)e.className=cls;ch.forEach(c=>{if(c)e.appendChild(typeof c==='string'?document.createTextNode(c):c);});return e;};
function btn(cls,html,onClick){const b=el('button',{class:cls});b.innerHTML=html;b.addEventListener('click',onClick);return b;}
function p(cls,text){const e=el('p',{class:cls});e.textContent=text;return e;}
function cardEl(children=[],extraClass=''){
  const c=div('card '+(extraClass||''));
  children.forEach(ch=>{if(ch)c.appendChild(typeof ch==='string'?document.createTextNode(ch):ch);});
  return c;
}
function sectionLabel(text,emoji=''){
  const d=div('section-label');
  if(emoji)d.appendChild(document.createTextNode(emoji+' '));
  d.appendChild(document.createTextNode(text));
  return d;
}
function muted(text){return p('muted',text);}

function sliderEl({min,max,value,color,onChange,title='',unit='',showCentered=false}){
  const wrap=div('slider-wrap');
  if(showCentered){
    const vd=div('slider-centered-val');
    const big=el('span',{class:'big'});big.style.color=color;big.textContent=value;
    const u=el('span',{class:'unit'});u.textContent=unit;
    vd.appendChild(big);vd.appendChild(u);wrap.appendChild(vd);
  } else if(title){
    const hd=div('slider-header');
    const tl=div('slider-title');tl.textContent=title;
    const vb=div('');vb.innerHTML=`<span class="slider-val-badge" style="color:${color}">${value}</span><span class="slider-unit">${unit}</span>`;
    hd.appendChild(tl);hd.appendChild(vb);wrap.appendChild(hd);
  }
  const inp=el('input',{type:'range',min,max,value});
  const pct=Math.round(((value-min)/(max-min))*100);
  const trackCol=`linear-gradient(to right,${color} 0%,${color} ${pct}%,var(--border) ${pct}%,var(--border) 100%)`;
  inp.style.background=trackCol;
  inp.addEventListener('input',e=>{
    const v=+e.target.value,pp=Math.round(((v-min)/(max-min))*100);
    inp.style.background=`linear-gradient(to right,${color} 0%,${color} ${pp}%,var(--border) ${pp}%,var(--border) 100%)`;
    if(showCentered){const b=wrap.querySelector('.big');if(b)b.textContent=v;}
    else if(title){const b=wrap.querySelector('.slider-val-badge');if(b)b.textContent=v;}
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
  if(active&&activeColor){b.style.background=activeColor;b.style.borderColor='transparent';b.style.color='#fff';}
  b.addEventListener('click',onClick);
  return b;
}
function selChipEl(label,active,onClick,pink=false){
  const b=el('button',{class:'sel-chip'+(active?(pink?' on-pink':' on'):'')});
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
  t.value=value||'';t.addEventListener('input',e=>onChange(e.target.value));return t;
}

// ─── Cycle Ring ───────────────────────────────────────────────────────────────
function cycleRing(progress,color,day,total,size=120){
  const r=(size/2)-8,cx=size/2,cy=size/2,circ=2*Math.PI*r;
  const dash=circ*(Math.min(progress,100)/100);
  const wrap=div('ring-wrap');
  wrap.innerHTML=`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="ring-track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dasharray 1s cubic-bezier(.34,1.56,.64,1);filter:drop-shadow(0 0 6px ${color}44)"/>
    </svg>
    <div class="ring-label">
      <div class="ring-day" style="color:${color}">${day}</div>
      <div class="ring-total">/ ${total}</div>
    </div>`;
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
    if(isToday)bar.style.boxShadow='0 0 10px #10b981aa';
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
function metricCard(label,value,sub,color,bg,iconName){
  const c=div('metric-card');
  c.style.background=bg;c.style.border='none';
  const ico=div('metric-icon');ico.style.background=color+'22';
  ico.innerHTML=icon(iconName,16,color,2);
  const v=div('metric-value');v.textContent=value;v.style.color=color;
  const l=div('metric-label');l.textContent=label;l.style.color=color;l.style.opacity='.6';
  c.appendChild(ico);c.appendChild(v);c.appendChild(l);
  if(sub){const s=div('metric-sub');s.textContent=sub;s.style.color=color;c.appendChild(s);}
  return c;
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome(pred,periods,logs,alerts,settings,suppressOv){
  const today=todayStr();
  const todayLog=logs[today]||{};
  const wrap=div('scroll');

  if(!pred){
    const e=div('empty');
    const ico=div('empty-icon');ico.innerHTML=icon('heart',38,'#d946a8',1.5);
    e.appendChild(ico);
    const t=el('h2',{style:{color:'var(--text)',fontWeight:'800',fontSize:'22px',letterSpacing:'-.03em'}});t.textContent='Welcome, '+settings.name+'!';
    const s=muted('Log your first period using the Calendar tab, or tap Log to track today.');
    e.appendChild(t);e.appendChild(s);
    const b=btn('btn-primary',icon('plus',16,'#fff',2.5)+' Log today',()=>{state.tab='log';render();});
    b.style.cssText='margin-top:8px;max-width:200px';
    e.appendChild(b);
    wrap.appendChild(e);return wrap;
  }

  const ph=PHASES[pred.phase]||PHASES.follicular;

  // Alert banners
  alerts.forEach(a=>{
    const banner=div('alert-banner '+(a.warn?'alert-banner-warn':'alert-banner-info'));
    const head=div('alert-banner-head');
    head.innerHTML=icon('alert',14,a.warn?'var(--primary)':'var(--primary-2)',2)+' ';
    const t=el('span');t.textContent=a.title;head.appendChild(t);
    const x=el('button',{style:{background:'none',border:'none',cursor:'pointer',padding:'2px',marginLeft:'auto',flexShrink:'0'}});
    x.innerHTML=icon('close',14,'var(--text-soft)');
    x.onclick=()=>{state.dismissed.push(a.id);save('dismissed',state.dismissed);render();};
    head.appendChild(x);
    banner.appendChild(head);banner.appendChild(muted(a.body));
    wrap.appendChild(banner);
  });

  // Phase hero
  const hero=div(`phase-hero phase-${pred.phase}`);
  const top=div('phase-hero-top');
  const left=div('phase-hero-left');
  const badge=div('phase-badge');
  badge.innerHTML=`<span>${ph.emoji}</span><span style="color:${ph.color}">${ph.name} · Day ${pred.cycleDay}</span>`;
  const desc=el('p',{style:{fontSize:'14px',color:'var(--text-mid)',lineHeight:'1.65',margin:'6px 0 0'}});
  desc.textContent=ph.desc;
  left.appendChild(badge);left.appendChild(desc);
  top.appendChild(left);
  top.appendChild(cycleRing(Math.min((pred.cycleDay/pred.avgCycle)*100,100),ph.color,pred.cycleDay,pred.avgCycle,120));
  hero.appendChild(top);

  const vitals=div('phase-vitals');
  [['Energy',ph.energy],['Libido',ph.libido],['Skin',ph.skin]].forEach(([l,v])=>{
    const vt=div('vital');
    const vl=div('vital-label');vl.textContent=l;
    const vv=div('vital-value');vv.textContent=v;vv.style.color=ph.color;
    vt.appendChild(vl);vt.appendChild(vv);vitals.appendChild(vt);
  });
  hero.appendChild(vitals);
  ph.tips.forEach(t=>{
    const tr=div('tip-row');
    const dot=div('tip-dot');dot.style.background=ph.color;
    tr.appendChild(dot);
    const span=el('span');span.textContent=t;tr.appendChild(span);
    hero.appendChild(tr);
  });
  wrap.appendChild(hero);

  // Metrics grid — tinted backgrounds
  const mg=div('metrics-grid');
  const fertScore=pred.fertilityMap[today]||0;
  const dl=pred.daysLeft;
  mg.appendChild(metricCard('Next Period',dl<=0?'Today':dl+'d',fmtShort(pred.nextStart),'#e879b8','#fdf2f8','drop'));
  mg.appendChild(suppressOv
    ? metricCard('Method',settings.contraception,'adjusted','#9333ea','#f5f3ff','pill')
    : metricCard('Ovulation',fmtShort(pred.ovulation),'predicted','#10b981','#f0fdf8','heart'));
  mg.appendChild(metricCard('Avg Cycle',pred.avgCycle+'d','± '+Math.round(pred.cycleStd)+'d','#8b5cf6','#f5f3ff','refresh'));
  mg.appendChild(suppressOv
    ? metricCard('Regularity',pred.regularity!=null?pred.regularity+'%':'—','cycle score','#6366f1','#eef2ff','activity')
    : metricCard('Fertility',fertScore+'%','today',fertScore>70?'#10b981':fertScore>30?'#f59e0b':'#94a3b8',fertScore>70?'#f0fdf8':fertScore>30?'#fffbeb':'#f8fafc','spark'));
  wrap.appendChild(mg);

  // Fertility strip
  if(!suppressOv&&fertScore>0){
    const fc=cardEl([sectionLabel('Fertility Forecast','🌿'),fertilityStrip(pred)]);
    wrap.appendChild(fc);
  }

  // Today log
  const tc=cardEl([sectionLabel('Today','📋')]);
  if(todayLog.flow||todayLog.mood?.length||todayLog.symptoms?.length){
    const tr=div('quick-log-strip');
    if(todayLog.flow){const f=FLOWS.find(x=>x.id===todayLog.flow);if(f){const qt=div('quick-tag');qt.innerHTML=`💧 ${f.label} flow`;tr.appendChild(qt);}}
    (todayLog.mood||[]).forEach(m=>{const mo=MOODS.find(x=>x.id===m);if(mo){const qt=div('quick-tag');qt.textContent=mo.emoji+' '+m;tr.appendChild(qt);}});
    (todayLog.symptoms||[]).forEach(s=>{const sy=SYMPTOMS.find(x=>x.id===s);if(sy){const qt=div('quick-tag');qt.textContent=sy.emoji+' '+s;tr.appendChild(qt);}});
    tc.appendChild(tr);
    const lb=btn('btn-ghost',icon('plus',14,'var(--primary)',2)+' Add more',()=>{state.tab='log';render();});
    lb.style.cssText='margin-top:8px;padding:6px 0;font-size:13px;color:var(--primary);font-weight:600;display:flex;align-items:center;gap:4px';
    tc.appendChild(lb);
  } else {
    tc.appendChild(muted('Nothing logged today yet.'));
    const lb=btn('btn-primary',icon('plus',15,'#fff',2.5)+' Log how you feel',()=>{state.tab='log';render();});
    lb.style.marginTop='12px';tc.appendChild(lb);
  }
  wrap.appendChild(tc);

  // Recent periods
  if(periods.length){
    const hc=cardEl([sectionLabel('Recent Periods','🗓️')]);
    [...periods].sort((a,b)=>b.start.localeCompare(a.start)).slice(0,3).forEach(pp=>{
      const row=div('hist-row');
      const s=el('span',{style:{fontWeight:'600',color:'var(--text)'}});s.textContent=fmtFull(pp.start);
      const d=el('span',{class:'muted'});d.textContent=diffDays(pp.start,pp.end)+1+' days';
      row.appendChild(s);row.appendChild(d);hc.appendChild(row);
    });
    wrap.appendChild(hc);
  }
  return wrap;
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function renderCalendar(periods,pred,logs){
  const now=new Date();
  let yr=now.getFullYear(),mo=now.getMonth(),sel=null;
  const wrap=div('scroll');

  function rebuild(){
    wrap.innerHTML='';
    const card=cardEl([]);
    const nav=div('month-nav');
    const prev=el('button',{class:'arrow-btn'});prev.innerHTML=icon('chevL',16,'var(--text-mid)');
    prev.onclick=()=>{mo===0?(yr--,mo=11):mo--;rebuild();};
    const next=el('button',{class:'arrow-btn'});next.innerHTML=icon('chevR',16,'var(--text-mid)');
    next.onclick=()=>{mo===11?(yr++,mo=0):mo++;rebuild();};
    const title=el('span',{style:{fontSize:'17px',fontWeight:'800',color:'var(--text)',letterSpacing:'-.03em'}});
    title.textContent=new Date(yr,mo).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    nav.appendChild(prev);nav.appendChild(title);nav.appendChild(next);card.appendChild(nav);

    const grid=div('cal-grid');
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{const l=div('cal-day-label');l.textContent=d;grid.appendChild(l);});
    for(let i=0;i<firstDOW(yr,mo);i++)grid.appendChild(div(''));
    const today=todayStr();
    for(let d=1;d<=daysInMonth(yr,mo);d++){
      const ds=isoDate(yr,mo,d);
      const inPeriod=periods.some(pp=>ds>=pp.start&&ds<=pp.end);
      let bg='transparent',color='var(--text)',border='transparent',dash=false;
      if(inPeriod){bg='#e879b8';color='#fff';}
      else if(pred){
        for(let c=0;c<6;c++){
          const offset=c*pred.avgCycle;
          const pStart=addDays(pred.nextStart,offset);
          const pEnd=addDays(pStart,pred.avgPeriod-1);
          const ov=addDays(pStart,-14);
          const fS=addDays(ov,-5);const fE=addDays(ov,1);const pms=addDays(pStart,-7);
          if(pEnd<isoDate(yr,mo,1))continue;
          if(pStart>isoDate(yr,mo,daysInMonth(yr,mo))&&c>0)break;
          if(ds>=pStart&&ds<=pEnd){bg='rgba(232,121,184,.15)';color='#e879b8';dash=true;break;}
          else if(ds===ov){bg='#10b981';color='#fff';break;}
          else if(ds>=fS&&ds<=fE){bg='rgba(16,185,129,.14)';color='#10b981';break;}
          else if(ds>=pms&&ds<pStart){bg='rgba(245,158,11,.14)';color='#d97706';break;}
        }
      }
      const cell=el('button',{class:'cal-day'});
      cell.textContent=d;
      cell.style.background=bg;cell.style.color=color;
      cell.style.borderColor=dash?'rgba(232,121,184,.5)':border;
      if(dash)cell.style.borderStyle='dashed';
      if(ds===today){cell.style.outline='2.5px solid var(--primary-2)';cell.style.outlineOffset='1px';}
      if(ds===sel){cell.style.outline='2.5px solid var(--text)';cell.style.outlineOffset='1px';}
      if(logs[ds]){
        const dot=div('');dot.style.cssText='width:4px;height:4px;background:var(--primary-2);border-radius:50%;position:absolute;bottom:3px';
        cell.style.position='relative';cell.appendChild(dot);
      }
      cell.onclick=()=>{sel=sel===ds?null:ds;rebuild();};
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    wrap.appendChild(card);

    const leg=div('legend');
    [['#e879b8','Period'],['rgba(232,121,184,.4)','Predicted',true],['#10b981','Ovulation'],['rgba(16,185,129,.4)','Fertile'],['rgba(245,158,11,.4)','PMS']].forEach(([c,l,d])=>{
      const it=div('legend-item');
      const dot=div('legend-dot');dot.style.background=c;
      if(d){dot.style.border='1.5px dashed #e879b8';dot.style.background='transparent';}
      it.appendChild(dot);const lt=el('span');lt.textContent=l;it.appendChild(lt);leg.appendChild(it);
    });
    wrap.appendChild(leg);

    if(sel){
      const sp=periods.find(pp=>sel>=pp.start&&sel<=pp.end);
      const sc=cardEl([]);
      const sh=sectionLabel(fmtFull(sel),'📍');sc.appendChild(sh);
      if(sp){
        if(sel>sp.start){
          sc.appendChild(muted('Day '+(diffDays(sp.start,sel)+1)+' of your period (started '+fmtShort(sp.start)+')'));
          sc.appendChild(div('',[]));// spacer
          const eb=btn('btn-secondary',icon('check',14,'var(--text-mid)',2)+' End period on this day',()=>{
            state.periods=state.periods.map(pp=>pp.id===sp.id?{...pp,end:sel}:pp);
            save('periods',state.periods);sel=null;rebuild();
          });sc.appendChild(eb);
        } else {
          sc.appendChild(muted('Period start day — tap below to remove this entry entirely.'));
          const rb=btn('btn-danger',icon('trash',14,'var(--danger-text)',2)+' Remove period entry',()=>{
            state.periods=state.periods.filter(pp=>pp.id!==sp.id);
            save('periods',state.periods);sel=null;rebuild();
          });
          rb.style.marginTop='10px';sc.appendChild(rb);
        }
      } else {
        const ab=btn('btn-primary',icon('drop',14,'#fff',2)+' Mark as period start',()=>{
          const end=addDays(sel,state.settings.periodLength-1);
          state.periods=[...state.periods.filter(pp=>Math.abs(diffDays(pp.start,sel))>state.settings.periodLength),{start:sel,end,id:Date.now()}].sort((a,b)=>a.start.localeCompare(b.start));
          save('periods',state.periods);sel=null;rebuild();
        });sc.appendChild(ab);
      }
      if(logs[sel]){
        const tg=div('quick-log-strip');tg.style.marginTop='12px';
        const fl=FLOWS.find(f=>f.id===logs[sel].flow);
        if(fl){const qt=div('quick-tag');qt.innerHTML=`💧 ${fl.label} flow`;tg.appendChild(qt);}
        (logs[sel].symptoms||[]).forEach(s=>{const sy=SYMPTOMS.find(x=>x.id===s);const qt=div('quick-tag');qt.textContent=(sy?.emoji||'•')+' '+s;tg.appendChild(qt);});
        (logs[sel].mood||[]).forEach(m=>{const mo=MOODS.find(x=>x.id===m);const qt=div('quick-tag');qt.textContent=(mo?.emoji||'•')+' '+m;tg.appendChild(qt);});
        sc.appendChild(tg);
      }
      wrap.appendChild(sc);
    }
  }
  rebuild();
  return wrap;
}

// ─── LOG ──────────────────────────────────────────────────────────────────────
function renderLog(logs,notes){
  let date=todayStr(),dirty=false,savedTimeout=null;
  const wrap=div('scroll');wrap.style.paddingBottom='110px';

  function rebuild(){
    wrap.innerHTML='';
    const log=logs[date]||{};
    const note=notes[date]||'';
    const pred=buildPredictions(state.periods,state.settings);
    const isPeriod=state.periods.some(pp=>date>=pp.start&&date<=pp.end);

    function setLog(field,val){const cur=logs[date]||{};logs[date]={...cur,[field]:val};state.logs=logs;save('logs',logs);dirty=true;rebuildSaveBar();}
    function toggleLog(field,item){const cur=logs[date]||{};const arr=cur[field]||[];logs[date]={...cur,[field]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]};state.logs=logs;save('logs',logs);dirty=true;rebuildSaveBar();}

    // Date nav
    const dc=cardEl([]);
    const dn=div('date-nav');
    const prev=div('date-nav-btn');prev.innerHTML=icon('chevL',15,'var(--text-mid)');
    prev.onclick=()=>{date=addDays(date,-1);rebuild();};
    const nxt=div('date-nav-btn');nxt.innerHTML=icon('chevR',15,'var(--text-mid)');
    nxt.onclick=()=>{if(date<todayStr()){date=addDays(date,1);rebuild();}};
    const dl=div('date-label');
    const dld=div('date-label-day');dld.textContent=fmtDay(date);
    const dlc=div('date-label-context');
    const fertScore=pred?.fertilityMap[date]||0;
    const phaseLabel=pred?(date>=pred.nextStart&&date<=pred.nextEnd?'Predicted period day':date===pred.ovulation?'Predicted ovulation ⭐':date>=pred.fertileStart&&date<=pred.fertileEnd?'Fertile window 🌿':date>=(pred.pmsStart||'')&&date<(pred.nextStart||'')?'PMS window 🌤️':''):null;
    dlc.textContent=phaseLabel||(fertScore>0?`Fertility: ${fertScore}%`:'');
    dlc.style.color=date===pred?.ovulation?'#10b981':date>=(pred?.fertileStart||'zzz')&&date<=(pred?.fertileEnd||'')?'#10b981':'var(--text-soft)';
    dl.appendChild(dld);if(dlc.textContent)dl.appendChild(dlc);
    dn.appendChild(prev);dn.appendChild(dl);dn.appendChild(nxt);
    dc.appendChild(dn);
    // Date input fallback
    const di=inputEl('date',date,v=>{date=v;rebuild();},{max:todayStr()});
    di.style.display='none';di.id='log-date-input';
    dc.appendChild(di);
    wrap.appendChild(dc);

    // Period banner
    const pb=div('period-banner'+(isPeriod?' active':''));
    const pbi=div('period-banner-icon');
    pbi.innerHTML=icon('drop',18,isPeriod?'#fff':'#e879b8',2);
    const pbt=div('');
    const pbtitle=el('div',{style:{fontSize:'14px',fontWeight:'700',color:isPeriod?'var(--primary)':'var(--text)'}});
    pbtitle.textContent=isPeriod?'Period day logged':'Mark as period day';
    const pbsub=el('div',{style:{fontSize:'12px',color:'var(--text-soft)',marginTop:'2px'}});
    pbsub.textContent=isPeriod?'Tap to undo':'Start tracking this period';
    pbt.appendChild(pbtitle);pbt.appendChild(pbsub);
    pb.appendChild(pbi);pb.appendChild(pbt);
    pb.onclick=()=>{
      if(isPeriod){
        const sp=state.periods.find(pp=>date>=pp.start&&date<=pp.end);
        if(sp)state.periods=state.periods.filter(pp=>pp.id!==sp.id);
      } else {
        const end=addDays(date,state.settings.periodLength-1);
        state.periods=[...state.periods.filter(pp=>Math.abs(diffDays(pp.start,date))>state.settings.periodLength),{start:date,end,id:Date.now()}].sort((a,b)=>a.start.localeCompare(b.start));
      }
      save('periods',state.periods);dirty=true;rebuildSaveBar();rebuild();
    };
    wrap.appendChild(pb);

    // Flow
    const fc=cardEl([sectionLabel('Flow','💧')]);
    const fr=div('flow-row');
    FLOWS.forEach(f=>{
      const b=div('flow-btn'+(log.flow===f.id?' on':''));
      if(log.flow===f.id){b.style.background=`${f.color}22`;b.style.borderColor=f.color;}
      const dot=div('flow-dot');dot.style.width=f.size+'px';dot.style.height=f.size+'px';
      dot.style.color=f.color;dot.style.background=log.flow===f.id?f.color:f.color+'55';
      const lbl=el('span',{style:{fontSize:'10px',color:log.flow===f.id?f.color:'var(--text-soft)',fontWeight:'600',lineHeight:'1.2'}});lbl.textContent=f.label;
      b.appendChild(dot);b.appendChild(lbl);
      b.onclick=()=>{setLog('flow',log.flow===f.id?null:f.id);rebuild();};
      fr.appendChild(b);
    });
    fc.appendChild(fr);wrap.appendChild(fc);

    // Mood
    const mc=cardEl([sectionLabel('How do you feel?','💭')]);
    const mg=div('emoji-grid');
    MOODS.forEach(m=>{
      const b=div('emoji-chip'+((log.mood||[]).includes(m.id)?' on':''));
      const em=div('em');em.textContent=m.emoji;
      const lbl=el('span');lbl.textContent=m.id;
      b.appendChild(em);b.appendChild(lbl);
      b.onclick=()=>{toggleLog('mood',m.id);rebuild();};
      mg.appendChild(b);
    });
    mc.appendChild(mg);wrap.appendChild(mc);

    // Symptoms
    const sc=cardEl([sectionLabel('Symptoms','🩺')]);
    const sg=div('emoji-grid');
    SYMPTOMS.forEach(s=>{
      const b=div('emoji-chip'+((log.symptoms||[]).includes(s.id)?' on-pink':''));
      const em=div('em');em.textContent=s.emoji;
      const lbl=el('span');lbl.textContent=s.id;
      b.appendChild(em);b.appendChild(lbl);
      b.onclick=()=>{toggleLog('symptoms',s.id);rebuild();};
      sg.appendChild(b);
    });
    sc.appendChild(sg);wrap.appendChild(sc);

    // Pain
    const pc=cardEl([sectionLabel('Pain Level','😣')]);
    const painVal=log.pain||0;
    const painDesc=painVal>=8?'Severe 😰':painVal>=6?'Moderate–Severe':painVal>=4?'Moderate 😕':painVal>=2?'Mild 🙂':'No pain 😊';
    pc.appendChild(sliderEl({min:0,max:10,value:painVal,color:'#8b5cf6',title:'Pain',unit:'',onChange:v=>{setLog('pain',v);const b=pc.querySelector('.slider-val-badge');if(b)b.textContent=v;}}));
    const pd=muted(painDesc);pd.id='pain-desc';pd.style.marginTop='8px';pd.style.textAlign='center';pc.appendChild(pd);
    wrap.appendChild(pc);

    // Sleep
    const slc=cardEl([sectionLabel('Sleep','🌙')]);
    const slr=div('chip-row');slr.style.marginBottom='14px';
    SLEEP_Q.forEach(q=>slr.appendChild(chipEl(q,log.sleep===q,()=>{setLog('sleep',log.sleep===q?null:q);rebuild();})));
    slc.appendChild(slr);
    const shVal=log.sleepHours!=null?log.sleepHours:7;
    slc.appendChild(sliderEl({min:0,max:13,value:shVal,color:'#818cf8',title:'Hours slept',unit:'h',onChange:v=>{setLog('sleepHours',v);}}));
    wrap.appendChild(slc);

    // Water
    const wc=cardEl([sectionLabel('Water','💧')]);
    wc.appendChild(sliderEl({min:0,max:12,value:log.water||0,color:'#38bdf8',title:'Glasses today',unit:'',onChange:v=>{setLog('water',v);}}));
    wrap.appendChild(wc);

    // Exercise
    const ec=cardEl([sectionLabel('Exercise','🏃')]);
    const er=div('chip-row');
    EXERCISE.forEach(ex=>{
      const b=chipEl(ex,log.exercise===ex,()=>{setLog('exercise',log.exercise===ex?null:ex);rebuild();});
      if(log.exercise===ex){b.style.background='rgba(16,185,129,.12)';b.style.borderColor='#6ee7b7';b.style.color='#059669';}
      er.appendChild(b);
    });
    ec.appendChild(er);wrap.appendChild(ec);

    // Intimacy
    const ic=cardEl([sectionLabel('Intimacy','💕')]);
    const ir=div('chip-row');
    SEX.forEach(s=>ir.appendChild(chipEl(s,log.sex===s,()=>{setLog('sex',log.sex===s?null:s);rebuild();})));
    ic.appendChild(ir);wrap.appendChild(ic);

    // Discharge
    const ddc=cardEl([sectionLabel('Discharge','🔬')]);
    const ddr=div('sel-grid');
    DISCHARGE.forEach(d=>ddr.appendChild(selChipEl(d,log.discharge===d,()=>{setLog('discharge',log.discharge===d?null:d);rebuild();})));
    ddc.appendChild(ddr);wrap.appendChild(ddc);

    // BBT
    const bc=cardEl([sectionLabel('Temperature (BBT)','🌡️')]);
    const br=div('');br.style.cssText='display:flex;align-items:center;gap:14px';
    const bw=div('bbt-wrap');
    const bi=el('input',{class:'bbt-input',type:'number',step:'0.01',min:'35',max:'40.5',placeholder:'36.50',value:log.temp||''});
    bi.oninput=e=>{setLog('temp',e.target.value);};
    const bu=div('bbt-unit');bu.textContent='°C';
    bw.appendChild(bi);bw.appendChild(bu);
    const bm=muted('Measure immediately after waking, before getting up.');bm.style.flex='1';bm.style.fontSize='12px';
    br.appendChild(bw);br.appendChild(bm);bc.appendChild(br);wrap.appendChild(bc);

    // Journal
    const jc=cardEl([sectionLabel('Journal','✍️')]);
    const ta=textareaEl(note,v=>{notes[date]=v;state.notes=notes;save('notes',notes);dirty=true;rebuildSaveBar();},'How are you feeling today?');
    jc.appendChild(ta);wrap.appendChild(jc);
  }

  // Save bar
  const saveBar=div('save-bar');saveBar.id='save-bar';
  let isSaved=false;
  function rebuildSaveBar(){
    const sb=saveBar.querySelector('.save-btn')||el('button',{class:'save-btn'});
    if(isSaved){sb.style.cssText='width:100%;background:linear-gradient(135deg,#10b981,#34d399);color:#fff;border:none;padding:14px 22px;border-radius:15px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 4px 18px rgba(16,185,129,.3);font-family:inherit;cursor:pointer';sb.innerHTML=icon('check',16,'#fff',2.5)+' Saved!';}
    else if(dirty){sb.style.cssText='width:100%;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;border:none;padding:14px 22px;border-radius:15px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 4px 18px rgba(217,70,168,.28);font-family:inherit;cursor:pointer';sb.innerHTML=icon('save',16,'#fff',2)+' Save Entry';}
    else{sb.style.cssText='width:100%;background:var(--surface);color:var(--text-soft);border:1.5px solid var(--border);padding:14px 22px;border-radius:15px;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;font-family:inherit;cursor:pointer';sb.innerHTML=icon('save',16,'var(--text-soft)',2)+' Save Entry';}
    sb.onclick=()=>{isSaved=true;dirty=false;rebuildSaveBar();if(savedTimeout)clearTimeout(savedTimeout);savedTimeout=setTimeout(()=>{isSaved=false;rebuildSaveBar();},2500);};
    saveBar.innerHTML='';saveBar.appendChild(sb);
  }
  rebuildSaveBar();
  document.getElementById('app').appendChild(saveBar);
  rebuild();
  return wrap;
}

// ─── INSIGHTS + HEALTH ────────────────────────────────────────────────────────
function renderInsights(periods,logs,pred,settings,alerts,insights){
  const wrap=div('scroll');

  // Health alerts first (if any)
  if(alerts.length){
    alerts.forEach(a=>{
      const banner=div('alert-banner '+(a.warn?'alert-banner-warn':'alert-banner-info'));
      const head=div('alert-banner-head');
      head.innerHTML=icon('alert',14,'var(--primary)',2)+' ';
      const t=el('span');t.textContent=a.title;head.appendChild(t);
      const x=el('button',{style:{background:'none',border:'none',cursor:'pointer',padding:'2px',marginLeft:'auto'}});
      x.innerHTML=icon('close',14,'var(--text-soft)');
      x.onclick=()=>{state.dismissed.push(a.id);save('dismissed',state.dismissed);render();};
      head.appendChild(x);
      banner.appendChild(head);banner.appendChild(muted(a.body));
      wrap.appendChild(banner);
    });
  }

  if(!periods.length){
    const e=div('empty');
    const ico=div('empty-icon');ico.innerHTML=icon('chart',36,'var(--primary)',1.5);
    e.appendChild(ico);e.appendChild(muted('Log at least one period to unlock your cycle insights.'));
    wrap.appendChild(e);return wrap;
  }

  const gaps=pred?.gaps||[];
  const allLogs=Object.entries(logs);

  // Metrics
  const mg=div('metrics-grid');
  mg.appendChild(metricCard('Avg Cycle',(pred?.avgCycle||settings.cycleLength)+'d',pred?'± '+Math.round(pred.cycleStd)+'d':'','#8b5cf6','#f5f3ff','refresh'));
  mg.appendChild(metricCard('Avg Period',(pred?.avgPeriod||settings.periodLength)+'d','','#e879b8','#fdf2f8','drop'));
  mg.appendChild(metricCard('Cycles',periods.length,'logged','#10b981','#f0fdf8','calendar'));
  const reg=pred?.regularity;
  mg.appendChild(metricCard('Regularity',reg!=null?reg+'%':'—',reg>=80?'Regular':reg>=60?'Moderate':'Irregular',reg>=80?'#10b981':reg>=60?'#f59e0b':'#f43f5e',reg>=80?'#f0fdf8':reg>=60?'#fffbeb':'#fff1f2','activity'));
  wrap.appendChild(mg);

  // Cycle history chart
  if(gaps.length){
    const bc=cardEl([sectionLabel('Cycle History','📊')]);
    const bch=div('bar-chart');
    gaps.forEach(g=>{
      const col=div('bar-col');
      const fill=div('bar-fill');
      fill.style.height=Math.min(100,Math.round((g/50)*100))+'%';
      fill.style.background=g<21||g>35?'#f43f5e':g<24||g>32?'#f59e0b':'#8b5cf6';
      fill.style.borderRadius='5px 5px 0 0';
      const lbl=div('bar-lbl');lbl.textContent=g;
      col.appendChild(fill);col.appendChild(lbl);bch.appendChild(col);
    });
    bc.appendChild(bch);bc.appendChild(muted('Days between cycles. Normal range: 21–35 days'));
    wrap.appendChild(bc);
  }

  // Symptom frequency
  const sf={};SYMPTOMS.forEach(s=>sf[s.id]=0);allLogs.forEach(([,l])=>(l.symptoms||[]).forEach(s=>sf[s]=(sf[s]||0)+1));
  const topS=Object.entries(sf).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).slice(0,6);
  const maxS=Math.max(...topS.map(([,v])=>v),1);
  if(topS.length){
    const sc=cardEl([sectionLabel('Symptom Frequency','🩺')]);
    topS.forEach(([s,c])=>{
      const sy=SYMPTOMS.find(x=>x.id===s);
      const r=div('ins-row');
      const l=div('ins-label');l.textContent=(sy?.emoji||'•')+' '+s;
      const t=div('ins-track');const b=div('ins-bar');b.style.width=Math.round((c/maxS)*100)+'%';b.style.background='linear-gradient(90deg,#e879b8,#f472b6)';
      t.appendChild(b);
      const ct=div('ins-count');ct.textContent=c;
      r.appendChild(l);r.appendChild(t);r.appendChild(ct);sc.appendChild(r);
    });
    wrap.appendChild(sc);
  }

  // Mood frequency
  const mf={};MOODS.forEach(m=>mf[m.id]=0);allLogs.forEach(([,l])=>(l.mood||[]).forEach(m=>mf[m]=(mf[m]||0)+1));
  const topM=Object.entries(mf).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).slice(0,6);
  const maxM=Math.max(...topM.map(([,v])=>v),1);
  if(topM.length){
    const mc=cardEl([sectionLabel('Mood Frequency','💭')]);
    topM.forEach(([m,c])=>{
      const mo=MOODS.find(x=>x.id===m);
      const r=div('ins-row');
      const l=div('ins-label');l.textContent=(mo?.emoji||'•')+' '+m;
      const t=div('ins-track');const b=div('ins-bar');b.style.width=Math.round((c/maxM)*100)+'%';b.style.background='linear-gradient(90deg,#8b5cf6,#a78bfa)';
      t.appendChild(b);
      const ct=div('ins-count');ct.textContent=c;
      r.appendChild(l);r.appendChild(t);r.appendChild(ct);mc.appendChild(r);
    });
    wrap.appendChild(mc);
  }

  // Health insights
  const healthInsights=insights.filter(i=>!['healthy','regular'].includes(i.id));
  if(healthInsights.length){
    const ic=cardEl([sectionLabel('Health Insights','💡')]);
    healthInsights.forEach(ins=>{
      const hc=div('health-card health-card-info');
      const ht=div('');ht.style.cssText='display:flex;align-items:flex-start;gap:10px;margin-bottom:8px';
      const dot=div('health-dot');dot.style.background='var(--primary-2)';
      const title=el('b',{style:{flex:'1',color:'var(--text)',fontSize:'14px'}});title.textContent=ins.title;
      ht.appendChild(dot);ht.appendChild(title);
      const body=muted(ins.body);body.style.paddingLeft='18px';
      hc.appendChild(ht);hc.appendChild(body);ic.appendChild(hc);
    });
    wrap.appendChild(ic);
  }

  // BBT chart
  const bbtData=allLogs.filter(([,l])=>l.temp&&+l.temp>35&&+l.temp<40.5).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
  if(bbtData.length>2){
    const btc=cardEl([sectionLabel('Body Temperature (BBT)','🌡️')]);
    const temps=bbtData.map(([,l])=>+l.temp);
    const mn=Math.min(...temps)-.2,mx=Math.max(...temps)+.2,w=300,h=70;
    const pts=temps.map((t,i)=>`${Math.round((i/(temps.length-1))*w)},${Math.round(h-((t-mn)/(mx-mn))*h)}`).join(' ');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${w} ${h+20}`);svg.setAttribute('width','100%');svg.setAttribute('height',h+20);svg.style.overflow='visible';
    svg.innerHTML=`<polyline points="${pts}" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linejoin="round"/>${temps.map((t,i)=>`<circle cx="${Math.round((i/(temps.length-1))*w)}" cy="${Math.round(h-((t-mn)/(mx-mn))*h)}" r="3.5" fill="#8b5cf6"/>`).join('')}<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="var(--border)" stroke-width="1"/>`;
    btc.appendChild(svg);btc.appendChild(muted('A rise of ~0.2–0.5°C after ovulation is normal'));
    wrap.appendChild(btc);
  }

  // Upcoming predictions
  if(pred){
    const pc=cardEl([sectionLabel('Upcoming Periods','📅')]);
    const conf=pred.confidence;
    const cm=muted(`Confidence: ${conf.charAt(0).toUpperCase()+conf.slice(1)} · ${pred.totalCycles} cycle${pred.totalCycles!==1?'s':''} logged`);
    cm.style.marginBottom='14px';pc.appendChild(cm);
    for(let i=0;i<3;i++){
      const st=addDays(pred.nextStart,i*pred.avgCycle),en=addDays(st,pred.avgPeriod-1),ov=addDays(st,-14);
      const r=div('pred-row');
      const dot=div('pred-dot');
      const info=div('');
      const ttl=el('div',{style:{fontWeight:'700',color:'var(--text)',marginBottom:'3px',fontSize:'14px'}});
      ttl.textContent='Period: '+fmtShort(st)+' – '+fmtShort(en);
      const sub=muted('Ovulation: ~'+fmtShort(ov));sub.style.fontSize='12px';
      info.appendChild(ttl);info.appendChild(sub);r.appendChild(dot);r.appendChild(info);pc.appendChild(r);
    }
    wrap.appendChild(pc);
  }

  // When to see a doctor
  const rc=cardEl([sectionLabel('When to See a Doctor','🏥')]);
  ['Periods lasting more than 7 days','Soaking through protection every hour for several hours','Severe pain that prevents daily activities','Bleeding between periods regularly','No period for 90+ days (and not pregnant)','A sudden change in your usual cycle pattern'].forEach(txt=>{
    const r=div('');r.style.cssText='padding:9px 0;font-size:13px;color:var(--text-mid);border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start';
    const dot=div('');dot.style.cssText='width:6px;height:6px;border-radius:50%;background:var(--primary);margin-top:5px;flex-shrink:0';
    const t=el('span');t.textContent=txt;r.appendChild(dot);r.appendChild(t);rc.appendChild(r);
  });
  wrap.appendChild(rc);
  return wrap;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function renderSettings(){
  const s=state.settings;
  const wrap=div('scroll');
  function upd(k,v){state.settings={...s,[k]:v};save('settings',state.settings);render();}

  // Profile
  const profc=cardEl([]);
  const profrow=div('');profrow.style.cssText='display:flex;align-items:center;gap:16px;margin-bottom:20px';
  const avatar=div('');avatar.style.cssText='width:56px;height:56px;border-radius:18px;background:var(--gradient);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;font-weight:800;color:#fff';
  avatar.textContent=s.name?s.name[0].toUpperCase():'?';
  const profinfo=div('');const pnt=el('div',{style:{fontSize:'18px',fontWeight:'800',color:'var(--text)',letterSpacing:'-.03em'}});pnt.textContent=s.name||'Your profile';const pns=muted('Tap below to update your name');
  profinfo.appendChild(pnt);profinfo.appendChild(pns);
  profrow.appendChild(avatar);profrow.appendChild(profinfo);profc.appendChild(profrow);
  const nl=el('label',{style:{fontSize:'13px',fontWeight:'600',color:'var(--text-soft)',display:'block',marginBottom:'8px'}});nl.textContent='Your name';
  const ni=inputEl('text',s.name,v=>upd('name',v));
  profc.appendChild(nl);profc.appendChild(ni);wrap.appendChild(profc);

  // Cycle settings
  const cc=cardEl([sectionLabel('Cycle Settings','🔄')]);
  const cl=div('');cl.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px';
  const clt=el('span',{style:{fontSize:'14px',fontWeight:'600',color:'var(--text)'}});clt.textContent='Cycle length';
  const clv=el('span',{style:{fontSize:'22px',fontWeight:'800',color:'var(--primary)'}});clv.textContent=s.cycleLength+' days';
  cl.appendChild(clt);cl.appendChild(clv);cc.appendChild(cl);
  cc.appendChild(sliderEl({min:18,max:50,value:s.cycleLength,color:'#e879b8',onChange:v=>{clv.textContent=v+' days';upd('cycleLength',v);}}));
  const pl=div('');pl.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;margin-top:24px';
  const plt=el('span',{style:{fontSize:'14px',fontWeight:'600',color:'var(--text)'}});plt.textContent='Period length';
  const plv=el('span',{style:{fontSize:'22px',fontWeight:'800',color:'var(--primary-2)'}});plv.textContent=s.periodLength+' days';
  pl.appendChild(plt);pl.appendChild(plv);cc.appendChild(pl);
  cc.appendChild(sliderEl({min:1,max:10,value:s.periodLength,color:'#a855f7',onChange:v=>{plv.textContent=v+' days';upd('periodLength',v);}}));
  wrap.appendChild(cc);

  // Contraception
  const contc=cardEl([sectionLabel('Contraception','💊')]);
  contc.appendChild(muted('Bloom adjusts predictions and health insights based on your method.'));
  contc.style.gap='0';
  const contr=div('chip-row');contr.style.marginTop='12px';
  ['None','Pill','IUD','Implant','Patch','Condoms','Other'].forEach(c=>contr.appendChild(chipEl(c,s.contraception===c,()=>upd('contraception',c))));
  contc.appendChild(contr);wrap.appendChild(contc);

  // Appearance
  const appc=cardEl([sectionLabel('Appearance','🎨')]);
  const dtw=div('toggle-row');
  const dleft=div('');dleft.style.cssText='display:flex;align-items:center;gap:14px;flex:1';
  const dico=div('setting-icon');dico.style.background=s.darkMode?'rgba(167,139,250,.15)':'rgba(251,191,36,.12)';
  dico.innerHTML=icon(s.darkMode?'moon':'sun',20,s.darkMode?'#a78bfa':'#f59e0b',1.75);
  const dinfo=div('');
  const dtitle=el('div',{style:{fontSize:'15px',fontWeight:'600',color:'var(--text)'}});dtitle.textContent='Dark Mode';
  const dsub=muted(s.darkMode?'Dark theme active':'Light theme active');dsub.style.fontSize='12px';
  dinfo.appendChild(dtitle);dinfo.appendChild(dsub);dleft.appendChild(dico);dleft.appendChild(dinfo);
  const tog=el('button',{class:'toggle'});tog.style.background=s.darkMode?'var(--primary)':'var(--border)';
  const thumb=div('toggle-thumb');thumb.style.left=s.darkMode?'26px':'4px';tog.appendChild(thumb);
  tog.onclick=()=>upd('darkMode',!s.darkMode);
  dtw.appendChild(dleft);dtw.appendChild(tog);appc.appendChild(dtw);wrap.appendChild(appc);

  // Export
  const ec=cardEl([sectionLabel('Your Data','📦')]);
  ec.appendChild(muted('Download your full data as JSON for backup or to share with a doctor.'));
  const db=btn('btn-secondary',icon('download',14,'var(--text-mid)',2)+' Download my data',()=>{
    try{
      const d={periods:state.periods,logs:state.logs,notes:state.notes,settings:state.settings,exported:new Date().toISOString()};
      const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=url;a.download='bloom-data.json';document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);document.body.removeChild(a);},1000);
    }catch{alert('Download failed. Please try a different browser.');}
  });
  db.style.marginTop='12px';ec.appendChild(db);
  const delb=btn('btn-danger',icon('trash',14,'var(--danger-text)',2)+' Delete all data',()=>{
    if(confirm('This will permanently delete all your Bloom data. Are you sure?')){
      ['periods','logs','notes','settings','dismissed'].forEach(k=>{try{localStorage.removeItem('bloom_'+k);}catch{}});
      state.periods=[];state.logs={};state.notes={};state.dismissed=[];
      state.settings={cycleLength:28,periodLength:5,name:'',contraception:'None',darkMode:false};
      state.tab='home';render();
    }
  });
  delb.style.marginTop='8px';ec.appendChild(delb);wrap.appendChild(ec);

  // About
  const ab=cardEl([sectionLabel('About Bloom','🌸')]);
  ab.appendChild(muted('Bloom v3 — Free, private period and health tracker. All your data is stored only on this device. No servers. No subscriptions. No ads.'));
  wrap.appendChild(ab);
  return wrap;
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function renderOnboard(){
  let step=0;
  const form={name:'',cycleLength:28,periodLength:5,lastPeriod:''};
  const root=div('ob-root');
  // Decorative blobs
  const b1=div('blob');b1.style.cssText='top:-80px;right:-80px;width:280px;height:280px;background:radial-gradient(circle,rgba(217,70,168,.2) 0%,transparent 65%)';
  const b2=div('blob');b2.style.cssText='bottom:-60px;left:-60px;width:240px;height:240px;background:radial-gradient(circle,rgba(147,51,234,.15) 0%,transparent 65%)';
  root.appendChild(b1);root.appendChild(b2);
  const card=div('ob-card');root.appendChild(card);

  function buildDots(){
    const d=div('ob-dots');
    for(let i=0;i<5;i++){const dot=div('ob-dot');dot.style.width=i===step?'24px':'7px';dot.style.background=i===step?'var(--primary)':'var(--border)';d.appendChild(dot);}
    return d;
  }

  function finish(){
    const merged={...state.settings,...form};state.settings=merged;save('settings',merged);
    if(form.lastPeriod){const pp=[{start:form.lastPeriod,end:addDays(form.lastPeriod,form.periodLength-1),id:Date.now()}];state.periods=pp;save('periods',pp);}
    render();
  }

  const steps=[
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='var(--gradient)';ic.innerHTML=icon('heart',32,'#fff',1.5);card.appendChild(ic);
      const t=el('h1',{class:'ob-title'});t.textContent='Welcome to Bloom';card.appendChild(t);
      const s=el('p',{class:'ob-sub'});s.textContent='Your private, intelligent period tracker. No subscriptions, no account. Your data never leaves your device.';card.appendChild(s);
      card.appendChild(btn('btn-primary','Get started →',()=>{step=1;steps[step]();}));
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='var(--gradient-bg)';ic.innerHTML='<span style="font-size:32px">👋</span>';card.appendChild(ic);
      const t=el('h2',{class:'ob-title'});t.textContent="What's your name?";card.appendChild(t);
      const s=el('p',{class:'ob-sub'});s.textContent='Just your first name so Bloom can personalise your experience.';card.appendChild(s);
      const inp=inputEl('text',form.name,v=>{form.name=v;});inp.placeholder='Your first name';card.appendChild(inp);
      card.appendChild(btn('btn-primary','Continue →',()=>{if(!inp.value.trim()){inp.focus();return;}form.name=inp.value.trim();step=2;steps[step]();}));
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='var(--gradient-bg)';ic.innerHTML='<span style="font-size:32px">🔄</span>';card.appendChild(ic);
      const t=el('h2',{class:'ob-title'});t.textContent='Your cycle length';card.appendChild(t);
      const s=el('p',{class:'ob-sub'});s.textContent='How many days from the start of one period to the next? Most cycles are 24–35 days.';card.appendChild(s);
      card.appendChild(sliderEl({min:18,max:50,value:form.cycleLength,color:'#e879b8',showCentered:true,unit:' days',onChange:v=>form.cycleLength=v}));
      card.appendChild(btn('btn-primary','Continue →',()=>{step=3;steps[step]();}));
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='var(--gradient-bg)';ic.innerHTML='<span style="font-size:32px">💧</span>';card.appendChild(ic);
      const t=el('h2',{class:'ob-title'});t.textContent='Period length';card.appendChild(t);
      const s=el('p',{class:'ob-sub'});s.textContent='How many days does your period usually last?';card.appendChild(s);
      card.appendChild(sliderEl({min:1,max:10,value:form.periodLength,color:'#a855f7',showCentered:true,unit:' days',onChange:v=>form.periodLength=v}));
      card.appendChild(btn('btn-primary','Continue →',()=>{step=4;steps[step]();}));
      card.appendChild(buildDots());
    },
    ()=>{
      card.innerHTML='';
      const ic=div('ob-icon');ic.style.background='var(--gradient-bg)';ic.innerHTML='<span style="font-size:32px">📅</span>';card.appendChild(ic);
      const t=el('h2',{class:'ob-title'});t.textContent='Last period start date';card.appendChild(t);
      const s=el('p',{class:'ob-sub'});s.textContent='This helps Bloom calculate your next period and current cycle phase right away.';card.appendChild(s);
      const inp=inputEl('date',form.lastPeriod,v=>form.lastPeriod=v);inp.max=todayStr();card.appendChild(inp);
      card.appendChild(btn('btn-primary','Start tracking 🌸',()=>{if(!inp.value){inp.focus();return;}form.lastPeriod=inp.value;finish();}));
      card.appendChild(btn('btn-ghost','Skip for now',finish));
      card.appendChild(buildDots());
    },
  ];
  steps[0]();
  return root;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  const app=document.getElementById('app');
  const existingSaveBar=document.getElementById('save-bar');if(existingSaveBar)existingSaveBar.remove();
  app.innerHTML='';

  const theme=state.settings.darkMode?'dark':'light';
  app.dataset.theme=theme;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name=theme-color]').content=state.settings.darkMode?'#0d0921':'#d946a8';

  // Background blobs
  const pred=buildPredictions(state.periods,state.settings);
  const phaseColors={menstrual:'#e879b8',follicular:'#9d5cf6',fertile:'#10b981',ovulation:'#10b981',pms:'#f59e0b',luteal:'#8b5cf6'};
  const col=pred&&phaseColors[pred.phase]?phaseColors[pred.phase]:'#9d5cf6';
  const blob1=div('blob');blob1.style.cssText=`top:-140px;right:-100px;width:380px;height:380px;background:radial-gradient(circle,${col}28 0%,transparent 65%)`;
  const blob2=div('blob');blob2.style.cssText='bottom:-80px;left:-80px;width:300px;height:300px;background:radial-gradient(circle,rgba(147,51,234,.12) 0%,transparent 65%)';
  app.appendChild(blob1);app.appendChild(blob2);

  if(!state.settings.name){app.appendChild(renderOnboard());return;}

  const health=analyzeHealth(state.periods,state.logs,pred,state.settings);
  const activeAlerts=health.alerts.filter(a=>!state.dismissed.includes(a.id));
  const suppressOv=['Pill','Implant','Patch'].includes(state.settings.contraception);

  // Header
  const header=div('header');
  const brand=div('brand');
  const bi=div('brand-icon');bi.innerHTML=icon('heart',16,'#d946a8',2);
  const bn=div('brand-name');bn.textContent='bloom';
  brand.appendChild(bi);brand.appendChild(bn);header.appendChild(brand);
  const right=div('header-right');
  const greet=el('span',{class:'header-greeting'});greet.textContent='Hi, '+state.settings.name;
  right.appendChild(greet);
  if(activeAlerts.length){const badge=div('alert-badge');badge.textContent=activeAlerts.length;right.appendChild(badge);}
  header.appendChild(right);app.appendChild(header);

  // Screen content
  const screen=div('screen');
  const t=state.tab;
  let content;
  if(t==='home')content=renderHome(pred,state.periods,state.logs,activeAlerts,state.settings,suppressOv);
  else if(t==='calendar')content=renderCalendar(state.periods,pred,state.logs);
  else if(t==='log')content=renderLog(state.logs,state.notes);
  else if(t==='insights')content=renderInsights(state.periods,state.logs,pred,state.settings,activeAlerts,health.insights);
  else if(t==='settings')content=renderSettings();
  if(content)screen.appendChild(content);
  app.appendChild(screen);

  // Nav — 5 tabs
  const nav=div('nav');
  const tabs=[
    {id:'home',icon:'home',label:'Home'},
    {id:'calendar',icon:'calendar',label:'Calendar'},
    {id:'log',icon:'plus',label:'Log',special:true},
    {id:'insights',icon:'chart',label:'Insights',badge:activeAlerts.length},
    {id:'settings',icon:'gear',label:'You'},
  ];
  tabs.forEach(tb=>{
    if(tb.special){
      const b=el('button',{class:'nav-btn nav-log'+(state.tab===tb.id?' active':'')});
      const circle=div('nav-log-circle');circle.innerHTML=icon('plus',22,'#fff',2.5);
      const lbl=el('span',{class:'nav-label'});lbl.textContent=tb.label;
      lbl.style.color=state.tab===tb.id?'var(--primary)':'var(--text-soft)';
      b.appendChild(circle);b.appendChild(lbl);
      b.onclick=()=>{state.tab=tb.id;render();};
      nav.appendChild(b);return;
    }
    const b=el('button',{class:'nav-btn'+(state.tab===tb.id?' active':'')});
    const ic=div('');ic.style.position='relative';
    ic.innerHTML=icon(tb.icon,22,state.tab===tb.id?'var(--primary)':'var(--text-soft)',state.tab===tb.id?2:1.75);
    if(tb.badge){const dot=div('nav-dot');dot.textContent=tb.badge;ic.appendChild(dot);}
    const lbl=el('span',{class:'nav-label'});lbl.textContent=tb.label;
    b.appendChild(ic);b.appendChild(lbl);
    b.onclick=()=>{state.tab=tb.id;render();};
    nav.appendChild(b);
  });
  app.appendChild(nav);
}

render();
