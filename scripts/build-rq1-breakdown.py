"""Aggregate final RQ1 accuracy and estimate process time excluding queue delays."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import hashlib
import json
from statistics import median
ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT / 'RQ1/final-results'
AUDIT = ROOT / 'results/rq1-stage-recall-audit/stage-recall.json'
progress = json.loads((FINAL / 'progress.json').read_text())
ARCHIVE = ROOT / 'results/autodl-rq1-strict-2026-11-14/ReCall Exp/results/rq1-strict-one-to-one-real'
REVISED_CACHE = ROOT / 'results/autodl-rq1-prompt-recheck/archived-cache'
STOP = ROOT / 'results/autodl-rejected-pair-replay/diagnostic-stop-checkpoint.json'
contention_end = datetime.fromisoformat(json.loads(STOP.read_text())['stoppedAt'])
timing_sources = []
request_timings = {}

for result in progress['rows']:
    subject = result['subject']
    files = sorted((REVISED_CACHE / subject / 'run/model-cache/chat').glob('*.json'))
    assert len(files) == result['revisedRequests'], subject
    request_timings[subject] = []
    for file in files:
        timing_sources.append(file)
        response = json.loads(file.read_text())['response']
        timestamp = response['created_at']
        assert timestamp.endswith('Z'), file
        whole, _, fraction = timestamp[:-1].partition('.')
        finished = datetime.fromisoformat(whole).replace(
            microsecond=int(fraction.ljust(6, '0')[:6]), tzinfo=timezone.utc
        )
        service_seconds = response['total_duration'] / 1e9
        accounted = sum(response[field] for field in (
            'load_duration', 'prompt_eval_duration', 'eval_duration'
        )) / 1e9
        request_timings[subject].append((
            finished - timedelta(seconds=service_seconds) < contention_end,
            max(0, service_seconds - accounted),
        ))

# Ollama did not log queue time directly. Keep the typical uncontended
# overhead in the estimate, and only adjust requests that overlapped the
# diagnostic job. Keep model loading, prefill, and generation in process time.
uncontended_overhead = median(residual for requests in request_timings.values()
                              for overlapped, residual in requests if not overlapped)
audit = {r['subject']:r for r in json.loads(AUDIT.read_text())['rows']}
libs = dict(webpack=75, vite=79, esbuild=41, rollup=9, turbopack=60, parcel=9, bun=9)
names = dict(webpack='Webpack', vite='Vite', esbuild='esbuild', rollup='Rollup', turbopack='Turbopack', parcel='Parcel', bun='Bun')
rows = []
for result in progress['rows']:
    subject = result['subject']
    assert result['status'] == 'completed'
    d = result['updated']
    stages = {}
    for stage, key in [('POG','pog'),('AST','ast'),('Validation','qwen')]:
        r=audit[subject][key]
        stages[stage]=dict(correct=r['positiveMatched'], assessedPredictions=r['positiveMatched']+r['incorrectMatches'],
                           promotions=r['positiveMatched']+r['incorrectMatches']+r['unassessedMatches'], denominator=d['denominator'])
    stages['Overall']=dict(correct=d['correct'],assessedPredictions=d['assessedPredictions'],
                           promotions=sum(x['promotions'] for x in stages.values()),denominator=d['denominator'])
    assert sum(stages[k]['correct'] for k in ['POG','AST','Validation'])==d['correct']
    assert sum(stages[k]['assessedPredictions'] for k in ['POG','AST','Validation'])==d['assessedPredictions']
    status_path = ARCHIVE / subject / 'run/status.json'
    timing_sources.append(status_path)
    status = json.loads(status_path.read_text())
    assert status['status'] == 'fixed-point', subject
    workflow_seconds = status['elapsedMs'] / 1000
    additional_seconds = result['attemptSeconds']
    overlapping = [residual for overlapped, residual in request_timings[subject] if overlapped]
    queue_seconds = sum(max(0, residual - uncontended_overhead) for residual in overlapping)
    assert 0 <= queue_seconds <= additional_seconds, subject
    rows.append(dict(subject=subject, stages=stages, workflowSeconds=workflow_seconds,
                     additionalProcessingSeconds=additional_seconds,
                     overlappingRequests=len(overlapping), estimatedQueueSeconds=queue_seconds,
                     processSeconds=workflow_seconds + additional_seconds - queue_seconds))
assert len(rows)==35

def aggregate(records, libraries):
    out = dict(repositories=len(records), libraries=libraries, seconds=sum(r['processSeconds'] for r in records), stages={})
    for key in ('workflowSeconds', 'additionalProcessingSeconds', 'overlappingRequests', 'estimatedQueueSeconds'):
        out[key] = sum(row[key] for row in records)
    for stage in ['POG','AST','Validation','Overall']:
        out['stages'][stage]={key:sum(r['stages'][stage][key] for r in records) for key in ['correct','assessedPredictions','promotions','denominator']}
    out['anchorCount']=out['stages']['POG']['promotions']
    return out
bygroup={g:aggregate([r for r in rows if r['subject'].split('/')[0]==g],libs[g]) for g in libs}
total=aggregate(rows,sum(libs.values()))
assert total['stages']['Overall']['correct']==49867
assert total['stages']['Overall']['denominator']==58128
assert total['stages']['Overall']['assessedPredictions']==50528

def hms(seconds):
    hours, rest = divmod(round(seconds), 3600)
    minutes, seconds = divmod(rest, 60)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d}'

def cells(label,d):
    gt=d['stages']['Overall']['denominator']
    prec=[100*d['stages'][k]['correct']/d['stages'][k]['assessedPredictions'] for k in ['POG','AST','Validation','Overall']]
    return [label, f"{100*d['anchorCount']/gt:.2f}"]+[f'{p:.2f}' for p in prec]+[f"{100*d['stages']['Overall']['correct']/gt:.2f}",hms(d['seconds']),f"{d['seconds']/60/d['libraries']:.2f}"]
tex=r'''% Generated by scripts/build-rq1-breakdown.py from the final RQ1 recovery traces.
\begin{table}[htbp]
\caption{ReCall's recovery accuracy, initial anchor set, and estimated process time excluding queue delays by bundler.}
\label{tab:rq1-bundler-breakdown}
\centering\small
\setlength{\tabcolsep}{2pt}
\renewcommand{\arraystretch}{1.12}
\begin{tabular*}{\linewidth}{@{\extracolsep{\fill}}lcccccccc@{}}
\toprule
\multirow{3}{*}{\shortstack{\textbf{Bundler}\\\textbf{Group}}} & \multirow{3}{*}{\shortstack{\textbf{Initial}\\\textbf{Anchor (\%)}}} & \multicolumn{4}{c}{\textbf{Precision (\%)}} & \multirow{3}{*}{\shortstack{\textbf{Recovery}\\\textbf{(\%)}}} & \multicolumn{2}{c}{\textbf{Process time (est.)}} \\
\cmidrule(lr){3-6}\cmidrule(l){8-9}
 & & \shortstack{POG\\Match} & \shortstack{AST\\Match} & \shortstack{Model\\validation} & Overall & & \shortstack{Total\\(h:min:s)} & \shortstack{Per library\\(min)} \\
\midrule
'''
for g,d in bygroup.items():
    tex+=' & '.join(cells(names[g],d))+r' \\'+'\n'
tex+=r'\midrule'+'\n'+' & '.join(r'\textbf{'+x+'}' for x in cells('Overall',total))+r' \\'+'\n'+r'''\bottomrule
\end{tabular*}
\end{table}
'''
(ROOT/'manuscript/data/rq1-bundler-breakdown.tex').write_text(tex)
provenance = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in [FINAL / 'progress.json', FINAL / 'protocol.json', STOP, AUDIT]}
timing_input_digest = hashlib.sha256()
for file in sorted(timing_sources):
    timing_input_digest.update(str(file.relative_to(ROOT)).encode() + b'\0')
    timing_input_digest.update(hashlib.sha256(file.read_bytes()).digest())
report = dict(run='final RQ1 recovery traces',
              timing='Workflow wall time plus additional processing, minus estimated queue delays during known concurrency.',
              uncontendedChatOverheadSeconds=uncontended_overhead,
              timingInputSHA256=timing_input_digest.hexdigest(),
              provenance=provenance, byBundler=bygroup, total=total, subjects=rows)
(ROOT / 'manuscript/data/rq1-bundler-breakdown.json').write_text(json.dumps(report, indent=2) + '\n')
for g,d in bygroup.items():print(' | '.join(cells(names[g],d)))
print(' | '.join(cells('Overall',total)))
