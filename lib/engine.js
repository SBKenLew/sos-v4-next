import { toDateKey } from './parser';

// ── Utilities ─────────────────────────────────────────────────────────────────
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const td = (val, lo, hi) => val >= lo && val <= hi ? 0 : val < lo ? lo - val : val - hi;

// ── Rolling window → {r, m, s} percentages ───────────────────────────────────
export function rolling(data, end, win) {
  const s = Math.max(0, end - win + 1);
  const sl = data.slice(s, end + 1);
  const n = sl.length;
  if (!n) return { r: 0, m: 0, s: 0 };
  return {
    r: sl.filter(d => +d.Recovery    === 1).length / n * 100,
    m: sl.filter(d => +d.MildStress  === 1).length / n * 100,
    s: sl.filter(d => +d.Stress      === 1).length / n * 100,
  };
}

function dScore(p, c, lo, hi) { return clamp(td(p, lo, hi) - td(c, lo, hi), -15, 15); }

// ── TimeframeScore (§14) ──────────────────────────────────────────────────────
export function tfScore(sp, sc) {
  return clamp(
    dScore(sp.r, sc.r, 50, 55) * 0.45 +
    dScore(sp.m, sc.m, 0, 45)  * 0.30 +
    dScore(sp.s, sc.s, 0, 15)  * 0.25,
    -15, 15
  );
}

// ── HRV utilities ─────────────────────────────────────────────────────────────
function hrvBase(data, i) {
  const sl = data.slice(Math.max(0, i-30), i).map(d => +d.HRV).filter(v => v > 0);
  return sl.length ? sl.reduce((a,b) => a+b) / sl.length : (+data[i]?.HRV || 50);
}
function hrvSupp(data, i, days) {
  if (i < days) return false;
  const base = hrvBase(data, i);
  for (let j = i - days + 1; j <= i; j++) if (+data[j].HRV >= base * 0.9) return false;
  return true;
}

// ── Context detection (§16) ───────────────────────────────────────────────────
export function detectCtx(st, data, i) {
  const { r, m, s } = st;
  if (r > 55 || (s > 15 && hrvSupp(data, i, 2))) return 'Overtraining';
  if (s > 15)  return 'Stress-Dominant';
  if (m >= 45) return 'MildStress-Dominant';
  if (r >= 50 && r <= 55 && m < 45 && s < 15) return 'Optimal';
  if (r < 50)  return 'Recovery Deficit';
  return 'Neutral';
}

// ── §17 Pro_ signal matrix ────────────────────────────────────────────────────
export function bScore(PP, PR, PM, PS, ctx) {
  if (PP > .5 && PR > .5)                           return 5;
  if (PP > .5 && PM > .5 && ctx === 'Overtraining') return 4;
  if (PP > .5 && PM > .5 && PS < .5)                return 3;
  if (PP > .5 && PR < .5 && PS < .5)                return 2;
  if (PP > .5 && PR < .5 && PS > .5)                return 1;
  if (PP < .5 && PR > .5 && PS < .5)                return 1;
  if (PP < .5 && PR < .5 && PS < .5)                return 0;
  if (PP < .5 && PM > .5)                            return -1;
  if (PP < .5 && PS > .5 && ctx === 'Stress-Dominant') return -5;
  if (PP < .5 && PS > .5)                            return -3;
  return 0;
}

export function bScoreLabel(bs) {
  if (bs >= 5) return '↑ Optimal adaptive';
  if (bs === 4) return '↑ Hormetic correction';
  if (bs === 3) return '↑ Hormetic stimulation';
  if (bs === 2) return '↑ Positive (early adaptation)';
  if (bs === 1) return '→ Monitor — stress offset';
  if (bs === 0) return '→ Neutral';
  if (bs === -1) return '↓ Maladaptive MildStress';
  if (bs === -3) return '↓ Stress-dominant response';
  if (bs === -5) return '↓ Acute overload compounding';
  return '→ Neutral';
}

// ── §18 Target Proximity Modifier ────────────────────────────────────────────
export function tpm(c, p) {
  let t = 0;
  if (td(c.r,50,55) < td(p.r,50,55)) t += 1; else if (td(c.r,50,55) > td(p.r,50,55)) t -= 1;
  if (c.s < p.s && c.s < 15) t += 1; else if (c.s > p.s && c.s > 15) t -= 1;
  if (c.m <= 45 && p.m <= 45) t += .5; else if (c.m > 45 && p.m <= 45) t -= .5;
  return t;
}

// ── OTP (§24) ────────────────────────────────────────────────────────────────
function calcOTP(st, data, i) {
  let tr = 0;
  if (st.r > 55) tr++;
  if (hrvSupp(data, i, 2)) tr++;
  if (i >= 3) {
    let ris = true;
    for (let j = i-2; j <= i; j++) { if (rolling(data,j,7).s < rolling(data,j-1,7).s) { ris = false; break; } }
    if (ris && st.s > 15) tr++;
  }
  if (i >= 3) { const dp = data.slice(i-3,i+1).map(d => +(d.Deep||0)); if (dp.every(v => v>0 && v<72)) tr++; }
  return tr >= 3 ? 15 : tr === 2 ? 7 : tr === 1 ? 3 : 0;
}

