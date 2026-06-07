import { ACTCAT_MAP } from './constants';

// ── Timezone-safe date key ────────────────────────────────────────────────────
export function toDateKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

// ── Parse date string → Date (noon local — timezone safe) ────────────────────
export function parseDate(s) {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0,10) + 'T12:00:00');
  const p = s.split('/');
  if (p.length === 3)
    return new Date(`${p[2].padStart(4,'20')}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}T12:00:00`);
  return new Date(s);
}

// ── Quoted-field-aware CSV line splitter ──────────────────────────────────────
export function splitCSVLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function normHdr(h) { return h.replace(/[\s_\-]/g,'').toLowerCase(); }

export function resolveActCat(raw) {
  if (!raw) return null;
  return ACTCAT_MAP[raw.toLowerCase().replace(/[\s_\-]/g,'')] || raw;
}

export function classifyAction(name) {
  const n = name.toLowerCase();
  if (/trail\s*run|open\s*water|hiking|hike|park\s*workout|cycling(?!\s*machine|\s*stationary)|^running|surfing|tennis|golf|kayak|sprint\s*interval|morning\s*walk/i.test(n)) return 'Outdoor Physical Activity';
  if (/strength|hiit|gym|lift|treadmill|rowing\s*machine|stationary|jump\s*rope|bodyweight|barre|crossfit|indoor|pilates|zone\s*2|cardio|swim(?:ming)?|yoga|mobil|stretch|circuit/i.test(n)) return 'Indoor Physical Activity';
  if (/exercise|workout|train/i.test(n)) return 'Indoor Physical Activity';
  if (/fast|keto|carb|protein|anti.?inflam|calor|macro|diet|meal|eat|food|nutrition|omad|plant.?based/i.test(n)) return 'Diet';
  if (/sleep|bed|nap|melatonin|blue.?light|screen|caffeine|wake\s*time/i.test(n)) return 'Sleep';
  if (/sauna|cold\s*plunge|cold\s*water|cwi|red\s*light|pemf|float|ice\s*bath|hyperbaric|ozone|infrared|neurofeed|biofeed/i.test(n)) return 'Biohacking';
  if (/breath|box\s*breath|wim\s*hof|hrv\s*coher|nasal|sighing/i.test(n)) return 'Breathwork';
  if (/magnesium|omega|vitamin|nad|nmn|ashwa|creatine|zinc|theanine|rhodiola|coq|berberine|quercetin|supplement|alpha.?lipoic/i.test(n)) return 'Supplement';
  if (/sunlight|morning\s*light|time.?restrict|dark\s*env|grounding/i.test(n)) return 'Circadian';
  if (/recov|foam\s*roll|massage|deload|rest\s*day|active\s*recov|contrast\s*therap|compression|epsom/i.test(n)) return 'Recovery Protocol';
  if (/bpc|tb.?500|ghk|peptide|semaglutide|tirzepatide|ipamorelin|epithalon|pt.?141/i.test(n)) return 'Peptide';
  if (/testosterone|metformin|thyroid|hcg|anastrozole|clomid|dhea|pregnenolone|\d+mg|medication|medicine/i.test(n)) return 'Medication';
  return 'Other';
}

// ── Main CSV parser — auto-detects long vs wide format ───────────────────────
export function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const hdrs = splitCSVLine(lines[0]).map(h => h.trim());
  const normHdrs = hdrs.map(normHdr);
  const hasActName = normHdrs.includes('actionname');
  const hasActCat  = normHdrs.includes('actioncategory');
  return hasActName && hasActCat
    ? parseLongFormat(lines, hdrs, normHdrs)
    : parseWideFormat(lines, hdrs, normHdrs);
}

