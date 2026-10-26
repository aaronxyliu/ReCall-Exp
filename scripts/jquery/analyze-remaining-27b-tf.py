"""Offline analysis of the eleven remaining 27B T/F acceptances; no model calls."""
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8'
REVIEW = P / 'first-positive-review'
OUT = REVIEW / 'verdict-only-27b-tf'
def read(path):
    return json.loads(path.read_text())
records = [r for r in read(OUT / 'results.json')['records'] if r['decision'] is True]
assert len(records) == 11
cases = {r['id']: r for r in read(REVIEW / 'cases.json')}
earlier = {r['id']: r for r in read(REVIEW / 'explanation-replay-27b/results.json')['records']}
detector = read(P / 'detector-input.json')
refs = [f for source in detector['sources'] for f in source['functions']]
ref_by_id = {f['id']: f for f in refs}
truth = {r['bundleId']: r for r in read(P / 'ground-truth.json')['records']}
groups = {
    'different_external_helper': ['A08', 'A09', 'A23', 'A24'],
    'different_captured_state': ['A11'],
    'different_external_regex': ['A34', 'A35'],
    'different_data_store': ['A43'],
    'nested_function_boundary': ['A19', 'A33', 'A42'],
}
labels = {
    'different_external_helper': 'Different external helper functions',
    'different_captured_state': 'Different captured state flags',
    'different_external_regex': 'Different external regular expressions',
    'different_data_store': 'Different state-store instances',
    'nested_function_boundary': 'Outer function confused with a nested function',
}
findings = {
    'different_external_helper': 'The bodies agree only after assuming sibling corresponds to the bundled helper. The saved bundled helper definition is dir: it traverses and returns an array. Source sibling returns one adjacent element. The omitted helper binding changes the result type and traversal extent.',
    'different_captured_state': 'The model assumes fired corresponds to the bundled variable, but the candidate is the locked method and reads the locked flag. A callback list locked before its first fire has fired=false and locked=true. The wrapper alone does not establish which state flag is read.',
    'different_external_regex': 'Both wrappers call regex.test(elem.nodeName), but the regex values differ. rinputs matches input/select/textarea/button; rheader matches heading names such as H1. The omitted initializer determines the behavior.',
    'different_data_store': 'Both wrappers invoke store.remove(elem,name), but the candidate uses dataUser and the wrong reference uses dataPriv. The two separate new Data() allocations have different expando identifiers and maintain different state. An identical constructor name or method signature does not establish object identity.',
    'nested_function_boundary': 'The candidate and wrong reference share code at different lexical function levels. Similar nested bodies do not make their enclosing functions equivalent. The corresponding calls return or execute different functions.',
}
rows = []
for r in records:
    case = cases[r['id']]
    bundle = next(b for b in detector['bundles'] if b['build'] == case['build'])
    functions = bundle['functions']
    by_id = {f['id']: i for i, f in enumerate(functions)}
    target = functions[by_id[case['bundleId']]]
    source = ref_by_id[case['wrongSourceId']]
    correct = ref_by_id[case['correctSourceId']]
    category = next(k for k, ids in groups.items() if r['id'] in ids)
    row = {'id': r['id'], 'build': case['build'], 'bundleId': case['bundleId'], 'wrongSourceId': case['wrongSourceId'], 'correctSourceId': case['correctSourceId'], 'wrongName': case['wrongName'], 'correctName': case['correctName'], 'category': category, 'finding': findings[category], 'staticBundleName': target['name'], 'wrongReferenceCaptures': source['captures'], 'bundleCaptures': target['captures'], 'earlierExplanation': earlier[r['id']]['explanation'], 'earlierMapping': earlier[r['id']]['variableMapping'], 'tfRawOutput': r['response']['message']['content'], 'targetOracle': truth[target['id']]}
    if r['id'] in ['A19', 'A33']:
        child_oracles = [g for g in truth.values() if g['build'] == case['build'] and g.get('sourceId') == case['wrongSourceId'] and g['bundleId'] in by_id and functions[by_id[g['bundleId']]]['parent'] == by_id[target['id']]]
        assert len(child_oracles) == 1
        row['nestedCounterpartEvidence'] = {'kind': 'wrong reference maps to direct child of candidate', 'oracle': child_oracles[0], 'candidateRootCode': target['code']}
        row['finding'] = 'The wrong reference is the inner argument-taking function; the candidate is the enclosing createPositionalPseudo(fn) factory. Source argument coercion happens on this call, while the candidate returns a wrapper and performs coercion on a later call. The saved map aligns source argument with a nested candidate parameter (A19), or incorrectly with the outer fn parameter (A33). A directly nested bundled function, not the outer candidate, has the supported wrong-reference identity.'
    elif r['id'] == 'A42':
        assert refs[correct['parent']]['id'] == source['id']
        parent = functions[target['parent']]
        row['nestedCounterpartEvidence'] = {'kind': 'candidate is returned callback; wrong reference is its source factory', 'sourceCorrectParent': source['id'], 'bundleParentCode': parent['code'], 'bundleParentOracle': truth[parent['id']]}
        row['finding'] = 'Source resolve(depth,deferred,handler,special) returns a callback. The bundled candidate is that callback itself and runs or schedules resolution when invoked. The factory is still present as the enclosing bundled function a(t,n,r,i). Earlier mapping aligns source parameters with candidate captures and sets resolve=null, ignoring the extra invocation boundary. Its parent has one own-body source-map point voting for resolve, so that parent remains unresolved under the two-point oracle threshold; the inner target has a supported identity.'
    rows.append(row)
