"""Offline, source-map-labelled audit of saved recovery checkpoints. No inference."""
import json
import os
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/os.environ.get('EXPERIMENT_OUTPUT','results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8')
def read(name):return json.loads((P/name).read_text())
data=read('detector-input.json'); gt={(r['build'],r['bundleId']):r for r in read('ground-truth.json')['records']}
refs=[f for s in data['sources'] for f in s['functions']]; refindex={f['id']:i for i,f in enumerate(refs)}; refmap={f['id']:f for f in refs}
active=read('study-config.json')['buildIds']
def graph(functions,edges,window):
 adj=[set() for f in functions]
 for e in edges:adj[e['from']].add(e['to']);adj[e['to']].add(e['from'])
 groups=defaultdict(list)
 for i,f in enumerate(functions):groups[f['parent'] if f['parent'] is not None else 'root'].append(i)
 for group in groups.values():
  for at,i in enumerate(group):
   for j in group[at+1:at+1+window]:adj[i].add(j);adj[j].add(i)
 return adj
source_edges=[];base=0
for s in data['sources']:
 source_edges.extend(dict(e,**{'from':e['from']+base,'to':e['to']+base}) for e in s['edges']);base+=len(s['functions'])
allrows=[];summaries=[]
for b in data['bundles']:
 build=b['build']
 if build not in active:continue
 run=read('recovery/'+build+'.json');cfg=run['configuration'];assert run['status']=='fixed-point';assert cfg['neighborhoodRadius']==1
 bg=graph(b['functions'],b['edges'],cfg['siblingWindow']);sg=graph(refs,source_edges,cfg['siblingWindow'])
 bf={f['id']:f for f in b['functions']};bi={f['id']:i for i,f in enumerate(b['functions'])}
 promos={p['bundleId']:p for p in run['promotions']};owners={p['sourceId']:p for p in run['promotions']}
 queries=defaultdict(list);pairs=defaultdict(list)
 for q in run['queries']:queries[q['bundleId']].append(q)
 for pair in run['pairs']:pairs[pair['queryId']].append(pair)
 counts=Counter();correct=0;total=0
 for f in b['functions']:
  oracle=gt[(build,f['id'])]
  if oracle['status']!='supported' or not oracle.get('sourceId'):continue
  target=oracle['sourceId'];total+=1;p=promos.get(f['id'])
  if p and p['sourceId']==target:correct+=1;continue
  qs=queries[f['id']];true_candidates=[q for q in qs if target in [c['sourceId'] for c in q['candidates']]];top=[q for q in qs if target in q.get('topCandidates',q['topThree'])]
  accepted=[q for q in top if target in q['acceptedCandidates']]
  parents=[b['functions'][j]['id'] for j in bg[bi[f['id']]] if b['functions'][j]['id'] in promos]
  owner=owners.get(target)
  final_candidate_ids=set()
  for par in parents:
   for j in sg[refindex[promos[par]['sourceId']]]:
    if refs[j]['id'] not in owners and len(refs[j]['code'])<=cfg['maxCodeCharacters']:final_candidate_ids.add(refs[j]['id'])
  if p:reason='wrong_source_promoted'
  elif not qs:
   if len(f['code'])>cfg['maxCodeCharacters']:reason='never_queried_input_length'
   elif not parents:reason='never_queried_no_matched_neighbor'
   elif not final_candidate_ids:reason='never_queried_no_available_source_candidate'
   else:reason='never_queried_other'
  elif accepted:
   statuses={q['status'] for q in accepted}
   if 'identity-conflict' in statuses:reason='correct_accepted_but_identity_conflict'
   elif 'ambiguous' in statuses:reason='correct_accepted_but_multiple_positives'
   else:reason='correct_accepted_other'
  elif top:
   correct_checks=[pair for q in top for pair in pairs[q['id']] if pair['sourceId']==target]
   if any(pair['verdict']=='reject' for pair in correct_checks):reason='correct_top3_but_never_accepted'
   elif correct_checks:reason='correct_top3_only_invalid_or_error'
   else:reason='correct_top3_not_validated_after_earlier_accept'
  elif true_candidates:reason='correct_candidate_never_top3'
  else:reason='correct_source_never_candidate'
  if cfg.get('topK',3)!=3:reason=reason.replace('top3','top'+str(cfg['topK']))
  counts[reason]+=1
  truth_checks=[pair for q in top for pair in pairs[q['id']] if pair['sourceId']==target]
  row={'build':build,'bundleId':f['id'],'bundleName':f['name'],'sourceId':target,'sourceName':refmap[target]['name'],'reason':reason,'queries':len(qs),'bestCorrectRank':min([next(i+1 for i,c in enumerate(q['candidates']) if c['sourceId']==target) for q in true_candidates],default=None),'rankingTopK':cfg.get('topK',3),'correctInTopKQueries':len(top),'correctInTop3Queries':sum(target in q['topThree'] for q in qs),'correctAcceptedQueries':len(accepted),'acceptedCorrectStatuses':dict(Counter(q['status'] for q in accepted)),'finalMatchedNeighbors':len(parents),'finalCorrectSourceOwner':owner,'queryIds':[q['id'] for q in qs],'bundleCode':f['code'],'correctSourceCode':refmap[target]['code'],'hasOuterBindings':bool(f['captures']),'correctSourceSize':len(refmap[target]['code'])}
  row['correctPairVerdicts']=dict(Counter(pair['verdict'] for pair in truth_checks))
  row['correctPairExitReasons']=dict(Counter(pair.get('doneReason','missing') for pair in truth_checks))
  if accepted:
   row['competingAcceptances']=[{'queryId':q['id'],'status':q['status'],'acceptedSources':[{'id':s,'name':refmap[s]['name'],'isCorrectIdentity':s==target,'code':refmap[s]['code']} for s in q['acceptedCandidates']]} for q in accepted]
  allrows.append(row)
 assert sum(counts.values())==total-correct
 summaries.append({'build':build,'total':total,'correct':correct,'notCorrect':total-correct,'recoveryPercent':100*correct/total,'categories':dict(counts)})
