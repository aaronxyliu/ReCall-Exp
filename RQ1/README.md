# RQ1: Real validation on simulation-aligned inputs

The **final RQ1 results** are from the completed AutoDL recheck across all **35 repositories**. ReCall recovered **49,867 of 58,128 pairs (85.79%)** with **98.69% assessed precision**. The original AutoDL run recovered 49,264 pairs (84.75%), and simulation recovered 50,259 (86.46%).

The AutoDL recheck used ground truth to select previously rejected correct pairs for a second validation. Recovery then ran from the original anchors, reusing other historical judgments and applying the revised prompt to newly reached pairs. The final traces used 27,051 distinct Qwen judgments. See the [recheck protocol](final-results/protocol.json) for provenance.

[Final results](final-results/PROGRESS.md) · [Validation timing](final-results/VALIDATION-TIMING.md) · [Validation errors](Validation%20Falses/) · [Historical local run](latest-run/PROGRESS.md)

## Quick start

Run the commands below from the **ReCall Exp** repository root. You need Python 3, a Node.js version supported by your ReCall checkout, and Ollama. The archived run used Node.js 24.15.0.

### 1. Set up the sibling repositories

Clone each repository only if you do not already have it at the indicated path.

```sh
git clone https://github.com/aaronxyliu/ReCall.git ../ReCall
git clone https://github.com/aaronxyliu/Recall-Dataset.git '../ReCall Dataset'
```

Use the current ReCall checkout and install its dependencies.

```sh
npm --prefix ../ReCall ci
```

### 2. Check the inputs and models

Verify the input archives and ground-truth files for all 35 repositories.

```sh
python3 RQ1/reproduce.py --verify-only
```

The runner checks the ground-truth files for the selected subjects. If your dataset checkout has changed those files, use the dataset revision recorded in the [input manifest](manifest.json) for a comparable score.

Start Ollama if it is not already serving at `http://127.0.0.1:11434`. Install the two models if needed.

```sh
ollama pull qwen3-embedding:0.6b
ollama pull qwen3.5:27b
```

Check the installed digests with `curl -fsS http://127.0.0.1:11434/api/tags` and compare them with the saved `modelDigests`. The same model tag can point to different weights. [Filekey comparison](latest-run/bun/RockwellShah--filekey/comparison.json)

### 3. Run Filekey first

```sh
python3 RQ1/reproduce.py --subject bun/RockwellShah--filekey --out results/rq1-repro-filekey
cat results/rq1-repro-filekey/bun/RockwellShah--filekey/score.json
```

The archived Filekey run recovered **463/480** pairs. Each fresh run uses the defaults from your ReCall checkout and a fresh model response cache per repository. The saved implementation digest in `run/run.json` identifies the code used. Newer implementations or defaults can change recovery and timing. Each subject folder contains `worker.log`, ReCall artifacts under `run/`, and the independently computed `score.json`.

### 4. Run all 35 repositories

```sh
python3 RQ1/reproduce.py --out results/rq1-repro-all
```

The runner processes the repositories sequentially. Use a fresh output directory for each invocation. Repeat `--subject` to select several repositories, or use `--recall` and `--dataset` if the checkouts are elsewhere.

## Compare results

| What to compare | Where to look |
|---|---|
| Real recovery | Sum `correctTargets` and `denominator` in the completed subjects’ `score.json` files, then divide the totals. |
| Simulation recovery | Sum `simulationCorrect` for those same subjects and divide by the same denominator. [Input manifest](manifest.json) |
| Recovery time and fresh validation requests | Use the [final validation timing report](final-results/VALIDATION-TIMING.md) for Qwen compute time, which excludes Ollama queueing. For fresh reproduction runs, `stats.elapsedMs` records wall-clock recovery time. |
| Individual stages and retries | Read the CLI stage timings at 0.1-second resolution. The JSON also records recovery and model API time. [Stage timings](latest-run/STAGE-TIMINGS.md) |

Timing varies with hardware, serving load, and model caches. The archived run includes resumed attempts, which have separate stage timing records.

## What is saved here

- [Input archives](inputs/) contain the exact collection-aligned source and bundle bytes. The runner resolves archived paths locally and uses ground truth only for scoring after recovery.
- [Final results](final-results/) contain the pooled report, per-repository scores and recovered mappings, and Qwen compute timing.
- [Historical local run](latest-run/) contains completed recovery traces, recovered-function mappings, comparisons, resolved configurations, and worker logs. It also contains the interrupted shadcn/ui checkpoint.
- The checkpoint and saved configurations reference the original machine’s paths. Use the original local run directory and caches for a compatible resume. The commands above reproduce the experiment from fresh inputs. Model weights, response caches, and generated working directories are kept locally.
