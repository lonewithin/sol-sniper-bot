# Edge ideas vs current baseline. Train=first 60% by time, holdout=last 40%. Adopt only if BOTH improve and survive dropping best trade.
import json,os,importlib.util,collections
s=importlib.util.spec_from_file_location('b','scripts/bt-ohlcv.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
O=[json.loads(l) for l in open('data/observations.jsonl')];O.sort(key=lambda o:o['t'])
seen=set();A=[]
for o in O:
  if o['mint'] in seen or not os.path.exists(b.C+o['mint']+'.json'):continue
  seen.add(o['mint']);B=b.bars(o['mint'],o['t'])
  if B:A.append((o,B))
cut=int(len(A)*.6);TR,HO=A[:cut],A[cut:]
print('universe with candles',len(A),'(traded tiers',sum(o['tier']!='SKIP' for o,_ in A),')')
USD={'SCALP':5,'SWING':6.25,'RUNNER':8,'SKIP':3}
BASE=dict(sl=15,ladder=[(1.5,.3)],trail2=20,pct2=1,trail1=20,pctTrail=1,arm=30,maxH=6,be=1)
g=lambda o:o['tier']!='SKIP' and o.get('safety',0)>=75 and o.get('src')!='pump.fun migration'
liq=lambda o:o['f'].get('liq',0) or 0
def run(S,filt=g,R=BASE,size=lambda o:USD[o['tier']]):
  P=[]
  for o,B in S:
    if not filt(o):continue
    x,pk=b.sim(B,R);p=(x-1)*100-b.COST;P.append((p*size(o)/100,p,pk))
  if not P:return 0,0,'n=0'
  u=sum(x[0] for x in P);ud=u-max(x[0] for x in P)
  return u,ud,f"n={len(P)} win={100*sum(x[1]>0 for x in P)/len(P):.0f}% ${u:+.2f} (drop-best ${ud:+.2f}) 2x+pk={sum(x[2]>=2 for x in P)}"
C={
 'ratio>=1.2':dict(filt=lambda o:g(o) and o['f'].get('ratio',0)>=1.2),
 'ratio>=1.5':dict(filt=lambda o:g(o) and o['f'].get('ratio',0)>=1.5),
 'accel>=2':dict(filt=lambda o:g(o) and o['f'].get('accel',0)>=2),
 'v5>=3k':dict(filt=lambda o:g(o) and o['f'].get('v5',0)>=3000),
 'hGrow>0':dict(filt=lambda o:g(o) and o['f'].get('hGrow',0)>0),
 'drop RUNNER tier':dict(filt=lambda o:g(o) and o['tier']!='RUNNER'),
 'RUNNER $5 not $8':dict(size=lambda o:5 if o['tier']=='RUNNER' else USD[o['tier']]),
 'tiered liq: also buy SKIP-for-liq at $3 (pot>=50,safety>=75)':dict(filt=lambda o:g(o) or (o['tier']=='SKIP' and o['pot']>=50 and o.get('safety',0)>=75)),
 'ladder 30%@2x,20%@5x, trail 25':dict(R=dict(BASE,ladder=[(2,.3),(5,.2)],trail2=25)),
 'ladder 25%@1.5x,25%@3x,15%@10x':dict(R=dict(BASE,ladder=[(1.5,.25),(3,.25),(10,.15)])),
 'ladder 30%@1.5x + trail 30 (looser)':dict(R=dict(BASE,trail2=30)),
 'maxH 12h':dict(R=dict(BASE,maxH=12)),
 'sl 20':dict(R=dict(BASE,sl=20)),
}
b0=run(TR);h0=run(HO);print('BASE  TR',b0[2],'| HO',h0[2])
for k,a in C.items():
  t=run(TR,**a);h=run(HO,**a)
  ok=t[0]>b0[0] and h[0]>h0[0] and h[1]>h0[1]
  print(('ADOPT ' if ok else 'reject')+' '+k,'| TR',t[2],'| HO',h[2])
