"""Generate per-build audits without waiting for the other builds or running inference."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / os.environ.get('EXPERIMENT_OUTPUT', 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8')
config = json.loads((OUTPUT / 'study-config.json').read_text())
for build in config['buildIds']:
    checkpoint = OUTPUT / 'recovery' / (build + '.json')
    if not checkpoint.exists() or json.loads(checkpoint.read_text())['status'] != 'fixed-point':
        continue
    with tempfile.TemporaryDirectory(prefix='jquery-completed-audit-') as folder:
        temporary = Path(folder)
        for name in ['detector-input.json', 'ground-truth.json', 'recovery']:
            (temporary / name).symlink_to(OUTPUT / name)
        (temporary / 'study-config.json').write_text(json.dumps({**config, 'buildIds': [build]}))
        subprocess.run(['python3', str(ROOT / 'scripts/jquery/analyze-recovery-bottlenecks.py')],
                       env={**os.environ, 'EXPERIMENT_OUTPUT': str(temporary)}, check=True,
                       stdout=subprocess.DEVNULL)
        destination = OUTPUT / 'per-build-recovery-bottlenecks' / build
        destination.mkdir(parents=True, exist_ok=True)
        for name in ['REPORT.md', 'summary.json']:
            shutil.copyfile(temporary / 'recovery-bottlenecks' / name, destination / name)
        summary = json.loads((destination / 'summary.json').read_text())
        print(json.dumps({'build': build, **summary['builds'][0]}))
