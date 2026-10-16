# Skills backtest on real 5m candles: entry filters / exits / regime, applied to every logged entry candidate. Time-ordered holdout split.
import json,sys;exec(open('scripts/bt-ohlcv.py').read())
def allbars(m):
  try:return json.load(open(C+m+'.json')).get('bars',[])
  except:return []
TR={'SCALP':dict(sl=12,ladder=[(1.2,1)],maxH=4/60),'SWING':dict(sl=18,ladder=[(1.5,1)],trail1=15,arm=30,armMin=3,maxH=15/60),
 'RUNNER':dict(sl=25,ladder=[(1.5,.5)],trail1=20,trail2=20,arm=30,armMin=3,lockAt=20,lockPct=3,maxH=0.5,be=True),
 'BIG':dict(sl=25,ladder=[(1.5,0.5)],trail1=25,trail2=40,pct2=1,arm=30,armMin=3,lockAt=20,lockPct=3,flatMin=50,maxH=8,be=True)}
E=[]
for l in open(D+'trades.jsonl'):
  t=json.loads(l);E.append((t['mint'],t['opened'],t['symbol'],'BIG' if t['tier']=='BIG' else (t['tier'] if t['tier'] in TR else 'SWING'),t.get('safety') or 0))
seen={e[0] for e in E}
for l in open(D+'big_shadow.jsonl'):
  t=json.loads(l)
  if t['mint'] not in seen:E.append((t['mint'],t['t'],t['symbol'],'BIG',0));seen.add(t['mint'])
for l in open(D+'observations.jsonl'):
  o=json.loads(l)
  if o['mint'] in seen or o['tier'] not in TR or not o.get('p0'):continue
  E.append((o['mint'],o['t'],o['symbol'],o['tier'],o['safety']));seen.add(o['mint'])
E.sort(key=lambda e:e[1])
def feats(m,t):
  A=allbars(m);pre=[b for b in A if b[0]*1000<t-300000][-12:];post=[b for b in A if b[0]*1000>=t-300000]
  if len(post)<3 or len(pre)<3:return None
  c=pre[-1][4];f={}
  f['run30']=(c/pre[-6][4]-1)*100 if len(pre)>=6 else 0
  f['run60']=(c/pre[0][4]-1)*100
  f['green3']=sum(b[4]>b[1] for b in pre[-3:])
  f['volUp']=pre[-1][5]>pre[-2][5]
  f['volAcc']=pre[-1][5]/max(1,sum(b[5] for b in pre[-4:-1])/3)
  return f,post
def simx(B,R,volDecay=0):
  if not volDecay:return sim(B,R)
  v0=B[0][5] or 1
  for k in range(2,len(B)):
    if B[k][5]<v0*volDecay and B[k][4]<B[0][4]*1.05:
      x,pk=sim(B[:k+1],{**R,'maxH':1e9});return x,pk
  return sim(B,R)
ROWS=[]
for m,t,s,tier,saf in E:
  r=feats(m,t)
  if r:ROWS.append((m,t,s,tier,saf,*r))
COST=1.5
def evalset(rows,skill,size=lambda r:1):
  out=[];losses=0;pause=0;hist=[]
  for r in rows:
    m,t,s,tier,saf,f,B=r
    if skill.get('cool') and t<pause:continue
    if skill.get('regime') and len(hist)>=skill['regime'][0] and sum(x>0 for x in hist[-skill['regime'][0]:])/skill['regime'][0]<skill['regime'][1]:hist.append(0.0001);continue   # skip but keep counting time
    if skill.get('noExt') and f['run60']>skill['noExt']:continue
    if skill.get('mom') and not(f['green3']>=skill['mom'] and f['volUp']):continue
    if skill.get('volAcc') and f['volAcc']<skill['volAcc']:continue
    x,pk=simx(B,TR[tier],skill.get('vd',0));p=(x-1)*100-COST;sz=size(r) if skill.get('size') else 1
    out.append((p,sz,pk));hist.append(p)
    if p<=0:
      losses+=1
      if skill.get('cool') and losses>=skill['cool'][0]:pause=t+skill['cool'][1]*6e4;losses=0
    else:losses=0
  return out
def summ(o):
  if not o:return 'n=0'
  n=len(o);net=sum(p*s for p,s,_ in o)*0.05/100;w=sum(p>0 for p,_,_ in o)
  return f'n={n:3d} win {100*w/n:3.0f}% net {net:+.4f} SOL avg {sum(p for p,_,_ in o)/n:+5.1f}% ({1+sum(p for p,_,_ in o)/n/100:.2f}x)'
S=dict(base={},mom2={'mom':2},mom3={'mom':3},volAcc15={'volAcc':1.5},noExt100={'noExt':100},noExt50={'noExt':50},noExt200={'noExt':200},
 volDecay30={'vd':0.3},volDecay50={'vd':0.5},regime10_30={'regime':(10,0.3)},regime6_33={'regime':(6,0.34)},cool3_30={'cool':(3,30)},cool2_60={'cool':(2,60)},
 sizeBySafety={'size':1})
sizefn=lambda r:1.5 if r[4]>=90 else 0.75 if r[4]<75 else 1
cut=int(len(ROWS)*0.6);TRN,TST=ROWS[:cut],ROWS[cut:]
print(f'{len(ROWS)} entries with candles before+after (train {len(TRN)} / holdout {len(TST)})')
res={}
for k,v in S.items():
  a=evalset(TRN,v,sizefn);b=evalset(TST,v,sizefn);res[k]=(a,b)
  print(f'{k:13s} TRAIN {summ(a)} | HOLDOUT {summ(b)}')
import itertools
print('--- combos')
for combo in [('noExt100','cool3_30'),('noExt100','volDecay50'),('mom2','noExt100'),('noExt100','cool3_30','volDecay50'),('noExt100','regime10_30')]:
  v={};[v.update(S[c]) for c in combo];a=evalset(TRN,v,sizefn);b=evalset(TST,v,sizefn);print(f"{'+'.join(combo):30s} TRAIN {summ(a)} | HOLDOUT {summ(b)}")
for combo in [('noExt50','volDecay50'),('mom2','volDecay50'),('mom2','noExt50'),('mom2','noExt50','volDecay50')]:
  v={};[v.update(S[c]) for c in combo];a=evalset(TRN,v,sizefn);b=evalset(TST,v,sizefn);ab=evalset(ROWS,v,sizefn);print(f"{'+'.join(combo):30s} TRAIN {summ(a)} | HOLDOUT {summ(b)} | ALL {summ(ab)}")
print('ALL base',summ(evalset(ROWS,{})))
by={}
for r in ROWS:by.setdefault(r[3],[]).append(r)
for k,v in by.items():print(' mode',k,len(v),'base',summ(evalset(v,{})),'| noExt50+vd50',summ(evalset(v,{'noExt':50,'vd':0.5})))
print('--- wallet-study skills')
def age(r):A=allbars(r[0]);return (r[1]/1000-A[0][0])/3600 if A else 0
for k,fn in [('minAge2h',lambda r:age(r)>=2),('minAge24h',lambda r:age(r)>=24)]:
  for nm,rows in [('TRAIN',TRN),('HOLDOUT',TST)]:print(k,nm,'base',summ(evalset(rows,{})),'| skill',summ(evalset([r for r in rows if fn(r)],{})))
TR0={k:dict(v) for k,v in TR.items()}
for k in TR:TR[k]['sl']=min(TR[k]['sl'],15)
print('stop15 TRAIN',summ(evalset(TRN,{})),'| HOLDOUT',summ(evalset(TST,{})))
TR.update(TR0)
