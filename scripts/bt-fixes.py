# Week-2 fixes backtest on cached 5m candles. Train = first 60% by time, holdout = last 40%. Adopt only if holdout improves AND survives dropping the best trade.
import json,os,importlib.util,collections
s=importlib.util.spec_from_file_location('b','scripts/bt-ohlcv.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
def split(A):A.sort(key=lambda x:x[0]['t']);c=int(len(A)*.6);return A[:c],A[c:]
def summ(P):
  if not P:return 0,0,'n=0'
  u=sum(P);ud=u-max(P);return u,ud,f"n={len(P)} win={100*sum(p>0 for p in P)/len(P):.0f}% ${u:+.2f} (drop-best ${ud:+.2f})"
O=[json.loads(l) for l in open('data/observations.jsonl')];seen=set();OBS=[]
for o in O:
  if o['mint'] in seen:continue
  seen.add(o['mint']);B=b.bars(o['mint'],o['t'])
  if B:OBS.append((o,B))
# ---------- 1. Moonbag exits ----------
def moon(B,sl=40,lad=((3,.25),(10,.25)),trail=30,be=True,tight=None,maxH=240):
  e=B[0][4];pk=1;rem=1.;real=0.;lad=list(lad);hit=False
  for i,(ts,o,h,l,c,v) in enumerate(B[1:],1):
    lo,hi=l/e,h/e
    if not hit and lo<=1-sl/100:return real+rem*(1-sl/100),max(pk,hi)
    if hit:
      tr=trail
      if tight:
        for at,t2 in tight:
          if pk>=at:tr=min(tr,t2)
      st=pk*(1-tr/100)
      if be:st=max(st,1)
      if lo<=st:return real+rem*st,pk
    elif tight and tight[0][0]<=lad[0][0] if lad else False:pass
    pk=max(pk,hi)
    while lad and pk>=lad[0][0]:
      x,f=lad.pop(0);q=min(rem,f);real+=q*x;rem-=q;hit=True
    if rem<=1e-9 or i*5>=maxH*60:return real+rem*c/e,pk
  return real+rem*B[-1][4]/e,pk
MU=[(o,B) for o,B in OBS if o.get('safety',0)>=70 and (o['f'].get('liq') or 0)>=15000]
TR,HO=split(MU);print('MOON universe',len(MU))
def mrun(S,**k):return summ([((moon(B,**k)[0]-1)*100-b.COST)*0.05*190/100 for o,B in S])  # $ at 0.05 SOL (~$9.5)
V={'CURRENT 25%@3x,25%@10x trail30':{},
 '+25%@2x first':dict(lad=((2,.25),(3,.25),(10,.25))),
 '30%@2x,25%@5x,15%@10x':dict(lad=((2,.3),(5,.25),(10,.15))),
 '50%@2x then trail30':dict(lad=((2,.5),(10,.25))),
 '25%@2x,25%@3x + trail20 after 3x':dict(lad=((2,.25),(3,.25),(10,.25)),tight=((3,20),)),
 '25%@2x + trail20 after 2x':dict(lad=((2,.25),(3,.25),(10,.25)),trail=20),
 '25%@2x + trail25 after 2x, 15 after 5x':dict(lad=((2,.25),(3,.25),(10,.25)),trail=25,tight=((5,15),)),
 'tight only: trail20 after 3x':dict(tight=((3,20),)),
}
r0=(mrun(TR),mrun(HO));print('  CURRENT TR',r0[0][2],'| HO',r0[1][2])
for k,a in list(V.items())[1:]:
  t,h=mrun(TR,**a),mrun(HO,**a);ok=h[0]>r0[1][0] and h[1]>r0[1][1]
  print(' ',('ADOPT ' if ok else 'reject'),k,'| TR',t[2],'| HO',h[2])
# Also replay on the real Moon paper trades that gave back gains (approx with candles from entry)
T=[json.loads(l) for l in open('data/trades.jsonl')];MT=[(x,b.bars(x['mint'],x['opened'])) for x in T if x['tier']=='MOON'];MT=[(x,B) for x,B in MT if B]
print('  real MOON trades with candles',len(MT),'actual $',round(sum(x['pnlPct'] for x,_ in MT)*0.095,2),'| cur sim',summ([((moon(B)[0]-1)*100-b.COST)*.095 for x,B in MT])[2],'| 25%@2x',summ([((moon(B,lad=((2,.25),(3,.25),(10,.25)))[0]-1)*100-b.COST)*.095 for x,B in MT])[2])
# ---------- 2+3. Skip reasons: what would buying each skipped bucket at small size ($3) have done? ----------
MS={};[MS.setdefault(m['mint'],m) for m in map(json.loads,open('data/missed.jsonl'))]
R=dict(sl=15,ladder=[(1.5,.3)],trail2=20,pct2=1,trail1=20,pctTrail=1,arm=30,maxH=12,be=1)
G=collections.defaultdict(list)
for o,B in OBS:
  m=MS.get(o['mint'])
  if not m:continue
  why=m['why'].split('(')[0].strip();x,pk=b.sim(B,R);G[why].append((o,(x-1)*100-b.COST,pk,min(bb[3] for bb in B[:13])/B[0][4]))
print('SKIP buckets (bought at $3, runner exits):')
for why,L in sorted(G.items(),key=lambda kv:-len(kv[1])):
  L.sort(key=lambda z:z[0]['t']);c=int(len(L)*.6)
  rug=sum(z[3]<=.2 for z in L)
  print(f"  {why:28s} n={len(L)} 2x+={sum(z[2]>=2 for z in L)} rug(-80% in 1h)={rug} | TR {summ([z[1]*3/100 for z in L[:c]])[2]} | HO {summ([z[1]*3/100 for z in L[c:]])[2]}")
  if why in('liquidity below $5000','thin RUNNER pool','low potential','dumping'):
    hs=[z for z in L if z[0].get('safety',0)>=90 and z[0]['pot']>=75];print(f"     high-score subset (S>=90,P>=75) n={len(hs)} {summ([z[1]*3/100 for z in hs])[2]}")
# ---------- 6. Big Play breakout entry ----------
E={}
for l in open('data/big_shadow.jsonl'):
  x=json.loads(l);E.setdefault(x['mint'],dict(t=x['t'],sym=x['symbol'],pc=x.get('pc',{}),age=x.get('ageH')))
for x in T:
  if x['tier']=='BIG':E.setdefault(x['mint'],dict(t=x['opened'],sym=x['symbol'],pc=(x.get('features') or {}).get('pc',{})))
BA=[(e,b.bars(m,e['t'])) for m,e in E.items()];BA=[(e,B) for e,B in BA if B];BT,BH=split(BA)
CUR=dict(sl=25,ladder=[(1.5,.5)],trail2=25,pct2=1,trail1=0,arm=0,maxH=24,be=0,lockAt=20,lockPct=3)
def brk(B,n=6,rng=25,vol=1.5):
  for i in range(n,min(len(B)-3,72)):
    w=B[i-n:i];hi=max(z[2] for z in w);lo=min(z[3] for z in w)
    if hi/lo-1<=rng/100 and B[i][4]>hi and B[i][5]>=vol*sum(z[5] for z in w)/n:return B[i:]
def brun(S,entry=None,filt=lambda e:True):
  P=[]
  for e,B in S:
    if not filt(e):continue
    BB=entry(B) if entry else B
    if BB and len(BB)>=3:P.append(((b.sim(BB,CUR)[0]-1)*100-b.COST)*5/100)
  return summ(P)
print('BIG universe',len(BA),'(no coin-age field stored, age window not testable directly)')
b0=(brun(BT),brun(BH),brun(BA));print('  CURRENT TR',b0[0][2],'| HO',b0[1][2])
for n,rg,vo in[(6,25,1.5),(6,15,1.5),(12,25,1.5),(6,25,2),(12,30,1.2)]:
  f=lambda B,n=n,rg=rg,vo=vo:brk(B,n,rg,vo);t,h=brun(BT,f),brun(BH,f)
  print(' ',('ADOPT ' if h[0]>b0[1][0] and h[1]>b0[1][1] else 'reject'),f'breakout {n*5}min range<={rg}% vol>={vo}x','| TR',t[2],'| HO',h[2])
# ---------- 3b. Loosen the costliest rule: chasing spike (m5 > maxEntryPc5). Which new cap? ----------
L=sorted(G['chasing spike'],key=lambda z:z[0]['t']);c=int(len(L)*.6)
for cap in [40,60,100,200,1e9]:
  f=lambda z:(z[0]['f'].get('pc5') or 0)<=cap;a=[z for z in L[:c] if f(z)];h=[z for z in L[c:] if f(z)]
  print(f'  chase cap m5<={cap:g}%: rugs={sum(z[3]<=.2 for z in a+h)} | TR {summ([z[1]*3/100 for z in a])[2]} | HO {summ([z[1]*3/100 for z in h])[2]}')
