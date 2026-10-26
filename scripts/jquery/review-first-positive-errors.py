"""Offline review of the 44 incorrect first choices in saved ambiguous queries."""
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'results/jquery-4.0.0/minified-no-tree-shaking-mapping-v8'
OUT = P / 'first-positive-review'
audit = json.loads((P / 'recovery-bottlenecks/summary.json').read_text())
data = json.loads((P / 'detector-input.json').read_text())
refs = {f['id']: f for s in data['sources'] for f in s['functions']}
runs = {b: json.loads((P / 'recovery' / (b + '.json')).read_text()) for b in ['esbuild-min-keep', 'rollup-min-keep', 'webpack-min-keep']}
groups = {
    'empty_noop': [2, 3, 13, 14, 15, 16, 20, 21, 28, 29, 30],
    'local_behavior': [1, 4, 5, 6, 7, 10, 17, 18, 22, 25, 31, 32, 36, 37, 38, 39, 44],
    'function_boundary': [12, 19, 27, 33, 41, 42],
    'external_binding': [8, 9, 11, 23, 24, 26, 34, 35, 40, 43],
}
assert sorted(n for values in groups.values() for n in values) == list(range(1, 45))
findings = {}
def finding(ids, text):
    for i in ids:
        findings[f'A{i:02d}'] = text
