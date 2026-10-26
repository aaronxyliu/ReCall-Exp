#!/usr/bin/env python3
"""Count candidate boundary relations from saved oracle votes, not compiler events."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def analyze(sources, bundles, records, minimum):
    refs = {f['id']: (s, f) for s in sources for f in s['functions']}
    targets = {(b['build'], f['id']) for b in bundles for f in b['functions']}
    outgoing = defaultdict(list)
    mixed = []
    edges = 0
    seen = set()
    for record in records:
        key = (record['build'], record['bundleId'])
        if key not in targets or key in seen:
            raise ValueError(f'Unknown or duplicate target record: {key}')
        seen.add(key)
        votes = dict(record['votes'])
        if set(votes) - refs.keys():
            raise ValueError('Oracle references missing from inventory')
        retained = [(sid, count) for sid, count in votes.items() if count >= minimum]
        for sid, count in retained:
            outgoing[sid].append({'build': key[0], 'bundleId': key[1], 'points': count})
            edges += 1
        if len(retained) > 1:
            mixed.append({'build': key[0], 'bundleId': key[1],
                          'mappedOwnPoints': record['mappedOwnPoints'],
                          'sources': [{'sourceId': sid, 'points': count,
                                       'library': refs[sid][0]['library']}
                                      for sid, count in retained]})
    if seen != targets:
        raise ValueError('Inventory target population and oracle records differ')
    absent = [{'sourceId': sid, 'library': s['library'], 'file': s['file'],
               'name': f['name']}
              for sid, (s, f) in refs.items() if not outgoing[sid]]
    multiple = [{'sourceId': sid, 'library': refs[sid][0]['library'],
                 'name': refs[sid][1]['name'], 'targets': links}
                for sid, links in outgoing.items() if len(links) > 1]
    by_library = []
    for lib in sorted({s['library'] for s in sources}):
        ids = [sid for sid, (s, _) in refs.items() if s['library'] == lib]
        counts = Counter(len(outgoing[sid]) for sid in ids)
        by_library.append({'library': lib, 'referenceDefinitions': len(ids),
                           'noRetainedTargetLink': counts[0],
                           'exactlyOneTargetLink': counts[1],
                           'multipleTargetLinks': sum(n for degree, n in counts.items() if degree > 1)})
    return {'minPointsPerRelation': minimum, 'referenceDefinitions': len(refs),
            'bundleDefinitions': len(targets), 'retainedRelations': edges,
            'noRetainedTargetLink': len(absent),
            'multipleTargetLinks': len(multiple), 'mixedSourceTargets': len(mixed),
            'byLibrary': by_library,
            'candidates': {'noRetainedTargetLink': absent,
                           'multipleTargetLinks': multiple, 'mixedSourceTargets': mixed}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='One saved application/build cohort directory')
    parser.add_argument('--out', required=True, type=Path, help='New output JSON; refuses overwrite')
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Output exists; choose a new path')
    inputs = [args.input / 'detector-input.json', args.input / 'ground-truth.json']
    detector, oracle = map(read, inputs)
    if 'sourceShards' in detector:
        shard_paths = [args.input / p for p in detector['sourceShards'] + detector['bundleShards']]
        sources = [read(args.input / p) for p in detector['sourceShards']]
        bundles = [read(args.input / p) for p in detector['bundleShards']]
        inputs += shard_paths
    else:
        sources, bundles = detector['sources'], detector['bundles']
    measurements = [analyze(sources, bundles, oracle['records'], n) for n in (2, 5, 10)]
    report = {
        'status': 'candidate-relations-only-not-transformation-counts',
        'scope': 'One supplied input cohort; all its saved chunks aggregated. Do not mix independent builds.',
        'limitations': [
            'Source maps are positional evidence, not a compiler transformation log.',
            'Multiple target links may reflect duplication, nesting artifacts, or mapping noise instead of splitting.',
            'Mixed source targets may reflect inlining/combination or mapping artifacts.',
            'No retained link does not establish removal; the saved oracle omits top-level generated code.',
            'Reference inventory is map-embedded selected sources, not every function in the original packages.',
            'Thresholds are sensitivity diagnostics, not validated decision rules.'
        ],
        'oraclePolicy': oracle.get('policy'),
        'inputs': [{'path': str(p.resolve()), 'sha256': digest(p)} for p in inputs],
        'scriptSha256': digest(Path(__file__)), 'measurements': measurements
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x') as output:
        json.dump(report, output, indent=2)
        output.write('\n')
    print(json.dumps([{k: v for k, v in m.items() if k not in ('candidates', 'byLibrary')}
                      for m in measurements], indent=2))


if __name__ == '__main__':
    main()