assert set(r['id'] for r in rows) == {i for ids in groups.values() for i in ids}
summary = {'total': len(rows), 'distinctWrongCorrectSourcePairs': len({(r['wrongSourceId'], r['correctSourceId']) for r in rows}), 'missingExternalBindingContext': 8, 'nestedFunctionBoundaryErrors': 3, 'categories': dict(Counter(r['category'] for r in rows)), 'scope': 'Analyst review of saved code, source-map evidence and prior 27B explanations. The current T/F responses contain no explanation. No inference or full recovery is run.'}
(OUT / 'remaining-acceptances.json').write_text(json.dumps({'summary': summary, 'cases': rows}, indent=2) + '\n')
md = '''# Why 27B still accepts these 11 pairs

**Eight cases lack decisive external-binding context; three confuse nested-function boundaries.** The 11 build occurrences cover eight distinct wrong/correct source-function pairs. This is an offline code review, not a new model experiment. The current model returned only T, so its internal reason is unavailable. Earlier explanations below are corroborating observations from a different output condition, not asserted explanations of the T/F run.

The source-distinct labels are consistent with identifiable differences in actual program context. These are not simply duplicate implementations that happen to be behaviorally interchangeable. The eight external cases are structurally similar under an assumed binding renaming, but that assumption is false in the actual program.

| Observed issue | Count | Cases |
|---|---:|---|
'''
for key, ids in groups.items():
    md += '| ' + labels[key] + ' | ' + str(len(ids)) + ' | ' + ', '.join('[' + i + '](../' + i + '.md)' for i in ids) + ' |\n'
