import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {hash, readJSON, writeJSON} from '../../ReCall/src/shared/artifacts.mjs';
import {oracleIndex, requireAlignedInputs} from '../scripts/simulation/validator.mjs';

// Observe each AST comparison in the released source-first loop. The hook
// runs in this process only and leaves both checkouts untouched.
const pipeline = new URL('../../ReCall/components/pipeline/index.mjs', import.meta.url);
const matchLine = 'if(!astMatch(sourceFunction.code,bm.get(bundleId).code,{minifiedSource:sourceCode}))continue;';
const hook = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (new URL(url).pathname !== pipeline.pathname) return result;
    const original = Buffer.from(result.source).toString('utf8');
    assert.equal(original.split(matchLine).length, 2);
    return {...result, source: original.replace(matchLine,
      'const matched=astMatch(sourceFunction.code,bm.get(bundleId).code,{minifiedSource:sourceCode});\n' +
      '     globalThis.recordRQ1ASTCheck(round,sourceId,bundleId,matched);\n' +
      '     if(!matched)continue;')};
  }
});
const {recoverFunctions} = await import(pipeline.href + '?stage-recall-audit');
hook.deregister();
globalThis.fetch = () => {throw new Error('Network access is disabled during replay')};

const [baselineRoot, finalRoot, extraEmbeddings, output, runtimeHashes] = process.argv.slice(2);
assert(output, 'Usage: node audit-stage-recall.mjs BASELINE_RESULTS FINAL_RUN EXTRA_EMBEDDINGS OUTPUT REMOTE_RUNTIME_HASHES');
const read = (root, name) => readJSON(path.join(root, name + '.json'));
const write = (root, name, data) => writeJSON(path.join(root, name + '.json'), data, {overwrite: true});
const progress = read(finalRoot, 'progress');
const protocol = read(finalRoot, 'protocol');
// The remote implementation digest included packaging sidecars. Verify
// every executable or prompt file against the server manifest by content.
const expectedHashes = fs.readFileSync(runtimeHashes, 'utf8').trim().split('\n')
  .map(line => line.split(/\s+/, 2)).filter(([, name]) => !path.basename(name).startsWith('._'));
const codeRoot = new URL('../../ReCall/', import.meta.url);
const actualHashes = ['src', 'components'].flatMap(dir =>
  fs.readdirSync(new URL(dir + '/', codeRoot), {recursive: true})
    .filter(name => /\.(mjs|txt)$/.test(name) && !path.basename(name).startsWith('._'))
    .map(name => [hash(fs.readFileSync(new URL(dir + '/' + name, codeRoot), 'utf8')), dir + '/' + name]));
assert.deepEqual(actualHashes.sort(), expectedHashes.sort());
assert.equal(progress.totals.repositories, 35);

function cachedModels(config, baseline, archived, expected, extra) {
  const stats = {embeddingCacheHits: 0, validationCacheHits: 0};
  const digests = archived.modelDigests;
  let position = 0;
  return {
    config, stats, modelDigests: digests, metadata: async () => digests,
    async embed(inputs) {
      const vectors = [];
      for (let i = 0; i < inputs.length; i += config.embeddingBatch) {
        const body = {
          model: config.embeddingModel, input: inputs.slice(i, i + config.embeddingBatch),
          truncate: false, keep_alive: config.keepAlive
        };
        const key = hash({endpoint: config.endpoint, modelDigest: digests[body.model], api: 'embed', body});
        const filename = key + '.json';
        const additional = path.join(extra, filename);
        const entry = readJSON(fs.existsSync(additional) ? additional : path.join(baseline, filename));
        assert.equal(entry.key, key);
        assert.deepEqual(entry.request, body);
        assert.equal(entry.modelDigests[body.model], digests[body.model]);
        vectors.push(...entry.response.embeddings);
        stats.embeddingCacheHits++;
      }
      return vectors;
    },
    async validate({source, bundle}) {
      const next = expected[position++];
      assert(next, 'Replay requested an extra validation');
      assert.equal(next.sourceId, source.id, 'Replay validator source diverged');
      assert.equal(next.bundleId, bundle.id, 'Replay validator target diverged');
      stats.validationCacheHits++;
      return next.result;
    },
    verify() {assert.equal(position, expected.length)}
  };
}
const pairKey = (source, bundle) => JSON.stringify([source, bundle]);
function candidateCounts(maps) {
  let positiveChecked = 0, positiveMatched = 0, incorrectMatches = 0, unassessedMatches = 0;
  for (const {groundTruth, matched} of maps.values()) {
    if (groundTruth === 'accept') {
      positiveChecked++;
      positiveMatched += Number(matched);
    } else if (matched && groundTruth === 'reject') incorrectMatches++;
    else if (matched) unassessedMatches++;
  }
  return {positiveChecked, positiveMatched, incorrectMatches, unassessedMatches};
}
function note(map, id, groundTruth, matched) {
  const existing = map.get(id);
  if (!existing || matched) map.set(id, {groundTruth, matched});
}

