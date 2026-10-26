import fs from 'node:fs';
import path from 'node:path';
import {output,read,write,now} from './common.mjs';
process.env.VALIDATOR_THINK='true';
const {validate}=await import('./models.mjs');
const folder=path.join(output,'thinking-pairwise-diagnostic');fs.mkdirSync(folder,{recursive:true});
const batchSample=read(path.join(output,'thinking-diagnostic/sample.json'));
const digests=read(path.join(output,'calibration-nonthinking-v3/recovery/esbuild-readable-keep.json')).modelDigests;
const sampleFile=path.join(folder,'sample.json');let sample;
if(fs.existsSync(sampleFile))sample=read(sampleFile);
else{const pairs=batchSample.batches.map(b=>{let p;if(b.stratum==='accepted-wrong-identity')p=b.pairs.find(p=>p.verdict==='accept'&&p.oracle==='wrong');if(b.stratum==='accepted-correct-identity')p=b.pairs.find(p=>p.verdict==='accept'&&p.oracle==='correct');p||=b.pairs.find(p=>p.oracle==='correct')||b.pairs[0];return {...p,stratum:b.stratum}});sample={created:now(),selection:'One fixed pair from each previously preregistered diagnostic batch: prioritize its declared error/correct stratum, then the oracle counterpart if available. Diagnostic, not an unbiased precision estimate.',pairs};write(sampleFile,sample)}
const results=[];
for(const p of sample.pairs){const file=path.join(folder,p.requestKey+'-'+p.rank+'.json');let result;if(fs.existsSync(file))result=read(file);else{
 const batch=read(path.join(output,'model-cache/validations',p.requestKey+'.json')),u=JSON.parse(batch.request.messages[1].content),candidate=u.reference_candidates[p.rank-1];
 const start=now(),decision=await validate({code:u.bundled_function,captures:u.bundle_captures},{code:candidate.code,captures:candidate.captures},u.supported_neighbor_correspondences,digests);
 result={started:start,finished:now(),pair:p,decision};write(file,result)}
 results.push(result);write(path.join(folder,'results.json'),{created:now(),status:results.length===sample.pairs.length?'complete':'running',selection:sample.selection,results});console.log('pairwise thinking',results.length,'/',sample.pairs.length,p.stratum,result.decision.verdict,Math.round(result.decision.wallMs||0)+'ms',result.decision.response?.eval_count+' tokens');
}
const accepted=results.filter(r=>r.decision.verdict==='accept'),correct=accepted.filter(r=>r.pair.oracle==='correct').length,wrong=accepted.filter(r=>r.pair.oracle==='wrong').length;
write(path.join(folder,'summary.json'),{created:now(),selection:sample.selection,pairs:results.length,accepted:accepted.length,correctAccepted:correct,wrongAccepted:wrong,unassessedAccepted:accepted.length-correct-wrong,uncertain:results.filter(r=>r.decision.verdict==='uncertain').length,invalid:results.filter(r=>r.decision.verdict==='invalid').length,errors:results.filter(r=>r.decision.verdict==='error').length,conditionalAcceptedIdentityPrecision:correct+wrong?100*correct/(correct+wrong):null,results});
