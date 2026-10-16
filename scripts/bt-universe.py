# Universe search: every token the bot ever saw (bought, skipped, missed). Real 5m candles. Random search on the
# earlier 60% (by time), judged on the later 40% holdout. Costs 1.5% per trade. Stops checked before targets in a bar.
import json,random,sys;exec(open('scripts/bt-ohlcv.py').read())
U={}
for f in ['observations.jsonl','missed.jsonl','trades.jsonl','big_shadow.jsonl']:
  for l in open(D+f):
    o=json.loads(l);m=o['mint'];t=o.get('t') or o.get('opened');u=U.setdefault(m,{'t':t,'sym':o.get('symbol'),'safety':None,'f':None,'tier':None,'bought':False})
    u['t']=min(u['t'],t)
    if o.get('safety') is not None:u['safety']=max(u['safety'] or 0,o['safety'])
    if o.get('f'):u['f']=o['f']
    if o.get('tier') and o['tier']!='SKIP':u['tier']=o['tier']
    if f=='trades.jsonl':u['bought']=True
R=[]
for m,u in U.items():
  try:A=json.load(open(C+m+'.json')).get('bars',[])
  except:continue
  pre=[b for b in A if b[0]*1000<u['t']-300000][-12:];post=[b for b in A if b[0]*1000>=u['t']-300000][:300]
  if len(post)<3:continue
  run60=(pre[-1][4]/pre[0][4]-1)*100 if len(pre)>=3 else None
  g3=sum(b[4]>b[1] for b in pre[-3:]) if len(pre)>=3 else None;vu=pre[-1][5]>pre[-2][5] if len(pre)>=2 else None
  age=(u['t']/1000-A[0][0])/3600
  R.append(dict(m=m,t=u['t'],sym=u['sym'],saf=u['safety'] or 0,f=u['f'] or {},bought=u['bought'],run60=run60,g3=g3,vu=vu,age=age,post=post))
R.sort(key=lambda r:r['t']);cut=int(len(R)*.6);TRN,TST=R[:cut],R[cut:]
def entry(r,E):
  if r['saf']<E['saf']:return None
  f=r['f']
  if E['liq'] and (f.get('liq') or 0)<E['liq']:return None
  if E['buys'] and (f.get('buys') or 0)<E['buys']:return None
  if E['noExt'] and r['run60'] is not None and r['run60']>E['noExt']:return None
  if E['mom'] and not(r['g3'] is not None and r['g3']>=E['mom'] and r['vu']):return None
  B=r['post']
  if E['wait']:  # wait k bars and only buy if price is above first-seen price (confirmation)
    k=E['wait']
    if len(B)<=k+2 or B[k][4]<=B[0][4]*(1+E['confirm']/100):return None
    B=B[k:]
  return B
def ev(rows,E,X):
  out=[]
  for r in rows:
    B=entry(r,E)
    if B:x,pk=sim(B,X);out.append(((x-1)*100-COST,pk))
  return out
def score(o):return sum(p for p,_ in o)*0.05/100
def fmt(o):
  if not o:return 'n=0'
  n=len(o);a=sum(p for p,_ in o)/n;return f'n={n:3d} win {100*sum(p>0 for p,_ in o)/n:3.0f}% net {score(o):+.4f} SOL avg {a:+.1f}% ({1+a/100:.2f}x)'
def rndE():return dict(saf=random.choice([0,50,70,80]),liq=random.choice([0,5000,15000,30000]),buys=random.choice([0,100,300]),noExt=random.choice([0,50,100]),mom=random.choice([0,2]),wait=random.choice([0,0,1,2,3]),confirm=random.choice([0,10,20]))
def rndX():
  l=random.choice([[(1.25,.5)],[(1.5,.5)],[(2,.5)],[(2,.5),(5,.25)],[(1.3,1)],[(1.5,1)],[(2,1)],[(1.25,.5),(2,.25)]])
  return dict(sl=random.choice([10,15,20,25,30]),ladder=l,trail1=random.choice([0,15,25]),trail2=random.choice([15,30,45]),pct2=1,arm=random.choice([0,30]),armMin=random.choice([3,1e9]),maxH=random.choice([0.25,0.5,1,2,4,8]),be=random.choice([True,False]))
if __name__=='__main__':
  random.seed(7);print(f'universe with candles: {len(R)} tokens ({sum(r["bought"] for r in R)} bought by the bot); train {len(TRN)} / holdout {len(TST)}')
  BOT_E=dict(saf=70,liq=5000,buys=0,noExt=0,mom=0,wait=0,confirm=0)
  best=[]
  for i in range(int(sys.argv[1]) if len(sys.argv)>1 else 3000):
    E,X=rndE(),rndX();o=ev(TRN,E,X)
    if len(o)<20:continue
    best.append((score(o),E,X))
  best.sort(key=lambda b:-b[0]);print('top train configs → holdout:')
  hold=[]
  for s,E,X in best[:25]:
    h=ev(TST,E,X);hold.append((score(h),s,E,X,h))
  for hs,s,E,X,h in sorted(hold,key=lambda x:-x[0])[:8]:
    print(f' train {s:+.4f} | holdout {fmt(h)}\n   entry {E}\n   exit  {X}')
  json.dump([dict(train=s,hold=hs,E=E,X=X) for hs,s,E,X,h in sorted(hold,key=lambda x:-x[0])],open('/workspace/bt/universe_best.json','w'),default=str)
