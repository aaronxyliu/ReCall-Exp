import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {recoverFunctions} from '../../ReCall/components/pipeline/index.mjs';
import {createModelClient} from '../../ReCall/components/pipeline/models.mjs';
import {minifySourceFunction} from '../../ReCall/src/analysis/minify.mjs';
import {hash, readJSON, writeJSON} from '../../ReCall/src/shared/artifacts.mjs';
import {exportRecovered, implementationDigest, summarizeRecovery} from '../../ReCall/src/workflow/run.mjs';
import {oracleIndex, requireAlignedInputs, scoreSimulation} from '../scripts/simulation/validator.mjs';

const [baselineRoot, simulationRoot, outputRoot, oldPromptFile, onlySubject] = process.argv.slice(2);
assert(outputRoot && oldPromptFile, 'Usage: node recheck-validation.mjs BASELINE SIMULATION OUTPUT OLD_PROMPT [SUBJECT]');
const oldPrompt = fs.readFileSync(oldPromptFile, 'utf8');
const prompt = fs.readFileSync(new URL('../../ReCall/src/analysis/validator-system-prompt.txt', import.meta.url), 'utf8');
assert.notEqual(prompt, oldPrompt);
const read = (dir, name) => readJSON(path.join(dir, name + '.json'));
const write = (dir, name, value) => writeJSON(path.join(dir, name + '.json'), value, {overwrite: true});
const digest = implementationDigest();
const subjects = read(baselineRoot, 'progress').rows;
assert(subjects.length === 35 && new Set(subjects.map(row => row.subject)).size === 35);
const selected = subjects.filter(row => !onlySubject || row.subject === onlySubject);
assert(selected.length, 'Unknown subject');
const started = new Date().toISOString();
const protocol = {
  originalPromptSHA256: hash(oldPrompt), revisedPromptSHA256: hash(prompt), implementationDigest: digest,
  policy: 'Ground truth selects previously observed model F / ground-truth T requests for revalidation. Exact original judgments are reused for other historical requests. New requests use the revised prompt. Recovery is regenerated from the original anchors with normal source-first ranking and one-to-one allocation.'
};
const manifestFile = path.join(outputRoot, 'protocol.json');
if (fs.existsSync(manifestFile)) assert.deepEqual(readJSON(manifestFile), protocol);
else write(outputRoot, 'protocol', protocol);

function inputs(source, bundle, minified) {
  return JSON.stringify({source_function: source.code, minified_source_function: minified, bundled_function: bundle.code});
}
function requestBody(config, system, user) {
  return {
    model: config.validationModel, messages: [{role: 'system', content: system}, {role: 'user', content: user}],
    think: config.thinking, stream: false, keep_alive: config.keepAlive,
    options: {temperature: config.temperature, num_ctx: config.numCtx, num_predict: config.numPredict, seed: config.seed}
  };
}
function cacheKey(config, digests, body) {
  return hash({endpoint: config.endpoint, modelDigest: digests[body.model], api: 'chat', body});
}
function verdict(response) {
  const text = response.message?.content?.trim();
  if (text === 'T') return 'accept';
  if (text === 'F') return 'reject';
  return 'invalid';
}
const pairId = (source, bundle) => JSON.stringify([source.id, bundle.id]);

