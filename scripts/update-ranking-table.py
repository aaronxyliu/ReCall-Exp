from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'results/rq1-ranking-recall-audit/stage-recall.json').read_text())
assert d['repositories']==35
r=d['totals']['ranking'];recall=100*r['TP']/(r['TP']+r['FN'])
p=ROOT/'manuscript/sections/rq1.tex';s=p.read_text()
line=f"Embedding Ranking (Top 3) & {r['TP']:,} & --- & {r['FN']:,} & --- & --- & {recall:.2f}\\% \\\\\n"
key='Qwen & 9,144'
assert key in s and 'Embedding Ranking (Top 3) &' not in s
s=s.replace(key,line+key,1)
note=r'''For Embedding Ranking (Top 3), TP counts ranking invocations whose top-three candidates contain the ground-truth counterpart, and FN counts those that do not. The source-first implementation ranks bundled candidates for each source function; only invocations with a known ground-truth counterpart are assessed. Counts are taken before validation and early stopping, after the AST precheck. A counterpart absent from the candidate pool counts as a miss; repeated invocations count separately. Recall is therefore query-level Recall@3, while FP, TN, and precision are not reported for this retrieval stage. The values come from a replay with archived embeddings and judgments that reproduces all 35 final recovery traces.
'''
s+='\n'+note
p.write_text(s)
print(r, 'Recall@3',recall)
