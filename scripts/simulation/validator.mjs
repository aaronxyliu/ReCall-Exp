// Evaluation-only adapter. Never import this oracle into ReCall's graph builder.
import {createModelClient} from '../../../ReCall/components/pipeline/models.mjs';
import {hash} from '../../../ReCall/src/shared/artifacts.mjs';
export function oracleIndex(source,bundle,pairs){
 const units=new Map(source.units.map(u=>[u.id,u])),sourceKeys=new Map(source.functions.map(f=>[f.id,JSON.stringify([f.library?.name,hash(units.get(f.unit).code),f.codeSpan||f.span])])),targetKeys=new Map(bundle.functions.map(f=>[f.id,JSON.stringify([f.unit,f.codeSpan||f.span])])),expected=new Map();
 for(const p of pairs){const split=id=>{const m=/^(.*)#([a-f0-9]{64})@(\d+)-(\d+)$/.exec(id);if(!m)throw Error('Invalid ground-truth identity');return m};const s=split(p.source),b=split(p.bundled);expected.set(JSON.stringify([b[1]+'#'+b[2],[+b[3],+b[4]]]),JSON.stringify([p.library,s[2],[+s[3],+s[4]]]));}
 return {sourceKeys,targetKeys,expected,decision:(sid,bid)=>{const t=targetKeys.get(bid);return !expected.has(t)?'unassessed':expected.get(t)===sourceKeys.get(sid)?'accept':'reject'}};
}
export function simulationClient(options,index){
 // The underlying client handles embeddings only. Do not even require metadata
 // for a validation model; this adapter never calls the underlying validate().
 const embeddingModel=options.embeddingModel||'qwen3-embedding:0.6b',base=createModelClient({...options,embeddingModel,validationModel:embeddingModel}),oracleStats={calls:0,accept:0,reject:0,unassessed:0};
 return {config:{...base.config,validationModel:'ground-truth-simulation'},stats:base.stats,oracleStats,embed:base.embed,metadata:base.metadata,get modelDigests(){return base.modelDigests},async validate({source,bundle}){const outcome=index.decision(source.id,bundle.id);oracleStats.calls++;oracleStats[outcome]++;return {verdict:outcome==='accept'?'accept':'reject',validator:'ground-truth-simulation',oracleOutcome:outcome,policy:'Exact ground-truth identity; unassessed candidates cannot be promoted. Embedding ranking and top-k are unchanged.'}}};
}
export function scoreSimulation(index,recovery){
 const predictions=new Map();for(const p of recovery.promotions){const t=index.targetKeys.get(p.bundleId);if(!predictions.has(t))predictions.set(t,new Set());predictions.get(t).add(index.sourceKeys.get(p.sourceId))}
 const available=new Set(index.sourceKeys.values()),targets=new Set(index.targetKeys.values());let correct=0,assessed=0;for(const [t,s]of index.expected){const ps=predictions.get(t)||new Set();if(ps.has(s))correct++;assessed+=ps.size}
 return {denominator:index.expected.size,correct,recoveryRate:correct/index.expected.size,assessedPredictions:assessed,precision:assessed?correct/assessed:null,missingSourceCounterparts:[...index.expected.values()].filter(s=>!available.has(s)).length,missingTargetCounterparts:[...index.expected.keys()].filter(t=>!targets.has(t)).length};
}

// Evaluation preflight: abort a mismatched experiment; never filter its denominator
// or remove functions/candidates according to oracle membership.
export function requireAlignedInputs(index){
 const sourceKeys=new Set(index.sourceKeys.values()),targetKeys=new Set(index.targetKeys.values());
 const missingSources=[...index.expected].filter(([,s])=>!sourceKeys.has(s));
 const missingTargets=[...index.expected.keys()].filter(t=>!targetKeys.has(t));
 if(missingSources.length||missingTargets.length)throw Error(`Ground-truth input alignment failed: ${missingSources.length} missing source counterparts, ${missingTargets.length} missing target counterparts. Use the same source corpus and representation as collection; do not drop these pairs.`);
 return {groundTruthPairs:index.expected.size,sourceCounterparts:index.expected.size,targetCounterparts:index.expected.size};
}
