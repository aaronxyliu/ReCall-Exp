import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,now} from './common.mjs';
const dir=path.join(output,'wrong-identity-audit/thinking-replay');
const sample=read(path.join(dir,'sample.json')),status=read(path.join(dir,'execution-status.json'));
const records=sample.tasks.map(t=>{const f=path.join(dir,'requests',t.id+'.json');return fs.existsSync(f)?read(f):null}).filter(Boolean);
const cases=read(path.join(output,'wrong-identity-audit/cases.json')).cases;
const rows=cases.map(c=>{
 const r=records.find(r=>r.id===c.id+'-wrong-pair-thinking'),control=records.find(r=>r.id===c.id+'-counterpart-thinking');
 return {id:c.id,actual:c.expected.name,predicted:c.predicted.name,expectedWrongPairDecision:!['W06','W11','W12'].includes(c.id)?false:true,thinking:r?{decision:r.decision,verdict:r.verdict,valid:typeof r.decision==='boolean',doneReason:r.response?.done_reason,tokens:r.response?.eval_count,thinkingCharacters:r.response?.message?.thinking?.length||0,seconds:r.wallMs/1000}:null,counterpart:control?{decision:control.decision,verdict:control.verdict,doneReason:control.response?.done_reason}:null};
});
const categories={};for(const variant of new Set(records.map(r=>r.variant))){const rs=records.filter(r=>r.variant===variant);categories[variant]={completed:rs.length,valid:rs.filter(r=>typeof r.decision==='boolean').length,correctSemanticDecision:rs.filter(r=>typeof r.decision==='boolean'&&r.decision===r.expectedSemanticDecision).length,accepted:rs.filter(r=>r.decision===true).length,rejected:rs.filter(r=>r.decision===false).length,invalid:rs.filter(r=>r.verdict==='invalid').length,errors:rs.filter(r=>r.verdict==='error').length}}
write(path.join(dir,'summary.json'),{created:now(),status:status.status,completed:records.length,total:sample.tasks.length,selection:sample.selection,comparison:sample.comparison,categories,rows});
let md='# Thinking-enabled replay of audited wrong pairs\n\n';
md+=`Status: **${status.status}**; completed ${records.length}/${sample.tasks.length} diagnostic requests.\n\n`;
md+='The replay preserves the saved validator system prompt, function code, captured bindings, neighboring matches, model digests, temperature, seed, and JSON boolean schema. Thinking is enabled; the output budget is raised from 32 to 8,192 tokens to accommodate reasoning. Two same-budget non-thinking controls are included for W04 and W13. This is an error-selected diagnostic, not a population precision estimate or a think-only causal experiment. Original recovery outputs and oracle labels are unchanged.\n\n';
md+='Ten original pairs have demonstrated behavioral differences. W06, W11, and W12 have the same return-argument call behavior under the audited scope, so true is expected for them even though their exact source identities differ. Correct-counterpart controls change only the reference function and its captured-binding records, retaining the original neighboring context, including any incorrect matches.\n\n';
md+='| Case | Actual origin → originally predicted source | Expected semantic verdict | Thinking verdict | Tokens | Time (s) | Correct counterpart verdict |\n|---|---|---|---|---:|---:|---|\n';
for(const r of rows)md+=`| ${r.id} | ${r.actual} → ${r.predicted} | ${r.expectedWrongPairDecision} | ${r.thinking?.verdict||'pending'} | ${r.thinking?.tokens??'—'} | ${r.thinking?.seconds.toFixed(1)??'—'} | ${r.counterpart?.verdict||'pending'} |\n`;
md+='\nA timeout, malformed output, or token-budget exit without a JSON verdict is not a successful rejection. Model-generated reasoning is diagnostic text, not a guaranteed faithful explanation of the earlier non-thinking response. Compiler stories in that text must be checked against the actual code and source-map audit.\n\n[Machine-readable summary](summary.json), [frozen requests and settings](sample.json), and individual raw responses under `requests/` retain thinking traces separately from final content. The [original code audit](../REPORT.md) supplies independently checked counterexamples.\n';
fs.writeFileSync(path.join(dir,'REPORT.md'),md);
console.log(JSON.stringify({status:status.status,completed:records.length,total:sample.tasks.length,categories},null,2));
