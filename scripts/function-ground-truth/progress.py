"""Summarize currently completed, matching capture/analysis records."""
import json
from sample_libraries import OUT, write

def optional(file):
    return json.loads(file.read_text()) if file.exists() else {}

def summarize():
    rows=[]
    for select in sorted(OUT.glob('*/*/selection.json')):
        folder=select.parent
        sample=optional(select)
        status=optional(folder/'status.json')
        relations=optional(folder/'relations.json')
        if status.get('stage')!='captured' or relations.get('imageID')!=status.get('imageID'):
            relations={}
        rows.append(dict(subject=str(folder.relative_to(OUT)),selected=len(sample['selected']),
                         stage=status.get('stage','pending'),pageStatus=status.get('pageStatus'),
                         scripts=status.get('scripts'),maps=status.get('maps'),
                         librariesWithMappedPaths=sum(bool(x) for x in relations['coverage'].values()) if relations else None,
                         oneToOnePairs=len(relations['pairs']) if relations.get('pairDefinition')=='reciprocal-mapped-v1' else None,
                         syntaxIdenticalPairs=sum(p.get('syntaxIdentical',True) for p in relations['pairs']) if relations else None,
                         observedSplit=relations.get('observedSplit'),observedCombine=relations.get('observedCombine'),
                         removePercent=None,createPercent=None))
    write(OUT/'progress.json',rows)
    return rows
if __name__=='__main__':
    summarize()
