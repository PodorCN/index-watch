"""Sites source synchronization. Credentials arrive through hidden stdin only."""
import json,os,subprocess,sys,tarfile,termios
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
if sys.stdin.isatty():
    attrs=termios.tcgetattr(sys.stdin.fileno());attrs[3]&=~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,attrs)
print('Ready for Site workflow JSON on stdin (input is hidden).',flush=True)
request=json.loads(sys.stdin.readline())
credential=request['credential'];token=credential.get('token','')
manifest=json.loads((ROOT/'.openai/hosting.json').read_text())
assert manifest['project_id']==request['project_id']
env=os.environ.copy();env['GIT_TERMINAL_PROMPT']='0'
env.pop('GIT_TRACE_CURL',None);env.pop('GIT_CURL_VERBOSE',None)
if token:
    env['GIT_CONFIG_COUNT']='1';env['GIT_CONFIG_KEY_0']='http.extraHeader'
    env['GIT_CONFIG_VALUE_0']='Authorization: Bearer '+token

def run(args):
    r=subprocess.run(args,cwd=ROOT,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if r.returncode:
        print(json.dumps({'error':'command_failed','command':args[:2],
                          'output':(r.stdout+r.stderr).replace(token,'[redacted]')[-1600:] if token else (r.stdout+r.stderr)[-1600:]}),flush=True)
        sys.exit(r.returncode)
    return r.stdout.strip()

branch=credential.get('branch','main')
if not (ROOT/'.git').exists():run(['git','init','-b',branch])
run(['git','config','user.name','Codex'])
run(['git','config','user.email','codex@users.noreply.openai.com'])
existing=run(['git','remote'])
if 'origin' not in existing.splitlines():run(['git','remote','add','origin',credential['remote_url']])
else:run(['git','remote','set-url','origin',credential['remote_url']])
heads=run(['git','ls-remote','--heads','origin',branch])
if heads:
    run(['git','fetch','origin',branch])
    if not run(['git','rev-parse','--is-inside-work-tree']):raise RuntimeError('No checkout')
    # A newly provisioned Site can have an initial source commit; retain its
    # ancestry while importing the complete prepared implementation.
    has_head=subprocess.run(['git','rev-parse','--verify','HEAD'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    if not has_head:run(['git','reset','--soft','FETCH_HEAD'])
run(['git','add','--all'])
run(['git','diff','--cached','--check'])
if run(['git','status','--porcelain']):run(['git','commit','-m','Build Macro Lens cross-asset research dashboard with verified market histories'])
sha=run(['git','rev-parse','HEAD'])
run(['git','push','--set-upstream','origin',branch])
remote_sha=run(['git','ls-remote','origin','refs/heads/'+branch]).split()[0]
assert remote_sha==sha,'Published source HEAD must match the built commit'
archive=Path(request['archivePath']);archive.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(archive,'w:gz') as tar:
    tar.add(ROOT/'.openai/hosting.json',arcname='.openai/hosting.json')
    for path in sorted((ROOT/'dist').rglob('*')):
        if path.is_file():tar.add(path,arcname=str(path.relative_to(ROOT)))
print(json.dumps({'project_id':manifest['project_id'],'commit_sha':sha,'archive':str(archive),'archive_bytes':archive.stat().st_size,'checkout_path':str(ROOT)}),flush=True)
