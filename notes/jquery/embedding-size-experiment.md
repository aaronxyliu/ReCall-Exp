# Revised source instruction: 0.6B versus 4B

Run directory: `results/jquery-4.0.0/embedding-source-instruction-size-v1`.

Use the exact frozen 150 cases and source candidate sets from `embedding-direction-v1/sample.json`. The sample includes 50 cases per build and 126 distinct oracle source functions. The correct source is present in each candidate set, which contains more than three candidates.

Source input:

```text
Instruct: Represent this JavaScript source function for matching against its bundled counterpart, allowing for minification and variable renaming.
Query:<source function code>
```

Bundled input: function code only. No ground-truth labels, neighbors, mappings, or validation output are sent to either embedding model.

Compare local deployments `qwen3-embedding:0.6b` and `qwen3-embedding:4b`. Save tag digests and full model manifests. These installations have different quantizations, Q8_0 and Q4_K_M respectively; this is a comparison of deployed configurations, not an isolated parameter-count experiment.

Rank identical source candidates by cosine similarity, breaking ties by original source index. Measure top-1 recall, top-3 recall, and MRR against source-map identities, pooled and per build. Record full rankings, including failures.

Timing: deduplicate exact input text within a pass, yielding 551 inputs; use an identical deterministic order and batches of at most 12 for every pass. Run two complete passes per model, in order 0.6B, 4B, 4B, 0.6B. Each pass makes fresh embedding requests, excluding its separate warm-up from embedding time. Save API wall times, reported load times, token counts, and ranking time separately. Report both individual passes and the mean total embedding time. Backend caches and machine load are not forcibly controlled. Record any changes in ranks across repeated passes.

No validation, anchor updates, graph expansion, or main recovery run. The source-side instruction is updated in the active embedding input builder; model size remains unchanged there until a separate decision to switch.

Runner: `node scripts/jquery/embedding-size-experiment.mjs`.
Verifier: `python3 scripts/jquery/verify-embedding-size.py` (offline, recomputes all rankings).
