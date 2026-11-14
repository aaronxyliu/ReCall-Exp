"""Explain each saved false negative independently using the on-server Ollama."""
from collections import Counter
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request(route, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = Request('http://127.0.0.1:11434/api/' + route, data=data,
                  headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=300) as response:
        return json.load(response)


def save(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(path)


def main(root, prompt_file):
    fn = root / 'FN'
    expected = json.loads((root / 'summary.json').read_text())
    jobs = [(row['subject'], json.loads((fn / (row['subject'] + '.json')).read_text()))
            for row in expected['rows']]
    assert sum(len(pairs) for _, pairs in jobs) == expected['totals']['FN']
    prompt = prompt_file.read_text()
    old = 'Output exactly one uppercase character: T for equivalent, or F for different. Output F only when there is clear evidence that they are not equivalent; otherwise output T. Do not output any other text.'
    new = ('Output T for equivalent, or F for different, on the first line. '
           'Output F only when there is clear evidence that they are not equivalent; otherwise output T. '
           'Then give a concise explanation. Identify the expressions and binding correspondence '
           'that support your verdict. If the result depends on a build flag, runtime condition, '
           'or external binding, state the dependency.')
    assert prompt.count(old) == 1
    prompt = prompt.replace(old, new)
    results = fn / 'explanations'
    results.mkdir(parents=True, exist_ok=True)
    protocol = {'basePromptSHA256': sha256(prompt_file.read_bytes()).hexdigest(),
                'explanationPromptSHA256': sha256(prompt.encode()).hexdigest(),
                'policy': 'One request per FN pair using the exact archived user input. '
                          'Use the revised validator prompt with a first-line verdict and concise explanation. '
                          'Keep the archived model, digest, and generation options. Ground truth is absent from the request.'}
    manifest = results / 'protocol.json'
    if manifest.exists():
        if json.loads(manifest.read_text()) != protocol:
            raise ValueError('Replay protocol changed')
    else:
        save(manifest, protocol)
    digests = {model['name']: model['digest'] for model in request('tags')['models']}
    counts = Counter()
    covered = {}
    total = expected['totals']['FN']

    def publish(active):
        save(results / 'progress.json', {'completed': counts['completed'], 'total': total, 'active': active,
                                         'verdicts': {v: counts[v] for v in ('T', 'F', 'invalid')},
                                         'emptyExplanations': counts['empty'],
                                         'lengthStops': counts['length'], 'bySubject': covered})

    def count(item):
        counts['completed'] += 1
        counts[item['verdict']] += 1
        counts['empty'] += not bool(item['explanation'])
        counts['length'] += item['output'].get('done_reason') == 'length'

    pending = []
    for subject, pairs in jobs:
        dest = results / (subject + '.jsonl')
        dest.parent.mkdir(parents=True, exist_ok=True)
        saved = {}
        if dest.exists():
            for line in dest.read_text().splitlines():
                item = json.loads(line)
                assert item['id'] not in saved
                saved[item['id']] = item
                count(item)
        ids = {pair['id'] for pair in pairs}
        assert saved.keys() <= ids and len(ids) == len(pairs)
        covered[subject] = {'completed': len(saved), 'total': len(pairs)}
        pending.extend((subject, dest, pair) for pair in pairs if pair['id'] not in saved)
    publish(pending[0][0] if pending else None)

    for subject, dest, pair in pending:
        judgment = pair['judgments'][-1]
        model = judgment['model']
        assert digests[model] == judgment['modelDigest']
        body = {'model': model, **judgment['settings'],
                'messages': [{'role': 'system', 'content': prompt}, {'role': 'user', 'content': pair['input']}]}
        for attempt in range(3):
            try:
                response = request('chat', body)
                break
            except HTTPError as error:
                if attempt == 2 or error.code < 500:
                    raise
                time.sleep(5 * (attempt + 1))
            except (URLError, TimeoutError):
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))
        first, _, explanation = response['message']['content'].strip().partition('\n')
        item = {'id': pair['id'], 'verdict': first if first in ('T', 'F') else 'invalid',
                'explanation': explanation.strip(), 'output': response}
        with dest.open('a') as handle:
            handle.write(json.dumps(item, ensure_ascii=False) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        count(item)
        covered[subject]['completed'] += 1
        publish(subject)
        print(counts['completed'], '/', total, pair['id'], item['verdict'], flush=True)
    publish(None)


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
