# Production application library recovery

Subject: primary-60 / PanJiaChen/vue-admin-template, commit 4c18a3f47bdb417ad8a25f09910f848cb574dee2.

Targets: axios 0.18.1 (HTTP client), NProgress 0.2.0 (progress indicator), js-cookie 2.2.0 (cookie utility). Direct import evidence is in src/utils/request.js, src/permission.js, and src/utils/auth.js / src/store/modules/app.js. These are libraries, separate from Vue, Vue Router, Vuex, and Element UI. Selection was based on direct imports, distinct roles, and availability of a single original mixed production chunk with complete source content, before observing recovery scores.

The existing corpus map-enabled production chunk and map are copied after validating their manifest hashes. No synthetic library-only build is used. The exact build-input source text is materialized as reference files. Ground truth uses the preliminary experiment's own-body interior mapping rule (two or more points, 80% purity, strict unique winner). Positive non-target mappings count as wrong when assigned a target identity; unresolved predictions are unassessed. No map identities enter detector-input.json.

Frozen settings: jQuery experiment 4 (94.4137507673% = 1538/1629), 27B validator, 0.6B ranking, think false, T/F, temperature 0, seed 42, context 16384, output budget 384, top five, first positive, one-to-one promotion. Prompt and core code hashes are checked against that saved implementation.

The joint library pool includes 146 functions (97 axios, 39 NProgress, 10 js-cookie). Every one of the vendor chunk's 2425 functions is retained for matching. Six functions exceed the unchanged 18000-character embedding limit and remain inventoried. Source-reference and oracle populations are separate: some original functions have no supported bundled counterpart. Reference sibling-group parent identifiers are namespaced by source file to preserve file-local lexical relationships in the joint pool. No cross-module resolver is added; frozen recovery code is unchanged.

Run from /Users/aaronxyliu/GitHub/FAPI Study:

```sh
node scripts/real-app/prepare.mjs
EXPERIMENT_OUTPUT=results/real-app/vue-admin-template-three-libraries VALIDATOR_MODEL=qwen3.5:27b PROMOTION_POLICY=first-positive node results/real-app/vue-admin-template-three-libraries/implementation/scripts/jquery/recover.mjs
python3 scripts/real-app/report.py
```

Prepare is for a new run only; it recreates static inputs. To continue an interrupted recovery, run `node scripts/real-app/run.mjs`; it runs recovery and then reporting/verification. Recovery replays its candidate sequence using exact-request caches. Do not change implementation, prompt, model digests, or inputs in an existing result directory.

Results: ../../results/real-app/vue-admin-template-three-libraries/REPORT.md. Per-library recall uses supported target bundle occurrences; precision uses assessed promotions attributed to the predicted library. Retain errors and unassessed outputs separately. Report the application case independently from the synthetic jQuery builds.

Comparability: this case changes library populations, modular source layout, build transformations, and the amount of non-target code. Compare its recovery rates descriptively with jQuery; this is not an isolated causal test of application complexity. The first embedding pass was interrupted before validation to namespace source parent identifiers. Its same-experiment embedding cache is reused; no jQuery embeddings or judgments are imported. Frozen caches do not retain original embedding API durations, so timing is not a complete end-to-end measurement.
