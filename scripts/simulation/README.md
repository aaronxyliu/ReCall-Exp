# Algorithm experiments: embedding plus simulated validation

Use this runner for subsequent algorithm-improvement experiments. It keeps the
qwen3-embedding:0.6b model, cosine ranking, top-three first-accept policy, radius 1,
POG anchors and the AST pre-ranking check. Only the LLM validator is replaced by
exact ground-truth decisions. The ReCall recovery core never imports the oracle.
The network guard rejects chat/generation requests; model metadata and embeddings
are the only permitted endpoints. Unknown ground-truth pairs cannot be promoted
by the simulated validator, while ordinary POG/AST acceptance remains unchanged.

Prepare a fresh directory with, for each subject:

- `<subject>/references/packages/`: source package directories whose bytes and function spans match the corpus used
  for ground-truth collection, each containing package.json with name/version.
  Do not substitute compiled npm distributions for original TypeScript. An already
  prepared input/source.json and input/bundle.json may be supplied instead.
- `<subject>/ground-truth/relations.json`: freshly collected isolated ground truth.

Run from ReCall Exp:

```sh
node --max-old-space-size=12288 scripts/simulation/run.mjs PREPARED_RUN_ROOT \
  primefaces--primeng swimlane--ngx-datatable
node --test scripts/simulation/validator.test.mjs
```

The runner compares unrestricted source processing against per-library isolation
using identical source and bundle inputs. It writes progress, complete ranked
candidate/check traces, source/target availability, precision, recovery and request
counts. It refuses to overwrite a completed experiment. The legacy model runner
is retained for historical reproduction; it is not the default for these algorithm
experiments. Do not compare oracle-validation results with historical LLM results
as if only the algorithm changed.

The 2026-11-10 reference run and its source-resolution-only ablation are in
`results/rq1-library-isolation-simulation-2026-11-10/REPORT.md`. Its scripts record
independent source acquisition and separate ground-truth recollection. Historical
results and released pair files remain untouched.


Mandatory alignment preflight aborts when any oracle source or target counterpart
is absent from the supplied inventories. It never narrows the denominator or filters
candidate inventories to oracle functions. The aligned 2026-11-10 rerun is documented
in `results/rq1-aligned-source-simulation-2026-11-10/REPORT.md`; it supersedes the
mismatched-source results as the comparison for these two subjects. Its stronger
preflight also verifies exact original source-file IDs and function spans via an
offline collection ledger. Recovery receives source code and ordinary source layout;
source-map correspondences remain outside the algorithm.
