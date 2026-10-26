"""Summarize saved short-prompt ground-truth pair results; no model calls."""
import json,math,statistics
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'results/jquery-4.0.0/minified-no-tree-shaking/recovery-bottlenecks/false-negatives'
P=BASE/'short-variable-mapping-replay'
status=json.loads((P/'status.json').read_text());assert status['status']=='complete'
r=json.loads((P/'results.json').read_text())['records'];assert len(r)==114
baseline=json.loads((BASE/'nonthinking-explanations/results.json').read_text())['records'];old={x['id']:x for x in baseline}
for x in r:
 assert x['request']['think'] is False
 assert x['request']['options']=={'temperature':0,'num_ctx':16384,'num_predict':384,'seed':42}
 assert set(json.loads(x['request']['messages'][1]['content']))=={'reference_source','bundled_function'}
 assert json.loads(x['request']['messages'][1]['content'])==json.loads(old[x['id']]['request']['messages'][1]['content'])
 assert not x['response']['message'].get('thinking')
 if x['verdict'] not in ['invalid','error']:
  assert set(x['variableMapping'])==set(v['key'] for v in x['requiredVariables'])
  assert x['decision'] is True or x['explanation'].strip()
  assert x['response']['done_reason']=='stop'
accepted=sum(x.get('decision') is True for x in r);rejected=sum(x.get('decision') is False for x in r)
transitions=Counter(('true' if x['baselineDecision'] else 'false')+' -> '+('true' if x['decision'] is True else 'false' if x['decision'] is False else x['verdict']) for x in r)
latencies=sorted(x['wallMs']/1000 for x in r);tokens=[x['response']['eval_count'] for x in r]
byBinding={}
for flag in [True,False]:
 xs=[x for x in r if x['externalLibraryBindings']==flag];byBinding[str(flag)]={'total':len(xs),'accepted':sum(x.get('decision') is True for x in xs),'rejected':sum(x.get('decision') is False for x in xs)}
summary={'created':datetime.now(timezone.utc).isoformat(),'total':114,'accepted':accepted,'rejected':rejected,'validationSuccessPercent':100*accepted/114,'baselineAccepted':59,'baselinePercent':100*59/114,'improvementPercentagePoints':100*(accepted-59)/114,'transitions':dict(transitions),'byBuild':status['byBuild'],'byExternalBindings':byBinding,'medianSeconds':statistics.median(latencies),'p95Seconds':latencies[math.ceil(len(latencies)*.95)-1],'sumRequestSeconds':sum(latencies),'totalOutputTokens':sum(tokens),'maximumOutputTokens':max(tokens),'totalMappedSourceKeys':sum(len(x.get('variableMapping') or {}) for x in r),'nullMappingEntries':sum(v is None for x in r for v in (x.get('variableMapping') or {}).values()),'invalid':status['invalid'],'errors':status['errors'],'thinkingCharacters':status['thinkingCharacters'],'policy':'Positive-pair acceptance on the fixed 114 historical FN occurrences, representing 70 source definitions across three builds. Not full-population accuracy, precision, mapping accuracy, or end-to-end recovery. No negative candidates or recovery rounds were run.'}
(P/'analysis-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
md='# Short mapping prompt: validation results\n\n'+summary['policy']+f'\n\n**{accepted}/114 accepted ({100*accepted/114:.2f}%)**, {rejected}/114 rejected. Invalid: {summary["invalid"]}; errors: {summary["errors"]}; thinking characters: {summary["thinkingCharacters"]}.\n\n'
md+='| Build | Accepted / pairs | Success | Previous accepted / pairs |\n|---|---:|---:|---:|\n'
for b,v in status['byBuild'].items():
 oldn=sum(x['decision'] is True for x in baseline if x['build']==b);md+=f'| {b} | {v["accepted"]}/{v["total"]} | {100*v["accepted"]/v["total"]:.2f}% | {oldn}/{v["total"]} |\n'
md+=f'\nThe previous explanation-only prompt accepted 59/114 (51.75%). The new prompt changes the instruction, required source-key list and output schema to expose a full mapping; model digest, function pairs, thinking off, temperature 0, seed 42, context and 384-token output limit are unchanged. Transitions: {dict(transitions)}. This is a selected diagnostic comparison, not a held-out evaluation or repeated-run stability estimate.\n\n'
md+=f'All {summary["totalMappedSourceKeys"]} required source-key entries were returned; {summary["nullMappingEntries"]} values are null. This validates mapping completeness, not correspondence correctness. Keys were extracted from source syntax only, including nested scope bindings and external references. No candidate names were supplied in the key list.\n\n'
md+=f'Per-request latency: median {summary["medianSeconds"]:.2f} s; p95 {summary["p95Seconds"]:.2f} s. Total generated tokens: {sum(tokens)}. No response reached the 384-token budget.\n\n'
md+='## Remaining rejections\n\n'
for x in r:
 if x.get('decision') is False:md+=f'### [{x["id"]}](cases/{x["id"]}.md): {x["sourceName"]}\n\n{x["explanation"]}\n\n'
md+='\nThe remaining explanations still contain code-reading errors (for example confusing a renamed collection with a loop counter, or negating an operator that is not negated in the code). They are saved as model claims, not validated proofs of inequivalence.\n\n[All cases and model outputs](REPORT.md), [full records](results.json), [machine-readable metrics](analysis-summary.json).\n'
(P/'ANALYSIS.md').write_text(md)
print(json.dumps(summary,indent=2))
