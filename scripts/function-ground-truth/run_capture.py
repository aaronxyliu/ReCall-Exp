"""Open a pinned local image in Chrome, collect scripts and verify their map availability."""
import argparse
import json
import os
import re
import shutil
import subprocess as sp
import tempfile
import time
from pathlib import Path
from sample_libraries import DATA, OUT, GROUPS, EXCLUDED, write

SCRIPTS = Path(__file__).resolve().parent
COMPOSE = {'vite/immich-app--immich':'frontend','vite/LibreChat-AI--LibreChat':'app',
           'webpack/dokploy--dokploy':'panel'}
SECRET_FILES = {'vite/LibreChat-AI--LibreChat':'librechat.env','webpack/dokploy--dokploy':'dokploy.env'}


def run(args, **kw):
    return sp.run(args, check=True, text=True, **kw)


def capture(key, scratch, image=None):
    if key in EXCLUDED:
        raise ValueError("Subject excluded from the experiment dataset: " + key)
    recipe = DATA/'bundling-dataset'/key
    dest = OUT/key
    source = json.loads((recipe/'subject.json').read_text())
    prior = json.loads((recipe/'result.json').read_text())
    status = {'repo':source['repo'],'commit':source['commit'],'image':image or prior['image']}
    if prior['status']=='configuration-required':
        write(dest/'status.json',dict(status,stage='configuration-required',reason=prior['reason']))
        return
    rawdir = scratch/key
    rawdir.mkdir(parents=True,exist_ok=True)
    manifest = rawdir/'capture.json'
    cleanup = []
    try:
        status['imageID']=run(['docker','image','inspect','--format','{{.Id}}',status['image']],capture_output=True).stdout.strip()
        route = prior['route']
        if key in COMPOSE:
            cli = [os.environ['COMPOSE_BIN']] if os.environ.get('COMPOSE_BIN') else ['docker','compose']
            cli += ['-p','recall-gt-'+recipe.name.lower().replace('--','-'),'-f',str(recipe/'compose.yaml')]
            if key in SECRET_FILES: cli += ['--env-file',str(DATA/'builds/.runtime'/SECRET_FILES[key])]
            override=rawdir/'override.json'
            write(override,{'services':{COMPOSE[key]:{'image':status['image']}}})
            cli+=['-f',str(override)]
            cleanup=cli+['down']
            run(cli+['up','-d','--no-build'],stdout=sp.DEVNULL)
            host='127.0.0.1:8080'
        else:
            readme=(recipe/'README.md').read_text()
            port=re.search(r'127\.0\.0\.1:8080:(\d+)',readme)[1]
            cid=run(['docker','run','-d','-p',f'127.0.0.1::{port}',status['image']],capture_output=True).stdout.strip()
            cleanup=['docker','rm','-f',cid]
            host=run(['docker','port',cid,port+'/tcp'],capture_output=True).stdout.strip()
        url='http://'+host+route
        for _ in range(60):
            if sp.run(['curl','-fsSL','--max-time','2',url,'-o','/dev/null'],capture_output=True).returncode==0:break
            time.sleep(1)
        run(['node','--max-old-space-size=6144',str(SCRIPTS/'capture.mjs'),url,str(rawdir),str(manifest)],timeout=360)
        doc=json.loads(manifest.read_text())
        doc.update(repo=source['repo'],commit=source['commit'],imageID=status['imageID'])
        write(dest/'capture.json',doc)
        status.update(stage='captured',scripts=len(doc['assets']),
                      maps=sum(a['map']['status']=='map-found' for a in doc['assets']),
                      pageStatus=doc['pageStatus'],title=doc['title'],bodyTextLength=doc['bodyTextLength'])
    except Exception as error:
        status.update(stage='capture-failed',reason=str(error)[:600])
    finally:
        if cleanup:sp.run(cleanup,stdout=sp.DEVNULL,stderr=sp.DEVNULL)
        write(dest/'status.json',status)
    print(key,status['stage'],status.get('maps'),status.get('scripts'),flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--scratch',required=True,type=Path)
    ap.add_argument('--subject',action='append')
    ap.add_argument('--image',help='Override the image for one subject')
    args=ap.parse_args()
    keys=args.subject or [f'{g}/{p.parent.name}' for g in GROUPS for p in sorted((OUT/g).glob('*/selection.json'))]
    if args.image and len(keys)!=1:ap.error('--image requires one --subject')
    for k in keys:capture(k,args.scratch,args.image)
