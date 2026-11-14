import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readJSON, writeJSON} from '../../ReCall/src/shared/artifacts.mjs';
import {oracleIndex, requireAlignedInputs, scoreSimulation} from '../scripts/simulation/validator.mjs';

const [finalRoot, archiveRoot, revisedCacheRoot, output] = process.argv.slice(2);
assert(output, 'Usage: node export-validation-falses.mjs FINAL_RUN BASELINE_RESULTS REVISED_CACHE OUTPUT');
const progress = readJSON(path.join(finalRoot, 'progress.json'));
assert(progress.active === null && progress.totals.repositories === 35);
const read = (dir, name) => readJSON(path.join(dir, name));
const write = (dir, name, data) => writeJSON(path.join(dir, name), data, {overwrite: true});
const summary = [];

function chatCache(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => read(dir, name));
}

for (const row of progress.rows) {
  const {subject} = row;
  assert.equal(row.status, 'completed');
  const final = path.join(finalRoot, subject);
  const baseline = path.join(archiveRoot, 'rq1-strict-one-to-one-real', subject, 'run');
  const [source, bundle] = ['source.json', 'bundle.json'].map(name => read(baseline, name));
  const truth = read(path.join(archiveRoot, 'rq1-crosschunk-simulation-2026-11-10', subject), 'ground-truth/relations.json');
  const oracle = oracleIndex(source, bundle, truth.pairs);
  assert.equal(requireAlignedInputs(oracle).groundTruthPairs, row.updated.denominator);
  const recovery = read(path.join(final, 'run'), 'recovery.json');
  assert.equal(recovery.status, 'fixed-point');
  assert.deepEqual(scoreSimulation(oracle, recovery), row.updated);
  for (const key of ['sourceId', 'bundleId']) assert.equal(new Set(recovery.promotions.map(pair => pair[key])).size, recovery.promotions.length);
  const sourceById = new Map(source.functions.map(fn => [fn.id, fn]));
  const bundleById = new Map(bundle.functions.map(fn => [fn.id, fn]));
  const promoted = new Set(recovery.promotions.map(pair => JSON.stringify([pair.sourceId, pair.bundleId])));
  const oldCache = chatCache(path.join(baseline, 'model-cache/chat'));
  const newCache = chatCache(path.join(revisedCacheRoot, subject, 'run/model-cache/chat'));
  assert.equal(oldCache.length, row.originalRequests);
  assert.equal(newCache.length, row.revisedRequests);
  const byResponse = new Map([...oldCache, ...newCache].map(entry => [entry.response.created_at, entry]));
  assert.equal(byResponse.size, oldCache.length + newCache.length);
  const errors = {FP: new Map(), FN: new Map()};
  let unassessedChecks = 0;
  let invalidChecks = 0;
  function record(sourceId, bundleId, response, phase, traceRound) {
    const groundTruth = oracle.decision(sourceId, bundleId);
    const verdict = response.message.content.trim();
    if (phase === 'final-recovery-trace') {
      if (groundTruth === 'unassessed') unassessedChecks++;
      if (!['T', 'F'].includes(verdict)) invalidChecks++;
    }
    const kind = verdict === 'T' && groundTruth === 'reject' ? 'FP'
      : verdict === 'F' && groundTruth === 'accept' ? 'FN' : null;
    if (!kind) return;
    const entry = byResponse.get(response.created_at);
    assert(entry);
    assert.deepEqual(response, entry.response);
    const input = entry.request.messages.find(message => message.role === 'user').content;
    const bodies = JSON.parse(input);
    assert.equal(bodies.source_function, sourceById.get(sourceId).code);
    assert.equal(bodies.bundled_function, bundleById.get(bundleId).code);
    const key = JSON.stringify([sourceId, bundleId]);
    if (!errors[kind].has(key)) {
      errors[kind].set(key, {
        subject, sourceId, bundleId, groundTruth: kind === 'FP' ? 'F' : 'T', input,
        finalPairPromoted: promoted.has(key), judgments: []
      });
    }
    const item = errors[kind].get(key);
    assert.equal(item.input, input);
    let judgment = item.judgments.find(value => value.requestKey === entry.key);
    if (!judgment) {
      const {model, think, stream, keep_alive, options} = entry.request;
      judgment = {
        requestKey: entry.key, model, modelDigest: entry.modelDigests[model],
        settings: {think, stream, keep_alive, options}, output: entry.response,
        targetedRecheck: false, traceRounds: []
      };
      item.judgments.push(judgment);
    }
    if (phase === 'targeted-recheck') judgment.targetedRecheck = true;
    else if (!judgment.traceRounds.includes(traceRound)) judgment.traceRounds.push(traceRound);
  }
  for (const query of recovery.queries) {
    for (const check of query.checks) {
      if (check.validator === 'model') record(check.sourceId, query.bundleId, check.response, 'final-recovery-trace', query.round);
    }
  }
  for (const item of read(final, 'rechecks.json')) {
    for (const pair of item.pairs) record(pair.sourceId, pair.bundleId, item.response, 'targeted-recheck');
  }
  const counts = {subject, unassessedChecks, invalidChecks};
  for (const [kind, items] of Object.entries(errors)) {
    const records = [...items.values()];
    records.forEach((item, index) => {item.id = `${subject}/${kind}-${String(index + 1).padStart(4, '0')}`});
    write(output, path.join(kind, subject + '.json'), records);
    counts[kind] = records.length;
    counts[kind + 'InTrace'] = records.filter(item => item.judgments.some(judgment => judgment.traceRounds.length)).length;
  }
  summary.push(counts);
}
const totals = Object.fromEntries(Object.keys(summary[0]).filter(key => key !== 'subject').map(key =>
  [key, summary.reduce((sum, row) => sum + row[key], 0)]));
write(output, 'summary.json', {repositories: summary.length, totals, rows: summary});
console.log(totals);
