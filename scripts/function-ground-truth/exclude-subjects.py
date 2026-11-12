"""Remove subjects from active experiment indexes, retaining an exclusion audit."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('dataset', type=Path)
parser.add_argument('subjects', nargs='+')
args = parser.parse_args()
dataset = args.dataset.resolve()
requested = set(args.subjects)
manifest = dataset / 'experiment-exclusions.json'
audit = json.loads(manifest.read_text()) if manifest.exists() else {'schema': 'recall.experiment-exclusions/v1', 'exclusions': []}
existing = {r['subject'] for r in audit['exclusions']}
indexes = {}
found = set(existing)
for name in ['one-to-one-evaluation.json', 'one-to-one-evaluation-v2.json']:
    file = dataset / name
    raw = file.read_bytes()
    value = json.loads(raw)
    found.update(s['subject'] for s in value['subjects'])
    indexes[name] = (raw, value)
if requested - found:
    raise SystemExit('Unknown subjects: ' + ', '.join(sorted(requested - found)))
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
for subject in sorted(requested - existing):
    rows = {name: next((s for s in value['subjects'] if s['subject'] == subject), None) for name, (_, value) in indexes.items()}
    audit['exclusions'].append({'subject': subject, 'excludedAt': stamp, 'reason': 'Removed from the experiment cohort at the user\'s explicit request.', 'priorIndexRows': rows})
excluded = requested | existing
for name, (raw, value) in indexes.items():
    digest = hashlib.sha256(raw).hexdigest()
    backup = dataset / 'cohort-history' / (name.removesuffix('.json') + '-' + digest[:12] + '.json')
    backup.parent.mkdir(exist_ok=True)
    if any(s['subject'] in excluded for s in value['subjects']) and not backup.exists():
        backup.write_bytes(raw)
    value['subjects'] = [s for s in value['subjects'] if s['subject'] not in excluded]
    value['repositoryCount'] = len(value['subjects'])
    value['oneToOnePairs'] = sum(s['oneToOnePairs'] for s in value['subjects'])
    value['cohortExclusions'] = 'experiment-exclusions.json'
    temporary = dataset / (name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(dataset / name)
    print(name, value['repositoryCount'], value['oneToOnePairs'])
manifest.write_text(json.dumps(audit, indent=2) + '\n')
