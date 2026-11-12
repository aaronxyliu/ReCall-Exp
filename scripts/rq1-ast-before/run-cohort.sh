#!/usr/bin/env bash
set -eu
export PATH=/root/autodl-tmp/recall-tools/node-v24.15.0-linux-x64/bin:$PATH
cd '/Users/aaronxyliu/GitHub/ReCall Research/ReCall Exp'
export RECALL_RUNTIME_ROOT='/Users/aaronxyliu/GitHub/ReCall Research/ReCall AST Before Runtime'
root=results/rq1-autodl-ast-before-top3-26
baseline=results/rq1-autodl-top3-fixed-26
mkdir -p "$root"
python3 -u scripts/rq1-ast-before/run.py "$root" "$baseline" >> "$root/dispatcher.log" 2>&1
