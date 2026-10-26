"""Package unchanged-analyzer holdout results, including adverse audit evidence."""
import pathlib,json,hashlib,csv,collections,shutil
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE=ROOT/'results/real-app/bundle-graph-v2-holdout'
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
write=lambda p,x:p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
selection=read(BASE/'selection.json');freeze=read(BASE/'analyzer-freeze.json')
for p,h in freeze['files'].items():assert sha(ROOT/p)==h,('Frozen analyzer changed',p)
for p,h in read(BASE/'protocol-dependencies.json').items():assert sha(ROOT/p)==h
subjects=[];rows=[];riskCounts=collections.Counter();totals=collections.Counter();manual=read(BASE/'manual-audit.json')['records']
for subject in selection['subjects']:
 d=BASE/'subjects'/subject['slug'];s=read(d/'summary.json');art=read(d/'artifacts.json');traces=read(d/'target-traces.json');population=read(d/'population.json')
 assert s['modelCalls']==0 and population==s['population']
 assert population['detectorSha256']==sha(d/'detector-input.json')
 assert population['oracleSha256']==sha(d/'ground-truth.json')
 for f in art['files']:
  assert sha(pathlib.Path(f['js']))==f['jsSha256'];assert sha(pathlib.Path(f['map']))==f['mapSha256']
 for f in art['contextJavaScript']:assert sha(pathlib.Path(f['path']))==f['sha256']
 for side in ['source','bundle']:
  r=read(d/(side+'-relations.json'));assert r['converged'] and not r['errors'];assert r['provenance']['analyzerSha256']==freeze['files']['scripts/real-app/bundle-graph-v2/analyzer.mjs']
 assert sum(l['targets'] for l in s['libraries'])==population['targets']
 totals['targets']+=population['targets']
 for v in s['variants']:
  assert sum(l['variants'][v['variant']]['recovered'] for l in s['libraries'])==v['recovered'];totals[v['variant']]+=v['recovered']
 risk=read(d/'risk-screen.json');riskCounts.update(risk['counts']);sensitivity=read(d/'audit-sensitivity.json')['rows'];auditFiltered=next(x for x in sensitivity if x['filter']=='drop-all-screen-flags' and not x['cross']);totals['audit-filtered-per-chunk']+=auditFiltered['recovered']
 for l in s['libraries']:
  r={'repo':s['repo'],'bundler':s['bundler'],'library':l['library'],'targets':l['targets'],'seeds':l['variants']['baseline']['seeds'],'source_parse_failures':l['sourceParseFailures']}
  for v in s['variants']:
   k=v['variant'];r[k]=l['variants'][k]['recovered'];r[k+'_rate']=l['variants'][k]['rate']
  r['gain']=r['improved-per-chunk']-r['baseline'];r['audit_filtered_per_chunk']=next(x['recovered'] for x in auditFiltered['libraries'] if x['library']==l['library']);rows.append(r)
 subjects.append({'repo':s['repo'],'bundler':s['bundler'],'commit':s['commit'],'targets':population['targets'],'seeds':population['seeds'],**{v['variant']:v['recovered'] for v in s['variants']},'audit_filtered_per_chunk':auditFiltered['recovered'],'parse_failures':sum(l['sourceParseFailures'] for l in s['libraries']),'added_directed_edges':s['addedEdges'],'risk_flags':risk['counts']})
for name,data in [('per-library.csv',rows),('per-repo.csv',[{k:v for k,v in s.items() if not isinstance(v,dict)} for s in subjects])]:
 with open(BASE/name,'w') as f:
  w=csv.DictWriter(f,fieldnames=list(data[0]));w.writeheader();w.writerows(data)