async function loadSubject({subject, pairs}) {
  const baseline = path.join(baselineRoot, subject, 'run');
  const simulation = path.join(simulationRoot, subject);
  const original = read(baseline, 'recovery');
  const originalRun = read(baseline, 'run');
  assert(original.status === 'fixed-point' && original.configuration.oneBundlePerSource &&
    original.configuration.neighborhoodOrder === 'source-first' && !originalRun.config.models.astFirst);
  const [source, bundle] = ['source', 'bundle'].map(name => read(baseline, name));
  const oracle = oracleIndex(source, bundle, read(simulation, 'ground-truth/relations').pairs);
  assert.equal(requireAlignedInputs(oracle).groundTruthPairs, pairs);
  const sourceById = new Map(source.functions.map(fn => [fn.id, fn]));
  const bundleById = new Map(bundle.functions.map(fn => [fn.id, fn]));
  const originalCache = new Map();
  const originalChat = path.join(baseline, 'model-cache/chat');
  if (fs.existsSync(originalChat)) for (const file of fs.readdirSync(originalChat).filter(name => name.endsWith('.json'))) {
    const entry = readJSON(path.join(originalChat, file));
    assert.equal(entry.request.messages[0].content, oldPrompt);
    assert.equal(entry.key, cacheKey(originalRun.config.models, original.modelDigests, entry.request));
    assert.equal(entry.key + '.json', file);
    originalCache.set(entry.key, entry);
  }
  assert.equal(originalCache.size, original.stats.model.validationRequests);
  const eligible = new Map();
  const targetedPairs = new Map();
  const minified = new Map();
  for (const query of original.queries) for (const check of query.checks) {
    if (check.validator !== 'model' || check.verdict !== 'reject' ||
        oracle.decision(check.sourceId, query.bundleId) !== 'accept') continue;
    const sourceFn = sourceById.get(check.sourceId), bundleFn = bundleById.get(query.bundleId);
    if (!minified.has(check.sourceId)) minified.set(check.sourceId, minifySourceFunction(sourceFn.code));
    const user = inputs(sourceFn, bundleFn, minified.get(check.sourceId));
    const key = cacheKey(originalRun.config.models, original.modelDigests, requestBody(originalRun.config.models, oldPrompt, user));
    assert.equal(originalCache.get(key)?.response.message?.content?.trim(), 'F');
    const id = pairId(sourceFn, bundleFn);
    targetedPairs.set(id, key);
    if (!eligible.has(key)) eligible.set(key, {source: sourceFn, bundle: bundleFn, minified: minified.get(check.sourceId), pairs: new Map()});
    eligible.get(key).pairs.set(id, {sourceId: sourceFn.id, bundleId: bundleFn.id});
  }
  return {baseline, simulation, original, originalRun, source, bundle, oracle, originalCache, eligible, targetedPairs};
}

