"""Publish the completed v8 measurements in the manuscript; never invoke models."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8'
PAPER = ROOT / 'manuscript'
def read(name):
    return json.loads((OUT / name).read_text())
summary, comparison, verification = (read(n) for n in ['summary.json', 'comparison-summary.json', 'verification.json'])
assert summary['status'] == comparison['status'] == 'complete'
assert verification['status'] == 'passed'
builds = summary['builds']
assert len(builds) == 3 and all(b['status'] == 'fixed-point' for b in builds)
breakdown = read('recovery-bottlenecks/summary.json')
archive = PAPER / 'archive/2026-10-20-before-v8-results'
files = ['main.tex', 'README.md', 'sections/results.tex', 'sections/introduction.tex', 'sections/experiment.tex', 'sections/limitations.tex']
for name in files:
    target = archive / name
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PAPER / name, target)
names = {'esbuild-min-keep': 'esbuild', 'rollup-min-keep': 'Rollup', 'webpack-min-keep': 'webpack'}
def table(caption, label, columns, header, rows):
    return ('\\begin{table}[t]\n\\caption{' + caption + '}\n\\label{' + label + '}\n\\centering\n\\small\n'
            + '\\begin{tabular}{' + columns + '}\n\\toprule\n' + header + '\\\\\n\\midrule\n'
            + ''.join(' & '.join(map(str, row)) + '\\\\\n' for row in rows)
            + '\\bottomrule\n\\end{tabular}\n\\end{table}\n')
recovery = table('Recovery of supported jQuery function identities. Wrong identities and unassessed predictions are reported separately.', 'tab:v8-recovery', 'lrrrrrr',
                 'Bundler & Targets & POG & Correct & Recovery & Wrong & Unassessed',
                 [[names[b['build']], b['supportedJqueryDefinitions'], b['anchors']['correct'], b['final']['correct'], f"{b['correctRecovery']:.2f}\\%", b['final']['wrong'], b['final']['unassessed']] for b in builds])
validation = table('Pair-level validation and final-match precision. Rates describe saved pair checks, including cache reuse.', 'tab:v8-validation', 'lrrrrr',
                   'Bundler & Checks & Accepted & Pair precision & Final precision & Invalid',
                   [[names[b['build']], b['modelPairs'], b['acceptedModelPairs']['total'], f"{b['acceptedPairIdentityPrecision']:.2f}\\%", f"{b['conditionalPrecision']:.2f}\\%", b['invalid']] for b in builds])
reason_names = {
    'correct_accepted_but_multiple_positives': 'Multiple accepted candidates',
    'correct_candidate_never_top3': 'Correct candidate outside top three',
    'never_queried_no_matched_neighbor': 'No matched neighbor',
    'wrong_source_promoted': 'Wrong identity promoted',
    'correct_top3_but_never_accepted': 'Correct top-three candidate rejected',
    'correct_accepted_but_identity_conflict': 'Source-identity conflict',
    'correct_source_never_candidate': 'Correct source absent from candidates',
    'never_queried_input_length': 'Function exceeds input limit',
    'correct_top3_only_invalid_or_error': 'Correct pair only invalid or error',
    'never_queried_no_available_source_candidate': 'No available source candidate',
    'never_queried_other': 'Other query restriction',
    'correct_accepted_other': 'Other acceptance restriction',
}
bybuild = {b['build']: b['categories'] for b in breakdown['builds']}
reason_rows = [[reason_names[k]] + [bybuild[b['build']].get(k, 0) for b in builds] + [v]
               for k, v in sorted(breakdown['aggregate'].items(), key=lambda p: -p[1])]
barriers = table('Exclusive observed reasons for failure to recover a supported identity correctly. Repeated functions across builds are correlated.', 'tab:v8-barriers', 'lrrrr',
                 'Observed outcome & esbuild & Rollup & webpack & Total', reason_rows)
runtime = table('Recovery execution time and cache reuse. Rounds include the final round with no additions.', 'tab:v8-runtime', 'lrrrr',
                'Bundler & Rounds & Fresh calls & Cache hits & Minutes',
                [[names[b['build']], b['round'], b['modelCalls'], b['cacheHits'], f"{b['elapsedMs']/60000:.2f}"] for b in builds])
for name, content in [('recovery', recovery), ('validation', validation), ('barriers', barriers), ('runtime', runtime)]:
    (PAPER / f'data/v8-{name}.tex').write_text(content)
pooled = comparison['pooledOccurrences']
rates = [b['correctRecovery'] for b in builds]
text = r'''\section{Results}
\label{sec:results}
All three minified configurations with tree shaking disabled reached a fixed point. The following measurements use the mapping-and-verdict validator with thinking disabled. Earlier interrupted and non-minified snapshots are archived and are not combined with these results.

\subsection{Function population and recovery}
The reference distribution contains 558 static function definitions: 85 (15.23\%) have at least ten own-body property-operation occurrences, 393 have one to nine, and 80 have none. These are implementation instances. Anchor eligibility does not imply a unique matching fingerprint. Table~\ref{tab:v8-recovery} distinguishes the initial correct POG matches from final recovery and reports wrong identities and unassessed predictions separately.

\input{data/v8-recovery}

'''
text += f"Final correct recovery ranges from {min(rates):.2f}\\% to {max(rates):.2f}\\%. Expansion increases recovery beyond the initial POG matches in each build. Across the three configurations, {pooled['correct']} of {pooled['supported']} supported bundled-function occurrences are correctly identified ({pooled['recoveryPercent']:.2f}\\%). This pooled count repeats functions across builds and is descriptive, not a sample of independent functions.\n\n"
text += r'''\subsection{Validator decisions and accepted matches}
Table~\ref{tab:v8-validation} separates accepted-pair precision from final-match precision. A model acceptance is a proposal: multiple accepted candidates and competing allocations of the same source identity can block promotion. Source-map agreement measures recovered identity, not unrestricted semantic equivalence. Structured mappings are checked for completeness, not independently proved correct.

\input{data/v8-validation}

Accepted-pair precision is substantially lower than final-match precision. Thus, a model acceptance alone is insufficient evidence of the exact source identity; ambiguity and conflict checks exclude many incorrect proposals. The remaining wrong promotions show that these checks do not eliminate errors.

'''
calls = sum(b['modelCalls'] for b in builds)
hits = sum(b['cacheHits'] for b in builds)
invalid = sum(b['invalid'] for b in builds)
errors = sum(b['errors'] for b in builds)
text += f"The recovery procedure performs {sum(b['modelPairs'] for b in builds)} pair checks: {calls} fresh model calls and {hits} cache hits. The new cache initially contains 111 distinct exact requests from the preceding prompt diagnostic; later repeated pairs also reuse judgments. Cached checks are not independent model trials. There are {invalid} invalid pair-check responses and {errors} API errors. Full responses, token counts, generation exits, model digests, and request provenance are retained.\n\n"
text += r'''\subsection{Reasons for incomplete recovery}
We classify each supported bundled function that is not correctly identified using all saved queries (Table~\ref{tab:v8-barriers}). Wrong promotions take precedence. For targets without a promotion, we distinguish functions never queried, correct acceptances blocked by ambiguity or identity conflict, correct top-three pairs never accepted, ranking misses, and absence of the correct source from the candidate pool. Invalid-only comparisons are distinguished from explicit rejection. Counts sum to the number of supported targets not correctly recovered.

\input{data/v8-barriers}

These categories describe observed outcomes under the complete procedure. They do not estimate the independent gain from repairing each stage: changing a match changes later neighborhoods, candidate pools, and conflicts. In particular, accepting more pairs can reduce rejection losses while increasing ambiguity or incorrect propagation.

'''
text += f"The historical minified run correctly recovered {pooled['previousCorrect']}/{pooled['supported']} occurrences ({pooled['previousRecoveryPercent']:.2f}\\%), compared with {pooled['recoveryPercent']:.2f}\\% under the current prompt. Build inputs, POG initialization, ranking, and promotion rules are fixed, but this is a comparison of complete recovery procedures rather than a paired validator ablation: different promotions change subsequent requests. Prompt development used the same library, so these measurements do not establish held-out performance.\n"
reasons, old_reasons = comparison['nonRecoveryReasons'], comparison['previousNonRecoveryReasons']
text += f"\nCorrect top-three candidates that were never accepted decrease from {old_reasons.get('correct_top3_but_never_accepted',0)} to {reasons.get('correct_top3_but_never_accepted',0)}. In contrast, multiple accepted candidates block {reasons.get('correct_accepted_but_multiple_positives',0)} targets, compared with {old_reasons.get('correct_accepted_but_multiple_positives',0)} previously; wrong final identities increase from {old_reasons.get('wrong_source_promoted',0)} to {pooled['wrong']}. The current prompt therefore shifts the main observed barrier from rejection to ambiguity while increasing final identity errors.\n"
text += r'''
\subsection{Execution time}
Table~\ref{tab:v8-runtime} reports recovery time, excluding compilation and embedding preparation. Later builds reuse identical requests from earlier builds. Call counts, cache reuse, and candidate populations vary, limiting direct comparisons of elapsed time.

\input{data/v8-runtime}
'''
(PAPER / 'sections/results.tex').write_text(text)
intro = PAPER / 'sections/introduction.tex'
t = intro.read_text()
start = 'The numerical results reported here retain an early snapshot'
if start in t:
    t = t[:t.index(start)] + 'The evaluation fixes minification on and tree shaking off for three bundlers. All three recovery runs reach a fixed point; we report their recovery, identity accuracy, and observed reasons for incomplete recovery.\n'
intro.write_text(t)
experiment = PAPER / 'sections/experiment.tex'
t = experiment.read_text().replace('The present snapshot answers only part of these questions because most recovery runs have not completed.', 'All three selected recovery configurations have completed; the study remains preliminary because it uses one library and one application.')
t = t.replace(' The historical snapshot in Section~\\ref{sec:results} used the earlier binary-only validator with a 32-token output limit.', ' The archived historical snapshot used an earlier validator; its settings are not applied to the results in Section~\\ref{sec:results}.')
experiment.write_text(t)
limitations = PAPER / 'sections/limitations.tex'
t = limitations.read_text().replace('The completed measurements reported in this snapshot cover only two non-minified configurations.', 'The completed measurements cover three minified configurations with tree shaking disabled.')
t = t.replace('Tool settings, quantization, context limits, and captured-binding excerpts can affect results.', 'Tool settings, quantization, context limits, and unavailable external bindings can affect results.')
limitations.write_text(t)
main = PAPER / 'main.tex'
t = main.read_text()
start = t.index('\\begin{abstract}') + len('\\begin{abstract}')
end = t.index('\\end{abstract}', start)
abstract = ('\nBundling and minification change the names and structure of JavaScript functions, making it difficult to identify library code in a delivered application. '
            'We investigate an iterative approach that combines property-order-graph fingerprints, static function relationships, code embeddings, and language-model judgments. '
            'Distinctive fingerprints establish initial function matches. The approach then ranks source candidates for nearby bundled functions and checks the highest-ranked pairs before adding new matches. '
            'Our validator emits a variable mapping and accepts a pair unless it finds definite evidence of different behavior; this policy is a heuristic and does not prove semantic equivalence. '
            f'We evaluate jQuery across three minified configurations with tree shaking disabled. All three reach a fixed point, correctly identifying {min(rates):.2f}--{max(rates):.2f}\\% of source-map-supported functions. '
            'We retain wrong identities and unassessed predictions separately and classify the remaining recovery barriers. '
            'These preliminary measurements motivate separate evaluation of candidate retrieval, model decisions, and final function matches.\n')
t = t[:start] + abstract + t[end:]
main.write_text(t)
inputs = ['summary.json', 'comparison-summary.json', 'verification.json', 'recovery-bottlenecks/summary.json']
(PAPER / 'data/v8-evidence.json').write_text(json.dumps({'inputs': {n: {'path': str(OUT / n), 'sha256': hashlib.sha256((OUT / n).read_bytes()).hexdigest()} for n in inputs}, 'promptVersion': comparison['promptVersion'], 'builds': builds, 'nonRecoveryReasons': breakdown['aggregate']}, indent=2) + '\n')
print('Updated manuscript from completed, verified v8 results; earlier sources archived at ' + str(archive))
