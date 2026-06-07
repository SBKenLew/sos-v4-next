'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { parseCSV, toDateKey } from '../lib/parser';
import { computeAll } from '../lib/engine';
import { STORE_KEY, ACT_KEY } from '../lib/constants';
import ActionTable from '../components/ActionTable';
import DayDetail from '../components/DayDetail';
import LogDrawer from '../components/LogDrawer';

// Chart.js requires browser — load dynamically
const TrajectoryChart = dynamic(() => import('../components/Charts').then(m => m.TrajectoryChart), { ssr: false });
const StateChart      = dynamic(() => import('../components/Charts').then(m => m.StateChart),      { ssr: false });
const HRVChart        = dynamic(() => import('../components/Charts').then(m => m.HRVChart),        { ssr: false });
const ComponentChart  = dynamic(() => import('../components/Charts').then(m => m.ComponentChart),  { ssr: false });

// ── Helpers ──────────────────────────────────────────────────────────────────
function avg(arr, fn) { const v = arr.map(fn).filter(x => x > 0); return v.length ? v.reduce((a,b) => a+b)/v.length : 0; }
function statePct(arr, key) { return arr.length ? arr.filter(r => r[key] === 1).length / arr.length * 100 : 0; }

function sosColor(v) {
  if (v >= 70) return 'var(--teal)';
  if (v >= 45) return 'var(--amber)';
  return 'var(--red)';
}
function sosLabel(v) {
  if (v >= 80) return 'Optimal';
  if (v >= 65) return 'Good';
  if (v >= 45) return 'Moderate';
  if (v >= 25) return 'Elevated Risk';
  return 'High Risk';
}

function ctxClass(c) {
  if (c === 'Optimal') return 'ctx-opt';
  if (c === 'MildStress-Dominant') return 'ctx-ms';
  if (c === 'Stress-Dominant') return 'ctx-sd';
  if (c === 'Recovery Deficit') return 'ctx-rd';
  if (c === 'Overtraining') return 'ctx-ot';
  return 'ctx-neu';
}