async function recheck(row) {
  const begin = performance.now();
  const {subject} = row, output = path.join(outputRoot, subject);
  if (fs.existsSync(path.join(output, 'score.json'))) return;
  console.log(new Date().toISOString(), subject, 'loading');
  const {baseline, simulation, original, originalRun, source, bundle, oracle, originalCache, eligible, targetedPairs} = await loadSubject(row);
  const cacheDir = path.join(output, 'run/model-cache');
  const runDir = path.join(output, 'run');
  const oldEmbed = path.join(baseline, 'model-cache/embed'), newEmbed = path.join(cacheDir, 'embed');
  if (fs.existsSync(oldEmbed)) {
    fs.mkdirSync(newEmbed, {recursive: true});
    for (const name of fs.readdirSync(oldEmbed).filter(name => name.endsWith('.json'))) {
      try {fs.linkSync(path.join(oldEmbed, name), path.join(newEmbed, name))}
      catch (error) {if (error.code !== 'EEXIST') throw error}
    }
  }
  const client = createModelClient({...originalRun.config.models, cacheDir, systemPrompt: prompt});
  const digests = original.modelDigests ? await client.metadata() : null;
  assert.deepEqual(digests, original.modelDigests);
  const replayed = new Map();
  for (const [key, pair] of eligible) {
    const result = await client.validate(pair);
    replayed.set(key, result);
    if (replayed.size % 20 === 0 || replayed.size === eligible.size) {
      console.log(new Date().toISOString(), subject, 'rechecked', replayed.size, '/', eligible.size);
    }
  }
  write(output, 'rechecks', [...replayed].map(([key, result]) => ({
    originalCacheKey: key, pairs: [...eligible.get(key).pairs.values()],
    verdict: result.verdict, response: result.response
  })));
  const models = {
    ...client,
    get modelDigests() {return client.modelDigests},
    async validate(pair) {
      const user = inputs(pair.source, pair.bundle, pair.minified);
      const key = cacheKey(originalRun.config.models, digests, requestBody(originalRun.config.models, oldPrompt, user));
      const targetedKey = targetedPairs.get(pairId(pair.source, pair.bundle));
      if (targetedKey) {
        assert.equal(targetedKey, key);
        return {...replayed.get(key), validationEvidence: 'rechecked-original-rejection'};
      }
      const entry = originalCache.get(key);
      if (entry) return {verdict: verdict(entry.response), validator: 'model', response: entry.response, validationEvidence: 'original-judgment'};
      const result = await client.validate(pair);
      return {...result, validationEvidence: 'new-candidate'};
    }
  };
  const save = (name, value) => write(runDir, name, value);
  const checkpointFile = path.join(runDir, 'checkpoint.json');
  let prior = null;
  if (fs.existsSync(checkpointFile)) {
    const {checkpointDigest, ...state} = readJSON(checkpointFile);
    assert.equal(hash(state), checkpointDigest);
    prior = state;
  }
  const config = {...originalRun.config, models: client.config};
  save('run', {...originalRun, config, implementationDigest: digest, node: process.version, protocol});
  const recovery = await recoverFunctions({
    source, bundle, ...Object.fromEntries(['sourceGraph', 'bundleGraph', 'anchors', 'libraries'].map(name => [name, read(baseline, name)])),
    config: {...config.recovery, models: config.models}, models, resume: prior,
    onCheckpoint: state => save('checkpoint', {...state, checkpointDigest: hash(state)}),
    onProgress: event => {
      if (event.status) console.log(new Date().toISOString(), subject, 'round', event.round, event.status, event.recovered);
    }
  });
  assert.equal(recovery.status, 'fixed-point');
  for (const key of ['sourceId', 'bundleId']) assert.equal(new Set(recovery.promotions.map(p => p[key])).size, recovery.promotions.length);
  const originalScore = scoreSimulation(oracle, original);
  const updatedScore = scoreSimulation(oracle, recovery);
  const validationChecks = {}, uniqueRequests = new Set();
  for (const query of recovery.queries) for (const check of query.checks) {
    if (check.validator !== 'model') continue;
    assert(check.validationEvidence && check.response?.created_at);
    validationChecks[check.validationEvidence] = (validationChecks[check.validationEvidence] ?? 0) + 1;
    uniqueRequests.add(check.response.created_at);
  }
  const newChat = path.join(cacheDir, 'chat');
  const revisedRequests = fs.existsSync(newChat) ? fs.readdirSync(newChat).filter(name => name.endsWith('.json')).length : 0;
  save('recovery', recovery);
  save('recovered-functions', exportRecovered(recovery, source, bundle));
  save('summary', summarizeRecovery(recovery, bundle));
  write(output, 'score', {
    subject, status: 'completed', original: originalScore, updated: updatedScore,
    simulation: read(simulation, 'isolated/summary').score, rechecked: eligible.size,
    recheckedPairs: targetedPairs.size,
    flips: [...replayed.values()].filter(result => result.verdict === 'accept').length,
    invalidRechecks: [...replayed.values()].filter(result => result.verdict === 'invalid').length,
    validationChecks, uniqueRequests: uniqueRequests.size, revisedRequests,
    originalRequests: original.stats.model.validationRequests, originalSeconds: original.stats.elapsedMs / 1000,
    rebuildSeconds: recovery.stats.elapsedMs / 1000, attemptSeconds: (performance.now() - begin) / 1000
  });
}

