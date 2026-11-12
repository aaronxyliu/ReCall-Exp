"""Run real ReCall validation with the archived RQ1 source and bundle inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'manifest.json').read_text())


def verify(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'SHA-256 mismatch for {path}')


def extract(archive, directory):
    directory.mkdir()
    with tarfile.open(archive, 'r:gz') as package:
        for member in package:
            target = (directory / member.name).resolve()
            if not member.isfile() or directory not in target.parents:
                raise ValueError(f'Unsupported archive entry {member.name}')
            target.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as source, target.open('xb') as destination:
                shutil.copyfileobj(source, destination)
    for name in ('source.json', 'bundle.json'):
        path = directory / name
        manifest = json.loads(path.read_text())
        manifest['roots'] = [str(directory / root) for root in manifest['roots']]
        for entry in manifest['files']:
            for field in ('path', 'packageRoot'):
                if field in entry:
                    entry[field] = str(directory / entry[field])
        path.write_text(json.dumps(manifest, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recall', type=Path, default=ROOT.parents[1] / 'ReCall')
    parser.add_argument('--dataset', type=Path, default=ROOT.parents[1] / 'ReCall Dataset')
    parser.add_argument('--out', type=Path, default=ROOT.parent / 'results/rq1-reproduction')
    parser.add_argument('--subject', action='append', choices=[r['subject'] for r in MANIFEST['subjects']])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--prepare-only', action='store_true')
    mode.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()

    recall, dataset, output = (p.resolve() for p in (args.recall, args.dataset, args.out))
    subjects = [r for r in MANIFEST['subjects'] if not args.subject or r['subject'] in args.subject]
    qualified = dataset / 'qualified-dataset'
    index = json.loads((qualified / 'index.json').read_text())
    dataset_subjects = {entry['subject']: entry for entry in index['subjects']}
    for subject in subjects:
        verify(ROOT / subject['archive'], subject['sha256'])
        current = dataset_subjects.get(subject['subject'])
        if current is None:
            raise ValueError(f"Dataset index is missing {subject['subject']}")
        verify(qualified / current['records'], subject['recordsSHA256'])
    if args.verify_only:
        print(f'Verified inputs and ground truth for {len(subjects)} subjects.')
        return

    output.mkdir(parents=True)
    for entry in subjects:
        subject = entry['subject']
        folder = output / subject
        folder.mkdir(parents=True)
        inputs = folder / 'input'
        extract(ROOT / entry['archive'], inputs)
        run = folder / 'run'
        command = [
            'node', str(recall / 'bin/recall.mjs'), 'run',
            '--source-manifest', str(inputs / 'source.json'),
            '--bundle-manifest', str(inputs / 'bundle.json'), '--out', str(run)
        ]
        if args.prepare_only:
            command.append('--prepare-only')
        print(subject, flush=True)
        with (folder / 'worker.log').open('w') as log:
            subprocess.run(command, cwd=recall, stdout=log, stderr=subprocess.STDOUT, check=True)
        if not args.prepare_only:
            with (folder / 'score.json').open('w') as score:
                subprocess.run([sys.executable, str(dataset / 'tools/score.py'),
                                subject, '--run', str(run)], stdout=score, check=True)


if __name__ == '__main__':
    main()