const rows = [];
for (const {subject, updated} of progress.rows) {
  const original = path.join(baselineRoot, 'rq1-strict-one-to-one-real', subject, 'run');
  const final = path.join(finalRoot, subject, 'run');
  const config = read(final, 'run').config.models;
  const archived = read(final, 'recovery');
  assert.equal(archived.configuration.neighborhoodOrder, 'source-first');
  assert(archived.configuration.oneBundlePerSource && !config.astFirst);
  const source = read(original, 'source');
  const bundle = read(original, 'bundle');
  const anchors = read(original, 'anchors');
  const gt = read(path.join(baselineRoot, 'rq1-crosschunk-simulation-2026-11-10', subject), 'ground-truth/relations');
  const oracle = oracleIndex(source, bundle, gt.pairs);
  assert.equal(requireAlignedInputs(oracle).groundTruthPairs, updated.denominator);

  const sourceByOracleKey = new Map();
  for (const f of source.functions) {
    const key = oracle.sourceKeys.get(f.id);
    if (!sourceByOracleKey.has(key)) sourceByOracleKey.set(key, []);
    sourceByOracleKey.get(key).push(f);
  }
  const {minFeatures, featureMetric} = anchors.options;
  const sizeEligible = f => Number(f[featureMetric]) >= minFeatures;
  const pog = {positiveSizeEligible: 0, positiveChecked: 0, positiveFingerprintEqual: 0,
    positiveRawAnchors: 0, positiveMatched: 0, incorrectMatches: 0, unassessedMatches: 0};
  const rawAnchorTargets = new Set(anchors.matches.filter(m => oracle.decision(m.sourceId, m.bundleId) === 'accept').map(m => oracle.targetKeys.get(m.bundleId)));
  pog.positiveRawAnchors = rawAnchorTargets.size;
  for (const b of bundle.functions) {
    const key = oracle.targetKeys.get(b.id);
    const expected = oracle.expected.get(key);
    if (!expected || !sizeEligible(b)) continue;
    const eligibleSources = sourceByOracleKey.get(expected).filter(sizeEligible);
    if (!eligibleSources.length) continue;
    pog.positiveSizeEligible++;
    if (!b.pogHash || !eligibleSources.some(s => s.pogHash)) continue;
    pog.positiveChecked++;
    if (eligibleSources.some(s => s.pogHash === b.pogHash)) pog.positiveFingerprintEqual++;
  }

  const qwenPairs = new Map(), expected = [];
  for (const query of archived.queries) {
    for (const {sourceId, score, ...result} of query.checks) {
      if (result.validator !== 'model') continue;
      expected.push({sourceId, bundleId: query.bundleId, result});
      if (['accept', 'reject'].includes(result.verdict)) {
        note(qwenPairs, pairKey(sourceId, query.bundleId), oracle.decision(sourceId, query.bundleId), result.verdict === 'accept');
      }
    }
  }
  const astPairs = new Map(), records = [];
  globalThis.recordRQ1ASTCheck = (round, sourceId, bundleId, matched) => {
    const id = pairKey(sourceId, bundleId);
    const groundTruth = oracle.decision(sourceId, bundleId);
    note(astPairs, id, groundTruth, matched);
    records.push(JSON.stringify({round, sourceId, bundleId, matched, groundTruth}));
  };
  const models = cachedModels(config, path.join(original, 'model-cache/embed'), archived, expected,
    path.join(extraEmbeddings, subject, 'run/model-cache/embed'));
  const replay = await recoverFunctions({
    source, bundle, anchors, models, config: archived.configuration,
    sourceGraph: read(original, 'sourceGraph'), bundleGraph: read(original, 'bundleGraph'),
    libraries: read(original, 'libraries')
  });
  models.verify();
  assert.equal(replay.status, 'fixed-point');
  for (const field of ['promotions', 'queries', 'processedStates']) assert.deepEqual(replay[field], archived[field]);
  for (const key of Object.keys(replay.stats)) {
    if (key !== 'model' && key !== 'elapsedMs') assert.equal(replay.stats[key], archived.stats[key], key);
  }
  assert.equal(records.length, archived.stats.astPreRankingChecks);

  const ast = {...candidateCounts(astPairs), checks: records.length, distinctChecks: astPairs.size};
  const qwen = candidateCounts(qwenPairs);
  const methods = {'pog-anchor': pog, 'ast-recovered': ast, 'model-recovered': qwen};
  const accepted = {'accept': 'positiveMatched', 'reject': 'incorrectMatches', 'unassessed': 'unassessedMatches'};
  const fromPromotions = Object.fromEntries(Object.keys(methods).map(k => [k, {positiveMatched: 0, incorrectMatches: 0, unassessedMatches: 0}]));
  for (const m of replay.promotions) fromPromotions[m.kind][accepted[oracle.decision(m.sourceId, m.bundleId)]]++;
  Object.assign(pog, fromPromotions['pog-anchor']);
  for (const [method, stats] of Object.entries(methods)) for (const [key, value] of Object.entries(fromPromotions[method])) assert.equal(stats[key], value);
  const dir = path.join(output, subject);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'ast-checks.jsonl'), records.length ? records.join('\n') + '\n' : '');
  const row = {subject, groundTruth: updated.denominator, pog, ast, qwen};
  write(dir, 'stage-recall', row);
  rows.push(row);
  console.log(subject, JSON.stringify(row));
}
const totals = Object.fromEntries(['pog', 'ast', 'qwen'].map(stage => [stage,
  Object.fromEntries(Object.keys(rows[0][stage]).map(key => [key, rows.reduce((sum, row) => sum + row[stage][key], 0)]))]));
write(output, 'stage-recall', {repositories: rows.length, implementationDigest: protocol.implementationDigest, totals, rows});
console.log(JSON.stringify(totals));