// ── PIS (§25) ────────────────────────────────────────────────────────────────
function calcPIS(data, i) {
  if (i === 0) return 0;
  let ii = 0;
  const ph = +data[i-1].HRV, ch = +data[i].HRV;
  if (ph > 0 && ch > 0) { const dr = (ph-ch)/ph; if (dr > .28) ii += 2.5; else if (dr > .15) ii += 1.5; }
  const sc = rolling(data,i,7).s, sp = rolling(data,Math.max(0,i-1),7).s;
  const sk = sc - sp;
  if (sk > 20) ii += 2.5; else if (sk > 10) ii += 1.5;
  ii = clamp(ii, 0, 10);
  return ii >= 7 ? 10 : ii >= 4 ? 5 : ii >= 1 ? 2 : 0;
}

// ── Cluster Modifier ─────────────────────────────────────────────────────────
export function clusterMod(acts, PP, PR, PM, PS, ctx) {
  if (!acts?.length) return { mod: 0, label: 'No actions logged', breakdown: [] };
  const catNorm = c => {
    c = (c||'').toLowerCase();
    if (c.includes('indoor')||c.includes('outdoor')||c==='exercise') return 'physical';
    if (c==='diet') return 'diet';
    if (c==='sleep') return 'sleep';
    if (c==='biohacking') return 'biohacking';
    if (c==='breathwork') return 'breathwork';
    if (c==='supplement') return 'supplement';
    if (c==='circadian') return 'circadian';
    if (c==='recovery protocol') return 'recovery';
    if (c==='medication') return 'medication';
    if (c==='peptide') return 'peptide';
    return 'other';
  };
  const cats = new Set(acts.map(a => catNorm(a.cat)));
  const has = b => cats.has(b);
  let mod = 0; const bd = [];

  if (has('physical') && has('diet') && (has('sleep')||has('biohacking')||has('breathwork')||has('supplement')||has('recovery'))) {
    mod += 1.5; bd.push('+1.5 Full protocol (Physical + Diet + Recovery modality)');
  } else if (has('physical') && has('diet')) {
    mod += 0.5; bd.push('+0.5 Exercise + Nutrition alignment');
  }
  if ((has('biohacking')||has('breathwork')) && (has('sleep')||has('supplement'))) {
    mod += 1.0; bd.push('+1.0 Recovery stack (biohacking/breathwork + sleep/supplement)');
  }
  if (has('circadian') && (has('physical')||has('sleep')||has('breathwork'))) {
    mod += 0.5; bd.push('+0.5 Circadian synergy');
  }
  if ((has('peptide')||has('medication')) && has('physical')) {
    mod += 0.25; bd.push('+0.25 Augmented protocol');
  }
  const n = cats.size;
  if (n >= 5)      { mod += 1.0; bd.push('+1.0 Multi-domain diversity (5+ categories)'); }
  else if (n === 4) { mod += 0.5; bd.push('+0.5 Multi-domain diversity (4 categories)'); }
  else if (n === 3) { mod += 0.25; bd.push('+0.25 Multi-domain diversity (3 categories)'); }

  if (has('physical') && PS > .5 && !has('diet') && !has('supplement')) {
    mod -= 1.0; bd.push('−1.0 Exercise-induced stress without nutritional support');
  }
  if (ctx === 'Stress-Dominant' && has('physical') && !has('sleep') && !has('biohacking') && !has('breathwork') && !has('recovery')) {
    mod -= 0.5; bd.push('−0.5 Physical load in stress-dominant state without recovery');
  }
  mod = clamp(mod, -3, 3);
  const label = mod > 1 ? '↑ Strong alignment' : mod > 0 ? '↑ Aligned' : mod === 0 ? '→ Neutral cluster' : '↓ Misaligned';
  return { mod, label, breakdown: bd };
}