auditCount=dict(collections.Counter(r['verdict'] for r in manual))
aggregate={'policy':'Previously untested repository holdout. Original lexical graph baseline vs unchanged BundleGraph v2 on identical newly frozen targets/seeds. Oracle connectivity only, no models. Separate cross-chunk result.','repositories':len(subjects),'libraryCases':len(rows),'positiveSupportedCases':sum(r['targets']>0 for r in rows),'improvedLibraryCases':sum(r['gain']>0 for r in rows),'totals':dict(totals),'subjects':subjects,'manualAudit':auditCount,'riskScreenCounts':dict(riskCounts),'analyzerUnchanged':True}
write(BASE/'aggregate.json',aggregate)
rate=lambda n,d:f'{n/d:.2%}' if d else 'N/A'
cell=lambda n,d:f'{n:,}/{d:,} ({rate(n,d)})' if d else 'N/A (0 supported)'
lines=['# BundleGraph v2: unchanged-analyzer repository holdout','',
'Date: 2026-10-23. Five previously untested repositories, one per non-webpack bundler; analyzer frozen before preparation/evaluation. Models invoked: **0**. No result-driven analyzer fixes or repository replacement.','',
f"Across {len(rows)} repository/library cases ({aggregate['positiveSupportedCases']} with supported targets), per-chunk connectivity increases from **{cell(totals['baseline'],totals['targets'])}** to **{cell(totals['improved-per-chunk'],totals['targets'])}**; cross-chunk connectivity is **{cell(totals['improved-cross-chunk'],totals['targets'])}**. {aggregate['improvedLibraryCases']} library cases improve. These are source-map-supported pairs, not unique source-function counts, whole-library recall, model accuracy, or edge precision.",'',
'## Selection and build evidence','',
'Selected before recovery outcomes: native existing pinned esbuild/Rolldown applications, plus fresh native Rspack/Parcel applications because the old corpus had no unused subjects for those mechanisms. 9router is an explicit rebundling experiment: its pinned production script used webpack; the isolated build uses the already-configured Turbopack backend. This selection is convenience/availability based, not a representative random ecosystem sample. Shared third-party libraries may have appeared in the earlier development subjects.','',
'| Bundler | New repository | Commit | Build evidence |','|---|---|---|---|',
f"| esbuild | ionic-team/ionic-conference-app | `{subjects[0]['commit']}` | Saved Angular application-builder browser output; no new build or separately attested esbuild binary version. |",
f"| Rolldown | geeker-admin/Geeker-Admin | `{subjects[1]['commit']}` | Native Vite 8.0.16 production build, `--sourcemap`; existing pinned dependencies, original config. |",
f"| Turbopack | decolua/9router | `{subjects[2]['commit']}` | Next 16.3.5, isolated `next build --turbopack`; browser maps enabled in existing build image. |",
f"| Rspack | robustmq/robustmq-copilot | `{subjects[3]['commit']}` | Native Rsbuild 1.4.1 production build; config wrapper only enables JS source maps. |",
f"| Parcel | cobiwave/simplefolio | `{subjects[4]['commit']}` | Native Parcel 2.8.2 production build and locked dependencies. |",'',
'All source-map pairs and context JS are individually hashed. Scope is emitted browser/main-thread artifacts, including supplied lazy/shared/runtime chunks; separate service workers are excluded. Native absolute artifact manifests supply chunks whose filenames are computed at runtime. The preparer selects at most ten non-framework packages by deduplicated embedded JS-family source bytes before oracle outcome inspection, using the previous package exclusions. Existing policy treats Ionic packages as component libraries while excluding Angular runtime packages; this does not establish a universal framework/library taxonomy.','',
'Turbopack build adjustment: direct Google Fonts fetch failed both offline and with container networking. A first Proxy fixture failed because Turbopack requires enumerable URL keys. The successful offline fixture maps the exact Inter Google Fonts URL to an empty CSS comment via Next\'s built-in mock-response hook. It omits font assets; application JavaScript and analyzer code are unchanged. All failed and successful logs and both original/build Next configs are preserved. This is a build-adjusted subject, not untouched default production output.','',
'Simplefolio declares several packages but emits only vanilla-tilt among eligible bundled JS libraries; ScrollReveal is external and CSS-only/declaration-only dependencies are not counted as bundled targets. Its 14 supported pairs provide little evidence about Parcel-wide behavior.','',
'## Controlled comparison','',
'Same inventory, source-map oracle, seeds and propagation parameters in every variant. POG seed proposals require at least ten property operations and uniqueness; only oracle-confirmed proposals become initial anchors. Incorrect/unassessed proposals are saved and withheld. Nonunique source identities within a chunk remain in denominators but cannot promote. Radius one, undirected relationships, sibling window two, 18,000-character promotion cap. Cross-chunk propagation is separate; context-only runtime files add no targets/seeds. No initialization-function matching or module-membership clique.','',
'| Bundler / repository | Supported pairs | Original graph | Source graph improved only | V2 per chunk | V2 cross chunk |','|---|---:|---:|---:|---:|---:|']
for s in subjects:lines.append('| '+s['bundler']+' / '+s['repo']+' | '+f"{s['targets']:,}"+' | '+' | '.join(cell(s[v],s['targets']) for v in ['baseline','source-only','improved-per-chunk','improved-cross-chunk'])+' |')
lines+=['',f"The source-only stage adds {totals['source-only']-totals['baseline']:,} pairs; bundle-side augmentation adds another {totals['improved-per-chunk']-totals['source-only']:,}; cross-chunk propagation adds {totals['improved-cross-chunk']-totals['improved-per-chunk']:,}. These are staged effects, not independent per-feature causal ablations.",'',
'## Every selected library','',
'| Repository / library | Supported pairs | Seeds | Baseline | V2 per chunk | V2 cross chunk |','|---|---:|---:|---:|---:|---:|']
for r in rows:lines.append('| '+r['repo']+' / `'+r['library']+'` | '+str(r['targets'])+' | '+str(r['seeds'])+' | '+' | '.join(cell(r[v],r['targets']) for v in ['baseline','improved-per-chunk','improved-cross-chunk'])+' |')
lines+=['','## Independent added-edge audit','',
f"Saved {sum(sum(s['added_directed_edges'][k] for k in ['source','bundle']) for s in subjects):,} added directed, typed edges (different kinds/directions can describe the same undirected adjacency). A deterministic hash-order sample rotates edge kinds, up to six edges per graph side per repo, supplemented with available new-promotion parent witnesses. The resulting **55 inspected records contain 50 supported relations, four incorrect argument-reference types, and one spurious function-value reference**. This small nonuniform sample is not an unbiased edge-precision estimate.",'',
'Supported examples independently trace Rspack module-ID/export-getter bindings, Rolldown lazy exports and returned constructors, Turbopack namespace exports, native ESM import aliases, and Parcel default interop. Function arguments/component values are reference relationships; `callee-callback` does not assert callback execution. Conditional references establish a possible relationship, not an exclusive runtime target. Some sampled bundle edges involve non-target application/framework context, since those functions participate in neighborhoods.','',
'The four incorrect types occur when class getters such as `get el(){return this}` are stored as if their function tokens were the property values. Reading `this.el` invokes a getter; it does not pass the getter function as an argument. Caller-to-getter adjacency is still a genuine accessor dependency. Getter-token links from an unrelated receiving callee are a more serious possible false bridge. The spurious reference sample is a write-only identifier in `s3=r2=n3=void 0`: clearing a variable does not read its old callback value.','',
'The independent AST screen checks all saved added edges for these two patterns. It flags **602 getter-as-function-value edges and 98 write-only-reference sites**, across source and bundle graphs. Flags are candidates/typing diagnostics, not a complete precision oracle: some caller/accessor adjacencies remain valid, and other false edges may be missed. The current analyzer is deliberately left unchanged.','',
'| Repository | Getter-value flags | Write-only flags | Raw per-chunk recovered | All-screen-flags-suppressed diagnostic |','|---|---:|---:|---:|---:|']
for s in subjects:
 g=sum(v for k,v in s['risk_flags'].items() if 'class-getter' in k);w=sum(v for k,v in s['risk_flags'].items() if 'write-only' in k)
 lines.append(f"| {s['repo']} | {g} | {w} | {s['improved-per-chunk']:,} | {s['audit_filtered_per_chunk']:,} |")
