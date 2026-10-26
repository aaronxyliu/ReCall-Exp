"""Count saved lexical-binding metadata; no inference or experiment replay."""
import json
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parents[2]
p=root/'results/jquery-4.0.0/minified-no-tree-shaking'
d=json.loads((p/'detector-input.json').read_text())
active=set(json.loads((p/'study-config.json').read_text())['buildIds'])
sources={f['id']:f for s in d['sources'] for f in s['functions']}
bundles={f['id']:f for b in d['bundles'] if b['build'] in active for f in b['functions']}
rows=[r for r in json.loads((p/'model-pair-evaluation.json').read_text()) if r['build'] in active]
def stats(functions):
 fs=list(functions);total=len(fs);count=sum(bool(f['captures']) for f in fs)
 return {'total':total,'with_outer_bindings':count,'percent':round(100*count/total,2),'with_at_least_two':sum(len(f['captures'])>=2 for f in fs)}
result={'created':datetime.now(timezone.utc).isoformat(),'policy':'Saved statically resolved captures in own function body; nested function bodies excluded. Globals and unresolved bindings excluded. Presence of an outer binding does not establish an undecidable pair or a validation error. Build/function pairs count separately across builds; repeated attempts deduplicated for function counts. Historical full-run validation, not the stopped four-case functions-only replay.','source_functions':stats(sources.values()),'source_nonanchors':stats(f for f in sources.values() if f['propertyOperations']<10),'validated_source_functions':stats({r['sourceId']:sources[r['sourceId']] for r in rows}.values()),'validated_bundle_functions':stats({r['bundleId']:bundles[r['bundleId']] for r in rows}.values()),'by_build':{b:stats({r['bundleId']:bundles[r['bundleId']] for r in rows if r['build']==b}.values()) for b in sorted(active)}}
unique=list({r['requestKey']:r for r in rows}.values());valid=[r for r in unique if isinstance(r.get('decision'),bool)]
result['unique_boolean_pair_requests']={'total':len(valid),'either_function_has_outer_binding':sum(bool(bundles[r['bundleId']]['captures'] or sources[r['sourceId']]['captures']) for r in valid),'both_functions_have_outer_bindings':sum(bool(bundles[r['bundleId']]['captures'] and sources[r['sourceId']]['captures']) for r in valid)}
result['case_bindings']=[{'id':c['id'],'bundle':[x['name'] for x in c['bundled']['captures']],'reference':[x['name'] for x in c['predicted']['captures']]} for c in json.loads((p/'wrong-identity-audit/cases.json').read_text())['cases']]
out=p/'outer-binding-analysis';out.mkdir(exist_ok=True)
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
md='# Functions using outer bindings\n\n'+result['policy']+'\n\n| Population | With outer bindings | Percentage |\n|---|---:|---:|\n'
for label,key in [('All source functions','source_functions'),('Non-anchor source functions','source_nonanchors'),('Distinct source functions used in validation','validated_source_functions'),('Distinct bundled functions used in validation','validated_bundle_functions')]:
 s=result[key];md+=f'| {label} | {s["with_outer_bindings"]}/{s["total"]} | {s["percent"]}% |\n'
for b,s in result['by_build'].items():md+=f'| Validated bundled functions: {b} | {s["with_outer_bindings"]}/{s["total"]} | {s["percent"]}% |\n'
v=result['unique_boolean_pair_requests'];md+=f'\nAmong {v["total"]} distinct pair requests with a boolean verdict, {v["either_function_has_outer_binding"]} have an outer binding on at least one side and {v["both_functions_have_outer_bindings"]} on both sides. One additional recorded request lacks a boolean verdict and is excluded from this pair denominator.\n\nW01, W02, W03, and W08 specifically confuse distinct public/private data stores. Other outer bindings may refer to helper functions, enclosing parameters, or constants. Their presence alone does not demonstrate missing information is essential for the comparison.\n\nNo model calls were performed. Regenerate with `python3 scripts/jquery/analyze-outer-bindings.py`.\n'
(out/'REPORT.md').write_text(md)
print(md)
