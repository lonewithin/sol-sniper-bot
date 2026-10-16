# Path backtest on real 5m candles (cache from fetch-ohlcv.py). Within a bar: low (stops) checked before high (targets) = conservative.
import json,os,sys
C='/workspace/bt/ohlcv/';D='data/';COST=1.5
def bars(m,t0):
  try:d=json.load(open(C+m+'.json'))
  except:return None
  B=[b for b in d.get('bars',[]) if b[0]*1000>=t0-300000]
  return B if len(B)>=3 else None
def sim(B,R):
  e=B[0][4];peak=1;rem=1.0;real=0.0;lad=list(R.get('ladder',[]));hit=False
  for i,(ts,o,h,l,c,v) in enumerate(B[1:],1):
    age=i*R.get('bar',5);lo,hi=l/e,h/e
    # stops
    if not hit and lo<=1-R['sl']/100:return real+rem*(1-R['sl']/100),max(peak,hi)
    if R.get('lockAt') and not hit and peak>=1+R['lockAt']/100 and lo<=1+R['lockPct']/100:return real+rem*(1+R['lockPct']/100),peak
    tr=R['trail2'] if hit else R.get('trail1',0)
    if tr and peak>=1.1 and (hit or peak>=1+R.get('arm',0)/100 or age>=R.get('armMin',1e9)):
      stop=peak*(1-tr/100) if R.get('pctTrail') or (hit and R.get('pct2')) else peak-tr/100
      if lo<=stop:return real+rem*stop,peak
    if hit and R.get('be') and lo<=1:return real+rem*1,peak
    peak=max(peak,hi)
    while lad and peak>=lad[0][0]:
      x,f=lad.pop(0);s=min(rem,f);real+=s*x;rem-=s;hit=True
    if rem<=1e-9:return real,peak
    if R.get('flatMin') and not hit and age>=R['flatMin'] and peak<1.05:return real+rem*c/e,peak
    if age>=R['maxH']*60:return real+rem*c/e,peak
  return real+rem*B[-1][4]/e,peak
def run(name,E,R,size=0.05):
  res=[]
  for m,t,sym in E:
    B=bars(m,t)
    if B:x,pk=sim(B,R);res.append((sym,(x-1)*100-COST,pk))
  if not res:return print(name,'no data')
  p=[r[1] for r in res];w=sum(x>0 for x in p)
  print(f'{name:38s} n={len(p):3d} win {100*w/len(p):3.0f}% avg {sum(p)/len(p):+6.1f}% net {sum(p)*size/100:+.4f} SOL  2x+ {sum(r[2]>=2 for r in res)} 5x+ {sum(r[2]>=5 for r in res)} captured>=3x {sum(r[1]>=200 for r in res)} best exit {max(p):+.0f}%')
  return res
