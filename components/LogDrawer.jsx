'use client';
import { useState } from 'react';
import { CAT_COLORS, ACTION_PRESETS, CATEGORY_GROUPS } from '../lib/constants';
import { toDateKey } from '../lib/parser';

export default function LogDrawer({ open, onClose, dailyActs, onSave }) {
  const today = toDateKey(new Date());
  const [date, setDate] = useState(today);
  const [selCat, setSelCat] = useState('Indoor Physical Activity');
  const [customName, setCustomName] = useState('');
  const [tempActs, setTempActs] = useState([]);

  const existingForDate = dailyActs[date] || [];
  const allForDate = [...existingForDate, ...tempActs];

  function addAction(name, cat) {
    if (!name.trim()) return;
    if (allForDate.find(a => a.name === name)) return;
    setTempActs(prev => [...prev, { name: name.trim(), cat, _src: 'manual' }]);
    setCustomName('');
  }

  function removeTemp(idx) {
    setTempActs(prev => prev.filter((_, i) => i !== idx));
  }

  function removeExisting(name) {
    onSave(date, existingForDate.filter(a => a.name !== name), false);
  }

  function save() {
    const merged = [...existingForDate, ...tempActs];
    onSave(date, merged, true);
    setTempActs([]);
    onClose();
  }

  const allCats = CATEGORY_GROUPS.flatMap(g => g.cats);

  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`drawer${open ? ' open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="drawer-title">Log Actions</span>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>✕</button>
        </div>

        {/* Date picker */}
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {/* Category selector */}
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={selCat} onChange={e => setSelCat(e.target.value)}>
            {CATEGORY_GROUPS.map(g => (
              <optgroup key={g.label} label={`── ${g.label}`}>
                {g.cats.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div className="form-group">
          <label className="form-label">Quick add</label>
          <div className="preset-grid">
            {(ACTION_PRESETS[selCat] || []).map(p => (
              <button key={p} className="preset-btn" onClick={() => addAction(p, selCat)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Custom name */}
        <div className="form-group">
          <label className="form-label">Custom action name</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input" placeholder="e.g. Morning Walk 5km"
              value={customName} onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAction(customName, selCat)}
            />
            <button className="btn btn-primary btn-sm" onClick={() => addAction(customName, selCat)}>Add</button>
          </div>
        </div>

        {/* Actions for this date */}
        {allForDate.length > 0 && (
          <div className="form-group">
            <label className="form-label">Actions for {date}</label>
            <div className="actions-list">
              {existingForDate.map((a, i) => (
                <div className="action-chip" key={`ex-${i}`}>
                  <div className="dot" style={{ background: CAT_COLORS[a.cat] || '#94a3b8' }} />
                  <span style={{ fontWeight: 600 }}>{a.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>{a.cat}</span>
                  <span className="rm" onClick={() => removeExisting(a.name)}>×</span>
                </div>
              ))}
              {tempActs.map((a, i) => (
                <div className="action-chip" key={`tmp-${i}`} style={{ border: '1px dashed var(--teal)' }}>
                  <div className="dot" style={{ background: CAT_COLORS[a.cat] || '#94a3b8' }} />
                  <span style={{ fontWeight: 600 }}>{a.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--teal)', marginLeft: 4 }}>new</span>
                  <span className="rm" onClick={() => removeTemp(i)}>×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}