const existing = fs.existsSync(path.join(outputRoot, 'progress.json')) ? read(outputRoot, 'progress') : null;
const beganAt = existing?.started ?? started;
function publish(active, error) {
  const rows = subjects.map(({subject}) => {
    const dir = path.join(outputRoot, subject);
    if (fs.existsSync(path.join(dir, 'score.json'))) return read(dir, 'score');
    return {subject, status: subject === active ? (error ? 'failed' : 'running') : 'queued'};
  });
  const completed = rows.filter(row => row.status === 'completed');
  const sum = (select) => completed.reduce((total, row) => total + select(row), 0);
  const totals = {
    repositories: completed.length, denominator: sum(row => row.updated.denominator),
    recovered: sum(row => row.updated.correct), assessed: sum(row => row.updated.assessedPredictions),
    originalRecovered: sum(row => row.original.correct), originalAssessed: sum(row => row.original.assessedPredictions),
    simulationRecovered: sum(row => row.simulation.correct), originalRequests: sum(row => row.originalRequests),
    uniqueRequests: sum(row => row.uniqueRequests), revisedRequests: sum(row => row.revisedRequests),
    rechecked: sum(row => row.rechecked), flips: sum(row => row.flips), invalidRechecks: sum(row => row.invalidRechecks)
  };
  const updatedAt = new Date().toISOString();
  const elapsed = Math.floor((Date.parse(updatedAt) - Date.parse(beganAt)) / 1000);
  write(outputRoot, 'progress', {started: beganAt, updatedAt, elapsedSeconds: elapsed, active, error, totals, rows});
  const pct = (n, d) => d ? (100 * n / d).toFixed(2) + '%' : '—';
  const lines = [
    '# RQ1 recovery results', '', `Updated ${updatedAt}. Elapsed wall time ${Math.floor(elapsed / 3600)}h ${Math.floor(elapsed / 60) % 60}m ${elapsed % 60}s.`, '',
    `**${completed.length}/${subjects.length} repositories complete.** Recovery ${pct(totals.recovered, totals.denominator)} (${totals.recovered.toLocaleString()}/${totals.denominator.toLocaleString()}). Assessed precision ${pct(totals.recovered, totals.assessed)}.`,
    `Original recovery ${pct(totals.originalRecovered, totals.denominator)} and assessed precision ${pct(totals.originalRecovered, totals.originalAssessed)}. Simulation recovery ${pct(totals.simulationRecovered, totals.denominator)} on the same completed repositories.`,
    `Qwen judgments used in the rebuilt traces ${totals.uniqueRequests.toLocaleString()}. Revised-prompt requests stored ${totals.revisedRequests.toLocaleString()}. Targeted rechecks ${totals.rechecked.toLocaleString()}, with ${totals.flips.toLocaleString()} F-to-T changes and ${totals.invalidRechecks.toLocaleString()} invalid responses.`, '',
    'The experiment rechecks original Qwen rejections with ground-truth-positive labels, reuses other exact historical judgments, and runs the revised prompt on new requests. Each recovery is rebuilt from its original anchors. See [protocol.json](protocol.json) for provenance.', '',
    '| Repository | Status | Recovery | Original recovery | Assessed precision | Qwen judgments | Revised requests | Rechecked | F to T |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for (const row of rows) {
    if (row.status !== 'completed') {lines.push(`| ${row.subject} | ${row.status} | — | — | — | — | — | — | — |`); continue}
    lines.push(`| ${row.subject} | completed | ${pct(row.updated.correct, row.updated.denominator)} | ${pct(row.original.correct, row.original.denominator)} | ${pct(row.updated.correct, row.updated.assessedPredictions)} | ${row.uniqueRequests} | ${row.revisedRequests} | ${row.rechecked} | ${row.flips} |`);
  }
  if (error) lines.push('', `**${active}** failed with ${error}`);
  const temporary = path.join(outputRoot, '.progress.md.tmp');
  fs.writeFileSync(temporary, lines.join('\n') + '\n');
  fs.renameSync(temporary, path.join(outputRoot, 'PROGRESS.md'));
}

if (process.env.RQ1_RECHECK_INVENTORY === '1') {
  const counts = [];
  for (const row of selected) {
    const {eligible, targetedPairs, originalCache} = await loadSubject(row);
    counts.push({subject: row.subject, recheckRequests: eligible.size, recheckPairs: targetedPairs.size, originalRequests: originalCache.size});
  }
  write(outputRoot, 'inventory', counts);
  console.log(JSON.stringify(counts));
} else {
  for (const row of selected) {
    if (fs.existsSync(path.join(outputRoot, row.subject, 'score.json'))) continue;
    publish(row.subject);
    try {await recheck(row)}
    catch (error) {publish(row.subject, error.message); throw error}
  }
  publish(null);
}
