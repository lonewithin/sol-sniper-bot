# Skill candidates vs current "Let it run" exits. Train=first 60% by time, holdout=last 40%. Adopt only if holdout USD improves.
import json,os,sys,importlib.util,datetime
s=importlib.util.spec_from_file_location('b','scripts/bt-ohlcv.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
O=[json.loads(l) for l in open('data/observations.jsonl')]
O=[o for o in O if o['tier']!='SKIP' and os.path.exists(b.C+o['mint']+'.json')];O.sort(key=lambda o:o['t'])
seen=set();E=[]
for o in O:
  if o['mint'] in seen:continue
  seen.add(o['mint']);B=b.bars(o['mint'],o['t'])
  if B:E.append((o,B))
cut=int(len(E)*.6);TR,HO=E[:cut],E[cut:]
USD={'SCALP':5,'SWING':6.25,'RUNNER':8}
R=dict(sl=15,ladder=[(1.5,.3)],trail2=20,pct2=1,trail1=20,pctTrail=1,arm=30,maxH=6,be=1)
hr=lambda o:(datetime.datetime.utcfromtimestamp(o['t']/1000).hour+1)%24
def run(S,filt=lambda o,B:True,shift=None,cool=None):
  usd=0;n=0;w=0;loss=0;skipUntil=0;P=[]
  for o,B in S:
    if o['t']<skipUntil or not filt(o,B):continue
    BB=B
    if shift:
      BB=shift(B)
      if BB is None:continue
    x,_=b.sim(BB,R);p=(x-1)*100-b.COST;P.append(p);usd+=p*USD[o['tier']]/100;n+=1;w+=p>0
    if cool:
      loss=loss+1 if p<=0 else 0
      if loss>=cool[0]:skipUntil=o['t']+cool[1]*6e4;loss=0
  avg=sum(P)/n if n else 0
  return usd,f"n={n} win={100*w/max(n,1):.0f}% avg {avg:+.1f}% ({1+avg/100:.2f}x) ${usd:+.2f}"
def confirm1(B):  # wait one 5m candle; buy only if it closed green, enter at its close
  if len(B)<4 or B[1][4]<=B[0][4]:return None
  return B[1:]
C={'momentum confirm (1 green 5m candle, enter late)':dict(shift=confirm1),
 'ratio>=1.3':dict(filt=lambda o,B:o['f'].get('ratio',0)>=1.3),
 'accel<8 (no volume spike)':dict(filt=lambda o,B:o['f'].get('accel',0)<8),
 'pc5<=100 (no chase)':dict(filt=lambda o,B:o['f'].get('pc5',0)<=100),
 'v5>=5k':dict(filt=lambda o,B:o['f'].get('v5',0)>=5000),
 'safety>=75':dict(filt=lambda o,B:o.get('safety',0)>=75),
 'skip 00-07 WAT':dict(filt=lambda o,B:not(0<=hr(o)<7)),
 'skip pump migrations':dict(filt=lambda o,B:o.get('src')!='pump.fun migration'),
 'cooldown 3 losses -> 30m':dict(cool=(3,30)),
 'cooldown 2 losses -> 60m':dict(cool=(2,60)),
 'pot>=55':dict(filt=lambda o,B:o['pot']>=55)}
b0t,s0t=run(TR);b0h,s0h=run(HO);print('BASE TR',s0t,'| HO',s0h)
for k,a in C.items():
  t,st=run(TR,**a);h,sh=run(HO,**a)
  print(('ADOPT ' if t>b0t and h>b0h else 'reject ')+k,'| TR',st,'| HO',sh)
print('--- combined + robustness (drop single best trade)')
fs=[lambda o,B:o['f'].get('pc5',0)<=100,lambda o,B:o.get('safety',0)>=75,lambda o,B:o.get('src')!='pump.fun migration']
import itertools
for r in range(1,4):
  for cmb in itertools.combinations(range(3),r):
    f=lambda o,B,c=cmb:all(fs[i](o,B) for i in c);print(cmb,'TR',run(TR,filt=f)[1],'| HO',run(HO,filt=f)[1])
print('--- on top of the live entry gate (m5 <= +20% unless RUNNER)')
g=lambda o,B:o['tier']=='RUNNER' or o['f'].get('pc5',0)<=20
for nm,f in [('live gate',g),('+safety>=75',lambda o,B:g(o,B) and o.get('safety',0)>=75),('+skip migrations',lambda o,B:g(o,B) and o.get('src')!='pump.fun migration'),('+both',lambda o,B:g(o,B) and o.get('safety',0)>=75 and o.get('src')!='pump.fun migration')]:
  print(nm,'TR',run(TR,filt=f)[1],'| HO',run(HO,filt=f)[1])
print('--- skillVolExit (was never wired for snipes) on live gate + adopted skills')
gg=lambda o,B:g(o,B) and o.get('safety',0)>=75 and o.get('src')!='pump.fun migration'
def volcut(B,pct=50):
  e=B[0][4];v0=B[0][5] or 0
  for i in range(2,len(B)):
    if v0>0 and B[i][5]<v0*pct/100 and B[i][4]/e<1.05 and max(x[2] for x in B[1:i+1])/e<1.5:return B[:i+1]
  return B
for pct in [30,50,70]:
  print(pct,'TR',run(TR,filt=gg,shift=lambda B:volcut(B,pct))[1],'| HO',run(HO,filt=gg,shift=lambda B:volcut(B,pct))[1])
