'use client';
import { CAT_COLORS } from '../lib/constants';

function ctxClass(c) {
  if (c === 'Optimal') return 'ctx-opt';
  if (c === 'MildStress-Dominant') return 'ctx-ms';
  if (c === 'Stress-Dominant') return 'ctx-sd';
  if (c === 'Recovery Deficit') return 'ctx-rd';
  if (c === 'Overtraining') return 'ctx-ot';
  return 'ctx-neu';
}

function SosBar({ val, max = 100 }) {
  const pct = Math.min(100, (val / max) * 100);
  const col = val >= 70 ? '#00d4aa' : val >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bar-wrap" style={{ minWidth: 60 }}>
      <div className="bar-bg" style={{ flex: 1 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, minWidth: 28, textAlign: 'right' }}>{val.toFixed(1)}</span>
    </div>
  );
}

export default function ActionTable({ results, onSelectDay }) {
  if (!results?.length) return null;

  const rows = [];
  results.forEach(r => {
    const acts = r.acts || [];
    const cl = r.cluster || { mod: 0, label: '', breakdown: [] };
    if (!acts.length) {
      rows.push(
        <tr key={r.dk} className="date-first">
          <td><span style={{ fontWeight: 700 }}>{r.dk}</span></td>
          <td colSpan={3}><em style={{ color: 'var(--muted)', fontSize: 11 }}>No actions logged</em></td>
          <td className={r.PP > .5 ? 'pos' : 'neg'}>{r.PP.toFixed(2)}</td>
          <td className={r.PR > .5 ? 'pos' : 'neg'}>{r.PR.toFixed(2)}</td>
          <td className={r.PM > .5 ? 'pos' : 'neg'}>{r.PM.toFixed(2)}</td>
          <td className={r.PS > .5 ? 'neg' : 'pos'}>{r.PS.toFixed(2)}</td>
          <td>{r.bs}</td>
          <td>{r.tp?.toFixed(1)}</td>
          <td>{r.as?.toFixed(1)}</td>
          <td>{r.rls.toFixed(1)}</td>
          <td><SosBar val={r.sos} /></td>
          <td><span className={`ctx-chip ${ctxClass(r.ctx)}`}>{r.ctx}</span></td>
        </tr>
      );
      return;
    }
    acts.forEach((a, ai) => {
      const isFirst = ai === 0;
      const isLast  = ai === acts.length - 1;
      const color = CAT_COLORS[a.cat] || '#94a3b8';
      rows.push(
        <tr key={`${r.dk}-${ai}`} className={isFirst ? 'date-first' : ''}>
          <td>
            {isFirst ? <span style={{ fontWeight: 700 }}>{r.dk}</span> : null}
          </td>
          <td>
            <span className="act-num">{ai + 1}/{acts.length}</span>
            <span className="act-name" style={{ color }}>{a.name}</span>
            {a._src === 'csv' && <span className="csv-badge">CSV</span>}
            <span className="cat-badge">{a.cat}</span>
          </td>
          <td><span className="cat-badge" style={{ color, background: color + '22' }}>{a.cat}</span></td>
          <td><span className={`ctx-chip ${ctxClass(a.ctx)}`}>{a.ctx}</span></td>
          <td className={a.PP > .5 ? 'pos' : 'neg'}>{a.PP != null ? a.PP.toFixed(2) : '—'}</td>
          <td className={a.PR > .5 ? 'pos' : 'neg'}>{a.PR != null ? a.PR.toFixed(2) : '—'}</td>
          <td className={a.PM > .5 ? 'pos' : 'neg'}>{a.PM != null ? a.PM.toFixed(2) : '—'}</td>
          <td className={a.PS > .5 ? 'neg' : 'pos'}>{a.PS != null ? a.PS.toFixed(2) : '—'}</td>
          <td style={{ fontWeight: 700, color: a.bs >= 3 ? 'var(--teal)' : a.bs <= -1 ? 'var(--red)' : 'var(--amber)' }}>{a.bs}</td>
          <td>{a.tpm?.toFixed(1)}</td>
          <td style={{ fontWeight: 600 }}>{a.as?.toFixed(1)}</td>
          <td>{isLast ? r.rls.toFixed(1) : ''}</td>
          <td>{isFirst ? <SosBar val={r.sos} /> : ''}</td>
          <td>
            {isFirst && <span className={`ctx-chip ${ctxClass(r.ctx)}`}>{r.ctx}</span>}
            {!isFirst && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.signal}</span>}
          </td>
        </tr>
      );
      if (isLast && acts.length > 0) {
        rows.push(
          <tr key={`${r.dk}-cluster`} className="cluster-row">
            <td colSpan={4}>⬡ Cluster: {cl.label} · {cl.breakdown.join(' · ') || 'No combo bonus'}</td>
            <td /><td /><td /><td />
            <td /><td />
            <td style={{ fontWeight: 700, color: cl.mod >= 0 ? 'var(--teal)' : 'var(--red)' }}>
              {cl.mod >= 0 ? '+' : ''}{cl.mod.toFixed(2)}
            </td>
            <td>{r.rls.toFixed(1)}</td>
            <td colSpan={2} />
          </tr>
        );
      }
    });
  });

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Category</th>
            <th>Context</th>
            <th>PP</th>
            <th>PR</th>
            <th>PM</th>
            <th>PS</th>
            <th>bScore</th>
            <th>TPM</th>
            <th>AS</th>
            <th>RLS</th>
            <th>SOS™</th>
            <th>Signal / State</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
