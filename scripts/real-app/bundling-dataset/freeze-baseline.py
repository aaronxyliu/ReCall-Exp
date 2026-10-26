"""Freeze the completed v1 connectivity experiment; never overwrite a baseline."""
from pathlib import Path
import hashlib,json,shutil,datetime,subprocess,os
ROOT=Path.cwd();ID='bundling-connectivity-v1-2026-10-22';OUT=ROOT/'baselines'/ID
SRC=ROOT/'results/real-app/bundling-dataset'
read=lambda p:json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def digest(x):return hashlib.sha256(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
s=read(SRC/'summary.json')
assert s['newTargets']==11 and s['selectedRepoLibraryCases']==94 and s['modelCalls']==0
assert s['aggregate']['supportedTargets']==168826 and s['aggregate']['baselineRecovered']==110357
assert not OUT.exists(),f'Baseline already exists; refusing to overwrite: {OUT}'
# Verify the experiment evidence before taking a copy.
for p,h in read(SRC/'evidence-sha256.json')['fileSha256'].items():assert sha(ROOT/p)==h,p
OUT.mkdir(parents=True)
for rel in ['results/real-app/bundling-dataset','scripts/real-app/bundling-dataset','scripts/real-app/connectivity','scripts/real-app/robustness/legacy-patterns','vendor/debun']:
 shutil.copytree(ROOT/rel,OUT/rel,ignore=shutil.ignore_patterns('node_modules','.parcel-cache','__pycache__'))
for rel in ['package.json','package-lock.json','scripts/jquery/common.mjs','scripts/jquery/inventory.mjs','scripts/jquery/analysis.mjs','scripts/jquery/measure.mjs','scripts/jquery/oracle-point.mjs']:
 dest=OUT/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,dest)
for n in ['selection.json','subjects.csv','verification.json','README.md']:
 dest=OUT/'dataset-snapshot'/n;dest.parent.mkdir(exist_ok=True);shutil.copy2(ROOT/'datasets/bundling-dataset'/n,dest)
subjects=[]
for r in s['repos']:
 slug=r['repo'].replace('/','--');p=SRC/slug;tr=read(p/'target-traces.json');base=[t for t in tr if t['variant']=='original'];pairs=lambda xs:sorted((t['build'],t['bundleId'],t['sourceId']) for t in xs)
 subjects.append({'repo':r['repo'],'commit':r['commit'],'bundler':r['bundler'],'selectedLibraries':read(p/'selection.json')['selectedLibraries'],'supportedTargets':r['supportedTargets'],'baselineRecovered':r['baselineRecovered'],'intermoduleRecovered':r['intermoduleRecovered'],'targetPairSetSha256':digest(pairs(base)),'initialAnchorPairSetSha256':digest(pairs([t for t in base if t['recovered'] and t['round']==0])),'originalRecoveredPairSetSha256':digest(pairs([t for t in base if t['recovered']])),'intermoduleRecoveredPairSetSha256':digest(pairs([t for t in tr if t['variant']=='original-patterns-intermodule' and t['recovered']])),'detectorInputSha256':sha(p/'detector-input.json'),'oracleSha256':sha(p/'ground-truth.json')})