// ── Signsbeat long format (one row per action per date) ───────────────────────
function parseLongFormat(lines, hdrs, normHdrs) {
  const ci = n => normHdrs.indexOf(normHdr(n));
  const iActName   = ci('actionname');
  const iActCat    = ci('actioncategory');
  const iDate      = ci('date');
  const iVS        = ci('vitalzscore');
  const iScoreType = ci('scoretype');
  const iRecov     = ci('recovery');
  const iMS        = ci('mildstress');
  const iStr       = ci('stress');
  const iProR      = ci('pro_recovery');
  const iProM      = ci('pro_mildstress');
  const iProS      = ci('pro_stress');
  const iPP        = [ci('pro_positivesi'),ci('pro_positive'),ci('positivesi')].find(x => x >= 0) ?? -1;
  const iHRV       = ci('hrv');
  const iHR        = ci('hr');
  const iDeep      = ci('deep');
  const iNSI       = ci('nextdaystressorindex');

  const byDate = {};
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const rawDate = (vals[iDate] || '').trim();
    if (!rawDate) continue;
    const dt = parseDate(rawDate);
    if (!dt || isNaN(dt)) continue;
    const dk = toDateKey(dt);
    if (!byDate[dk]) byDate[dk] = { dt, vals: [] };
    byDate[dk].vals.push(vals);
  }

  const rows = [];
  Object.entries(byDate).forEach(([dk, { dt, vals: allVals }]) => {
    const first = allVals[0];
    const scoreType = (iScoreType >= 0 ? (first[iScoreType] || '') : '').trim().toLowerCase();
    let rec = 0, ms = 0, str = 0;
    if (scoreType === 'recovery') rec = 1;
    else if (scoreType === 'mildstress' || scoreType === 'mild stress') ms = 1;
    else if (scoreType === 'stress') str = 1;
    else {
      rec = iRecov >= 0 ? +(first[iRecov] || 0) : 0;
      ms  = iMS    >= 0 ? +(first[iMS]    || 0) : 0;
      str = iStr   >= 0 ? +(first[iStr]   || 0) : 0;
    }

    const seen = new Set();
    const acts = allVals.map(v => {
      const name = (iActName >= 0 ? (v[iActName] || '') : '').replace(/^["']|["']$/g,'').trim();
      const rawCat = (iActCat >= 0 ? (v[iActCat] || '') : '').trim();
      if (!name || seen.has(name)) return null;
      seen.add(name);
      const cat   = resolveActCat(rawCat) || classifyAction(name);
      const aProP = iPP   >= 0 ? +(v[iPP]   || 0) : null;
      const aProR = iProR >= 0 ? +(v[iProR] || 0) : null;
      const aProM = iProM >= 0 ? +(v[iProM] || 0) : null;
      const aProS = iProS >= 0 ? +(v[iProS] || 0) : null;
      return { cat, name, _src: 'csv', _proP: aProP, _proR: aProR, _proM: aProM, _proS: aProS };
    }).filter(Boolean);

    const proR = acts.reduce((s,a) => s + (a._proR ?? 0), 0) / (acts.length || 1);
    const proM = acts.reduce((s,a) => s + (a._proM ?? 0), 0) / (acts.length || 1);
    const proS = acts.reduce((s,a) => s + (a._proS ?? 0), 0) / (acts.length || 1);
    const proP = acts.reduce((s,a) => s + (a._proP ?? 0), 0) / (acts.length || 1);

    rows.push({
      Date: dk, LoginEmail: 'csv@signsbeat',
      VitalzScore: iVS   >= 0 ? (first[iVS]   || '') : '',
      HRV:         iHRV  >= 0 ? (first[iHRV]  || '') : '',
      HR:          iHR   >= 0 ? (first[iHR]   || '') : '',
      Deep:        iDeep >= 0 ? (first[iDeep] || '') : '',
      NextDayStressorIndex: iNSI >= 0 ? (first[iNSI] || '') : '',
      Recovery: rec, MildStress: ms, Stress: str,
      _proR: proR, _proM: proM, _proS: proS, _proP: proP,
      _acts: acts, _date: dt,
    });
  });

  rows.sort((a,b) => a._date - b._date);
  return rows;
}

// ── Wide format (one row per date, columns per category) ─────────────────────
const COL_CAT_MAP = [
  { cols:['actionname','intervention','action'], cat: null },
  { cols:['macrocombo','macro','diet','nutrition','food','meal'], cat:'Diet' },
  { cols:['indooractivity','exercise','workout','training'], cat:'Indoor Physical Activity' },
  { cols:['outdooractivity','outdoor'], cat:'Outdoor Physical Activity' },
  { cols:['supplement','supplements'], cat:'Supplement' },
  { cols:['biohacking','biohack'], cat:'Biohacking' },
  { cols:['sleep','sleepprotocol'], cat:'Sleep' },
  { cols:['recoveryprotocol'], cat:'Recovery Protocol' },
  { cols:['breathwork','breathing'], cat:'Breathwork' },
  { cols:['circadian'], cat:'Circadian' },
  { cols:['peptide'], cat:'Peptide' },
  { cols:['medication'], cat:'Medication' },
];

function parseWideFormat(lines, hdrs, normHdrs) {
  const catCols = [];
  COL_CAT_MAP.forEach(({ cols, cat }) => {
    normHdrs.forEach((nh, ci) => { if (cols.includes(nh)) catCols.push({ ci, cat }); });
  });
  const rows = [], seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const row  = {};
    hdrs.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    if (!row.Date) continue;
    const dt = parseDate(row.Date);
    if (!dt || isNaN(dt)) continue;
    row._date = dt;
    const k = toDateKey(dt);
    const acts = [];
    catCols.forEach(({ ci, cat }) => {
      const cell = (vals[ci] || '').trim();
      if (!cell) return;
      cell.replace(/^["']|["']$/g,'').split(/[;|]+/).map(s => s.trim()).filter(Boolean).forEach(name => {
        const resolvedCat = cat || classifyAction(name);
        if (!acts.find(a => a.name === name)) acts.push({ cat: resolvedCat, name, _src: 'csv' });
      });
    });
    row._acts = acts;
    if (!seen.has(k)) { seen.add(k); rows.push(row); }
  }
  rows.sort((a,b) => a._date - b._date);
  return rows;
}
