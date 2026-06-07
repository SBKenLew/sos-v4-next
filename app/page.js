'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { parseCSV, toDateKey } from '../lib/parser';
import { computeAll } from '../lib/engine';
import { ACTION_PRESETS, STORE_KEY, ACT_KEY } from '../lib/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  'Indoor Physical Activity':'#3B82F6','Outdoor Physical Activity':'#22C55E',
  Diet:'#84CC16',Sleep:'#A78BFA','Recovery Protocol':'#06B6D4',
  Breathwork:'#EC4899',Circadian:'#F97316',Supplement:'#F59E0B',
  Biohacking:'#00D4AA',Peptide:'#8B5CF6',Medication:'#F43F5E',
  Exercise:'#3B82F6',Other:'#94A3B8',
};

function bandInfo(sos){
  if(sos>=90)return['Elite Adaptive Physiology','band-elite'];
  if(sos>=80)return['Strong Recovery Resilience','band-strong'];
  if(sos>=70)return['Balanced Adaptive Physiology','band-balanced'];
  if(sos>=60)return['Mild Physiological Drift','band-drift'];
  if(sos>=40)return['Stress-Dominant State','band-stress'];
  return['Recovery Deficit / Instability','band-deficit'];
}
function ctxClass(ctx){
  const m={Optimal:'ctx-optimal',Overtraining:'ctx-overtraining','Stress-Dominant':'ctx-stress','MildStress-Dominant':'ctx-mildstress','Recovery Deficit':'ctx-deficit'};
  return m[ctx]||'ctx-neutral';
}
function tagClass(ctx){
  const m={Optimal:'tag-opt',Overtraining:'tag-over','Stress-Dominant':'tag-str','MildStress-Dominant':'tag-ms','Recovery Deficit':'tag-def'};
  return m[ctx]||'tag-neu';
}
function proBarColor(key,val){
  if(key==='PP')return val>.5?'var(--teal)':'var(--red)';
  if(key==='PR')return val>.5?'var(--blue)':'var(--muted)';
  if(key==='PM')return val>.5?'var(--amber)':'var(--muted)';
  if(key==='PS')return val>.5?'var(--red)':'var(--teal)';
  return'var(--muted)';
}
function proLabel(key,val){
  if(key==='PP')return val>.5?'Positive':'Below threshold';
  if(key==='PR')return val>.5?'Recovery':'Low recovery';
  if(key==='PM')return val>.5?'MildStress active':'MildStress low';
  if(key==='PS')return val>.5?'⚠ Stress active':'Stress low';
  return'';
}
function sigClass(as){
  if(as>=5)return'sig-p5';if(as>=4)return'sig-p4';if(as>=3)return'sig-p3';
  if(as>=2)return'sig-p2';if(as>=1)return'sig-p1';if(as===0)return'sig-z0';
  if(as>=-1)return'sig-n1';if(as>=-3)return'sig-n3';return'sig-n5';
}
function sigText(as){
  if(as>=5)return'⬆⬆ Optimal adaptive response';
  if(as>=4)return'⬆⬆ Hormetic correction (Overtraining ctx)';
  if(as>=3)return'⬆ Productive hormetic signal';
  if(as>=2)return'↑ Early adaptation — PP positive';
  if(as>=1)return'↑ Partially offset positive signal';
  if(as===0)return'→ Neutral — no net RLS contribution';
  if(as>=-1)return'↓ Maladaptive MildStress signal';
  if(as>=-3)return'↓ Stress-dominant response';
  return'↓↓ Acute overload compounding';
}
function bScoreLabel(bs){
  if(bs>=5)return'↑ Optimal adaptive';if(bs===4)return'↑ Hormetic correction';
  if(bs===3)return'↑ Hormetic stimulation';if(bs===2)return'↑ Positive (early adaptation)';
  if(bs===1)return'→ Monitor — stress offset';if(bs===0)return'→ Neutral';
  if(bs===-1)return'↓ Maladaptive MildStress';if(bs===-3)return'↓ Stress-dominant response';
  if(bs===-5)return'↓ Acute overload compounding';return'→ Neutral';
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Home(){
  const [rawRows, setRawRows]      = useState([]);
  const [dailyActs, setDailyActs]  = useState({});
  const [results, setResults]      = useState([]);
  const [viewDays, setViewDaysS]   = useState(90);
  const [dayDetail, setDayDetail]  = useState(null);
  const [drawerOpen, setDrawerOpen]= useState(false);
  const [modalOpen, setModalOpen]  = useState(false);
  const [actRange, setActRange]    = useState(7);
  const [actFrom, setActFrom]      = useState('');
  const [actTo, setActTo]          = useState('');
  const [actsOnly, setActsOnly]    = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [toast, setToast]          = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [drag, setDrag]            = useState(false);

  // Drawer form state
  const [fDate, setFDate]          = useState('');
  const [fState, setFState]        = useState(null);
  const [fVS, setFVS]              = useState('');
  const [fHRV, setFHRV]            = useState('');
  const [fHR, setFHR]              = useState('');
  const [fDeep, setFDeep]          = useState('');
  const [fNSI, setFNSI]            = useState('0.50');
  const [fNotes, setFNotes]        = useState('');
  const [fCat, setFCat]            = useState('');
  const [fPreset, setFPreset]      = useState('');
  const [fCustom, setFCustom]      = useState('');
  const [pendingActs, setPendingActs] = useState([]);
  const [editingDate, setEditingDate] = useState(null);
  const [drawerTitle, setDrawerTitle] = useState('Log Daily Entry');

  // Refs
  const fileRef   = useRef();
  const trajRef   = useRef(); const trajChart = useRef(null);
  const stateRef  = useRef(); const stateChart= useRef(null);
  const hrvRef    = useRef(); const hrvChartR = useRef(null);
  const toastTimer= useRef(null);

  // ── Load from localStorage ────────────────────────────────────────────────
  useEffect(()=>{
    try{
      const rd=localStorage.getItem(STORE_KEY);
      const ra=localStorage.getItem(ACT_KEY);
      if(rd){const rows=JSON.parse(rd).map(r=>({...r,_date:new Date(r._date)}));setRawRows(rows);}
      if(ra)setDailyActs(JSON.parse(ra));
    }catch(e){}
  },[]);

  // ── Recompute ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!rawRows.length){setResults([]);return;}
    setResults(computeAll(rawRows,dailyActs));
  },[rawRows,dailyActs]);

  // ── Charts ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!results.length)return;
    const sl=getSlice(results,viewDays);
    renderTrajChart(sl);
    renderStateChart(sl);
    renderHRVChart(results.slice(-30));
  },[results,viewDays]);

  function getSlice(res,days){
    if(days===0||res.length<=days)return res;
    return res.slice(res.length-days);
  }

  function dotColor(r){
    if(r.Recovery===1)return'rgba(59,130,246,.9)';
    if(r.MildStress===1)return'rgba(245,158,11,.9)';
    if(r.Stress===1)return'rgba(239,68,68,.9)';
    return'rgba(100,116,139,.7)';
  }

  function renderTrajChart(sl){
    if(typeof window==='undefined')return;
    const Chart=window.Chart;
    if(!Chart||!trajRef.current)return;
    if(trajChart.current)trajChart.current.destroy();
    const ctx=trajRef.current.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,200);
    g.addColorStop(0,'rgba(0,212,170,.18)');g.addColorStop(1,'rgba(0,212,170,0)');
    const ptSizes=sl.map(r=>r.acts.length>0?8:4);
    const ptColors=sl.map(r=>r.acts.length>0?'rgba(167,139,250,.95)':dotColor(r));
    const ptBorders=sl.map(r=>r.acts.length>0?'rgba(167,139,250,.5)':'transparent');
    trajChart.current=new Chart(ctx,{
      type:'line',
      data:{labels:sl.map(r=>r.dateStr),datasets:[{
        label:'SOS™',data:sl.map(r=>r.sos),
        borderColor:'#00D4AA',borderWidth:2,
        pointRadius:ptSizes,pointBackgroundColor:ptColors,pointBorderColor:ptBorders,pointBorderWidth:2,
        pointHoverRadius:9,fill:true,backgroundColor:g,tension:0.35
      }]},
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        onClick(_e,els){if(!els.length)return;setDayDetail(sl[els[0].index]);},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'#1A2035',borderColor:'#1E2D45',borderWidth:1,
            titleColor:'#E2E8F0',bodyColor:'#94A3B8',
            callbacks:{
              title:i=>i[0].label,
              label:i=>`SOS: ${i.raw.toFixed(1)}`,
              afterBody:i=>{
                const r=sl[i[0].dataIndex];
                const lines=[
                  `VS:${r.VitalzScore}  HRV:${r.HRV}  HR:${r.HR}`,
                  `Rec:${r.rPct.toFixed(0)}%  MS:${r.mPct.toFixed(0)}%  Str:${r.sPct.toFixed(0)}%`,
                  `Context: ${r.ctx}`
                ];
                if(r.acts.length)lines.push(`Actions: ${r.acts.map(a=>a.name).join(', ')}`);
                lines.push('');lines.push('▶ Click to see action impact');
                return lines;
              }
            }
          }
        },
        scales:{
          x:{grid:{color:'rgba(30,45,69,.5)'},ticks:{color:'#64748B',maxTicksLimit:10,font:{size:10}},border:{color:'transparent'}},
          y:{min:0,max:100,grid:{color:'rgba(30,45,69,.5)'},ticks:{color:'#64748B',font:{size:10},stepSize:10},border:{color:'transparent'}}
        }
      }
    });
  }

  function renderStateChart(sl){
    if(typeof window==='undefined')return;
    const Chart=window.Chart;
    if(!Chart||!stateRef.current)return;
    if(stateChart.current)stateChart.current.destroy();
    const ctx=stateRef.current.getContext('2d');
    stateChart.current=new Chart(ctx,{
      type:'line',
      data:{labels:sl.map(r=>r.dateStr),datasets:[
        {label:'Recovery% (target 50–55)',data:sl.map(r=>r.rPct),borderColor:'#3B82F6',backgroundColor:'rgba(59,130,246,.12)',fill:true,borderWidth:1.5,pointRadius:0,tension:.4},
        {label:'MildStress% (target <45)',data:sl.map(r=>r.mPct),borderColor:'#F59E0B',backgroundColor:'rgba(245,158,11,.08)',fill:true,borderWidth:1.5,pointRadius:0,tension:.4},
        {label:'Stress% (target <15)',data:sl.map(r=>r.sPct),borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,.08)',fill:true,borderWidth:1.5,pointRadius:0,tension:.4},
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#64748B',font:{size:9},boxWidth:10}},tooltip:{backgroundColor:'#1A2035',borderColor:'#1E2D45',borderWidth:1,titleColor:'#E2E8F0',bodyColor:'#94A3B8'}},
        scales:{
          x:{ticks:{color:'#64748B',maxTicksLimit:6,font:{size:9}},grid:{display:false},border:{color:'transparent'}},
          y:{min:0,max:100,ticks:{color:'#64748B',font:{size:9},stepSize:25},grid:{color:'rgba(30,45,69,.4)'},border:{color:'transparent'}}
        }
      }
    });
  }

  function renderHRVChart(sl){
    if(typeof window==='undefined')return;
    const Chart=window.Chart;
    if(!Chart||!hrvRef.current)return;
    if(hrvChartR.current)hrvChartR.current.destroy();
    const ctx=hrvRef.current.getContext('2d');
    const base=sl.length?sl.reduce((a,r)=>a+r.HRV,0)/sl.length:50;
    hrvChartR.current=new Chart(ctx,{
      type:'bar',
      data:{labels:sl.map(r=>r.dateStr),datasets:[
        {label:'HRV (ms)',data:sl.map(r=>r.HRV),backgroundColor:sl.map(r=>r.HRV<base*.85?'rgba(239,68,68,.85)':'rgba(0,212,170,.75)'),borderRadius:3,yAxisID:'y'},
        {label:'HR (bpm)',data:sl.map(r=>r.HR),type:'line',borderColor:'rgba(245,158,11,.8)',pointRadius:3,pointBackgroundColor:'rgba(245,158,11,.9)',borderWidth:1.5,tension:.4,yAxisID:'y2'}
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#64748B',font:{size:10},boxWidth:10}},tooltip:{backgroundColor:'#1A2035',borderColor:'#1E2D45',borderWidth:1,titleColor:'#E2E8F0',bodyColor:'#94A3B8'}},
        scales:{
          x:{ticks:{color:'#64748B',maxTicksLimit:10,font:{size:9}},grid:{display:false},border:{color:'transparent'}},
          y:{position:'left',ticks:{color:'#64748B',font:{size:9}},grid:{color:'rgba(30,45,69,.4)'},border:{color:'transparent'},title:{display:true,text:'HRV ms',color:'#64748B',font:{size:9}}},
          y2:{position:'right',ticks:{color:'#64748B',font:{size:9}},grid:{display:false},border:{color:'transparent'},title:{display:true,text:'HR bpm',color:'#64748B',font:{size:9}}}
        }
      }
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg){
    setToast(msg);setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToastVisible(false),2800);
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  function persist(rows,acts){
    try{
      localStorage.setItem(STORE_KEY,JSON.stringify(rows.map(r=>({...r,_date:r._date.toISOString()}))));
      localStorage.setItem(ACT_KEY,JSON.stringify(acts));
    }catch(e){}
  }

  // ── CSV processing ────────────────────────────────────────────────────────
  function processText(text,silent=false){
    const parsed=parseCSV(text);
    if(!parsed.length){if(!silent)showToast('No valid rows found in this file');return;}

    setRawRows(prev=>{
      setDailyActs(prevActs=>{
        const nextActs={...prevActs};
        let importedActCount=0; const catsSeen=new Set();
        parsed.forEach(r=>{
          if(!r._acts||!r._acts.length)return;
          const dk=toDateKey(r._date);
          const existing=nextActs[dk]||[];
          const manualActs=existing.filter(a=>a._src!=='csv');
          const csvActs=r._acts.map(a=>({...a,_src:'csv'}));
          nextActs[dk]=[...manualActs,...csvActs];
          importedActCount+=csvActs.length;
          csvActs.forEach(a=>catsSeen.add(a.cat));
        });

        const manualKeys=new Set(prev.filter(r=>r.LoginEmail==='manual@entry').map(r=>toDateKey(r._date)));
        const newCSVRows=parsed.filter(r=>!manualKeys.has(toDateKey(r._date)));
        const existingCSVKeys=new Set(prev.filter(r=>r.LoginEmail!=='manual@entry').map(r=>toDateKey(r._date)));
        const brandNew=newCSVRows.filter(r=>!existingCSVKeys.has(toDateKey(r._date))).length;
        const overwrite=newCSVRows.filter(r=>existingCSVKeys.has(toDateKey(r._date))).length;

        const nextRows=[...prev.filter(r=>r.LoginEmail==='manual@entry'||!newCSVRows.some(n=>toDateKey(n._date)===toDateKey(r._date))),...newCSVRows].sort((a,b)=>a._date-b._date);
        persist(nextRows,nextActs);

        if(!silent){
          const parts=[];
          if(brandNew)parts.push(`${brandNew} new rows`);
          if(overwrite)parts.push(`${overwrite} updated`);
          if(importedActCount)parts.push(`${importedActCount} actions (${[...catsSeen].join(', ')})`);
          else parts.push('⚠ No ActionName columns detected');
          showToast(parts.join(' · ')+' ✓');
        }
        return nextActs;
      });
      return prev; // will be replaced by setRawRows below
    });

    // Simpler approach: update directly
    const manualKeys=new Set(rawRows.filter(r=>r.LoginEmail==='manual@entry').map(r=>toDateKey(r._date)));
    const newCSVRows=parsed.filter(r=>!manualKeys.has(toDateKey(r._date)));
    const nextRows=[...rawRows.filter(r=>r.LoginEmail==='manual@entry'||!newCSVRows.some(n=>toDateKey(n._date)===toDateKey(r._date))),...newCSVRows].sort((a,b)=>a._date-b._date);

    const nextActs={...dailyActs};
    let importedActCount=0; const catsSeen=new Set();
    parsed.forEach(r=>{
      if(!r._acts||!r._acts.length)return;
      const dk=toDateKey(r._date);
      const existing=nextActs[dk]||[];
      const manualActs=existing.filter(a=>a._src!=='csv');
      const csvActs=r._acts.map(a=>({...a,_src:'csv'}));
      nextActs[dk]=[...manualActs,...csvActs];
      importedActCount+=csvActs.length;
      csvActs.forEach(a=>catsSeen.add(a.cat));
    });

    setRawRows(nextRows);
    setDailyActs(nextActs);
    persist(nextRows,nextActs);

    if(!silent){
      const existingCSVKeys=new Set(rawRows.filter(r=>r.LoginEmail!=='manual@entry').map(r=>toDateKey(r._date)));
      const brandNew=newCSVRows.filter(r=>!existingCSVKeys.has(toDateKey(r._date))).length;
      const overwrite=newCSVRows.filter(r=>existingCSVKeys.has(toDateKey(r._date))).length;
      const parts=[];
      if(brandNew)parts.push(`${brandNew} new rows`);
      if(overwrite)parts.push(`${overwrite} updated`);
      if(importedActCount)parts.push(`${importedActCount} actions (${[...catsSeen].join(', ')})`);
      else parts.push('⚠ No ActionName columns detected');
      showToast(parts.join(' · ')+' ✓');
    }
  }

  function handleFile(e){
    const files=e.target.files; if(!files.length)return;
    Array.from(files).forEach((f,i)=>{
      const fr=new FileReader();
      fr.onload=ev=>processText(ev.target.result, i<files.length-1);
      fr.readAsText(f);
    });
    e.target.value='';
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV(){
    if(!rawRows.length){showToast('No data to export');return;}
    const sosMap={}; results.forEach(r=>{sosMap[r.dk]=r.sos;});
    const hdr='Date,LoginEmail,VitalzScore,HRV,HR,Recovery,MildStress,Stress,Deep,NextDayStressorIndex,SOS_Score,Actions\n';
    const rows=rawRows.map(r=>{
      const dk=toDateKey(r._date);
      const acts=(dailyActs[dk]||[]).map(a=>`${a.cat}:${a.name}`).join('|');
      const sos=sosMap[dk]!=null?sosMap[dk].toFixed(1):'';
      return[r.Date,r.LoginEmail||'',r.VitalzScore,r.HRV,r.HR,r.Recovery,r.MildStress,r.Stress,r.Deep,r.NextDayStressorIndex||'',sos,acts].join(',');
    });
    const blob=new Blob([hdr+rows.join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`sos_v4_export_${new Date().toISOString().slice(0,10)}.csv`;a.click();
    showToast('CSV exported ✓');
  }

  // ── Clear All ─────────────────────────────────────────────────────────────
  function clearAll(){
    if(!confirm('Clear ALL data — rows, actions, and LocalStorage?\n\nThis cannot be undone.'))return;
    localStorage.removeItem(STORE_KEY);localStorage.removeItem(ACT_KEY);
    setRawRows([]);setDailyActs({});setResults([]);setDayDetail(null);
    [trajChart,stateChart,hrvChartR].forEach(r=>{try{r.current&&r.current.destroy();}catch(e){}});
    trajChart.current=stateChart.current=hrvChartR.current=null;
    showToast('All data cleared');
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function openDrawer(dateStr){
    const today=new Date(); const ds=dateStr||toDateKey(today);
    setFDate(ds); setFState(null); setFVS(''); setFHRV(''); setFHR('');
    setFDeep(''); setFNSI('0.50'); setFNotes(''); setFCat(''); setFPreset(''); setFCustom('');
    const existing=rawRows.find(r=>toDateKey(r._date)===ds);
    if(existing){
      setEditingDate(ds);
      setFVS(existing.VitalzScore||''); setFHRV(existing.HRV||'');
      setFHR(existing.HR||''); setFDeep(existing.Deep||'');
      if(existing.NextDayStressorIndex!==''&&existing.NextDayStressorIndex!=null)
        setFNSI(parseFloat(existing.NextDayStressorIndex).toFixed(2));
      if(+existing.Recovery===1)setFState('Recovery');
      else if(+existing.MildStress===1)setFState('MildStress');
      else if(+existing.Stress===1)setFState('Stress');
      setDrawerTitle('Edit Entry — '+ds);
    } else {
      setEditingDate(null);
      setDrawerTitle('Log Entry — '+ds);
    }
    const acts=(dailyActs[ds]||[]).map(a=>({...a}));
    setPendingActs(acts);
    setDrawerOpen(true);
  }

  function saveEntry(){
    if(!fDate){showToast('Please select a date');return;}
    if(!fState){showToast('Please select a dominant state');return;}
    if(!fVS||!fHRV||!fHR){showToast('VitalzScore, HRV and Heart Rate are required');return;}
    const dt=new Date(fDate+'T12:00:00');
    const row={
      Date:fDate,LoginEmail:'manual@entry',
      VitalzScore:fVS,HRV:fHRV,HR:fHR,Deep:fDeep,
      Recovery:fState==='Recovery'?'1':'0',
      MildStress:fState==='MildStress'?'1':'0',
      Stress:fState==='Stress'?'1':'0',
      NextDayStressorIndex:fNSI,_date:dt
    };
    const nextRows=[...rawRows.filter(r=>toDateKey(r._date)!==fDate),row].sort((a,b)=>a._date-b._date);
    const nextActs={...dailyActs,[fDate]:[...pendingActs]};
    setRawRows(nextRows);setDailyActs(nextActs);
    persist(nextRows,nextActs);
    setDrawerOpen(false);
    showToast(editingDate?'Entry updated ✓':'Entry saved ✓');
  }

  function deleteEntry(dk){
    if(!confirm('Delete entry for '+dk+'?'))return;
    const nextRows=rawRows.filter(r=>toDateKey(r._date)!==dk);
    const nextActs={...dailyActs};delete nextActs[dk];
    setRawRows(nextRows);setDailyActs(nextActs);persist(nextRows,nextActs);
    showToast('Entry deleted');
  }

  // ── Action table filter ───────────────────────────────────────────────────
  function getFilteredResults(){
    if(!results.length)return[];
    const now=new Date();now.setHours(23,59,59,999);
    let fromDt,toDt=now;
    if(actFrom&&actTo){fromDt=new Date(actFrom+'T00:00:00');toDt=new Date(actTo+'T23:59:59');}
    else if(actRange>0){fromDt=new Date(now);fromDt.setDate(fromDt.getDate()-(actRange-1));fromDt.setHours(0,0,0,0);}
    else fromDt=null;
    let filtered=[...results].filter(r=>(!fromDt||r.date>=fromDt)&&r.date<=toDt).reverse();
    if(actsOnly)filtered=filtered.filter(r=>r.acts.length>0);
    return filtered;
  }

  function exportSelected(){
    if(!selectedDates.size){showToast('No rows selected');return;}
    const sosMap={};results.forEach(r=>{sosMap[r.dk]=r.sos;});
    const hdr='Date,LoginEmail,VitalzScore,HRV,HR,Recovery,MildStress,Stress,Deep,NextDayStressorIndex,SOS_Score,Actions\n';
    const rows=rawRows.filter(r=>selectedDates.has(toDateKey(r._date))).map(r=>{
      const dk=toDateKey(r._date);
      const acts=(dailyActs[dk]||[]).map(a=>`${a.cat}:${a.name}`).join('|');
      const sos=sosMap[dk]!=null?sosMap[dk].toFixed(1):'';
      return[r.Date,r.LoginEmail||'',r.VitalzScore,r.HRV,r.HR,r.Recovery,r.MildStress,r.Stress,r.Deep,r.NextDayStressorIndex||'',sos,acts].join(',');
    });
    const blob=new Blob([hdr+rows.join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`sos_selected_${new Date().toISOString().slice(0,10)}.csv`;a.click();
    showToast(`${selectedDates.size} date${selectedDates.size>1?'s':''} exported ✓`);
  }

  function toggleRowSelect(dk,checked){
    setSelectedDates(prev=>{const n=new Set(prev);if(checked)n.add(dk);else n.delete(dk);return n;});
  }
  function toggleAll(checked){
    const filtered=getFilteredResults();
    setSelectedDates(checked?new Set(filtered.map(r=>r.dk)):new Set());
  }

  // ── Derived values for render ─────────────────────────────────────────────
  const L=results.length?results[results.length-1]:null;
  const P=results.length>1?results[results.length-2]:L;
  const delta=L&&P?L.sos-P.sos:0;
  const hasDash=results.length>0;
  const filteredAct=getFilteredResults();
  const totalActRows=filteredAct.reduce((s,r)=>s+(r.acts.length||1),0);
  const totalActCount=filteredAct.reduce((s,r)=>s+r.acts.length,0);

  // ── Day Detail render helpers ─────────────────────────────────────────────
  function renderDayDetail(r){
    if(!r)return null;
    const stateLabel=r.Recovery===1?<span style={{color:'var(--blue)'}}>Recovery</span>:r.MildStress===1?<span style={{color:'var(--amber)'}}>MildStress</span>:<span style={{color:'var(--red)'}}>Stress</span>;
    const pros=[{k:'PP',v:r.PP,desc:'Pro_Positive'},{k:'PR',v:r.PR,desc:'Pro_Recovery'},{k:'PM',v:r.PM,desc:'Pro_MildStress'},{k:'PS',v:r.PS,desc:'Pro_Stress'}];
    const pen=r.otp+r.pis+r.rdp;
    const cl=r.cluster||{mod:0,label:'—',breakdown:[]};
    const actSum=r.acts.reduce((s,a)=>s+(a.as??r.as),0);
    return(
      <div className="day-detail">
        <div className="dd-hdr">
          <div>
            <div className="dd-date">{r.dateStr}</div>
            <div style={{marginTop:6}}><span className={`ctx-chip ${ctxClass(r.ctx)}`}>{r.ctx}</span></div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:3}}>SOS Score</div>
              <div className="dd-sos" style={{fontSize:22}}>{r.sos.toFixed(1)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setDayDetail(null)} style={{marginTop:2}}>✕</button>
          </div>
        </div>

        {/* Biometrics */}
        <div className="dd-meta">
          {[{l:'VitalzScore',v:r.VitalzScore,c:'var(--teal)'},{l:'HRV',v:r.HRV+'ms',c:r.HRV<50?'var(--red)':'var(--green)'},{l:'Heart Rate',v:r.HR+'bpm',c:r.HR>80?'var(--amber)':'var(--text)'},{l:'Deep Sleep',v:r.Deep?r.Deep+'min':'—',c:r.Deep&&r.Deep<72?'var(--amber)':'var(--text)'},{l:'NSI',v:r.NSI!=null?r.NSI.toFixed(2):'—',c:r.NSI!=null&&r.NSI>.6?'var(--red)':'var(--text)'},{l:'State',v:stateLabel,c:''}].map(m=>(
            <div className="dd-metric" key={m.l}>
              <div className="dm-label">{m.l}</div>
              <div className="dm-val" style={m.c?{color:m.c}:{}}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Pro_ bars */}
        <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:8}}>
          Pro_ Signal Dimensions <span style={{fontSize:9,color:'var(--muted)',fontWeight:400,textTransform:'none',letterSpacing:0}}>(T-1: today's biometrics score yesterday's actions)</span>
        </div>
        <div className="dd-pro-row">
          {pros.map(p=>(
            <div className="pro-pill" key={p.k}>
              <div className="pp-label">{p.k}</div>
              <div className="pp-bar"><div className="pp-fill" style={{width:`${p.v*100}%`,background:proBarColor(p.k,p.v)}}></div></div>
              <div className="pp-val" style={{color:proBarColor(p.k,p.v)}}>{p.v.toFixed(2)}</div>
              <div style={{fontSize:9,color:'var(--muted)',marginTop:2,textAlign:'center'}}>{proLabel(p.k,p.v)}</div>
            </div>
          ))}
        </div>

        {/* Score summary */}
        <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:8}}>Score Breakdown</div>
        <div className="dd-score-summary">
          {[['APS',r.aps,'var(--teal)'],['RLS',r.rls,'var(--blue)'],['CLS',r.cls,''],['DSS',r.dss,'']].map(([l,v,c],i)=>(
            <><div className="dd-sum-item" key={l}><div className="si-label">{l}</div><div className="si-val" style={c?{color:c}:{}}>{v.toFixed(1)}</div></div>{i<3&&<span style={{fontSize:12,color:'var(--muted)',alignSelf:'center'}}>+</span>}</>
          ))}
          <div className="dd-sum-div"/>
          <div className="dd-sum-item"><div className="si-label">OTP</div><div className="si-val" style={{color:r.otp>0?'var(--red)':'var(--muted)'}}>−{r.otp}</div></div>
          <div className="dd-sum-item"><div className="si-label">PIS</div><div className="si-val" style={{color:r.pis>0?'var(--red)':'var(--muted)'}}>−{r.pis}</div></div>
          <div className="dd-sum-item"><div className="si-label">RDP</div><div className="si-val" style={{color:r.rdp>1?'var(--red)':'var(--muted)'}}>−{r.rdp.toFixed(1)}</div></div>
          <div className="dd-sum-div"/>
          <div className="dd-sum-item"><div className="si-label">BaseScore</div><div className={`si-val ${r.bs>=0?'pos':'neg'}`}>{r.bs>=0?'+':''}{r.bs}</div></div>
          <div className="dd-sum-item"><div className="si-label">TPM</div><div className={`si-val ${r.tp>=0?'pos':'neg'}`}>{r.tp>=0?'+':''}{r.tp.toFixed(1)}</div></div>
          <div className="dd-sum-item"><div className="si-label">Cluster</div><div className="si-val" style={{color:cl.mod>=0?'var(--teal)':'var(--red)',fontSize:14}}>{cl.mod>=0?'+':''}{cl.mod.toFixed(2)}</div></div>
          <div className="dd-sum-item"><div className="si-label">RLS_raw</div><div className="si-val" style={{color:(r.rlsRaw||0)>=0?'var(--blue)':'var(--red)',fontSize:16}}>{(r.rlsRaw||0)>=0?'+':''}{(r.rlsRaw||0).toFixed(1)}</div></div>
          <div className="dd-sum-div"/>
          <div className="dd-sum-item" style={{minWidth:64}}><div className="si-label">Total SOS</div><div className="si-val" style={{color:'var(--teal)',fontSize:20,fontWeight:800}}>{r.sos.toFixed(1)}</div></div>
        </div>

        {/* Action list */}
        <div className="dd-actions-title">
          {!r.acts||!r.acts.length?'No Actions Logged for this Day':`ActionName Cluster Score — ${r.acts.length} Action${r.acts.length>1?'s':''} · §15–§19 RLS Engine`}
        </div>
        {(!r.acts||!r.acts.length)?(
          <div className="dd-no-actions">
            No lifestyle interventions recorded for {r.dateStr}.<br/>
            <span style={{color:'var(--muted2)'}}>Click <b>Edit / Add Actions</b> below to log what you did.</span>
          </div>
        ):(
          <>
            {r.acts.map((a,i)=>{
              const color=CAT_COLORS[a.cat]||'#94A3B8';
              const aScore=a.as??r.as;
              const aBS=a.bs??r.bs;
              const aTPM=a.tpm??r.tp;
              const aSig=a.signal||bScoreLabel(aBS);
              const sigColor=aScore>=3?'var(--teal)':aScore>=1?'var(--green)':aScore===0?'var(--muted)':aScore>=-1?'var(--amber)':'var(--red)';
              return(
                <div className="dd-action-row" key={i}>
                  <div className="dd-act-top">
                    <div className="dd-cat-dot" style={{background:color}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="dd-act-name">{a.name}{a._src==='csv'&&<span style={{fontSize:9,background:'rgba(0,212,170,.15)',color:'var(--teal)',padding:'1px 6px',borderRadius:10,fontWeight:700,verticalAlign:'middle',marginLeft:4}}>CSV</span>}</div>
                      <div className="dd-act-cat">{a.cat}</div>
                    </div>
                    <span style={{fontSize:10,color:'var(--muted)'}}>{i+1}/{r.acts.length}</span>
                  </div>
                  <div className="dd-act-bottom">
                    <div className="dd-score-col"><div className="sc-label">Base</div><div className={`sc-val ${aBS>=0?'pos':'neg'}`}>{aBS>=0?'+':''}{aBS}</div></div>
                    <div className="dd-op">+</div>
                    <div className="dd-score-col"><div className="sc-label">TPM</div><div className={`sc-val ${aTPM>=0?'pos':'neg'}`}>{aTPM>=0?'+':''}{aTPM.toFixed(1)}</div></div>
                    <div className="dd-op">=</div>
                    <div className="dd-score-col"><div className="sc-label">ActionScore</div><div className="sc-val" style={{color:aScore>=0?'var(--teal)':'var(--red)',fontWeight:700}}>{aScore>=0?'+':''}{aScore.toFixed(1)}</div></div>
                    <div className="dd-score-col sc-signal" style={{flex:2}}><div className="sc-label">Signal</div><div className="sc-val" style={{color:sigColor,fontSize:10}}>{aSig}</div></div>
                  </div>
                </div>
              );
            })}
            {/* Cluster block */}
            <div style={{background:'var(--card)',border:`1px solid ${cl.mod>0?'var(--teal)':cl.mod<0?'var(--red)':'var(--border)'}`,borderRadius:10,padding:'10px 14px',marginTop:6}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--text)'}}>Cluster Score</span>
                <span style={{fontSize:11,fontWeight:800,color:cl.mod>0?'var(--teal)':cl.mod<0?'var(--red)':'var(--muted)'}}>{cl.mod>0?'+':''}{cl.mod.toFixed(2)}</span>
                <span style={{fontSize:10,color:'var(--muted)',marginLeft:'auto'}}>{cl.label}</span>
              </div>
              {cl.breakdown.length?(
                <div style={{fontSize:10,color:'var(--muted2)',lineHeight:1.7}}>
                  {cl.breakdown.map((b,i)=><div key={i}>{b}</div>)}
                </div>
              ):<div style={{fontSize:10,color:'var(--muted)'}}>No cluster modifier — single category or insufficient combination</div>}
            </div>
            {/* RLS summary */}
            <div style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.25)',borderRadius:10,padding:'10px 14px',marginTop:6,display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{fontSize:10,color:'var(--muted)'}}>Σ ActionScores</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{actSum>=0?'+':''}{actSum.toFixed(1)}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>+ Cluster</div>
              <div style={{fontSize:14,fontWeight:700,color:cl.mod>=0?'var(--teal)':'var(--red)'}}>{cl.mod>=0?'+':''}{cl.mod.toFixed(2)}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>= RLS_raw</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{(r.rlsRaw||0)>=0?'+':''}{(r.rlsRaw||0).toFixed(2)}</div>
              <div style={{marginLeft:'auto',textAlign:'right'}}>
                <div style={{fontSize:10,color:'var(--muted)'}}>RLS (0–25)</div>
                <div style={{fontSize:20,fontWeight:800,color:'var(--blue)'}}>{r.rls.toFixed(1)}</div>
              </div>
            </div>
            {/* Why context */}
            <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',marginTop:6,fontSize:11,color:'var(--muted2)',lineHeight:1.7}}>
              <b style={{color:'var(--text)'}}>§17 Context (day-level avg):</b> &nbsp;
              <span style={{color:'var(--teal)'}}>{r.ctx}</span> &nbsp;·&nbsp;
              PP avg {r.PP.toFixed(2)} &nbsp;·&nbsp; PR avg {r.PR.toFixed(2)} &nbsp;·&nbsp;
              PM avg {r.PM.toFixed(2)} &nbsp;·&nbsp; PS avg {r.PS.toFixed(2)}
              <br/><span style={{color:'var(--muted)'}}>Each ActionName is scored with its own Pro_ values from the CSV row.</span>
            </div>
          </>
        )}

        <div className="dd-footer">
          <button className="btn btn-ghost btn-sm" onClick={()=>setDayDetail(null)}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setDayDetail(null);openDrawer(r.dk);}}>✏ Edit / Add Actions</button>
        </div>
      </div>
    );
  }

  // ── Action table rows ─────────────────────────────────────────────────────
  function renderActRows(){
    if(!filteredAct.length)return(
      <tr className="no-data-row"><td colSpan={14}>No data in selected range — try a wider window or upload a CSV</td></tr>
    );
    const rows=[];
    filteredAct.forEach(r=>{
      if(r.acts.length===0){
        rows.push(
          <tr key={`${r.dk}-0`} className="date-group-first" onClick={()=>setDayDetail(r)}>
            <td onClick={e=>e.stopPropagation()}><input type="checkbox" className="row-check" checked={selectedDates.has(r.dk)} onChange={e=>toggleRowSelect(r.dk,e.target.checked)}/></td>
            <td style={{whiteSpace:'nowrap',fontWeight:700}}>{r.dateStr}</td>
            <td style={{fontWeight:700,color:'var(--teal)'}}>{r.VitalzScore}</td>
            <td><span style={{color:'var(--muted)',fontSize:10,fontStyle:'italic'}}>No actions logged — click ＋ Log Action to add</span></td>
            <td><span className={`tag ${tagClass(r.ctx)}`}>{r.ctx}</span></td>
            <td/><td/><td/><td/>
            <td/><td/><td/>
            <td className={r.rls>=15?'pos':r.rls>=10?'':'neg'} style={{fontWeight:700}}>{r.rls.toFixed(1)}</td>
            <td/>
          </tr>
        );
      } else {
        r.acts.forEach((a,ai)=>{
          const first=ai===0;
          const isLast=ai===r.acts.length-1;
          const aBS=a.bs??r.bs;
          const aTPM=a.tpm??r.tp;
          const aAS=a.as??r.as;
          const aSig=a.signal||bScoreLabel(aBS);
          rows.push(
            <tr key={`${r.dk}-${ai}`} className={`${first?'date-group-first':''} ${selectedDates.has(r.dk)?'row-selected':''}`} onClick={()=>setDayDetail(r)}>
              <td onClick={e=>e.stopPropagation()}><input type="checkbox" className="row-check" checked={selectedDates.has(r.dk)} onChange={e=>toggleRowSelect(r.dk,e.target.checked)} data-date={r.dk}/></td>
              <td style={{whiteSpace:'nowrap',fontWeight:first?700:400,color:first?'var(--text)':'var(--muted)'}}>
                {first?r.dateStr:<span style={{color:'var(--muted)',fontSize:11}}>↳</span>}
                {first&&r.acts.length>1&&<span className="today-indicator">✦{r.acts.length}</span>}
              </td>
              <td style={{fontWeight:700,color:first?'var(--teal)':'var(--muted)'}}>{first?r.VitalzScore:''}</td>
              <td>
                <div className="act-name-bar">
                  <span className="act-num">{ai+1}/{r.acts.length}</span>
                  <span className="tag-action">{a.name}</span>
                  {a._src==='csv'&&<span style={{fontSize:9,background:'rgba(0,212,170,.15)',color:'var(--teal)',padding:'1px 5px',borderRadius:8,fontWeight:700,marginLeft:4}}>CSV</span>}
                  <span style={{fontSize:9,color:'var(--muted)',background:'var(--card2)',padding:'1px 5px',borderRadius:4,marginLeft:2}}>{a.cat}</span>
                </div>
              </td>
              <td>{first?<span className={`tag ${tagClass(r.ctx)}`}>{r.ctx}</span>:''}</td>
              <td className={(a.PP??r.PP)>.5?'pos':'neg'}>{(a.PP??r.PP).toFixed(2)}</td>
              <td className={(a.PR??r.PR)>.5?'pos':'neg'}>{(a.PR??r.PR).toFixed(2)}</td>
              <td className={(a.PM??r.PM)>.5?'pos':'neg'}>{(a.PM??r.PM).toFixed(2)}</td>
              <td className={(a.PS??r.PS)>.5?'neg':'pos'}>{(a.PS??r.PS).toFixed(2)}</td>
              <td className={aBS>=0?'pos':'neg'}>{aBS>=0?'+':''}{aBS}</td>
              <td className={aTPM>=0?'pos':'neg'}>{aTPM>=0?'+':''}{aTPM.toFixed(1)}</td>
              <td>
                <div className="score-bar">
                  <span className={aAS>=0?'pos':'neg'} style={{fontWeight:700,minWidth:28}}>{aAS>=0?'+':''}{aAS.toFixed(1)}</span>
                  <div className="bar-bg"><div className="bar-fill" style={{width:`${Math.abs(aAS)/5*100}%`,background:aAS>=0?'var(--teal)':'var(--red)'}}/></div>
                </div>
              </td>
              <td className={r.rls>=15?'pos':r.rls>=10?'':'neg'} style={{fontWeight:700}}>{first?r.rls.toFixed(1):''}</td>
              <td style={{fontSize:10,color:'var(--muted2)',whiteSpace:'nowrap'}}>{aSig}</td>
            </tr>
          );
          if(isLast&&r.acts.length>0){
            const cl=r.cluster||{mod:0,label:'—',breakdown:[]};
            rows.push(
              <tr key={`${r.dk}-cluster`} className="cluster-mod-row">
                <td colSpan={4} style={{paddingLeft:52,fontSize:10,color:'var(--muted)'}}>
                  <span style={{color:cl.mod>0?'var(--teal)':cl.mod<0?'var(--red)':'var(--muted)'}}>⬡ Cluster: {cl.label}</span>
                  {cl.breakdown&&cl.breakdown.length?<span style={{marginLeft:6,color:'var(--muted2)'}}>{cl.breakdown.join(' · ')}</span>:''}
                </td>
                <td/><td/><td/><td/><td/>
                <td/><td/>
                <td style={{fontWeight:700,color:cl.mod>=0?'var(--teal)':'var(--red)'}}>{cl.mod>=0?'+':''}{cl.mod.toFixed(2)}</td>
                <td style={{fontWeight:700,color:'var(--blue)'}}>{r.rls.toFixed(1)}</td>
                <td style={{fontSize:10,color:'var(--muted)'}}>{cl.mod!==0?'Cluster mod':'No cluster mod'}</td>
              </tr>
            );
          }
        });
      }
    });
    return rows;
  }

  // ── Event card ────────────────────────────────────────────────────────────
  function renderEventCard(){
    if(!L)return null;
    const ev=L.evts&&L.evts.length?L.evts[0]:null;
    if(ev){
      return(
        <div className="event-card">
          <div className={`ev-type ${ev.type}`}>{ev.type==='gain'?'⬆ ':ev.type==='opt'?'✓ ':'⚡ '}{ev.label}</div>
          <div className="ev-score">Score: <b>{L.sos.toFixed(2)}</b> <span className={delta>=0?'pos':'neg'}>{delta>=0?'+':''}{delta.toFixed(2)} vs prev</span></div>
          <div className="ev-chips">{(ev.chips||[]).map((c,i)=><span key={i} className={`ev-chip ${i===0?'t':''}`}>{c}</span>)}</div>
        </div>
      );
    }
    return(
      <div className="event-card">
        <div className="ev-type gain">📊 {L.ctx}</div>
        <div className="ev-score">Score: <b>{L.sos.toFixed(2)}</b> <span className={delta>=0?'pos':'neg'}>{delta>=0?'+':''}{delta.toFixed(2)} vs prev</span></div>
        <div className="ev-chips">
          <span className="ev-chip b">Rec {L.rPct.toFixed(0)}%</span>
          <span className="ev-chip a">MS {L.mPct.toFixed(0)}%</span>
          <span className="ev-chip">Str {L.sPct.toFixed(0)}%</span>
          <span className="ev-chip t">HRV {L.HRV}</span>
          <span className="ev-chip t">HR {L.HR}</span>
          {L.acts.length>0&&<span className="ev-chip b">{L.acts.length} action{L.acts.length>1?'s':''}</span>}
        </div>
      </div>
    );
  }

  const [bannerLabel, bannerClass] = L ? bandInfo(L.sos) : ['—','band-neutral'];
  const ctxDesc = {'Optimal':'All three targets met — sustainable adaptation','Overtraining':'Recovery% > 55 or HRV suppressed — reduce load','Stress-Dominant':'Stress% > 15 — immediate intervention needed','MildStress-Dominant':'MildStress% ≥ 45 — chronic hormetic burden','Recovery Deficit':'Recovery% < 50 — parasympathetic restoration priority'};

  // ─────────────────────────────────────────────────────────────────────────
  return(
    <>
      {/* Chart.js CDN */}
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" async/>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className="logo">Signs<span>beat</span> SOS™</span>
          <span className="badge">v4.0</span>
        </div>
        <div className="topbar-right">
          {hasDash&&<button className="btn btn-ghost" onClick={()=>setModalOpen(true)}>📋 All Data</button>}
          {hasDash&&<button className="btn btn-ghost" onClick={exportCSV}>⬇ Export</button>}
          <button className="btn btn-ghost" onClick={()=>fileRef.current?.click()}>⬆ Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" multiple style={{display:'none'}} onChange={handleFile}/>
          {hasDash&&<button className="btn btn-danger" onClick={clearAll} style={{padding:'7px 12px'}}>🗑 Clear All</button>}
          <button className="btn btn-primary" onClick={()=>openDrawer()}>＋ Log Entry</button>
        </div>
      </div>

      <div className="app-body">
        <div className={`main-content${drawerOpen?' drawer-open':''}`}>

          {/* ── Upload zone ── */}
          {!hasDash&&(
            <div
              className={`upload-zone${drag?' drag':''}`}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const files=e.dataTransfer.files;if(!files.length)return;Array.from(files).forEach((f,i)=>{const fr=new FileReader();fr.onload=ev=>processText(ev.target.result,i<files.length-1);fr.readAsText(f);});}}
              onClick={()=>fileRef.current?.click()}
            >
              <h3>Upload Signsbeat HR CSV or enter data manually</h3>
              <p>Drag & drop one or more CSV files, or click to select multiple files — data is merged automatically.</p>
              <div className="upload-format">Date · LoginEmail · VitalzScore · HRV · HR · Recovery · MildStress · Stress · Deep · NextDayStressorIndex · <span style={{color:'var(--teal)'}}>ActionName / Intervention</span></div>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:10}}>ActionName column is auto-detected · multiple actions per cell separated by <code style={{background:'var(--card2)',padding:'1px 5px',borderRadius:4}}>;</code></div>
              <div className="upload-actions" onClick={e=>e.stopPropagation()}>
                <button className="btn btn-primary" onClick={()=>openDrawer()}>＋ Log First Entry</button>
              </div>
            </div>
          )}

          {/* ── Dashboard ── */}
          {hasDash&&L&&(
            <>
              {/* Cards */}
              <div className="cards-row">
                <div className="card card-main">
                  <div className="card-label">SOS™ Score — Latest</div>
                  <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                    <div className="card-value">{L.sos.toFixed(1)}</div>
                    <span className={delta>=0?'pos':'neg'} style={{fontSize:13}}>{delta>=0?'+':''}{delta.toFixed(1)} vs prev</span>
                  </div>
                  <div className={`card-band ${bannerClass}`}>{bannerLabel}</div>
                  <div className="card-sub">{L.dateStr}</div>
                </div>
                <div className="card">
                  <div className="card-label">APS</div>
                  <div className="card-value" style={{fontSize:22,color:L.aps>35?'var(--teal)':L.aps>25?'var(--amber)':'var(--red)'}}>{L.aps.toFixed(1)}</div>
                  <div className="card-sub">Adaptive · max 50</div>
                </div>
                <div className="card">
                  <div className="card-label">RLS</div>
                  <div className="card-value" style={{fontSize:22,color:L.rls>16?'var(--teal)':L.rls>10?'var(--amber)':'var(--red)'}}>{L.rls.toFixed(1)}</div>
                  <div className="card-sub">Lifestyle · max 25</div>
                </div>
                <div className="card">
                  <div className="card-label">CLS + DSS</div>
                  <div className="card-value" style={{fontSize:22}}>{(L.cls+L.dss).toFixed(1)}</div>
                  <div className="card-sub">Compliance + Sync · max 25</div>
                </div>
                <div className="card">
                  <div className="card-label">Penalties</div>
                  <div className="card-value neg" style={{fontSize:22}}>−{(L.otp+L.pis+L.rdp).toFixed(1)}</div>
                  <div className="card-sub">OTP:{L.otp} · PIS:{L.pis} · RDP:{L.rdp.toFixed(1)}</div>
                </div>
              </div>

              {/* Pills */}
              <div className="pill-row">
                {[{l:'Daily TS',v:L.dTS.toFixed(1),p:L.dTS>=0},{l:'Weekly TS',v:L.wTS.toFixed(1),p:L.wTS>=0},{l:'Monthly TS',v:L.mTS.toFixed(1),p:L.mTS>=0},{l:'Recovery%',v:L.rPct.toFixed(0)+'%',p:L.rPct>=50&&L.rPct<=55},{l:'MildStress%',v:L.mPct.toFixed(0)+'%',p:L.mPct<45},{l:'Stress%',v:L.sPct.toFixed(0)+'%',p:L.sPct<15}].map(x=>(
                  <div className="pill" key={x.l}><span className="pill-label">{x.l}</span><span className={`pill-val ${x.p?'pos':'neg'}`}>{x.v}</span></div>
                ))}
              </div>

              {/* Context */}
              <div className="context-row">
                <span style={{fontSize:11,color:'var(--muted)'}}>Context:</span>
                <span className={`ctx-chip ${ctxClass(L.ctx)}`}>{L.ctx}</span>
                <span style={{fontSize:11,color:'var(--muted)'}}>{ctxDesc[L.ctx]||'Physiology stable but below optimal zone'}</span>
              </div>

              {/* Event card */}
              {renderEventCard()}

              {/* Trajectory chart */}
              <div className="chart-card">
                <div className="chart-hdr">
                  <div>
                    <div className="chart-title">Health Trajectory</div>
                    <div className="chart-sub">{results.length}-day pattern — click events to see action impact</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div className="view-btns">
                      {[{l:'30d',v:30},{l:'90d',v:90},{l:'All',v:0}].map(vb=>(
                        <button key={vb.l} className={`view-btn${viewDays===vb.v?' active':''}`} onClick={()=>setViewDaysS(vb.v)}>{vb.l}</button>
                      ))}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openDrawer()} style={{padding:'4px 10px'}}>＋ Add</button>
                  </div>
                </div>
                <div className="chart-wrap"><canvas ref={trajRef}/></div>
                <div className="chart-legend">
                  <div className="leg-item"><div className="leg-dot" style={{background:'var(--green)'}}/>SOS score</div>
                  <div className="leg-item"><div className="leg-dot" style={{background:'var(--blue)'}}/>Recovery day</div>
                  <div className="leg-item"><div className="leg-dot" style={{background:'var(--amber)'}}/>MildStress day</div>
                  <div className="leg-item"><div className="leg-dot" style={{background:'var(--red)'}}/>Stress day</div>
                  <div className="leg-item"><div className="leg-dot" style={{background:'var(--purple)'}}/>Action logged</div>
                  <span style={{fontSize:10,color:'var(--muted)',marginLeft:4}}>— click any point to see action impact</span>
                </div>
              </div>

              {/* Day Detail Panel */}
              {dayDetail&&renderDayDetail(dayDetail)}

              {/* Two-col */}
              <div className="two-col">
                <div className="chart-card" style={{marginBottom:0}}>
                  <div className="chart-hdr"><div>
                    <div className="chart-title">7-Day Rolling State %</div>
                    <div className="chart-sub">Recovery · MildStress · Stress vs targets</div>
                  </div></div>
                  <div className="chart-wrap chart-sm"><canvas ref={stateRef}/></div>
                </div>
                <div className="chart-card" style={{marginBottom:0}}>
                  <div className="chart-hdr"><div>
                    <div className="chart-title">APS Sub-Score Breakdown</div>
                    <div className="chart-sub">Latest day — directional components</div>
                  </div></div>
                  <table className="tbl">
                    <thead><tr><th>Timeframe</th><th>Dir_R</th><th>Dir_M</th><th>Dir_S</th><th>TS</th><th>Wt</th></tr></thead>
                    <tbody>
                      {[{tf:'Daily',dR:L.dR_d,dM:L.dM_d,dS:L.dS_d,ts:L.dTS,w:50},{tf:'Weekly',dR:L.dR_w,dM:L.dM_w,dS:L.dS_w,ts:L.wTS,w:30},{tf:'Monthly',dR:L.dR_m,dM:L.dM_m,dS:L.dS_m,ts:L.mTS,w:20}].map(row=>(
                        <tr key={row.tf}>
                          <td>{row.tf}</td>
                          <td className={row.dR>=0?'pos':'neg'}>{row.dR.toFixed(1)}</td>
                          <td className={row.dM>=0?'pos':'neg'}>{row.dM.toFixed(1)}</td>
                          <td className={row.dS>=0?'pos':'neg'}>{row.dS.toFixed(1)}</td>
                          <td className={row.ts>=0?'pos':'neg'} style={{fontWeight:700}}>{row.ts.toFixed(2)}</td>
                          <td className="neu">{row.w}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action table */}
              <div className="chart-card" style={{marginTop:16}}>
                <div className="chart-hdr">
                  <div>
                    <div className="chart-title">Per-Day ActionName Impact</div>
                    <div className="chart-sub">T-1 rule applied — actions scored by next-day biometric response</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openDrawer()}>＋ Log Action</button>
                </div>
                {/* Filter bar */}
                <div className="act-filter-bar">
                  {[{l:'7d',v:7},{l:'14d',v:14},{l:'30d',v:30},{l:'All',v:0}].map(rb=>(
                    <button key={rb.l} className={`range-btn${actRange===rb.v&&!actFrom?' active':''}`} onClick={()=>{setActRange(rb.v);setActFrom('');setActTo('');}}>{rb.l}</button>
                  ))}
                  <div className="act-filter-sep"/>
                  <input type="date" className="act-filter-date" value={actFrom} onChange={e=>setActFrom(e.target.value)} placeholder="From"/>
                  <span style={{fontSize:11,color:'var(--muted)'}}>→</span>
                  <input type="date" className="act-filter-date" value={actTo} onChange={e=>setActTo(e.target.value)} placeholder="To"/>
                  <label className="act-toggle"><input type="checkbox" checked={actsOnly} onChange={e=>setActsOnly(e.target.checked)}/>Actions only</label>
                  <span className="act-row-count">{filteredAct.length?`${filteredAct.length} day${filteredAct.length>1?'s':''} · ${totalActCount} action${totalActCount!==1?'s':''}`:'No data in range'}</span>
                </div>
                {/* Selection toolbar */}
                {selectedDates.size>0&&(
                  <div className="sel-toolbar">
                    <span className="sel-count">{selectedDates.size} date{selectedDates.size>1?'s':''} selected</span>
                    <span className="sel-dates">{[...selectedDates].sort().reverse().slice(0,4).join(' · ')}{selectedDates.size>4?` +${selectedDates.size-4} more`:''}</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedDates(new Set())}>✕ Clear</button>
                    <button className="btn btn-primary btn-sm" onClick={exportSelected}>⬇ Export Selected</button>
                  </div>
                )}
                <div style={{overflowX:'auto'}}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="th-check"><input type="checkbox" className="row-check" onChange={e=>toggleAll(e.target.checked)}/></th>
                        <th className="w-date">Date</th><th className="w-vs">VS</th>
                        <th>ActionName</th><th className="w-ctx">Context</th>
                        <th>PP</th><th>PR</th><th>PM</th><th>PS</th>
                        <th>Base</th><th>TPM</th><th>ActionScore</th>
                        <th>RLS</th><th>Signal</th>
                      </tr>
                    </thead>
                    <tbody>{renderActRows()}</tbody>
                  </table>
                </div>
              </div>

              {/* HRV chart */}
              <div className="chart-card" style={{marginTop:16}}>
                <div className="chart-hdr"><div>
                  <div className="chart-title">HRV & Heart Rate — 30 Days</div>
                  <div className="chart-sub">Red bars = HRV below 85% of 30-day baseline · T-1 attribution</div>
                </div></div>
                <div className="chart-wrap"><canvas ref={hrvRef}/></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Log Entry Drawer ── */}
      <div className={`drawer${drawerOpen?' open':''}`}>
        <div className="drawer-hdr">
          <h3>{drawerTitle}</h3>
          <button className="btn btn-ghost btn-icon" onClick={()=>setDrawerOpen(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={fDate} onChange={e=>setFDate(e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Dominant Physiological State</label>
            <div className="state-selector">
              {[{k:'Recovery',icon:'💧'},{k:'MildStress',icon:'⚡'},{k:'Stress',icon:'🔥'}].map(s=>(
                <div key={s.k} className={`state-btn${fState===s.k?` active-${s.k.toLowerCase()}`:''}`} onClick={()=>setFState(s.k)}>
                  <span className="state-icon">{s.icon}</span>{s.k==='MildStress'?'Mild Stress':s.k}
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Biometrics</label>
            <div className="metrics-grid">
              <div className="metric-box"><label>VitalzScore</label><input type="number" value={fVS} onChange={e=>setFVS(e.target.value)} min={0} max={100} placeholder="0–100"/><div className="unit">SB Score (0–100)</div></div>
              <div className="metric-box"><label>HRV</label><input type="number" value={fHRV} onChange={e=>setFHRV(e.target.value)} min={1} max={300} placeholder="ms"/><div className="unit">milliseconds</div></div>
              <div className="metric-box"><label>Heart Rate</label><input type="number" value={fHR} onChange={e=>setFHR(e.target.value)} min={30} max={200} placeholder="bpm"/><div className="unit">resting BPM</div></div>
              <div className="metric-box"><label>Deep Sleep</label><input type="number" value={fDeep} onChange={e=>setFDeep(e.target.value)} min={0} max={300} placeholder="min"/><div className="unit">minutes</div></div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Next Day Stressor Index <span style={{fontSize:10,color:'var(--muted)',fontWeight:400,textTransform:'none',letterSpacing:0}}>(0 = no stressor → 1 = high stressor)</span></label>
            <div className="slider-row">
              <input type="range" className="slider" min={0} max={1} step={0.01} value={fNSI} onChange={e=>setFNSI(parseFloat(e.target.value).toFixed(2))}/>
              <div className="slider-val">{fNSI}</div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--muted)',marginTop:3}}>
              <span>Low stressor</span><span>High stressor</span>
            </div>
          </div>
          <hr className="form-divider"/>
          <div className="form-group">
            <label className="form-label">Actions / Interventions <span style={{fontSize:10,color:'var(--muted)',fontWeight:400,textTransform:'none',letterSpacing:0}}>(RLS scored by tomorrow's biometrics — T-1 rule)</span></label>
            <div className="action-chips">
              {pendingActs.length===0?(
                <span style={{fontSize:11,color:'var(--muted)',alignSelf:'center'}}>No actions — add below or include an <b style={{color:'var(--teal)'}}>ActionName</b> column in your CSV</span>
              ):pendingActs.map((a,i)=>(
                <div key={i} className={`action-chip${a._src==='csv'?' from-csv':''}`}>
                  <span className="cat">{a.cat}</span>
                  <span>{a.name}</span>
                  {a._src==='csv'&&<span className="csv-badge">CSV</span>}
                  <span className="action-chip-x" onClick={()=>setPendingActs(prev=>prev.filter((_,j)=>j!==i))}>×</span>
                </div>
              ))}
            </div>
            <div className="action-add-row">
              <select className="form-select" value={fCat} onChange={e=>{setFCat(e.target.value);setFPreset('');}} style={{fontSize:12}}>
                <option value="">Category…</option>
                <optgroup label="── Physical Activity"><option>Indoor Physical Activity</option><option>Outdoor Physical Activity</option></optgroup>
                <optgroup label="── Nutrition"><option>Diet</option></optgroup>
                <optgroup label="── Recovery & Wellness"><option>Sleep</option><option>Recovery Protocol</option><option>Breathwork</option><option>Circadian</option></optgroup>
                <optgroup label="── Intervention"><option>Supplement</option><option>Biohacking</option><option>Peptide</option><option>Medication</option></optgroup>
                <optgroup label="── Other"><option>Other</option></optgroup>
              </select>
              <select className="form-select" value={fPreset} onChange={e=>setFPreset(e.target.value)} style={{fontSize:12}}>
                <option value="">Select or type…</option>
                {(ACTION_PRESETS[fCat]||[]).map(p=><option key={p}>{p}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={()=>{
                const name=fCustom.trim()||fPreset;
                if(!name||!fCat){showToast('Select a category and action name');return;}
                setPendingActs(prev=>[...prev,{cat:fCat,name}]);
                setFCustom('');setFPreset('');
              }}>Add</button>
            </div>
            <div style={{marginTop:6}}>
              <input type="text" className="form-input" value={fCustom} onChange={e=>setFCustom(e.target.value)} placeholder="Or type custom action name…" style={{fontSize:12}} onKeyDown={e=>{if(e.key==='Enter'){const name=fCustom.trim();if(!name||!fCat){showToast('Select a category first');return;}setPendingActs(prev=>[...prev,{cat:fCat,name}]);setFCustom('');}}}/>
            </div>
          </div>
          <hr className="form-divider"/>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input" rows={2} value={fNotes} onChange={e=>setFNotes(e.target.value)} placeholder="How did you feel today?" style={{resize:'vertical',fontSize:12,lineHeight:1.5}}/>
          </div>
          {editingDate&&(
            <div style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,padding:'10px 12px',fontSize:11,color:'var(--amber)'}}>
              ✏ Editing existing entry — saving will overwrite this date's data
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-ghost" onClick={()=>setDrawerOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveEntry}>Save & Update Chart</button>
        </div>
      </div>

      {/* ── All Data Modal ── */}
      {modalOpen&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}>
          <div className="modal">
            <div className="modal-hdr">
              <h3>All Data Entries</h3>
              <div style={{display:'flex',gap:8}}>
                <span style={{fontSize:11,color:'var(--muted)',alignSelf:'center'}}>{rawRows.length} entries</span>
                <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
                <button className="btn btn-ghost btn-icon" onClick={()=>setModalOpen(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <table className="tbl" style={{fontSize:11}}>
                <thead><tr><th>Date</th><th>VS</th><th>HRV</th><th>HR</th><th>State</th><th>Deep</th><th>NSI</th><th>Actions</th><th>SOS</th><th/></tr></thead>
                <tbody>
                  {[...rawRows].reverse().map(r=>{
                    const dk=toDateKey(r._date);
                    const sosMap={}; results.forEach(res=>{sosMap[res.dk]=res.sos;});
                    const acts=dailyActs[dk]||[];
                    const sos=sosMap[dk];
                    const stateEl=+r.Recovery===1?<span className="tag tag-def">Recovery</span>:+r.MildStress===1?<span className="tag tag-ms">MildStress</span>:+r.Stress===1?<span className="tag tag-str">Stress</span>:'—';
                    return(
                      <tr key={dk}>
                        <td style={{whiteSpace:'nowrap',fontWeight:600}}>{r.Date}</td>
                        <td>{r.VitalzScore||'—'}</td>
                        <td>{r.HRV||'—'}</td>
                        <td>{r.HR||'—'}</td>
                        <td>{stateEl}</td>
                        <td>{r.Deep||'—'}</td>
                        <td>{r.NextDayStressorIndex!==''&&r.NextDayStressorIndex!=null?parseFloat(r.NextDayStressorIndex).toFixed(2):'—'}</td>
                        <td>{acts.length?acts.map((a,i)=><span key={i} className="tag-action" style={{marginRight:3}}>{a.name}</span>):'—'}</td>
                        <td>{sos!=null?<b>{sos.toFixed(1)}</b>:'—'}</td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={()=>{setModalOpen(false);openDrawer(dk);}}>✏</button>
                            <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={()=>deleteEntry(dk)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rawRows.length&&<div style={{textAlign:'center',padding:32,color:'var(--muted)',fontSize:13}}>No entries yet.</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div className={`toast${toastVisible?' show':''}`}>{toast}</div>
    </>
  );
}
