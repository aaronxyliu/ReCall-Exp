"""Generate manuscript tables from saved checkpoints; never invokes a model."""
from pathlib import Path
import datetime
import hashlib
import json

root = Path(__file__).resolve().parents[2]
base = root / 'results/jquery-4.0.0'
active = base / 'v5-binary-validator'
dest = root / 'manuscript/data'
dest.mkdir(parents=True, exist_ok=True)
read = lambda p: json.loads(p.read_text())
gt = {g['bundleId']: g for g in read(active / 'ground-truth.json')['records']}

def count(predictions):
    counts = dict(correct=0, wrong=0, unassessed=0)
    for p in predictions:
        g = gt.get(p['bundleId'], {})
        k = ('wrong' if g.get('nonTarget') else 'unassessed' if not g.get('sourceId')
             else 'correct' if g['sourceId'] == p['sourceId'] else 'wrong')
        counts[k] += 1
    return counts

rows = []
for build in read(active / 'build-manifest.json')['builds']:
    name = build['id']
    p = active / 'recovery' / (name + '.json')
    row = dict(build=name, minified=build['minified'], treeShaking=build['treeShaking'],
               supported=sum(g['build'] == name and bool(g.get('sourceId')) for g in gt.values()),
               status='not-started')
    if p.exists():
        r = read(p)
        row.update(status=r['status'], checkpoint=r['created'], anchors=count([x for x in r['promotions'] if x['kind'] == 'pog-anchor']),
                   final=count(r['promotions']), pairs=len(r['pairs']), acceptedPairs=count([x for x in r['pairs'] if x['verdict'] == 'accept']),
                   freshCalls=r['modelCalls'], cacheHits=r['cacheHits'], elapsedSeconds=r['elapsedMs']/1000,
                   productiveRounds=len({x['round'] for x in r['promotions'] if x['round'] > 0}),
                   inputHash=r['inputHash'], configuration=r['configuration'])
    rows.append(row)

matrix = [r'\begin{table}[t]', r'\caption{Build inventory and recovery status at the saved stopping point. All twelve builds passed fixture checks. Supported targets have a source-map-backed jQuery identity.}',
          r'\label{tab:matrix}', r'\centering\small', r'\begin{tabular}{lllrrl}',r'\toprule',
          r'Bundler & Minify & Shake & All functions & Supported & Recovery\\',r'\midrule']
inventory = {r['build']: r for r in read(active / 'inventory-summary.json')['builds']}
for r in rows:
    status = {'fixed-point': 'Complete', 'stopped-by-user': 'Interrupted', 'not-started': 'Not started'}[r['status']]
    matrix.append(f"{r['build'].split('-')[0]} & {'On' if r['minified'] else 'Off'} & {'On' if r['treeShaking'] else 'Off'} & {inventory[r['build']]['allFunctions']} & {r['supported']} & {status}\\\\")
matrix += [r'\bottomrule',r'\end{tabular}',r'\end{table}']
(dest / 'matrix.tex').write_text('\n'.join(matrix)+'\n')

table = [r'\begin{table}[t]',r'\caption{Completed v5 recovery runs. Precision excludes unassessed outputs. The second run reuses cached judgments and is not an independent inference trial.}',
         r'\label{tab:completed}',r'\centering\small',r'\begin{tabular}{lrr}',r'\toprule',r'Measure & esbuild keep & esbuild shake\\',r'\midrule']
completed = [r for r in rows if r['status'] == 'fixed-point']
assert [r['build'] for r in completed] == ['esbuild-readable-keep','esbuild-readable-shake'], 'Update manuscript narrative when completed configurations change.'
fmt = lambda r: f"{100*r['final']['correct']/r['supported']:.2f}\\%"
precision = lambda r: f"{100*r['final']['correct']/(r['final']['correct']+r['final']['wrong']):.2f}\\%"
metrics = [('Correct initial POG matches', lambda r: r['anchors']['correct']),
           ('Correct final matches', lambda r: r['final']['correct']),
           ('Wrong final identities', lambda r: r['final']['wrong']),
           ('Unassessed final matches', lambda r: r['final']['unassessed']),
           ('Supported targets', lambda r: r['supported']),('Recovery', fmt),('Assessed identity precision', precision),
           ('Productive expansion rounds',lambda r:r['productiveRounds']),('Pair checks',lambda r:r['pairs']),
           ('Fresh validator calls',lambda r:r['freshCalls']),('Cache hits',lambda r:r['cacheHits']),
           ('Recovery wall time (s)',lambda r:f"{r['elapsedSeconds']:.1f}")]
for label, get in metrics:
    table.append(label+' & '+' & '.join(str(get(r)) for r in completed)+r'\\')
table += [r'\bottomrule',r'\end{tabular}',r'\end{table}']
(dest / 'completed.tex').write_text('\n'.join(table)+'\n')

files = [active/'ground-truth.json',active/'detector-input.json',active/'build-manifest.json',active/'model-manifest.json',active/'execution-status.json']
files += sorted((active/'recovery').glob('*.json'))
files += [root/'scripts/jquery'/n for n in ['recover.mjs','models.mjs','validator-policy.mjs','analysis.mjs','measure.mjs','oracle.mjs','oracle-point.mjs']]
snapshot = dict(created=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                executionStatus=read(active/'execution-status.json'), sourcePopulation=read(base/'feature-definition-sensitivity.json')['source'],
                builds=rows, files=[dict(path=str(p.relative_to(root)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files],
                note='Read-only aggregation of saved experiments. No recovery or model calls run by this script.')
(dest / 'evidence.json').write_text(json.dumps(snapshot,indent=2)+'\n')
print('Generated matrix.tex, completed.tex, evidence.json from saved checkpoints only.')
