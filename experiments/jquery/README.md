# Active v8 experiment

The active validator returns **a compact full variable mapping plus an equivalence verdict**, without explanations, and with thinking off. The three-build experiment is complete: see the [recovery rates and remaining-function breakdown](../../results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/COMPARISON.md) and [V8_PROTOCOL.md](V8_PROTOCOL.md). Run `node scripts/jquery/experiment.mjs`; current results are in `results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8/`. The old completed experiment and diagnostics remain intact.

The following sections describe historical configurations and must not be read as the active prompt.

# Crafted jQuery recovery pilot

**Current preliminary setting:** minification always on, tree shaking always off. Run `node scripts/jquery/experiment.mjs` to process only esbuild, Rollup, and webpack under these settings. Active results: `results/jquery-4.0.0/minified-no-tree-shaking/`. The former 12-profile matrix is stopped and preserved. Current commands default to this restricted experiment; previous reproduction instructions below document the earlier matrix.

See [PROTOCOL.md](PROTOCOL.md) for scope, feature definitions, graph construction, model configuration, evaluation, and limits. The active validator is **v5 binary default-true**. The earlier abstaining-policy results remain under `results/jquery-4.0.0/`; new recovery outputs are separate under `results/jquery-4.0.0/v5-binary-validator/`.

## Reproduce

From the workspace root, with Node 24, local Chrome, and the two named Ollama models available:

```sh
npm ci --ignore-scripts
npm run build
node scripts/jquery/smoke.mjs
npm test
npm run inventory
EXPERIMENT_OUTPUT=results/jquery-4.0.0/v5-binary-validator node scripts/jquery/recover.mjs
EXPERIMENT_OUTPUT=results/jquery-4.0.0/v5-binary-validator npm run report
```

Thinking is explicitly disabled by user instruction. Ranking uses `/api/embed`, which produces vectors without generated reasoning. Validation sends `think: false`; the active configuration does not accept a thinking-enabled environment override. Historical thinking diagnostics are preserved but removed from the experiment runner. Model requests cache their complete configuration and model digests. Recovery runs without opening source maps; the report evaluates its outputs against them afterward. Interrupted runs reuse model caches, but replay their candidate/round sequence rather than resuming an in-flight request.

The validator returns JSON `false` only with obvious, definite evidence of a behavioral difference; otherwise JSON `true`, including incomplete evidence. No `uncertain` model verdict is permitted. Internally booleans map to accept/reject for reporting. Invalid outputs and transport errors remain separate. This is a permissive decision policy, not a proof of semantic equivalence. All top-three pairs are still checked independently; exactly one acceptance and no identity conflict are required for promotion. Multiple `true` responses remain ambiguous. `node scripts/jquery/experiment.mjs` selects the separate v5 output directory by default and runs recovery plus evaluation.

`OLLAMA_URL` can change the default `http://127.0.0.1:11434`. `BUILD_IDS` restricts an explicitly declared subset of build IDs. `CHROME_PATH` overrides the installed Chrome executable used by browser checks. The supplied browser default is the macOS Chrome path.

## View the web application

```sh
node scripts/jquery/serve.mjs
```

Open [the local build index](http://127.0.0.1:4387/). Each build shows the same task-board fixture and its behavior-check results. The fixture server only exposes the public build directory, not model logs or arbitrary workspace files. Stop it with Ctrl-C.

## Result files

- `build-manifest.json`: pinned tool versions, build settings, source lists, and artifact hashes.
- `browser-smoke.json`: actual browser checks for all builds.
- `inventory-summary.json`: function and feature counts.
- `detector-input.json`: reference and bundle functions/graphs, without oracle labels.
- `ground-truth.json`: separate source-map label votes and witnesses.
- `model-manifest.json`: actual Ollama model digests and deployment metadata.
- `model-cache/`: reusable embeddings and full pair request/response records.
- `recovery/*.json`: promotions, candidate rankings, rounds, and pair outcomes.
- `summary.json`, `identified-functions.json`, and `model-pair-evaluation.json`: offline evaluation outputs.

The experiment uses portable JSON files and does not modify the prior MySQL study data or the archived framework study.