write(OUT/'BASELINE.json',{'schemaVersion':1,'id':ID,'status':'frozen','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':'Reference baseline for future module-graph recognition and inter-module-edge improvements across esbuild, Rspack, Rolldown, Turbopack and Parcel.','modelCalls':0,'newTargets':11,'selectedRepoLibraryCases':94,'casesWithSupportedTargets':87,'aggregate':s['aggregate'],'sourceResultsDirectory':str(SRC),'snapshotResultsDirectory':'results/real-app/bundling-dataset','subjects':subjects,'storagePolicy':'Independent file copies; no hard links. Installed node_modules and Parcel caches excluded. Exact emitted inputs, oracle, detector inventories/shards, traces, module analyses, source/code snapshots and dependency lock are retained. Reinstall dependencies in a working copy when needed.','comparisonPolicy':{'fixed':['pinned repo/build artifacts','selected libraries and source package instances','supported source/bundle target pairs and denominator','source-map oracle','confirmed original POG seeds','radius=1','sibling window=2','synchronous oracle promotion','18000-character expansion limit','per-chunk boundary','one-to-one identity policy','no module-initialization or membership expansion','zero models'],'allowedForPrimaryComparison':['code-only module recognition for additional bundler formats','static import/export and inter-module-call resolution','corresponding source-side and bundle-side graph edges'],'report':['per-library and per-repository recovered/supported counts and rate changes','newly recovered and regressed exact target pairs','recognized modules and resolved/ambiguous edges on both sides','analysis errors and runtime/resource costs','same-target and same-seed checks'],'separateExperimentRequiredFor':['source parser or oracle changes','library selection or artifact/build changes','POG seed, neighborhood, character limit or chunk-boundary changes','initialization membership expansion']}})
(OUT/'README.md').write_text('''# Frozen connectivity baseline v1

Baseline ID: **bundling-connectivity-v1-2026-10-22**.

11 new repository targets, 94 selected library cases (87 with supported targets),
168,826 supported generated-function cases; 110,357 recovered (**65.37%**).
Baseline and original-pattern inter-module variants are identical. Model calls: **0**.

The [full report](results/real-app/bundling-dataset/REPORT.md),
[repository rates](results/real-app/bundling-dataset/repos.csv), and
[per-library rates](results/real-app/bundling-dataset/per-library.csv) retain all
coverage limits. In particular, Turbopack source parsing is partial, Next.js is
excluded as a framework, and zero-support libraries have N/A rates. Repeated
library copies in different chunks are separate cases.

This is an independent, read-only snapshot of results, prepared inputs, oracle,
inventories, graph code, original recognizer patterns, traces, and dependency lock.
`BASELINE.json` pins exact target, seed and recovered pair sets per repository.
`SHA256SUMS.json` pins every snapshot file except itself and the verification receipt.
Installed dependencies and build caches are omitted. The original working results
remain available separately; this snapshot is the comparison reference.

Verify without changing the snapshot:

```sh
python3 verify.py
```

For future module-graph work, create a separate working/output directory. Reuse
these prepared inputs, labels, selected libraries, confirmed POG seeds, and
propagation settings. Recompute module analysis with the new implementation;
never reuse the baseline module-analysis cache as a new result. Compare exact
recovered pairs, gains and regressions, as well as rates and edge counts.
Changes to parsing, ground truth, target selection or propagation belong in a
separately identified experiment. Preserve unsupported and N/A cases. Do not run
experiment writers in this baseline directory or overwrite its outputs.
''')
(OUT/'verify.py').write_text('''from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
manifest=json.loads((root/'SHA256SUMS.json').read_text())['fileSha256']
excluded={'SHA256SUMS.json','baseline-verification.json'}
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and str(p.relative_to(root)) not in excluded}
assert actual==set(manifest), 'Snapshot file set changed'
for name,expected in manifest.items():
 h=hashlib.sha256()
 with (root/name).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 assert h.hexdigest()==expected, name
print(json.dumps({'status':'passed','files':len(manifest),'baseline':'bundling-connectivity-v1-2026-10-22'}))
''')
files={str(p.relative_to(OUT)):sha(p) for p in sorted(OUT.rglob('*')) if p.is_file()}
write(OUT/'SHA256SUMS.json',{'algorithm':'sha256','fileSha256':files})
receipt=json.loads(subprocess.check_output(['python3',str(OUT/'verify.py')],text=True));receipt['noExperimentsRerun']=True;write(OUT/'baseline-verification.json',receipt)
for p in OUT.rglob('*'):
 if p.is_file():p.chmod(0o444)
for p in sorted((p for p in OUT.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):p.chmod(0o555)
OUT.chmod(0o555)
print(subprocess.check_output(['python3',str(OUT/'verify.py')],text=True).strip());print(OUT)
