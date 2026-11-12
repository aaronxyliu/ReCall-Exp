"""Index every sampled subject, counting only audited, measurable captures."""
import hashlib
from sample_libraries import OUT, EXCLUDED, write
from progress import optional, summarize


def generate():
    subjects = []
    for row in summarize():
        folder = OUT / row['subject']
        sample = optional(folder / 'selection.json')
        subject = dict(repo=sample['repo'], commit=sample['commit'], subject=row['subject'])
        subject.update(oneToOnePairs=None, syntaxIdenticalPairs=None,
                       samplingRule=sample.get('samplingRule','manifest-only-v1'),
                       selectedLibraries=sample['selected'])
        if sample.get('samplingRule') == 'frontend-counterpart-fill-v1':
            subject['sampleCompletion'] = dict(seed=sample['fillSeed'],
                    retainedLibraries=sample['retainedContributors'],
                    candidatePairCounts=sample['candidatePairCounts'],
                    outcome=sample['fillOutcome'])
        if row['stage'] != 'captured':
            reason = row['stage']
        elif not row['selected']:
            reason = 'no-eligible-dependencies'
        elif not row['maps']:
            reason = 'no-captured-maps'
        else:
            records = folder / 'relations.json'
            report = optional(records)
            audit = optional(folder / 'pair-audit.json')
            assert report['pairDefinition'] == 'reciprocal-mapped-v1'
            assert audit['imageID'] == report['imageID'] == optional(folder/'status.json')['imageID']
            assert audit['verifiedPairs'] == len(report['pairs'])
            reason = 'pairs-observed' if report['pairs'] else 'no-pairs-observed-in-capture'
            subject.update(imageID=report['imageID'], records=str(records.relative_to(OUT)),
                           recordsSHA256=hashlib.sha256(records.read_bytes()).hexdigest(),
                           oneToOnePairs=len(report['pairs']),syntaxIdenticalPairs=row['syntaxIdenticalPairs'])
        subject['status'] = reason
        subjects.append(subject)
    assert len(subjects) == 30 - len(EXCLUDED)
    write(OUT/'one-to-one-evaluation.json', dict(pairDefinition='reciprocal-mapped-v1',
          repositoryCount=len(subjects),oneToOnePairs=sum(s['oneToOnePairs'] or 0 for s in subjects),
          syntaxIdenticalPairs=sum(s['syntaxIdenticalPairs'] or 0 for s in subjects),subjects=subjects))


if __name__ == '__main__':
    generate()