lines+=['',
f"Post-hoc sensitivity uses the saved graphs with exactly the same seeds/protocol. Removing only write-only references plus getter-token callee/callback links yields {totals['audit-filtered-per-chunk']:,} recovered pairs; removing all flags yields the same result. Main unchanged-analyzer result remains {totals['improved-per-chunk']:,}. Only one Ionic pair is lost, and that statement also genuinely reads `this.el`, so the loss does not by itself establish a false recovery. Correct getter-call modeling could preserve that legitimate dependency. See `sensitivity-case.json`. This diagnostic is not a repaired-analyzer benchmark or proof that the remaining edges are precise.",'',
'## Generalization findings and limits','',
'The unchanged implementation improves four of five new repos, including new import/export relationships under all four substantial artifact populations. The largest stage gain here is source-side resolution, rather than the single missing runtime-helper effect that dominated the earlier 97.49% result. This supports transfer beyond the original repositories, while the small convenience sample and previously seen library families limit external validity. The earlier 64.83%→97.49% population differs from this holdout; do not compare the absolute aggregate percentages as if targets were identical.','',
'Remaining failures are informative: Geeker `@element-plus/icons-vue` stays 1/293 with 292 targets lacking an accepted bundle neighbor; RobustMQ `@radix-ui/react-icons` stays 0/12 with no seeds; 9router `@reduxjs/toolkit` stays 0/114 with no seeds. These counts indicate propagation/seed reachability gaps, not proof that every module was unrecognized. Simplefolio vanilla-tilt remains 4/14: five identities are ambiguous under the unchanged oracle policy and five lack an accepted bundle neighbor. Ionic `@ionic/angular` remains 194/596, with missing relationships on both sides.','',
'9router has 85 unparseable source files in selected `@dnd-kit/core`, yielding zero supported targets for that case; retain N/A rather than report complete recovery. This is a denominator limitation: the experiment cannot assess that library. Source parsing, oracle support, module recognition, edge precision and oracle connectivity remain separate measurements.','',
'Before changing the analyzer, the next implementation priorities are explicit class-accessor semantics and excluding write-only identifiers from function-value references. Preserve this run as an unchanged-analyzer holdout; use a new version/result directory for any repair. Wider held-out repository/version coverage and a larger independent edge audit are still needed before claiming support for most ecosystem applications.','',
'## Reproduction and artifacts','',
'- `selection.json`, `analyzer-freeze.json`: selection, exclusions and pre-evaluation code hashes.','- `per-library.csv`, `per-repo.csv`, `aggregate.json`: exact counts and rates; N/A preserved.','- `subjects/*/artifacts.json`: JS/map pairs, context files, hashes and build scope.','- `subjects/*/inputs`, `inventory-shards`, `ground-truth.json`: exact embedded source inputs and oracle construction evidence.','- `subjects/*/population.json`, `seed-audit.json`, `target-traces.json`: invariant hashes, seed proposals and paired promotion witnesses.','- `subjects/*/{source,bundle}-relations.json`, `added-edges.json`: unchanged code-only analyzer outputs and graph deltas.','- `manual-audit.json`, `subjects/*/audit-sample.json`: exact sampled edges, code spans and inspection judgments.','- `subjects/*/risk-screen.json`, `audit-sensitivity.json`: exhaustive pattern flags and diagnostic reachability differences.','- `build-evidence`, `build-logs`, `code`, `SHA256SUMS.json`: pinned build evidence, failed attempts, exact code and integrity manifest.','',
'Run from the original workspace with its locked dependencies. Preparation/extraction/evaluation refuse overwriting completed results; preserve this directory before a deliberately versioned rerun.','',
'```sh','node --expose-gc --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/prepare.mjs SLUG','node --expose-gc --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/extract.mjs SLUG source','node --expose-gc --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/extract.mjs SLUG bundle','node --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/evaluate.mjs SLUG','python3 scripts/real-app/bundle-graph-holdout/sample-audit.py','node --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/risk-screen.mjs','node --max-old-space-size=8192 scripts/real-app/bundle-graph-holdout/sensitivity.mjs','python3 scripts/real-app/bundle-graph-holdout/report.py','```','']
(BASE/'REPORT.md').write_text('\n'.join(lines))
# Snapshot exact analyzer and driver sources, retaining workspace-relative paths.
paths=set(freeze['files'])|set(read(BASE/'protocol-dependencies.json'))
paths.update(str(p.relative_to(ROOT)) for p in (ROOT/'scripts/real-app/bundle-graph-holdout').glob('*') if p.is_file())
paths.update(['package.json','package-lock.json','scripts/real-app/bundling-dataset/io.mjs','scripts/real-app/bundling-dataset/inventory/inventory.mjs','scripts/real-app/bundling-dataset/inventory/measure.mjs','scripts/real-app/bundling-dataset/inventory/analysis.mjs','scripts/jquery/oracle-point.mjs'])
for name in sorted(paths):
 p=ROOT/name;q=BASE/'code'/name;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
write(BASE/'verification.json',{'analyzerFrozenHashesMatch':True,'protocolDependencyHashesMatch':True,'repos':len(subjects),'libraryCases':len(rows),'targets':totals['targets'],'modelCalls':0,'artifactPairAndContextHashesMatch':True,'countsAndPopulationHashesMatch':True,'mainResultChangedByAudit':False,'manualAuditRecords':len(manual),'bounds':'No whole-graph precision or ecosystem-wide coverage claim. Existing source-map support and parser exclusions retained.'})
manifest={str(p.relative_to(BASE)):sha(p) for p in sorted(BASE.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
write(BASE/'SHA256SUMS.json',manifest)
print(json.dumps({'totals':dict(totals),'libraryCases':len(rows),'audit':auditCount,'files':len(manifest)}))
