import json,os,sys,itertools
sys.path.insert(0,'scripts');import importlib.util
s=importlib.util.spec_from_file_location('b','scripts/bt-ohlcv.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
O=[json.loads(l) for l in open('data/observations.jsonl')]
O=[o for o in O if o['tier']!='SKIP' and os.path.exists(b.C+o['mint']+'.json')]
O.sort(key=lambda o:o['t']);seen=set();E=[]
for o in O:
  if o['mint'] in seen:continue
  seen.add(o['mint']);B=b.bars(o['mint'],o['t'])
  if B:E.append((o,B))
cut=int(len(E)*0.6);TR,HO=E[:cut],E[cut:]
USD={'SCALP':5,'SWING':6.25,'RUNNER':8}
CUR={'SCALP':dict(sl=12,ladder=[(1.2,1.0)],maxH=4/60,trail2=0),
     'SWING':dict(sl=18,ladder=[(1.5,1.0)],maxH=.25,trail2=0,trail1=15,pctTrail=1,arm=30),
     'RUNNER':dict(sl=25,ladder=[(1.5,.5)],trail2=20,pct2=1,trail1=20,pctTrail=1,arm=30,maxH=.5,lockAt=20,lockPct=3)}
def ev(S,filt,rules):
  r={};
  for o,B in S:
    if not filt(o):continue
    t=o['tier'];x,pk=b.sim(B,rules[t]);p=(x-1)*100-b.COST
    r.setdefault(t,[]).append(p)
  return r
def summ(r):
  tot=0;out=[]
  for t,p in sorted(r.items()):
    u=sum(q*USD[t]/100 for q in p);tot+=u
    out.append(f"{t} n={len(p)} win={100*sum(q>0 for q in p)/len(p):.0f}% avg={sum(p)/len(p):+.1f}% ({1+sum(p)/len(p)/100:.2f}x) ${u:+.2f}")
  return tot,' | '.join(out)
def runner(sl,tp,frac,tr,mh,lock):
  R=dict(sl=sl,ladder=[(1+tp/100,frac)] if frac else [],trail2=tr,pct2=1,trail1=tr,pctTrail=1,arm=30,maxH=mh)
  if lock:R.update(lockAt=20,lockPct=3)
  return R
F0=lambda o:True
print('baseline TR',summ(ev(TR,F0,CUR)));print('baseline HO',summ(ev(HO,F0,CUR)))
# grid: per-tier exit + filters, select on train
best=[]
for sl,tp,frac,tr,mh,lock in itertools.product([10,15,20,25],[50,100,200],[0,.3,.5],[20,30,40],[.5,2,6],[0,1]):
  R=runner(sl,tp,frac,tr,mh,lock);rules={'SCALP':R,'SWING':R,'RUNNER':R}
  best.append((summ(ev(TR,F0,rules))[0],(sl,tp,frac,tr,mh,lock)))
best.sort(reverse=True)
for sc,k in best[:5]:
  R=runner(*k);rules={'SCALP':R,'SWING':R,'RUNNER':R}
  print('TR',round(sc,2),k,'HO',summ(ev(HO,F0,rules)))
for name,f in [('noPumpMig',lambda o:o.get('src')!='pump.fun migration'),('pot>=55',lambda o:o['pot']>=55),('ratio>=1.3',lambda o:o['f'].get('ratio',0)>=1.3),('liq>=15k',lambda o:o['f'].get('liq',0)>=15000),('noScalp',lambda o:o['tier']!='SCALP')]:
  print(name,'TR',summ(ev(TR,f,CUR))[0].__round__(2),'HO',summ(ev(HO,f,CUR)))
print('---robust')
for k in [(15,50,.3,20,2,0),(15,50,.3,20,6,0),(15,50,.3,20,2,1)]:
  R=runner(*k);rules={'SCALP':R,'SWING':R,'RUNNER':R}
  for nm,S in[('TR',TR),('HO',HO)]:
    r=ev(S,F0,rules);allp=sorted(q for p in r.values() for q in p)
    print(k,nm,'top',[round(x) for x in allp[-3:]],'sum',round(sum(allp)),'minusTop',round(sum(allp[:-1])))
  r=ev(HO,F0,CUR);allp=sorted(q for p in r.values() for q in p);print('CUR HO top',[round(x) for x in allp[-3:]],round(sum(allp)),round(sum(allp[:-1])))
print('---early')
for nm,R in [('noEarly',runner(15,50,.5,20,6,0)),('early25+be',dict(runner(15,50,.5,20,6,0),ladder=[(1.25,.35),(1.5,.325)],be=1))]:
  rules={'SCALP':R,'SWING':R,'RUNNER':R}
  print(nm,'TR',summ(ev(TR,F0,rules)));print(nm,'HO',summ(ev(HO,F0,rules)))
