# Candle-only strategy search on an external universe of Solana memecoins (GeckoTerminal lists, 15m candles).
# One trade per token (first signal). Time holdout = tokens whose signal fires later. Survivorship bias: lists only show pools still trading.
import json,glob,random,sys;exec(open('scripts/bt-ohlcv.py').read())
T=[]
for f in glob.glob('/workspace/bt/ext/*.json'):
  d=json.load(open(f));b=d.get('bars') or []
  if len(b)>=30:T.append(d)
def signal(d,E):
  b=d['bars'];c0=d['created']
  for i in range(4,len(b)-2):
    if (b[i][0]-c0)/3600<E['age']:continue
    c=b[i][4];r1h=(c/b[i-4][4]-1)*100;g=sum(x[4]>x[1] for x in b[i-2:i+1]);vu=b[i][5]>b[i-1][5]
    if E['minR']<=r1h<=E['maxR'] and g>=E['g'] and (vu or not E['vu']) and b[i][5]*c>0 and b[i][5]>=E['vol']:return i
  return None
def ev(toks,E,X):
  o=[]
  for d in toks:
    i=signal(d,E)
    if i is None:continue
    x,pk=sim(d['bars'][i:],{**X,'bar':15});o.append((d['bars'][i][0],(x-1)*100-COST,pk))
  return o
def sc(o):return sum(p for _,p,_ in o)*0.05/100
def fm(o):
  if not o:return 'n=0'
  n=len(o);a=sum(p for _,p,_ in o)/n;return f'n={n:3d} win {100*sum(p>0 for _,p,_ in o)/n:3.0f}% net {sc(o):+.3f} SOL avg {a:+.1f}% ({1+a/100:.2f}x)'
rE=lambda:dict(age=random.choice([0,1,6,24,72]),minR=random.choice([-30,-10,0,5,15]),maxR=random.choice([20,50,100,1000]),g=random.choice([0,1,2,3]),vu=random.choice([0,1]),vol=0)
rX=lambda:dict(sl=random.choice([10,15,20,25,30]),ladder=random.choice([[(1.25,.5)],[(1.5,.5)],[(2,.5)],[(2,.5),(5,.25)],[(1.3,1)],[(1.5,1)],[(2,1)]]),trail1=random.choice([0,15,25]),trail2=random.choice([15,30,45]),pct2=1,arm=random.choice([0,30]),armMin=1e9,maxH=random.choice([1,2,4,8,24]),be=random.choice([True,False]))
if __name__=='__main__':
  random.seed(3);print('external tokens with candles',len(T))
  res=[]
  for _ in range(int(sys.argv[1]) if len(sys.argv)>1 else 1500):
    E,X=rE(),rX();o=sorted(ev(T,E,X))
    if len(o)<30:continue
    c=int(len(o)*.6);res.append((sc(o[:c]),E,X,o))
  res.sort(key=lambda r:-r[0])
  out=[]
  for s,E,X,o in res[:30]:c=int(len(o)*.6);out.append((sc(o[c:]),s,E,X,o,c))
  for h,s,E,X,o,c in sorted(out,key=lambda r:-r[0])[:6]:print(f' train {fm(o[:c])} | holdout {fm(o[c:])}\n   entry {E}\n   exit {X}')
  # bot's chosen Moonbag exits on candle-only entries (no safety/liq data here): first bar after 1h old
  E0=dict(age=1,minR=-1000,maxR=100000,g=0,vu=0,vol=0);c7X=dict(sl=30,ladder=[(2,.5),(5,.25)],trail1=15,trail2=15,pct2=1,arm=0,armMin=1e9,maxH=8,be=True)
  o=sorted(ev(T,E0,c7X));c=int(len(o)*.6);print('C7 exits, buy every token at 1h old: train',fm(o[:c]),'| holdout',fm(o[c:]))
