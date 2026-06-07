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

function ProBar({ label, val, color }) {
  return (
    <div className="pro-pill">
      <div className="pp-label">{label}</div>
      <div className="pp-bar"><div className="pp-fill" style={{ width: `${(val * 100).toFixed(0)}%`, background: color }} /></div>
      <div className="pp-val" style={{ color }}>{val.toFixed(2)}</div>
    </div>
  );
}

export default function DayDetail({ result, onClose }) {
  if (!result) return null;
  const r = result;
  const cl = r.cluster || { mod: 0, label: '', breakdown: [] };
  const acts = r.acts || [];
  const sosColor = r.sos >= 70 ? 'var(--teal)' : r.sos >= 45 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div className="dd-header">
        <div className="dd-date">{r.dk}</div>
        <div className="dd-sos" style={{ color: sosColor }}>{r.sos?.toFixed(1)}</div>
        <span className={`ctx-chip ${ctxClass(r.ctx)}`}>{r.ctx}</span>
        <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={onClose}>✕ Close</button>
      </div>

      {/* Biometric metrics */}
      <div className="dd-metrics">
        {[
          { label: 'VitalzScore', val: r.VitalzScore },
          { label: 'HRV', val: r.HRV },
          { label: 'HR', val: r.HR },
          { label: 'Deep Sleep%', val: r.Deep ? r.Deep + '%' : '—' },
          { label: 'NSI', val: r.NSI ?? '—' },
        ].map(({ label, val }) => (
          <div className="dm" key={label}>
            <div className="dm-label">{label}</div>
            <div className="dm-val">{val}</div>
          </div>
        ))}
      </div>

      {/* Pro_ bars */}
      <div className="pro-row" style={{ marginBottom: 14 }}>
        <ProBar label="Pro_Positive" val={r.PP} color="var(--teal)" />
        <ProBar label="Pro_Recovery" val={r.PR} color="var(--blue)" />
        <ProBar label="Pro_MildStress" val={r.PM} color="var(--amber)" />
        <ProBar label="Pro_Stress" val={r.PS} color="var(--red)" />
      </div>

      {/* SOS component breakdown */}
      <div className="rls-summary">
        {[
          ['APS', r.aps],
          ['RLS', r.rls],
          ['CLS', r.cls],
          ['DSS', r.dss],
          ['OTP', -r.otp],
          ['PIS', -r.pis],
          ['RDP', -r.rdp],
        ].map(([label, val], i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="op">{val >= 0 ? '+' : '−'}</span>}
            <div className="sum-item">
              <div className="si-label">{label}</div>
              <div className="si-val" style={{ color: val >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                {Math.abs(val).toFixed(1)}
              </div>
            </div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="op">=</span>
          <div className="sum-item">
            <div className="si-label">SOS™</div>
            <div className="si-val" style={{ fontSize: 20, color: sosColor }}>{r.sos?.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Per-action breakdown */}
      {acts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Action Breakdown</div>
          {acts.map((a, i) => {
            const color = CAT_COLORS[a.cat] || '#94a3b8';
            return (
              <div className="act-row" key={i}>
                <div className="act-row-top">
                  <div className="act-dot" style={{ background: color }} />
                  <span style={{ fontWeight: 700, color }}>{a.name}</span>
                  <span className="cat-badge">{a.cat}</span>
                  {a._src === 'csv' && <span className="csv-badge">CSV</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: a.bs >= 3 ? 'var(--teal)' : a.bs <= -1 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>
                    {a.signal}
                  </span>
                </div>
                <div className="act-row-bottom">
                  <div className="score-col"><div className="sc-label">PP</div><div className="sc-val" style={{ color: a.PP > .5 ? 'var(--teal)' : 'var(--red)' }}>{a.PP.toFixed(2)}</div></div>
                  <div className="score-col"><div className="sc-label">PR</div><div className="sc-val" style={{ color: a.PR > .5 ? 'var(--teal)' : 'var(--red)' }}>{a.PR.toFixed(2)}</div></div>
                  <div className="score-col"><div className="sc-label">PM</div><div className="sc-val" style={{ color: a.PM > .5 ? 'var(--amber)' : 'var(--muted)' }}>{a.PM.toFixed(2)}</div></div>
                  <div className="score-col"><div className="sc-label">PS</div><div className="sc-val" style={{ color: a.PS > .5 ? 'var(--red)' : 'var(--muted)' }}>{a.PS.toFixed(2)}</div></div>
                  <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                  <div className="score-col"><div className="sc-label">bScore</div><div className="sc-val">{a.bs}</div></div>
                  <div className="score-col"><div className="sc-label">TPM</div><div className="sc-val">{a.tpm?.toFixed(1)}</div></div>
                  <div className="score-col"><div className="sc-label">AS</div><div className="sc-val" style={{ color: a.as >= 0 ? 'var(--teal)' : 'var(--red)' }}>{a.as?.toFixed(1)}</div></div>
                </div>
              </div>
            );
          })}
          {/* Cluster block */}
          <div className="cluster-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>⬡ Cluster Modifier</span>
              <span className={`ctx-chip ${cl.mod > 0 ? 'ctx-opt' : cl.mod < 0 ? 'ctx-sd' : 'ctx-neu'}`}>{cl.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: cl.mod >= 0 ? 'var(--teal)' : 'var(--red)', fontSize: 16 }}>
                {cl.mod >= 0 ? '+' : ''}{cl.mod.toFixed(2)}
              </span>
            </div>
            {cl.breakdown.map((b, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 2 }}>• {b}</div>
            ))}
            {!cl.breakdown.length && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No combination bonuses applied</div>}
          </div>
        </div>
      )}
    </div>
  );
}
