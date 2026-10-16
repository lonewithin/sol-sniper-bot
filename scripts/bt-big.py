# Big Play variants on real 5m candles. Universe = Big Play signals (big_shadow) + BIG paper trades, deduped by mint.
# Train=first 60% by time, holdout=last 40%. Pick variant improving both + robust to dropping best trade.
import json,os,importlib.util,itertools
s=importlib.util.spec_from_file_location('b','scripts/bt-ohlcv.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
E={}
for l in open('data/big_shadow.jsonl'):
  x=json.loads(l);E.setdefault(x['mint'],dict(t=x['t'],sym=x['symbol'],mc=x.get('mc',0),liq=x.get('liq',0),pc=x.get('pc',{})))
for l in open('data/trades.jsonl'):
  x=json.loads(l)
  if x['tier']!='BIG':continue
  f=x.get('features') or {};E.setdefault(x['mint'],dict(t=x['opened'],sym=x['symbol'],mc=f.get('mcap',0),liq=f.get('liq',0),pc=f.get('pc',{})))
A=[];
for m,e in sorted(E.items(),key=lambda kv:kv[1]['t']):
  B=b.bars(m,e['t'])
  if B:A.append((e,B))
cut=int(len(A)*.6);TR,HO=A[:cut],A[cut:];print('Big universe',len(A),'train',len(TR),'holdout',len(HO))
CUR=dict(sl=25,ladder=[(1.5,.5)],trail2=25,pct2=1,trail1=0,arm=0,maxH=24,be=0,lockAt=20,lockPct=3)
def dip(B,d=25):  # wait for a pullback of d% from the post-signal high, buy when a candle closes back above the prior candle high (reclaim), within 6h
  hi=B[0][2];low=False
  for i in range(1,min(len(B)-3,72)):
    hi=max(hi,B[i-1][2])
    if B[i][3]<=hi*(1-d/100):low=True
    if low and B[i][4]>B[i-1][2]:return B[i:]
  return None
def run(S,R=CUR,filt=lambda e:True,entry=None,usd=10):
  P=[]
  for e,B in S:
    if not filt(e):continue
    BB=entry(B) if entry else B
    if BB is None or len(BB)<3:continue
    x,pk=b.sim(BB,R);p=(x-1)*100-b.COST;P.append(p*usd/100)
  if not P:return -1e9,-1e9,'n=0'
  u=sum(P);ud=u-max(P);return u,ud,f"n={len(P)} win={100*sum(p>0 for p in P)/len(P):.0f}% ${u:+.2f} (drop-best ${ud:+.2f})"
V={'CURRENT':{}}
for sl,tr,ld,mh in itertools.product([15,25,35],[20,30,40],[[(1.5,.5)],[(1.5,.3)],[(2,.3)],[(1.5,.25),(3,.25)],[]],[6,12,24]):
  V[f'sl{sl} trail{tr} ladder{ld} maxH{mh}']=dict(R=dict(sl=sl,ladder=ld,trail2=tr,pct2=1,trail1=tr,pctTrail=1,arm=30,maxH=mh,be=1))
F={'mc<=1M':lambda e:e['mc']<=1e6,'mc 100k-500k':lambda e:1e5<=e['mc']<=5e5,'liq>=50k':lambda e:e['liq']>=5e4,'h1<=200':lambda e:e['pc'].get('h1',0)<=200,'m5<=10':lambda e:e['pc'].get('m5',0)<=10,'h1>=20':lambda e:e['pc'].get('h1',0)>=20}
for k,f in F.items():V['filter '+k]=dict(filt=f)
for d in [15,25,40]:V[f'dip-reclaim {d}%']=dict(entry=lambda B,d=d:dip(B,d))
res=[]
for k,a in V.items():
  t=run(TR,**a);h=run(HO,**a);res.append((k,t,h))
c=res[0];print('CURRENT  TR',c[1][2],'| HO',c[2][2])
ok=[r for r in res[1:] if r[1][0]>c[1][0] and r[2][0]>c[2][0] and r[2][1]>c[2][1] and r[1][1]>c[1][1]]
ok.sort(key=lambda r:min(r[1][1],r[2][1]),reverse=True)
print(len(ok),'robust improvers of',len(res)-1,'; top 12 by worst drop-best:')
for r in ok[:12]:print(' ',r[0],'| TR',r[1][2],'| HO',r[2][2])
print('non-exit variants:');[print(' ',r[0],'| TR',r[1][2],'| HO',r[2][2]) for r in res if not r[0].startswith('sl')]
print('combos:')
R35=dict(sl=35,ladder=[(1.5,.5)],trail2=20,pct2=1,trail1=20,pctTrail=1,arm=30,maxH=12,be=1)
h=lambda e:e['pc'].get('h1',0)<=200
for nm,a in [('h1<=200 + sl35/trail20/50%@1.5x/12h',dict(R=R35,filt=h)),('h1<=200 + current exits',dict(filt=h)),('h1<=200 + sl35 + dip25',dict(R=R35,filt=h,entry=lambda B:dip(B,25)))]:
  for u in [10,5]:print(' ',nm,'$'+str(u),'| TR',run(TR,usd=u,**a)[2],'| HO',run(HO,usd=u,**a)[2])