finding([1], 'The reference returns its parameter. The candidate calls U.call(this) and returns the result. Mapping parameter p to captured function U ignores parameter position and the additional call. The supported source is toArray, which returns a sliced array.')
finding([2], 'An empty function returns undefined. The candidate returns -1 for a nullish array and otherwise calls indexOf. These are visible return and call differences. The model produced an empty variable mapping and equivalent=true.')
finding([3, 20], 'An empty function returns undefined; the candidate returns [length - 1]. An empty source-variable mapping satisfies the schema but does not check the candidate return expression.')
finding([4, 36], 'The reference invokes qualifier with elem as this and arguments (i, elem), coerces its result to Boolean, and compares with not. The candidate calls indexOf on the qualifier collection, tests whether the index exceeds -1, and compares with not. The model maps qualifier to indexOf while ignoring the different receiver, argument list, and comparison.')
finding([5, 37], 'The third argument to the same mapped winnow helper is true in the reference and false (!1) in the candidate. This changes the filter inversion. The variable mapping is plausible but does not address the differing literal.')
finding([6], 'The reference sorts a sliced collection through jQuery.uniqueSort. The candidate calls winnow with a selector and an inversion flag. Mapping jQuery to ft and slice to parameter e does not establish corresponding operations or argument roles.')
finding([7, 22], 'The reference calls dir(elem, "parentNode") without a stopping condition. The candidate forwards its third parameter as dir(elem, "parentNode", until). The source helper tests until and stops traversal when it matches; the additional argument is behaviorally relevant.')
finding([8, 9, 23, 24], 'The two wrappers have the same local call structure if the external helper names are assumed to correspond. They do not: sibling returns the next matching element, whereas dir traverses and returns an array. The wrong mapping sibling -> bundled dir cannot be disproved from the two wrapper bodies alone; helper identity or helper bodies are needed.')
finding([10], 'The reference calls sibling(elem, "previousSibling"). The candidate calls dir(elem, "previousSibling", until). Both the third argument and the helper identity differ. In this source, sibling returns an element while dir returns an array and uses until to stop traversal.')
finding([11, 26, 40], 'Both bodies return Boolean conversion of an external variable. The model assumes fired corresponds to the bundled variable, but source correspondence identifies that variable as locked. These states are distinct: a callback list can be locked before ever being fired. The wrapper bodies alone cannot establish which binding is used.')
finding([12, 27, 41], 'The reference is the inner resolve(depth, deferred, handler, special) factory, which returns a callback. The candidate is the outer then(onFulfilled, onRejected, onProgress), which contains resolve and returns a new promise. The mapping aligns source variables with variables inside the candidate nested helper rather than comparing the two outer function definitions. Shared nested code does not establish function equivalence.')
finding([13, 28], 'The empty reference returns undefined; the candidate explicitly returns false (!1). There is no external binding needed to see this difference. The accepted model output contains an empty variable mapping.')
finding([14], 'The empty reference has no calls and returns undefined. The candidate calls the event-registration helper with the once flag 1 and returns its result. The empty mapping misses the candidate behavior.')
finding([15, 16, 21, 29], 'The reference is empty and returns undefined. The candidate returns its argument. For any defined argument such as 7, the results differ. The empty source-variable mapping is schema-valid but not evidence of equivalence.')
finding([17, 31], 'The reference get hook explicitly returns null; the candidate set hook has no return value. With elem.parentNode=null the results are null versus undefined. The candidate also reads parent.selectedIndex before the grandparent check, a property read absent from the reference.')
finding([18, 32], 'The reference parameters are (types, selector, data, fn); the candidate delegate wrapper takes (selector, types, data, fn) and calls this.on with the first two arguments reversed. The mapping types -> t, selector -> e reorders observable parameter positions to make names look aligned. This is not a harmless renaming.')
finding([19, 33], 'The reference is the inner function that immediately coerces argument with unary plus. The candidate is the enclosing createPositionalPseudo(fn) factory, which returns that function. The mapping crosses lexical function levels: source argument maps to candidate outer fn, and nested seed/matches are shifted by one level. The additional factory boundary and coercion timing differ.')
finding([25, 39], 'The reference disable method always clears list and memory. The candidate lock method clears them only when neither memory nor firing is set. The missing-versus-present guard is visible in the bodies; outer variables do not explain away unconditional versus conditional writes.')
finding([30], 'The empty reference returns undefined without construction. The candidate calls new Tween.prototype.init(...) and returns an object. An empty mapping does not cover the constructor call or return value.')
finding([34, 35], 'Both bodies call an external regular expression test on elem.nodeName, so their local structures agree under a guessed binding renaming. The actual expressions differ: rinputs=/^(?:input|select|textarea|button)$/i and rheader=/^h\\d$/i. They disagree on H1, for example. The two wrapper bodies do not identify the regex values.')
finding([38], 'The reference forwards its third parameter until to dir; the candidate nextAll wrapper omits it. The mapping assigns until=null and accepts without checking how the missing stopping argument changes traversal. Unused-parameter removal alone is not an adequate explanation because dir uses until.')
finding([42], 'The reference resolve factory returns a callback without executing its body. The candidate is the returned callback itself: calling it runs or schedules processing. The output maps resolve to the string "function" and maps reference parameters to candidate captures, overlooking the removed outer function boundary.')
finding([43], 'The local bodies both call externalStore.remove(elem, name). The model maps dataPriv to the bundled store, but that store corresponds to dataUser. The source initializes dataPriv and dataUser as separate Data instances. Local wrappers cannot establish which state store the candidate accesses.')
finding([44], 'The reference consumes (elem, name) arguments. The candidate consumes this and captured key instead, and declares no parameters. Mapping elem -> this and name -> captured e changes the source of inputs. Its actual store is also dataUser rather than dataPriv. There is a visible argument/receiver difference in addition to the external-store issue.')
assert len(findings) == 44
rows = []
for row in audit['functions']:
    if row['reason'] != 'correct_accepted_but_multiple_positives':
        continue
    run = runs[row['build']]
    qs = [q for q in run['queries'] if q['id'] in row['queryIds'] and q['status'] == 'ambiguous' and row['sourceId'] in q['acceptedCandidates']]
    query = qs[0]
    first = query['acceptedCandidates'][0]
    if first == row['sourceId']:
        continue
    caseid = f'A{len(rows)+1:02d}'
    pair = next(p for p in run['pairs'] if p['queryId'] == query['id'] and p['sourceId'] == first)
    cache = json.loads((P / 'model-cache/validations' / (pair['cacheKey'] + '.json')).read_text())
    user = json.loads(cache['request']['messages'][1]['content'])
    assert user == {'reference_source': refs[first]['code'], 'bundled_function': row['bundleCode']}
    assert cache['verdict'] == 'accept' and cache['request']['think'] is False
    category = next(k for k, ids in groups.items() if int(caseid[1:]) in ids)
    rows.append({'id': caseid, 'build': row['build'], 'query': query['id'], 'bundleId': row['bundleId'], 'wrongSourceId': first, 'wrongName': refs[first]['name'], 'correctSourceId': row['sourceId'], 'correctName': row['sourceName'], 'firstRank': pair['rank'], 'category': category, 'finding': findings[caseid], 'wrongCode': user['reference_source'], 'bundleCode': user['bundled_function'], 'correctCode': row['correctSourceCode'], 'mapping': cache.get('variableMapping'), 'rawContent': cache['response']['message']['content'], 'cacheKey': pair['cacheKey']})