// ── Main compute function ─────────────────────────────────────────────────────
export function computeAll(data, dailyActs) {
  const res = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const d7c = rolling(data,i,7),   d7p = rolling(data,Math.max(0,i-1),7);
    const w7p = rolling(data,Math.max(0,i-7),7);
    const m30c = rolling(data,i,30), m30p = rolling(data,Math.max(0,i-30),30);

    const dTS = tfScore(d7p,d7c), wTS = tfScore(w7p,d7c), mTS = tfScore(m30p,m30c);
    const aps_raw = dTS*.5 + wTS*.3 + mTS*.2;
    const aps = clamp(25 + aps_raw*1.4, 0, 50);
    const ctx = detectCtx(d7c, data, i);

    // Day-level Pro_ (from CSV average or proxy)
    const nxt = i < data.length-1 ? data[i+1] : null;
    let PP, PR, PM, PS;
    const hasRealPro = d._proR != null || d._proM != null || d._proS != null || d._proP != null;
    if (hasRealPro) {
      PR = d._proR != null ? clamp(+d._proR,0,1) : .28;
      PM = d._proM != null ? clamp(+d._proM,0,1) : .28;
      PS = d._proS != null ? clamp(+d._proS,0,1) : .22;
      PP = d._proP != null ? clamp(+d._proP,0,1) : .55;
    } else if (nxt) {
      PP = +nxt.VitalzScore >= +d.VitalzScore ? .65 : .40;
      PR = +nxt.Recovery   === 1 ? .78 : .28;
      PM = +nxt.MildStress === 1 ? .72 : .28;
      PS = +nxt.Stress     === 1 ? .78 : .22;
    } else {
      PP = .55; PR = +d.Recovery===1?.78:.28; PM = +d.MildStress===1?.72:.28; PS = +d.Stress===1?.78:.22;
    }

    const dayTPM = tpm(d7c, d7p);
    const dk = toDateKey(d._date);
    const manualActs = dailyActs[dk] || [];
    const csvActs = d._acts || [];
    const mergedNames = new Set(manualActs.map(a => a.name));
    const rawActs = [...manualActs, ...csvActs.filter(a => !mergedNames.has(a.name))];

    // Score each action with its individual Pro_ values
    const acts = rawActs.map(a => {
      const aPP = a._proP != null ? clamp(+a._proP,0,1) : PP;
      const aPR = a._proR != null ? clamp(+a._proR,0,1) : PR;
      const aPM = a._proM != null ? clamp(+a._proM,0,1) : PM;
      const aPS = a._proS != null ? clamp(+a._proS,0,1) : PS;
      const aBS = bScore(aPP,aPR,aPM,aPS,ctx);
      const aAS = clamp(aBS + dayTPM, -5, 5);
      return { ...a, PP:aPP, PR:aPR, PM:aPM, PS:aPS, bs:aBS, tpm:dayTPM, as:aAS, signal:bScoreLabel(aBS), ctx };
    });

    const cluster = clusterMod(acts, PP, PR, PM, PS, ctx);
    const rlsRaw  = acts.reduce((s,a) => s+a.as, 0) + cluster.mod;

    const bs = bScore(PP,PR,PM,PS,ctx);
    const as = clamp(bs+dayTPM,-5,5);

    const fields = [d.HRV,d.HR,d.Deep,d.Recovery,d.MildStress,d.Stress].filter(v => v!==''&&v!=null&&!isNaN(+v)).length;
    const cls = 15*(fields/6);
    let dss = 10;
    if (i > 0) { const gap = (d._date - data[i-1]._date)/86400000; if (gap===2) dss=8; else if (gap===3) dss=5; else if (gap>3) dss=0; }
    const otp = calcOTP(d7c, data, i);
    const pis = calcPIS(data, i);

    res.push({
      date:d._date, dateStr:d.Date, dk,
      VitalzScore:+d.VitalzScore, HRV:+d.HRV, HR:+d.HR,
      Recovery:+d.Recovery, MildStress:+d.MildStress, Stress:+d.Stress,
      Deep:+(d.Deep||0), NSI:d.NextDayStressorIndex===''||d.NextDayStressorIndex==null?null:+d.NextDayStressorIndex,
      aps, dTS, wTS, mTS, aps_raw,
      rPct:d7c.r, mPct:d7c.m, sPct:d7c.s,
      ctx, PP, PR, PM, PS, bs, tp:dayTPM, as,
      cls, dss, otp, pis,
      acts, cluster, rlsRaw,
      _idx:i,
    });
  }

  // Second pass: RLS + RDP
  let cum = 0;
  for (let i = 0; i < res.length; i++) {
    const hasActs = res[i].acts?.length > 0;
    const rlsR = hasActs ? res[i].rlsRaw : res[i].as;
    res[i].rlsR = rlsR;
    res[i].rls = clamp(12.5 + rlsR*.625, 0, 25);

    const se = Math.max(0, res[i].sPct-15)*.1;
    const rd = Math.max(0, 45-res[i].rPct)*.05;
    const rn = (res[i].rPct>=50 && res[i].rPct<=55) ? 2 : 0;
    if (i >= 30) { const o = res[i-30]; cum -= (Math.max(0,o.sPct-15)*.1 + Math.max(0,45-o.rPct)*.05 - ((o.rPct>=50&&o.rPct<=55)?2:0)); }
    cum += se + rd - rn;
    res[i].rdp = clamp(cum*.4, 0, 15);
    res[i].sos = clamp(res[i].aps + res[i].rls + res[i].cls + res[i].dss - res[i].otp - res[i].pis - res[i].rdp, 0, 100);
  }

  return res;
}
