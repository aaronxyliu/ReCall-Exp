#!/usr/bin/env bash
set -eu
export PATH=/root/autodl-tmp/recall-tools/node-v24.15.0-linux-x64/bin:$PATH
cd '/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp'
export RECALL_RUNTIME_ROOT='/Users/aaronxyliu/GitHub/ReCall Research/ReCall Graph Syntax Runtime'
export RECALL_EXPERIMENT_PHASE='Graph syntax fixes with first AST hit and immediate promotion'
export RECALL_FALLBACK_BASELINE_ROOT='/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp/results/rq1-autodl-top3-fixed-26'
export RECALL_PRIORITY_SUBJECTS='["esbuild/mattlewis92--angular-calendar","vite/immich-app--immich","esbuild/swimlane--ngx-charts"]'
root=results/rq1-autodl-graph-syntax-first-hit-26
baseline=results/rq1-autodl-ast-first-hit-top3-26
mkdir -p "$root"
python3 -u scripts/rq1-graph-syntax/run.py "$root" "$baseline" >> "$root/dispatcher.log" 2>&1
