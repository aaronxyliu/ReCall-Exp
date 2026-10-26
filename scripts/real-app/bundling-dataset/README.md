# Bundling dataset connectivity simulation

These scripts extend the existing real-app robustness harness to the 11 indexed
bundling-dataset targets. They never invoke models. Frozen previous scripts and
outputs remain in `../robustness`.

1. Audit completed repository summaries and skip previously tested repositories.
2. Populate each subject's `results/real-app/bundling-dataset/<slug>/artifacts.json`
   with pinned existing or isolated-build JS/map pairs. Pair explicit map URLs,
   including inline URLs, rather than assuming `<js>.map` exists.
3. Run `prepare.mjs <slug>` and `run.mjs <slug>` from the workspace root. Use
   `--max-old-space-size=16384` for the large renderer/worker targets. Existing
   `prepared.json` inputs and module-analysis caches are reused; version or clear
   them explicitly if intentionally changing inputs or algorithms.
4. Run `check-parser.mjs`, the tests in `repairs.test.mjs`, and `report.py`.

`module-graph.mjs` copies the previous original-pattern static solver. Changes
are limited to importing the exact previous recognizer, using a null-prototype
export dictionary, and a standards-compliant JS parser fallback. The inventory
copies preserve graph/POG rules; Acorn is used only if Meriyah fails. There is no
TypeScript/JSX erasure, bundler-specific recognition extension, module-initializer
matching, or oracle access during graph extraction. `io.mjs` shards large
inventories without changing their objects.

The report's denominator is supported generated function cases, not all source
functions. All selected libraries, including those with no supported targets,
remain listed. Each subject retains its exact source-map oracle, detector inputs,
per-target witness/round traces, raw seed audit, artifact hashes and logs.
