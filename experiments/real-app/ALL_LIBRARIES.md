# All directly declared JavaScript libraries

Subject: primary-60 / PanJiaChen/vue-admin-template, commit 4c18a3f47bdb417ad8a25f09910f848cb574dee2. Read the repository's package.json, imports, README, and production splitChunks settings before selection.

Targets are all six directly declared JavaScript libraries: axios 0.18.1, core-js 3.6.5, Element UI 2.13.2, js-cookie 2.2.0, NProgress 0.2.0, and path-to-regexp 2.4.0. Vue, Vue Router, Vuex, CSS, development dependencies, and other transitive package names are excluded from target membership; their code remains in the full bundle search space. Target membership is the last node_modules package segment of each source path. The nested babel-runtime/node_modules/core-js copy is version 2.6.12 (verified from its _core.js) and is included under core-js, with a separate source-path identity from core-js 3.6.5. Package instances must not be merged merely because their contents match.

Inspecting all 16 map-enabled production JavaScript artifacts found target code in exactly two chunks: chunk-libs.df9dc2eb.js and chunk-elementUI.6f38d267.js. Both complete chunks and their source maps are copied after validating pinned corpus SHA256 values. They contain 2,425 and 4,197 functions, respectively. The build settings are preserved, rather than constructing a library-only bundle.

Reference population: 4,732 static function definitions in 290 unique build-input source files. Source path plus content hash identifies each file; repeated references to the same path/content are deduplicated. The six-library inventory is 97 axios, 435 core-js, 4,139 Element UI, 10 js-cookie, 39 NProgress, and 12 path-to-regexp functions. Element UI reference files are its published precompiled JavaScript distribution, rather than upstream Vue single-file components. Callbacks, wrappers, and internal/compiler helpers present in those input files are included; these numbers are not documented API totals.

The frozen oracle supports 4,678 target occurrences: 92 axios, 416 core-js, 4,110 Element UI, 9 js-cookie, 39 NProgress, and 12 path-to-regexp. Source reference functions without supported counterparts remain separate. There are no repeated supported source identities in this particular two-chunk inventory. Oracle thresholds are unchanged: innermost generated own-body interior points; at least two mapping votes, at least 80% purity, and a strict unique winner. Source maps establish positional identity, not semantic equivalence. Keep unresolved predictions unassessed. Structural review of these outputs is supplemental and must not update recovery or the frozen primary oracle.

Algorithm and models are frozen from jQuery experiment 4 (1538/1629, 94.41%). Ranking uses qwen3-embedding:0.6b and Terser-minified reference functions with the same instruction. Validation uses qwen3.5:27b, source + minified source + bundle code, the same transformation-reference prompt, thinking false, T/F output, temperature 0, seed 42, context 16384, output budget 384. The same top-five first-positive procedure, POG eligibility, neighborhoods, 18000-character embedding limit, and per-chunk one-to-one promotion rule apply. Source sibling parent identities are namespaced by file to preserve file-local relationships in the joint reference pool. No cross-module resolver is added.

Exact-request embedding and validation caches from the prior three-library run are copied with hashes recorded. Candidate generation, anchor uniqueness, ranking, and promotion are rerun against the expanded joint reference pool. No prior promotions or source-map labels are imported into matching. Reused requests are not independent new model observations. Both chunks use the joint six-library reference pool; source identity exclusivity resets at each chunk, as in the preliminary three-build runner.

From /Users/aaronxyliu/GitHub/FAPI Study:

```sh
# New result directory only:
node scripts/real-app/prepare-all.mjs

# Run or resume recovery, then report and verify:
node scripts/real-app/run-all.mjs > results/real-app/vue-admin-template-all-libraries/run.log 2>&1

# Refresh an intermediate report without model calls:
python3 scripts/real-app/report-all.py
```

Do not run prepare again over an existing prepared directory. Recovery replays interrupted candidate sequences using exact-request caches and guards completed profiles by input hash, settings, and model digests. Model execution requires access to the existing local Ollama service at 127.0.0.1:11434.

Results: ../../results/real-app/vue-admin-template-all-libraries/REPORT.md. Compare per-library recall on source-map-supported bundle targets; attribute wrong/unassessed predictions to the predicted library. Report source population and bundle population separately. The pooled rate is dominated by Element UI and is not a balanced six-library average. Differences from jQuery jointly involve library populations, modular layout, transformations, and competing code, so they do not isolate a causal effect of application complexity. Prior cache reuse also prevents a fresh end-to-end inference-time comparison.

Persistence optimization: the first continuation preserved a 333 MB checkpoint after observing excessive full-snapshot I/O. The six matching/model modules and prompt remain byte-identical to experiment 4. Only common.mjs persistence writes changed: running recovery snapshots at most once per 30 seconds using atomic rename; per-request judgment caches and fixed-point snapshots write immediately. All 3518 previously recorded pair decisions, 2962 queries, and 2616 promotions replayed identically, including ranks, scores, candidate lists, request keys, and model outputs. Original implementation/checkpoint, change hashes, and replay proof are preserved. New preparations apply this persistence policy before matching. Run `node --test scripts/real-app/persistence-policy.test.mjs` to verify intermediate batching, immediate judgment persistence, final flush, and atomic replacement. Process-level timings after replay are not fresh end-to-end measurements.