md += '''
## 1. External helper identity: four cases

```js
// Wrong reference: next
function(elem) { return sibling(elem, "nextSibling"); }
// Bundled nextAll
function(e) { return ae(e, "nextSibling"); }
```

The model's earlier output explicitly assumes `sibling -> ae` (or `Me`). The saved capture initializer shows that ae/Me implements dir. Source sibling returns a single element; dir accumulates an array of matching elements. For two following element siblings B and C, the results are B versus [B, C]. The same distinction applies to prev/prevAll. The helper implementation was already available to the analysis but was omitted from the two-function user message.

## 2. Captured state: one case

```js
function() { return !!fired; } // wrong reference
function() { return !!o; }     // bundled locked method
```

The earlier model guessed `fired -> o`. In the actual Callbacks object, o is locked. Calling lock before fire gives fired=false and locked=true. Boolean-conversion syntax does not identify which state flag is read.

## 3. Regex values: two cases

```js
rinputs = /^(?:input|select|textarea|button)$/i;
rheader = /^h\\d$/i;
```

The wrapper bodies only show a call to `.test(elem.nodeName)`. A34 guesses rinputs -> ye, but ye is the heading regex; A35 makes the reverse mistake. For nodeName H1, the input regex returns false and the heading regex returns true. The initializer is decisive and small enough to supply without an entire enclosing function.

## 4. State-store identity: one case

```js
function(elem, name) { dataPriv.remove(elem, name); } // wrong
function(e, t) { ot.remove(e, t); }                 // ot is dataUser
```

Both stores are constructed with `new Data()`, but they are separate objects. The source constructor assigns each instance its own expando identifier using Data.uid++. Removing a key from the private cache does not remove the corresponding user-cache key. Supplying only the common constructor/type is insufficient: the analysis needs the particular allocation or an enclosing-scope binding correspondence.

## 5. Nested function boundaries: three cases

For A19/A33, compare the function levels (abridged and renamed for readability):

```js
// Wrong reference: inner function
function(argument) {
    argument = +argument;
    return markFunction(function(seed, matches) { /* match loop */ });
}

// Candidate: outer factory
function createPositionalPseudo(fn) {
    return markFunction(function(argument) {
        argument = +argument;
        return markFunction(function(seed, matches) { /* match loop */ });
    });
}
```

The model recognizes the shared inner code and overlooks the enclosing factory. The argument roles and the timing of coercion differ. For both cases, source-map evidence maps the wrong reference to a direct child of the candidate, not to the candidate itself.

For A42, the error is in the opposite direction:

```js
// Wrong reference: factory
function resolve(depth, deferred, handler, special) {
    return function() { /* run or schedule resolution */ };
}
// Candidate: the returned callback
function() { /* run or schedule resolution */ }
```

Calling the first creates and returns a function; calling the second executes or schedules work. The factory remains an enclosing AST node in the bundle. Its own source-map label has only one point and is unresolved under the existing threshold; this evidence limitation is retained rather than relabeled. The current target is the supported inner callback. The earlier explanation concentrates on shared internal control flow and does not account for the invocation boundary.

## Why this persists, and what information could help

The prompt explicitly defaults to equivalent when an external binding is unknown. Thus, the eight external cases expose an input/policy limitation: there is no evidence in the two function bodies establishing the proposed binding correspondence. Increasing model size cannot supply missing identity evidence reliably. This differs from the three factory/callback cases, whose lexical boundary mismatch is visible in the input.

For these eight external cases, the static inventory also retains distinguishing member names: nextAll/prevAll, locked, header/input, and removeData. They come from AST property/assignment context, not source maps, but are not included in the model user message. Combining a preserved member key with an already matched owner is a compact possible identity check. It has not been tested as a recovery-policy change and is not a general guarantee that names survive or are unique.

Useful next checks are: (1) require correspondence for a behavior-determining external helper, value or object before promotion, or supply that small resolved definition; (2) check surrounding member keys when preserved; and (3) compare the root function's parameters, captures and return structure at the same lexical level. Parameter count alone is not a safe rejection rule because compilation can remove unused parameters or specialize calls. For unresolved bindings, delay identity promotion rather than treating a guessed renaming as an established correspondence.

No prompt change, additional model call, or recovery rerun is made by this analysis.

## Per-case evidence

| Case | Accepted wrong source | Supported source | Static bundled name | Finding |
|---|---|---|---|---|
'''
for row in rows:
    md += '| [' + row['id'] + '](../' + row['id'] + '.md) | ' + row['wrongName'] + ' | ' + row['correctName'] + ' | ' + row['staticBundleName'] + ' | ' + labels[row['category']] + ' |\n'
    file = REVIEW / (row['id'] + '.md')
    marker = '<!-- remaining-27b-tf-analysis:start -->'
    original = file.read_bytes().decode('utf-8').split(marker)[0].rstrip()
    text = '\n\n' + marker + '\n## Analysis of remaining T/F acceptance\n\n' + row['finding'] + '\n\n'
    text += 'Static bundled member/function name: `' + row['staticBundleName'] + '`; wrong reference: `' + row['wrongName'] + '`. The T/F run has no explanation; this is analyst review using the actual program context and earlier saved evidence.\n\n[Full remaining-case analysis](verdict-only-27b-tf/REMAINING_ACCEPTANCES.md). No new validation was run.\n<!-- remaining-27b-tf-analysis:end -->\n'
    file.write_text(original + text)
md += '\n[Structured capture and nesting evidence](remaining-acceptances.json), [full T/F comparison](REPORT.md).\n'
(OUT / 'REMAINING_ACCEPTANCES.md').write_text(md)
for name in ['REPORT.md', 'ANALYSIS.md']:
    file = OUT / name
    link = '\n[Detailed analysis of the 11 remaining acceptances](REMAINING_ACCEPTANCES.md).\n'
    text = file.read_text()
    if link not in text:
        file.write_text(text + link)
print(json.dumps(summary, indent=2))