aggregate=Counter(r['reason'] for r in allrows)
result={'created':datetime.now(timezone.utc).isoformat(),'policy':'Completed recovery checkpoints from the selected output directory. Offline post-hoc classification, not a new inference run. Categories are mutually exclusive, based on all saved queries for each final unrecovered source-linked bundle definition. Wrong promotion takes priority; then never queried; correct accepted but blocked; correct top3 never accepted; rank miss; candidate-generation miss. These are observed pipeline outcomes, not measured gains from proposed repairs. Build occurrences are correlated.','builds':summaries,'aggregate':dict(aggregate),'functions':allrows}
out=P/'recovery-bottlenecks';out.mkdir(exist_ok=True);(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
md='# Recovery bottlenecks\n\n'+result['policy']+'\n\n| Category | esbuild | Rollup | webpack | Total |\n|---|---:|---:|---:|---:|\n'
for category,count in aggregate.most_common():md+='| '+category+' | '+' | '.join(str(s['categories'].get(category,0)) for s in summaries)+f' | {count} |\n'
md+='\n| Build | Correct / supported source-linked definitions | Not correctly recovered |\n|---|---:|---:|\n'
for s in summaries:md+=f'| {s["build"]} | {s["correct"]}/{s["total"]} | {s["notCorrect"]} |\n'
md+='\n## Examples\n\n'
for cat,_ in aggregate.most_common():
 md+='### '+cat+'\n\n'
 for r in [r for r in allrows if r['reason']==cat][:3]:
  md+=f'- `{r["build"]}` / `{r["sourceName"]}`: {r["queries"]} queries; best correct rank {r["bestCorrectRank"]}; correct accepted {r["correctAcceptedQueries"]} times; final matched neighbors {r["finalMatchedNeighbors"]}.\n'
md+='\nFull per-function code and query provenance are in [summary.json](summary.json). Regenerate with `python3 scripts/jquery/analyze-recovery-bottlenecks.py`. No model calls are made.\n'
interpretation=out/'INTERPRETATION.md'
if interpretation.exists():md+='\n'+interpretation.read_text().replace('# Interpretation and repair priorities','## Interpretation and repair priorities',1)
(out/'REPORT.md').write_text(md);print(md)