function StateBar({ label, pct, color }) {
  return (
    <div className="state-bar-row">
      <span className="sb-label">{label}</span>
      <div className="sb-track">
        <div className="sb-fill" style={{ width: `${Math.min(100,pct).toFixed(0)}%`, background: color }} />
      </div>
      <span className="sb-val" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [rawRows,    setRawRows]    = useState([]);
  const [dailyActs,  setDailyActs]  = useState({});   // { dateKey: [{name,cat,_src}] }
  const [results,    setResults]    = useState([]);
  const [view,       setView]       = useState('trajectory');
  const [selDay,     setSelDay]     = useState(null);  // result object
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoimmune, setAutoimmune] = useState(false);
  const fileRef = useRef();

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      const storedActs = localStorage.getItem(ACT_KEY);
      if (stored) {
        const rows = JSON.parse(stored);
        rows.forEach(r => { r._date = new Date(r._date); });
        setRawRows(rows);
      }
      if (storedActs) setDailyActs(JSON.parse(storedActs));
    } catch {}
  }, []);

  // ── Recompute whenever data changes ───────────────────────────────────────
  useEffect(() => {
    if (!rawRows.length) { setResults([]); return; }
    const res = computeAll(rawRows, dailyActs);
    setResults(res);
    // Autoimmune check: last 7 days
    const last7 = res.slice(-7);
    const rPct = statePct(last7, 'Recovery');
    const sPct = statePct(last7, 'Stress');
    setAutoimmune(rPct > 15 && sPct > 15);
  }, [rawRows, dailyActs]);

  // ── CSV upload ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result);
      if (!rows.length) { alert('No data found in CSV.'); return; }
      setRawRows(rows);
      localStorage.setItem(STORE_KEY, JSON.stringify(rows));
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ── Manual actions save ────────────────────────────────────────────────────
  const handleSaveActs = useCallback((date, acts, persist) => {
    setDailyActs(prev => {
      const next = { ...prev, [date]: acts };
      if (persist) localStorage.setItem(ACT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Clear all ─────────────────────────────────────────────────────────────
  function clearAll() {
    if (!confirm('Clear all data?')) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(ACT_KEY);
    setRawRows([]); setDailyActs({}); setResults([]); setSelDay(null);
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const latest    = results[results.length - 1];
  const avgSOS    = results.length ? results.reduce((s,r) => s + r.sos, 0) / results.length : 0;
  const avgVS     = avg(results, r => r.VitalzScore);
  const avgHRV    = avg(results, r => r.HRV);
  const rPct7     = results.length ? statePct(results.slice(-7), 'Recovery')   : 0;
  const mPct7     = results.length ? statePct(results.slice(-7), 'MildStress') : 0;
  const sPct7     = results.length ? statePct(results.slice(-7), 'Stress')     : 0;

  // ── Chart views ───────────────────────────────────────────────────────────
  const VIEWS = ['trajectory', 'state', 'hrv', 'components', 'table'];

  return (
    <div className="app-wrap">
      {/* ── Header ── */}
      <div className="header">
        <h1>SOS™ v4.0 — Health Trajectory Engine</h1>
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>📂 Upload CSV</button>
        <button className="btn btn-secondary" onClick={() => setDrawerOpen(true)}>+ Log Actions</button>
        {results.length > 0 && <button className="btn btn-danger btn-sm" onClick={clearAll}>Clear</button>}
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {/* ── Autoimmune Warning ── */}
      {autoimmune && (
        <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontWeight: 700 }}>
          ⚠ AUTOIMMUNE MODE FLAGGED — Recovery% &gt;15% AND Stress% &gt;15% simultaneously detected in last 7 days. Monitor immune markers immediately.
        </div>
      )}

      {/* ── Empty state ── */}
      {!results.length && (
        <div className="card">
          <div
            className="upload-zone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { const fr = new FileReader(); fr.onload = ev => { const rows = parseCSV(ev.target.result); if (rows.length) { setRawRows(rows); localStorage.setItem(STORE_KEY, JSON.stringify(rows)); } }; fr.readAsText(f); } }}
          >
            <div style={{ fontSize: 32 }}>📊</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>Drop your Signsbeat CSV here</div>
            <p>Supports long format (one row per action per date) and wide format</p>
            <p>VitalzScore · HRV · HR · DeepSleep · Pro_States · ActionName · ActionCategory</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* ── Summary row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            {latest && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Latest SOS™</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: sosColor(latest.sos) }}>{latest.sos?.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sosLabel(latest.sos)} · {latest.dk}</div>
              </div>
            )}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Avg SOS™</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: sosColor(avgSOS) }}>{avgSOS.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{results.length} days</div>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Avg VitalzScore</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{avgVS.toFixed(0)}</div>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Avg HRV</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--violet)' }}>{avgHRV.toFixed(0)}</div>
            </div>
            {latest && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Context</div>
                <span className={`ctx-chip ${ctxClass(latest.ctx)}`} style={{ fontSize: 13, padding: '4px 10px' }}>{latest.ctx}</span>
              </div>
            )}
          </div>

          {/* ── 7-day state bars ── */}
          <div className="card">
            <div className="card-title">7-Day State Distribution</div>
            <StateBar label="Recovery" pct={rPct7}  color="var(--teal)" />
            <StateBar label="MildStress" pct={mPct7} color="var(--amber)" />
            <StateBar label="Stress" pct={sPct7}    color="var(--red)" />
          </div>

          {/* ── View tabs ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Analysis</div>
              <div className="view-tabs">
                {VIEWS.map(v => (
                  <button key={v} className={`view-tab${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
                    {v === 'trajectory' ? 'Trajectory' : v === 'state' ? 'States' : v === 'hrv' ? 'HRV / HR' : v === 'components' ? 'Components' : 'Action Table'}
                  </button>
                ))}
              </div>
            </div>

            {view === 'trajectory'  && <div className="chart-wrap"><TrajectoryChart results={results} /></div>}
            {view === 'state'       && <div className="chart-wrap"><StateChart results={results} /></div>}
            {view === 'hrv'         && <div className="chart-wrap"><HRVChart results={results} /></div>}
            {view === 'components'  && <div className="chart-wrap"><ComponentChart results={results} /></div>}
            {view === 'table'       && (
              <ActionTable
                results={results}
                onSelectDay={r => setSelDay(r === selDay ? null : r)}
              />
            )}
          </div>

          {/* ── Day Detail ── */}
          {selDay && view === 'table' && (
            <DayDetail result={selDay} onClose={() => setSelDay(null)} />
          )}

          {/* ── Per-day cards (click from charts) ── */}
          {view !== 'table' && results.length > 0 && (
            <div className="card">
              <div className="card-title">Daily Breakdown — click a date to expand</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {results.map(r => (
                  <button
                    key={r.dk}
                    className="btn btn-sm btn-secondary"
                    style={{
                      borderColor: selDay?.dk === r.dk ? 'var(--teal)' : 'var(--border)',
                      color: selDay?.dk === r.dk ? 'var(--teal)' : 'var(--muted2)',
                    }}
                    onClick={() => setSelDay(selDay?.dk === r.dk ? null : r)}
                  >
                    {r.dk.slice(5)} · {r.sos?.toFixed(0)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selDay && view !== 'table' && (
            <DayDetail result={selDay} onClose={() => setSelDay(null)} />
          )}
        </>
      )}

      {/* ── Log Drawer ── */}
      <LogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dailyActs={dailyActs}
        onSave={handleSaveActs}
      />
    </div>
  );
}
