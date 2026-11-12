"""Build each subject's map variant sequentially and preserve its baseline observation."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path
from run_capture import capture
from sample_libraries import DATA, OUT, EXCLUDED, write

def build(recipe, scratch):
    folder = recipe.parent
    key = str(folder.relative_to(OUT))
    if key in EXCLUDED:
        raise ValueError('Subject excluded from the experiment dataset: ' + key)
    sample = json.loads((folder/'selection.json').read_text())
    tag = 'recall-gt/' + folder.name.lower() + ':' + sample['commit'][:12]
    stage = scratch/key
    stage.mkdir(parents=True, exist_ok=True)
    log = stage/'map-build.log'
    with log.open('w') as stream:
        try:
            subprocess.run(['docker','build','--progress=plain','-t',tag,'-f',str(recipe),str(DATA/'builds'/key)],stdout=stream,stderr=subprocess.STDOUT,check=True,timeout=1800)
        except (subprocess.SubprocessError,OSError) as error:
            write(folder/'map-build.json',{'stage':'build-failed','commit':sample['commit'],'reason':str(error)})
            return
    for name in ('capture','status'):
        baseline = folder/('baseline-'+name+'.json')
        if (folder/(name+'.json')).exists() and not baseline.exists():
            shutil.copyfile(folder/(name+'.json'),baseline)
    capture(key,scratch,tag)
    status=json.loads((folder/'status.json').read_text())
    write(folder/'map-build.json',status)
    if status['stage']=='captured':
        def analyze(script, *extra):
            subprocess.run(['node','--max-old-space-size=6144',str(Path(__file__).with_name(script)),str(folder),str(stage),*extra],check=True)
        if sample.get('samplingRule')=='frontend-visible-v1' or key=='webpack/swagger-api--swagger-ui':
            analyze('sample_frontend.mjs',str(DATA/'builds'/key))
        analyze('relations.mjs')
        analyze('verify_pairs.mjs')
    from progress import summarize
    summarize()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--scratch',required=True,type=Path)
    parser.add_argument('--subject',action='append')
    args=parser.parse_args()
    recipes=[OUT/key/'Dockerfile' for key in args.subject] if args.subject else sorted(OUT.glob('*/*/Dockerfile'))
    for recipe in recipes:
        print('Building',recipe.parent.relative_to(OUT),flush=True)
        build(recipe,args.scratch)
