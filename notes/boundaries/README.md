# Source-map boundary relation screen

Date: 2026-10-24. Status: completed candidate-relation screen on one existing development application, not a census of compiler transformations.

## Reusable first pass

From `ReCall Exp`:

```sh
python3 scripts/real-app/boundary-relations.py \
  results/real-app/vue-admin-template-all-libraries \
  --out notes/boundaries/vue-admin-template-candidate-relations.json
```

The script refuses to overwrite an existing report. Use a new output path for a new run. It reads the saved function inventories and all source-function vote lists from `ground-truth.json`, including minority votes rather than just the selected 80%-purity winner. It supports sharded detector inventories. It performs no builds, recovery, network requests, or model calls.

Use one independently compiled application/build per invocation and aggregate its chunks. Do not mix independent builds: repeated outputs of the same source definition would inflate the multiple-target count.

For each retained source-map relation s → b, a configurable minimum number of mapping points supports the edge. The report provides sensitivity counts at 2, 5, and 10 points and candidate lists at each threshold:

- A source with multiple target neighbors is a **split or duplication candidate**, not a confirmed split.
- A target with multiple source neighbors is a **combine/inlining candidate**, not confirmed combination.
- A source with no retained neighbor is **unresolved/insufficiently mapped**, not confirmed removal.

Relations are positional witnesses. Function nesting, mapped headers, sparse mappings, neighboring mapping positions, code duplication, and compiler-generated code can affect these patterns. The current saved real-app oracle excludes generated positions outside function bodies, so inlining into top-level initialization code can be missed entirely. The reference inventory contains selected source texts embedded in maps; it is not every definition from the original package checkout.

## Observed development application

Input: `results/real-app/vue-admin-template-all-libraries`. The existing subject is PanJiaChen/vue-admin-template; all six selected libraries and both supplied target-containing chunks are included. Input and script hashes are retained in [the report](vue-admin-template-candidate-relations.json).

| Minimum mapping points per relation | Reference definitions | All bundled definitions | Retained relations | Source definitions with multiple targets | Targets with multiple sources | Source definitions with no retained link |
|---|---:|---:|---:|---:|---:|---:|
| 2 | 4,732 | 6,622 | 4,678 | 0 | 0 | 54 |
| 5 | 4,732 | 6,622 | 3,641 | 0 | 0 | 1,091 |
| 10 | 4,732 | 6,622 | 2,309 | 0 | 0 | 2,423 |

At threshold 2, 4,678/4,732 reference definitions have exactly one retained target relation. This describes observed mapping relations, not confirmed preservation of every function boundary. The zero candidate counts do not establish that no split or combination occurred; 54 insufficiently mapped definitions do not establish 54 removals. The threshold sensitivity illustrates how increasing a mapping-count requirement can create apparent absence without any change to compiled code.

The 6,622 bundled definitions include non-selected application/runtime code. They are not all library recovery targets. These source and target counts therefore have different populations and should not be subtracted to infer transformation counts.

## What is needed for defensible transformation counts

1. Revisit the exact original JS/maps, retain generated top-level regions in addition to innermost own-function-body regions, and preserve all contributor mappings. Keep function-body versus header witnesses distinct.
2. Validate multi-target candidates for duplicated copies, wrapper scaffolding, genuine partitioning, and nested-source artifacts. Validate multi-source targets for actual combined code contributions. Do not use candidate cardinality as the label.
3. For missing definitions, compare complete supplied artifacts and exact build-input source inventories; use pre-optimization output, compiler diagnostics, or reviewed paired builds where available. Missing mappings alone cannot distinguish eliminated code from unmapped surviving computation.
4. Retain confirmed split, confirmed combine (including inlining), confirmed removed, duplicated, and unresolved evidence. Transformations can coexist; do not force overlapping events into an additive three-way percentage without a declared classification policy.
5. Report per-build/library source counts, parse failures, map coverage, unresolved counts, and denominator policies before pooling. Broader corpus counts remain pending.

Validation: a known-relation synthetic fixture checks one multiple-target source, one mixed-source target, and one missing-link source; an incomplete oracle is rejected. The pilot report's recorded script hash was checked against the executable source.
