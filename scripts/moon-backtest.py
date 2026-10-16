# MOONBAG backtest on data/missed.jsonl (peak/final) joined with data/observations.jsonl (features + m1..m30 path).
import json,sys
D='data/'
O={}
for l in open(D+'observations.jsonl'):
  o=json.loads(l)
  if o.get('p0'):O.setdefault(o['mint'],o)
M={}
for l in open(D+'missed.jsonl'):
  m=json.loads(l);M[m['mint']]=m   # latest peak/final per mint
rows=[]
for k,o in O.items():
  m=M.get(k);path=[o['out'].get(x) for x in('m1','m5','m15','m30')];path=[x for x in path if x is not None]
  peak=max([m['peakPct']] if m else []+path or [0]) if m else max(path or [0])
  final=m['finalPct'] if m else (path[-1] if path else 0)
  rows.append(dict(f=o['f'],safety=o['safety'],pot=o['pot'],path=path,peak=max(peak,max(path or [0])),final=final,sym=o['symbol']))
COST=1.5
def sim(r,P):
  sl,lock,frac,trail=P['sl'],P['lockAt'],P['sellFrac'],P['trail']
  for x in r['path']:
    if x<=-sl:return -sl-COST,(1+r['peak']/100)
    if x>=lock:break
  pk=r['peak']
  if pk<lock: return max(r['final'],-sl)-COST,(1+pk/100)
  locked=frac*lock
  mult=1+pk/100;trailExit=mult*(1-trail/100)
  restX=max(1+r['final']/100,trailExit) if 1+r['final']/100<trailExit else 1+r['final']/100
  restX=max(restX,0)
  return locked+(1-frac)*(restX*100-100)-COST,mult
def F(r,P):
  f=r['f'];return r['safety']>=P['minSafety'] and f['liq']>=P['minLiq'] and f['buys']>=P['minBuys'] and f['ratio']>=P['minRatio'] and f['accel']>=P['minAccel'] and P['minPc5']<=f['pc5']<=P['maxPc5'] and f['v5']>=P['minVol5']
base=dict(sl=30,lockAt=100,sellFrac=0.8,trail=45,minSafety=70,minLiq=15000,minBuys=300,minRatio=1.2,minAccel=2,minPc5=-15,maxPc5=120,minVol5=20000)
V={'A balanced (default)':{},
 'B strict trend':dict(minBuys=500,minRatio=1.3,minAccel=3,minVol5=30000),
 'C loose':dict(minBuys=150,minRatio=1.1,minAccel=1.5,minVol5=10000,minLiq=10000),
 'D tight stop 20% / sell 85%':dict(sl=20,sellFrac=0.85),
 'E wide trail 50% / sell 75%':dict(trail=50,sellFrac=0.75),
 'F no-safety-floor 50':dict(minSafety=50)}
print(f'{len(rows)} coins with feature data; {sum(r["peak"]>=100 for r in rows)} reached 2x+')
for n,v in V.items():
  P={**base,**v};sel=[r for r in rows if F(r,P)];res=[sim(r,P) for r in sel]
  if not res:print(n,'0 trades');continue
  pn=[x for x,_ in res];w=sum(x>0 for x in pn);x2=sum(m>=2 for _,m in res);x5=sum(m>=5 for _,m in res)
  print(f'{n}: {len(pn)} trades, win {100*w/len(pn):.0f}%, hit2x {x2}, hit5x {x5}, max {max(m for _,m in res):.1f}x, avg {sum(pn)/len(pn):+.1f}%/trade, net {sum(pn)*0.05/100:+.4f} SOL @0.05')
  if '-v' in sys.argv:
    for r,(x,m) in zip(sel,res):print('   ',r['sym'],f'{x:+.0f}% max {m:.1f}x')
