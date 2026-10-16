# 10-100x runner study + strategy search on the 2-month multi-source universe (15m candles from launch).
import json,glob,random,sys,statistics as st;exec(open('scripts/bt-ohlcv.py').read())
T=[]
for f in glob.glob('/workspace/bt/u2/*.json'):
  if f.endswith('_pools.json'):continue
  d=json.load(open(f));b=[x for x in d.get('bars') or [] if x[0]>=d['created']-900]
  b=[[t,o,min(h,2*max(o,c)),max(l,min(o,c)/2),c,v] for t,o,h,l,c,v in b if o>0 and c>0]  # clip bad wicks
  ok=all(0.05<b[i][4]/b[i-1][4]<20 for i in range(1,len(b))) if b else False  # drop tokens with broken price feeds
  if len(b)>=8 and ok:d['bars']=b;T.append(d)
T.sort(key=lambda d:d['created'])
def early(d,k=4):  # what was visible after k bars (k*15 min)
  b=d['bars'][:k];c=b[-1][4];usd=sum(x[5] for x in b)
  return dict(vol=usd,acc=b[-1][5]/max(1,b[0][5]),ch=(c/b[0][1]-1)*100,green=sum(x[4]>x[1] for x in b),dd=(min(x[3] for x in b)/max(x[2] for x in b)-1)*100,dex=d['dex'])
def maxx(d,k=4):b=d['bars'];e=b[k-1][4];return max(x[2] for x in b[k:])/e if len(b)>k else 0
if __name__=='__main__' and 'study' in sys.argv:
  print('universe',len(T),'tokens; by source',{x:sum(d['dex']==x for d in T) for x in sorted({d['dex'] for d in T})})
  for k,lab in [(4,'1h'),(8,'2h')]:
    X=[(maxx(d,k),early(d,k)) for d in T]
    r10=[e for m,e in X if m>=10];r100=[e for m,e in X if m>=100];dud=[e for m,e in X if m<1.5]
    print(f'\nentry at {lab} after launch: {len(r10)} reached 10x+, {len(r100)} reached 100x+, {len(dud)} never reached 1.5x (of {len(X)})')
    for key in ['vol','acc','ch','green','dd']:
      md=lambda L:st.median([e[key] for e in L]) if L else 0
      print(f'  {key:6s} median  10x+: {md(r10):10.1f}   100x+: {md(r100):10.1f}   duds: {md(dud):10.1f}')
    src={}
    for m,e in X:s=src.setdefault(e['dex'],[0,0]);s[0]+=1;s[1]+=m>=10
    print('  10x rate by source:',{k:f'{v[1]}/{v[0]}' for k,v in src.items()})
def run(toks,E,X,size=0.05):
  o=[]
  for d in toks:
    b=d['bars']
    for i in range(E['k']-1,min(len(b)-2,E['k']-1+E['win'])):
      e=early(dict(d,bars=b[:i+1]),min(4,i+1))
      if e['vol']>=E['vol'] and e['acc']>=E['acc'] and E['chMin']<=e['ch']<=E['chMax'] and e['green']>=E['green'] and e['dd']>=E['dd']:
        x,pk=sim(b[i:],{**X,'bar':15});x=min(x,100);o.append((b[i][0],(x-1)*100-COST,pk,x));break
  return o
def rep(o,size):
  if not o:return 'n=0'
  o=sorted(o);n=len(o);eq=0;pk=0;dd=0
  for _,p,_,_ in o:eq+=p*size/100;pk=max(pk,eq);dd=min(dd,eq-pk)
  a=sum(p for _,p,_,_ in o)/n;spent=n*size
  return f'n={n:3d} win {100*sum(p>0 for _,p,_,_ in o)/n:3.0f}% net {eq:+.3f} SOL ({a:+.1f}%/trade, {1+a/100:.2f}x) maxDD {dd:.3f} SOL · held through 10x: {sum(pk>=10 for _,_,pk,_ in o)} · exits ≥10x: {sum(x>=10 for *_,x in o)} ≥3x: {sum(x>=3 for *_,x in o)}'
C7=dict(sl=30,ladder=[(2,.5),(5,.25)],trail1=15,trail2=15,pct2=1,arm=0,armMin=1e9,maxH=8,be=True)
BIGX=dict(sl=25,ladder=[(1.5,0.5)],trail1=25,trail2=40,pct2=1,arm=30,armMin=3,lockAt=20,lockPct=3,flatMin=50,maxH=24,be=True)
E0=dict(k=4,win=1,vol=0,acc=0,chMin=-1e9,chMax=1e9,green=0,dd=-100)
rE=lambda:dict(k=random.choice([2,4,8,16]),win=random.choice([1,4,16,96]),vol=random.choice([0,5e3,2e4,5e4,1e5]),acc=random.choice([0,1,2,4]),chMin=random.choice([-50,0,20,50,100]),chMax=random.choice([100,300,1000,1e9]),green=random.choice([0,2,3]),dd=random.choice([-100,-50,-30]))
def rX():
  return dict(sl=random.choice([15,20,25,30,40]),ladder=random.choice([[(2,.25)],[(2,.5)],[(3,.33)],[(2,.25),(5,.25)],[(2,.3),(10,.3)],[(3,.25),(10,.25)],[(5,.5)]]),trail1=random.choice([0,20,30]),trail2=random.choice([30,40,50,60]),pct2=1,pctTrail=random.choice([0,1]),arm=random.choice([30,50,100]),armMin=1e9,maxH=random.choice([24,72,168,240]),be=random.choice([True,False]))
if __name__=='__main__' and 'search' in sys.argv:
  random.seed(11);cut=int(len(T)*.6);TR,TS=T[:cut],T[cut:];print('train',len(TR),'holdout',len(TS))
  for n,E,X in [('current Moonbag exits, buy at 1h',E0,C7),('current Big Play exits, buy at 1h',E0,BIGX)]:print(f'{n:36s} TRAIN {rep(run(TR,E,X),.05)}\n{"":36s} HOLD  {rep(run(TS,E,X),.05)}')
  R=[]
  for _ in range(int(sys.argv[2]) if len(sys.argv)>2 else 1500):
    E,X=rE(),rX();o=run(TR,E,X)
    if len(o)<25:continue
    R.append((sum(p for _,p,_,_ in o),E,X))
  R.sort(key=lambda r:-r[0]);H=[]
  for s,E,X in R[:40]:h=run(TS,E,X);H.append((sum(p for _,p,_,_ in h),E,X,h))
  json.dump([(a,E,X) for a,E,X,_ in sorted(H,key=lambda r:-r[0])],open('/workspace/bt/runner_best.json','w'))
  for hs,E,X,h in sorted(H,key=lambda r:-r[0])[:6]:print(f'\nTRAIN {rep(run(TR,E,X),.05)}\nHOLD  {rep(h,.05)}\n entry {E}\n exit {X}')
