// Nodevision/scripts/csv-latency-benchmark.mjs
// This benchmark measures the CSV editor's model and history input pipeline, excluding browser DOM, layout, painting, and toolbar work.
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice(11);
const modelPath = 'ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.mjs';
const { setCsvCellValue } = baseline
  ? await import('data:text/javascript;base64,' + Buffer.from(execFileSync('git', ['show', baseline + ':' + modelPath])).toString('base64'))
  : await import('../' + modelPath);
import { createWysiwygProgrammaticHistory } from '../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs';
const base = '../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/';
const optimized = !baseline && readFileSync(new URL(base + 'CSVeditor.mjs', import.meta.url), 'utf8').includes('createCsvHistory');
const createHistory = optimized ? (await import(base + 'CSVHistory.mjs')).createCsvHistory : null;
const reports = [];
for (const count of [100, 1000, 5000]) {
  const runs = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    let rows = Array.from({ length: count }, (_, r) => Array.from({ length: 30 }, (_, c) => `row-${r}-cell-${c}`));
    const state = () => ({ rows, anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } });
    const snapshot = optimized ? state : () => JSON.stringify(state());
    const history = optimized ? createHistory({ readSnapshot: snapshot, writeSnapshot() {} })
      : createWysiwygProgrammaticHistory({}, { readSnapshot: snapshot, writeSnapshot() {} });
    const times = [];
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      const before = snapshot();
      rows = setCsvCellValue(rows, 0, 0, 'typed-' + i);
      history.record(before);
      if (i >= 10) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    runs.push({ p50: times[50], p95: times[95], max: times[99] });
  }
  reports.push({ rows: count, columns: 30, runs });
}
console.log(JSON.stringify({ optimized, baseline: baseline || null, node: process.version, platform: process.platform, measurements: 'milliseconds; model/history only; 3 runs, 100 inputs after 10 warmups', reports }, null, 2));
