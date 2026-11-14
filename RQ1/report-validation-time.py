"""Report Qwen prompt processing and generation time without Ollama queue time."""
import json
from pathlib import Path
import sys


def read(path):
    return json.loads(path.read_text())


def compute_seconds(responses):
    return sum(response['prompt_eval_duration'] + response['eval_duration']
               for response in responses) / 1e9


def main(root):
    progress = read(root / 'progress.json')
    rows = []
    for row in progress['rows']:
        if row['status'] != 'completed':
            continue
        run = root / row['subject'] / 'run'
        revised = {entry['key']: entry['response']
                   for file in (run / 'model-cache/chat').glob('*.json')
                   for entry in [read(file)]}
        recovery = read(run / 'recovery.json')
        used = {check['response']['created_at']: check['response']
                for query in recovery['queries'] for check in query['checks']
                if check['validator'] == 'model'}
        if len(revised) != row['revisedRequests'] or len(used) != row['uniqueRequests']:
            raise ValueError(f'Validation request count mismatch for {row["subject"]}')
        rows.append({
            'subject': row['subject'],
            'traceRequests': len(used),
            'traceModelSeconds': compute_seconds(used.values()),
            'revisedRequests': len(revised),
            'revisedModelSeconds': compute_seconds(revised.values()),
        })

    totals = {key: sum(row[key] for row in rows)
              for key in ('traceRequests', 'traceModelSeconds', 'revisedRequests', 'revisedModelSeconds')}
    method = ('Qwen compute time is Ollama prompt evaluation plus token generation. '
              'It excludes queueing, model loading, transport, embeddings, and exploration. '
              'Wall-clock progress is recorded separately. '
              'Rebuilt traces include reused judgments and can omit some targeted rechecks.')
    report = {'progressUpdatedAt': progress['updatedAt'], 'method': method,
              'repositories': len(rows), 'totals': totals, 'rows': rows}
    lines = [
        '# RQ1 validation timing', '',
        f'{len(rows)}/{len(progress["rows"])} repositories complete at {progress["updatedAt"]}.', '',
        method, '',
        '| Repository | Judgments used in rebuilt trace | Qwen compute in trace (s) | Revised-prompt requests | Revised Qwen compute (s) |',
        '|---|---:|---:|---:|---:|',
    ]
    for row in [*rows, {'subject': '**Total**', **totals}]:
        lines.append(f'| {row["subject"]} | {row["traceRequests"]:,} | {row["traceModelSeconds"]:.2f} | '
                     f'{row["revisedRequests"]:,} | {row["revisedModelSeconds"]:.2f} |')
    for name, content in [('validation-timing.json', json.dumps(report, indent=2)),
                          ('VALIDATION-TIMING.md', '\n'.join(lines))]:
        target = root / name
        temporary = root / ('.' + name + '.tmp')
        temporary.write_text(content + '\n')
        temporary.replace(target)


if __name__ == '__main__':
    main(Path(sys.argv[1]))
