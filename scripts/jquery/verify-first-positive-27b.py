"""Verify the saved 27B diagnostic and its comparison with the 4B replay; no inference."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8'
REVIEW = P / 'first-positive-review'
OUT = REVIEW / 'explanation-replay-27b'
old = json.loads((REVIEW / 'explanation-replay/results.json').read_text())
new = json.loads((OUT / 'results.json').read_text())
manifest = json.loads((OUT / 'model-manifest.json').read_text())
base = {r['id']: r for r in old['records']}
checks = []
def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)
check('all 44 cases completed', len(new['records']) == 44 and new['summary']['status'] == 'complete')
check('one output per original case', {r['id'] for r in new['records']} == set(base) and len({r['id'] for r in new['records']}) == 44)
for row in new['records']:
    previous = base[row['id']]
    request = json.loads(json.dumps(row['request']))
    check(row['id'] + ' uses pinned 27B digest', row['modelDigest'] == manifest['digest'] and request['model'] == 'qwen3.5:27b')
    request['model'] = previous['request']['model']
    check(row['id'] + ' request differs only in model', request == previous['request'])
    check(row['id'] + ' preserves historical timing', row['baselineWallMs'] == previous['wallMs'])
    check(row['id'] + ' thinking disabled', request['think'] is False and not row.get('response', {}).get('message', {}).get('thinking'))
    if row['verdict'] in ['accept', 'reject']:
        value = json.loads(row['response']['message']['content'])
        check(row['id'] + ' complete mapping and explanation', set(value) == {'variable_mapping', 'equivalent', 'explanation'} and set(value['variable_mapping']) == set(row['requiredVariables']) and isinstance(value['equivalent'], bool) and isinstance(value['explanation'], str) and bool(value['explanation'].strip()))
    text = (REVIEW / (row['id'] + '.md')).read_bytes().decode('utf-8')
    check(row['id'] + ' one 27B section', text.count('<!-- explanation-replay-27b:start -->') == 1)
    check(row['id'] + ' raw 27B output saved', row.get('response', {}).get('message', {}).get('content', row.get('error', '')) in text)
    check(row['id'] + ' 4B section and raw output preserved', text.count('<!-- explanation-replay:start -->') == 1 and previous['response']['message']['content'] in text)
check('same 44-case timing denominator', new['summary']['timing4b']['calls'] == new['summary']['timing27b']['calls'] == 44)
check('all verdicts accounted for', sum(new['summary']['model27b'].values()) == 44)
check('full recovery remains stopped', json.loads((ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8-first-positive/execution-status.json').read_text())['status'] == 'stopped')
result = {'status': 'passed', 'checks': len(checks), 'details': checks, 'modelDigest': manifest['digest'], 'uniqueRequests': new['summary']['uniqueRequestKeys'], 'thinkingCharacters': new['summary']['thinkingCharacters']}
(OUT / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'details'}, indent=2))
