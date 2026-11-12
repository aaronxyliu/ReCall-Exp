"""Extend existing samples to ten libraries with audited one-to-one counterparts."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from sample_libraries import DATA, OUT, write

SCRIPTS = Path(__file__).resolve().parent
SEED = 'recall-counterpart-fill-v1'


def read(path):
    return json.loads(path.read_text())


def analyze(folder, archive, script):
    subprocess.run(['node', '--max-old-space-size=6144', str(SCRIPTS / script),
                    str(folder), str(archive)], check=True)


def fill(folder):
    sample = read(folder / 'selection.json')
    previous = read(folder / 'relations.json')
    contributors = {pair['library'] for pair in previous['pairs']}
    if len(sample['eligible']) <= 10 or len(contributors) >= 10:
        return
    if sample.get('samplingRule') == 'frontend-counterpart-fill-v1':
        return
    key = folder.relative_to(OUT)
    archive = DATA / 'bundling-dataset' / key / 'ground-truth'
    with tempfile.TemporaryDirectory(prefix='recall-library-fill-') as temporary:
        work = Path(temporary)
        capture = read(folder / 'capture.json')
        assert capture['imageID'] == previous['imageID']
        write(work / 'capture.json', capture)
        candidates = sorted(set(sample['eligible']) | contributors)
        write(work / 'selection.json', dict(sample, selected=candidates))
        analyze(work, archive, 'relations.mjs')
        screening = read(work / 'relations.json')
        counts = dict.fromkeys(candidates, 0)
        for pair in screening['pairs']:
            counts[pair['library']] += 1
        def rank(name):
            return hashlib.sha256('\0'.join([SEED, sample['commit'], name]).encode()).hexdigest()
        additions = sorted((name for name in candidates if name not in contributors and counts[name]), key=rank)
        chosen = [name for name in sample['selected'] if name in contributors]
        chosen.extend(additions[:10-len(chosen)])
        updated = dict(sample, selected=chosen, samplingRule='frontend-counterpart-fill-v1',
                       fillSeed=SEED, previousSelected=sample['selected'],
                       retainedContributors=sorted(contributors), candidatePairCounts=counts,
                       candidateOrder=sorted((n for n in candidates if n not in contributors), key=rank),
                       targetContributingLibraries=10,
                       fillOutcome='limit-reached' if len(chosen)==10 else 'eligible-pool-exhausted',
                       frontendImageID=capture['imageID'])
        write(work / 'selection.json', updated)
        analyze(work, archive, 'relations.mjs')
        analyze(work, archive, 'verify_pairs.mjs')
        result = read(work / 'relations.json')
        assert {p['library'] for p in result['pairs']} == set(chosen)
        assert {(p['source'],p['bundled']) for p in previous['pairs']} <= {(p['source'],p['bundled']) for p in result['pairs']}
        backup = folder / 'selection-before-counterpart-fill.json'
        if not backup.exists():
            write(backup, sample)
        for name in ('selection.json', 'relations.json', 'pair-audit.json'):
            write(folder / name, read(work / name))
        print(json.dumps(dict(repo=sample['repo'],before=len(contributors),after=len(chosen),
                              pairs=len(result['pairs']),outcome=updated['fillOutcome'])), flush=True)


if __name__ == '__main__':
    for selection in sorted(OUT.glob('*/*/selection.json')):
        fill(selection.parent)
