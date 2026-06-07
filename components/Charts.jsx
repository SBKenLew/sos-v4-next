'use client';
import { useEffect, useRef } from 'react';
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' } },
    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.06)' } },
  },
};

function fmt(dk) { return dk ? dk.slice(5) : ''; }

export function TrajectoryChart({ results }) {
  const labels = results.map(r => fmt(r.dk));
  const data = {
    labels,
    datasets: [
      {
        label: 'SOS', data: results.map(r => r.sos?.toFixed(1)),
        borderColor: '#00d4aa', backgroundColor: 'rgba(0,212,170,.1)',
        fill: true, tension: .35, pointRadius: 3, pointHoverRadius: 5,
      },
      {
        label: 'VitalzScore', data: results.map(r => r.VitalzScore),
        borderColor: '#3b82f6', backgroundColor: 'transparent',
        tension: .35, pointRadius: 2, borderDash: [4,3],
      },
    ],
  };
  const opts = { ...CHART_OPTS, scales: { ...CHART_OPTS.scales, y: { ...CHART_OPTS.scales.y, min: 0, max: 100 } } };
  return <Line data={data} options={{ ...opts, plugins: { ...opts.plugins, legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } } } }} />;
}

export function StateChart({ results }) {
  const labels = results.map(r => fmt(r.dk));
  const data = {
    labels,
    datasets: [
      { label: 'Recovery%', data: results.map(r => r.rPct?.toFixed(1)), backgroundColor: 'rgba(0,212,170,.7)' },
      { label: 'MildStress%', data: results.map(r => r.mPct?.toFixed(1)), backgroundColor: 'rgba(245,158,11,.7)' },
      { label: 'Stress%', data: results.map(r => r.sPct?.toFixed(1)), backgroundColor: 'rgba(239,68,68,.7)' },
    ],
  };
  const opts = {
    ...CHART_OPTS,
    scales: { ...CHART_OPTS.scales, x: { ...CHART_OPTS.scales.x, stacked: true }, y: { ...CHART_OPTS.scales.y, stacked: true, min: 0, max: 100 } },
    plugins: { ...CHART_OPTS.plugins, legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } } },
  };
  return <Bar data={data} options={opts} />;
}

export function HRVChart({ results }) {
  const labels = results.map(r => fmt(r.dk));
  const data = {
    labels,
    datasets: [
      {
        label: 'HRV', data: results.map(r => r.HRV || null),
        borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,.1)',
        fill: true, tension: .35, pointRadius: 2,
      },
      {
        label: 'HR', data: results.map(r => r.HR || null),
        borderColor: '#f97316', backgroundColor: 'transparent',
        tension: .35, pointRadius: 2, borderDash: [4,3],
      },
    ],
  };
  const opts = {
    ...CHART_OPTS,
    plugins: { ...CHART_OPTS.plugins, legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } } },
  };
  return <Line data={data} options={opts} />;
}

export function ComponentChart({ results }) {
  const labels = results.map(r => fmt(r.dk));
  const data = {
    labels,
    datasets: [
      { label: 'APS', data: results.map(r => r.aps?.toFixed(1)), backgroundColor: 'rgba(0,212,170,.6)' },
      { label: 'RLS', data: results.map(r => r.rls?.toFixed(1)), backgroundColor: 'rgba(59,130,246,.6)' },
      { label: 'CLS', data: results.map(r => r.cls?.toFixed(1)), backgroundColor: 'rgba(167,139,250,.6)' },
      { label: 'DSS', data: results.map(r => r.dss?.toFixed(1)), backgroundColor: 'rgba(34,197,94,.6)' },
    ],
  };
  const opts = {
    ...CHART_OPTS,
    scales: { ...CHART_OPTS.scales, x: { ...CHART_OPTS.scales.x, stacked: true }, y: { ...CHART_OPTS.scales.y, stacked: true } },
    plugins: { ...CHART_OPTS.plugins, legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } } },
  };
  return <Bar data={data} options={opts} />;
}