assert len(rows) == 44
OUT.mkdir(exist_ok=True)
(OUT / 'cases.json').write_text(json.dumps(rows, indent=2) + '\n')
names = {'empty_noop': 'Empty noop accepted against nonempty behavior', 'local_behavior': 'Other visible return, call, argument, or guard mismatch', 'function_boundary': 'Wrong nested-function boundary', 'external_binding': 'External binding identity unavailable from the two bodies'}
counts = Counter(r['category'] for r in rows)
md = '''# Review of 44 incorrect first accepted candidates

The first-positive rerun is stopped at the user's request. This review uses the completed unique-positive baseline only; it performs no inference and does not estimate the final first-positive recovery rate.

Population: among the 88 targets blocked by multiple positives, select each target's earliest ambiguous query **containing its supported correct source among the accepted candidates**, then take the first accepted candidate in embedding-rank order. It is correct for 44 targets and incorrect for these 44. This conditional snapshot is not the first query of every target and is not a replay of changed propagation. The 44 build occurrences cover 28 distinct wrong/correct source pairs; 40 first choices are rank 1 and four are rank 2.

The saved validator output is mapping plus verdict, with thinking off and no explanation. Findings below are an analyst's code review, not recovered model reasoning. Variable-map schema completeness does not establish that mapped variables have corresponding roles or lexical scope. Ground truth measures source identity; local mismatches and external-binding mismatches are separated rather than treating all accepted source-distinct pairs as universally semantic negatives.

| Observed failure | Build occurrences | IDs |
|---|---:|---|
'''
for category, ids in groups.items():
    md += '| ' + names[category] + ' | ' + str(counts[category]) + ' | ' + ', '.join(f'[A{i:02d}](A{i:02d}.md)' for i in ids) + ' |\n'
md += '''
There are 34 cases with a visible body/interface or lexical-boundary mismatch and 10 whose locally similar bodies require external-binding evidence. Thus, unresolved outer variables explain a minority of these 44 cases. None of the 44 is classified here as merely interchangeable source identities without an identified distinguishing behavior or dependency.

## Concrete examples

- **A13:** `function() {}` versus `function de(){return !1}`. Returns undefined versus false. The model emitted `{"variable_mapping":{},"equivalent":true}`.
- **A05:** `winnow(this, selector || [], true)` versus `ft(this, e || [], !1)`. The negation flag changes, although the variable mapping looks plausible.
- **A18:** the map swaps `types` and `selector` across parameter positions; the actual wrapper receives them in the opposite order.
- **A12:** the map finds `resolve` inside bundled `then`, then accepts the entire outer function as equivalent to the nested factory. One returns a callback; the other creates and returns a promise.
- **A11:** `return !!fired` versus `return !!o`, where `o` is actually `locked`. Resolving the external binding is necessary.

## Implications for validation

1. Mapping output is a proposed correspondence, not a semantic check. Eleven empty-noop cases have an empty, schema-valid mapping despite visible candidate behavior.
2. Parameter positions, calls, return expressions, literals, guards, and lexical function boundaries need explicit checking. Avoid blindly rejecting differing parameter counts: bundlers can remove unused parameters or specialize calls.
3. Wrapper pairs using different external stores, regexes, state variables, or helpers need binding evidence; comparing the two bodies alone cannot establish their exact source identity.
4. Accepting the first positive removes a filter that currently catches these errors. The 44/88 snapshot is not a prediction of 44 final wrong promotions, because round conflicts and changed propagation still apply.

Source context checked: jQuery ESM distribution lines 1139-1140 (regexes), 2454-2467 (dir), 2787-2790 (sibling), and 3762-3764 (separate Data instances). No model rerun or claim about the model's hidden reasoning is made.

## Individual records

| Case | Build | Accepted wrong reference | Supported correct reference | First accepted rank | Finding |
|---|---|---|---|---:|---|
'''
for r in rows:
    md += f'| [{r["id"]}]({r["id"]}.md) | {r["build"]} | {r["wrongName"]} | {r["correctName"]} | {r["firstRank"]} | {names[r["category"]]} |\n'
    case = f'# {r["id"]}: {r["wrongName"]} accepted instead of {r["correctName"]}\n\n{r["finding"]}\n\n'
    case += '## Reference function supplied to the model\n\n```js\n' + r['wrongCode'] + '\n```\n\n'
    case += '## Bundled function supplied to the model\n\n```js\n' + r['bundleCode'] + '\n```\n\n'
    case += '## Correct source-map-supported reference\n\n```js\n' + r['correctCode'] + '\n```\n\n'
    case += '## Saved model output\n\n```json\n' + r['rawContent'] + '\n```\n\n'
    case += f'Thinking off; no explanation was requested. `{r["build"]}`, `{r["query"]}`, first accepted rank {r["firstRank"]}. [Exact request and raw response](../model-cache/validations/{r["cacheKey"]}.json).\n'
    target = OUT / (r['id'] + '.md')
    marker = '<!-- explanation-replay:start -->'
    previous = target.read_bytes().decode('utf-8') if target.exists() else ''
    if marker in previous:
        case += '\n' + previous[previous.index(marker):]
    target.write_text(case)
index = OUT / 'README.md'
marker = '<!-- explanation-replay-summary:start -->'
previous = index.read_text() if index.exists() else ''
if marker in previous:
    md += '\n' + previous[previous.index(marker):]
index.write_text(md)
print(json.dumps({'cases': len(rows), 'distinctSourcePairs': len({(r['wrongSourceId'], r['correctSourceId']) for r in rows}), 'categories': dict(counts), 'output': str(OUT)}, indent=2))
