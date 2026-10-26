"""Export saved diagnostics for human review; performs no model calls."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking/wrong-identity-audit'
DEST = BASE / 'readable-cases'
DEST.mkdir(exist_ok=True)

# The latest review uses the functions-only diagnostic, when available.
if (BASE / 'functions-only-thinking/sample.json').exists():
    import subprocess
    subprocess.run(['node', 'scripts/jquery/audit-functions-only.mjs', '--export-only'], cwd=ROOT, check=True)
    raise SystemExit(0)



def read(path):
    return json.loads(path.read_text())


def block(value, language='text'):
    text = value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False)
    longest = max([len(m.group()) for m in re.finditer(r'`+', text)] or [0])
    fence = '`' * max(3, longest + 1)
    return f'\n{fence}{language}\n{text}\n{fence}\n\n'


def request_sections(request):
    md = '### Request settings\n' + block({k: v for k, v in request.items() if k != 'messages'}, 'json')
    for index, message in enumerate(request['messages'], 1):
        md += f'### Message {index}: {message["role"]}\n'
        content = message['content']
        if message['role'] == 'user':
            try:
                fields = json.loads(content)
            except json.JSONDecodeError:
                fields = None
            if isinstance(fields, dict):
                md += 'The following fields are expanded from the exact JSON message for readability. The complete request below preserves the original message string.\n\n'
                for key, value in fields.items():
                    md += f'#### `{key}`\n' + block(value, 'javascript' if isinstance(value, str) and ('source' in key or 'function' in key) else 'json')
            else:
                md += block(content)
        else:
            md += block(content)
    md += '<details>\n<summary>Complete exact API request</summary>\n\n' + block(request, 'json') + '</details>\n\n'
    return md


def response_sections(response):
    message = response.get('message', {})
    md = '### Final output\n'
    md += block(message.get('content', ''))
    if not message.get('content'):
        md += '**The final output is empty; this is not a rejection.**\n\n'
    md += '### Thinking output (complete, unedited)\n'
    thinking = message.get('thinking', '')
    md += block(thinking) if thinking else 'No thinking content was returned.\n\n'
    md += '<details>\n<summary>Complete raw API response, including timing and token counts</summary>\n\n'
    md += block(response, 'json') + '</details>\n\n'
    return md


cases = read(BASE / 'cases.json')['cases']
annotations = {c['id']: c for c in read(BASE / 'annotations.json')['cases']}
counterexamples = {c['id']: c for c in read(BASE / 'counterexamples.json')['results']}
reviews = read(BASE / 'thinking-replay/trace-review.json')['cases']
index = '# Review of wrongly identified function pairs\n\n'
index += 'Each file contains one original wrong source-identity pair, its source code, exact validator inputs, original output, and complete thinking-enabled output. No model calls are performed by this export.\n\n'
index += '**Scope:** 13 source-identity mismatches comprise 10 demonstrated behavioral differences and 3 invocation-equivalent pairs (W06, W11, W12). The latter are comparison cases, not demonstrated semantic false positives. Thinking replays are complete for all 13 pairs.\n\n'
index += 'Start with W01 for captured-object confusion, W04 for a corrected decision, and W13 for reasoning that identifies a difference but never returns a verdict. Model reasoning is unverified diagnostic text; independent counterexamples establish behavioral differences.\n\n'
index += '| Case | Description | Classification | Thinking verdict |\n|---|---|---|---|\n'
manifest = []
for c in cases:
    cid = c['id']
    annotation = annotations[cid]
    replay_path = BASE / f'thinking-replay/requests/{cid}-wrong-pair-thinking.json'
    replay = read(replay_path) if replay_path.exists() else None
    equivalent = cid in {'W06', 'W11', 'W12'}
    classification = 'Invocation-equivalent; different source identity' if equivalent else 'Demonstrated behavioral difference'
    slug = re.sub(r'[^a-z0-9]+', '-', annotation['title'].lower()).strip('-')
    filename = f'{cid}-{slug}.md'
    md = f'# {cid}: {annotation["title"]}\n\n[Back to index](README.md)\n\n'
    md += f'**Build:** `{c["build"]}`. **Classification:** {classification}.\n\n'
    md += f'**Actual source:** `{c["expected"]["name"]}`. **Originally assigned source:** `{c["predicted"]["name"]}`.\n\n'
    md += f'**Expected semantic verdict:** `{str(equivalent).lower()}`. Original output: `{c["response"].get("message", {}).get("content", "")}`. '
    md += f'Thinking replay: **{replay["verdict"]}**.\n\n' if replay else 'Thinking replay: not available.\n\n'
    md += '## What to inspect\n\n' + annotation['explanation'] + '\n\n'
    md += '**Possible repair:** ' + annotation['proposedSolution'] + '\n\n'
    if cid in reviews:
        md += '**Observation from the thinking replay:** ' + reviews[cid]['finding'] + '\n\n'
        for key in ['interpretation', 'limit']:
            if key in reviews[cid]:
                md += reviews[cid][key] + '\n\n'
    md += 'These observations do not establish the hidden cause of the earlier non-thinking answer. Model-generated explanations may contain incorrect claims.\n\n'
    md += '## Function code\n\n### Bundled function\n' + block(c['bundled']['code'], 'javascript')
    md += '### Candidate source sent to the validator\n' + block(c['predicted']['code'], 'javascript')
    md += '### Actual source counterpart (evaluation only)\n\nThis label comes from source-map evaluation; it was not supplied as ground truth in the validator request.\n' + block(c['expected']['code'], 'javascript')
    md += '## Original validation: thinking disabled\n\n' + request_sections(c['request']) + response_sections(c['response'])
    md += '## Replay: thinking enabled\n\n'
    if replay:
        md += f'Elapsed time: {replay["wallMs"] / 1000:.1f} seconds. Generated tokens: {replay.get("response", {}).get("eval_count", "unknown")}. Verdict: **{replay["verdict"]}**.\n\n'
        md += 'The output budget was raised from 32 to 8,192 tokens together with enabling thinking; this is not a think-only causal comparison.\n\n'
        md += request_sections(replay['request']) + response_sections(replay.get('response', {}))
    else:
        md += 'No saved replay is available.\n\n'
    md += '## Independent behavioral check\n\nThe following saved test record includes its setup and scope; it is separate from the model input.\n'
    md += block(counterexamples.get(cid, {}), 'json')
    md += '## Retrieval and source-map evidence\n'
    md += block({k: c[k] for k in ['correctSourceInCandidatePool', 'correctSourceRank', 'correctSourceInTop3', 'earlierWrongOwner', 'parents', 'independentMapping']}, 'json')
    md += '## Provenance\n\n'
    md += f'- [Original frozen case](../cases/{cid}.json)\n'
    md += f'- [Thinking replay record](../thinking-replay/requests/{cid}-wrong-pair-thinking.json)\n'
    md += '- [Full independent audit](../REPORT.md)\n'
    for variant in ['wrong-pair-nonthinking-budget-control']:
        control_path = BASE / f'thinking-replay/requests/{cid}-{variant}.json'
        if control_path.exists():
            control = read(control_path)
            md += '\n## Additional same-budget control: thinking disabled\n\n'
            md += request_sections(control['request']) + response_sections(control.get('response', {}))
    (DEST / filename).write_text(md)
    verdict = replay['verdict'] if replay else 'unavailable'
    index += f'| [{cid}]({filename}) | {annotation["title"]} | {classification} | {verdict} |\n'
    manifest.append({'id': cid, 'file': filename, 'thinkingVerdict': verdict})
index += '\n`accept` means final `true`; `reject` means final `false`; `invalid` means no usable boolean verdict. An empty final output at the token limit must not be counted as a successful rejection. Full thinking text is intentionally preserved, including repetitions.\n\n'
index += 'Regenerate using `python3 scripts/jquery/export-failing-case-markdown.py` from the repository root.\n'
(DEST / 'README.md').write_text(index)
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Exported {len(manifest)} case files and README.md to {DEST}')
