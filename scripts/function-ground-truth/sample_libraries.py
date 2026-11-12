"""Freeze the production manifest and deterministic sample before looking at any maps."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

DATA = Path(__file__).resolve().parents[3] / "ReCall Dataset"
OUT = DATA / "function-ground-truth"
GROUPS = ("webpack", "vite", "esbuild")
SEED = "recall-library-sample-v1"
EXCLUDED = {row["subject"] for row in json.loads((OUT / "exclusions.json").read_text())}


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def generate():
    subjects = []
    for group in GROUPS:
        for record in sorted((DATA / "bundling-dataset" / group).glob("*/subject.json")):
            subject = json.loads(record.read_text())
            key = f"{group}/{record.parent.name}"
            if key in EXCLUDED:
                continue
            checkout = DATA / "builds" / key
            commit = subject["commit"]
            manifest = subject["packageJson"].split(f"/{commit}/", 1)[1]
            raw = subprocess.check_output(["git", "-C", checkout, "show", f"{commit}:{manifest}"])
            package = json.loads(raw)
            eligible, excluded = {}, {}
            for name, version in package.get("dependencies", {}).items():
                if name.startswith("@types/") or re.match(r'^(workspace:|file:|link:|portal:)', version):
                    excluded[name] = version
                else:
                    eligible[name] = version
            def rank(name):
                return hashlib.sha256("\0".join([SEED, commit, name]).encode()).hexdigest()
            selected = sorted(eligible, key=lambda name: (rank(name), name))[:10]
            target = OUT / key / "selection.json"
            if target.exists() and json.loads(target.read_text()).get("samplingRule") in {"frontend-visible-v1", "frontend-counterpart-fill-v1"}:
                subjects.append(key)
                continue
            write(target, dict(repo=subject["repo"], commit=commit,
                  manifest=manifest, manifestSHA256=hashlib.sha256(raw).hexdigest(), seed=SEED,
                  eligible=eligible, excluded=excluded, selected=selected))
            subjects.append(key)
    assert len(subjects) == 30 - len(EXCLUDED)
    return subjects


if __name__ == "__main__":
    generate()
