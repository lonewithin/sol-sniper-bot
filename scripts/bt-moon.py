import json,sys;exec(open('scripts/bt-ohlcv.py').read())
O={}
for l in open(D+'observations.jsonl'):
  o=json.loads(l)
  if o.get('p0'):O.setdefault(o['mint'],o)
A=dict(minSafety=70,minLiq=15000,minBuys=300,minRatio=1.2,minAccel=2,minPc5=-15,maxPc5=120,minVol5=20000)
Cl={**A,'minBuys':150,'minRatio':1.1,'minAccel':1.5,'minVol5':10000,'minLiq':10000}
def F(o,P):f=o['f'];return o['safety']>=P['minSafety'] and f['liq']>=P['minLiq'] and f['buys']>=P['minBuys'] and f['ratio']>=P['minRatio'] and f['accel']>=P['minAccel'] and P['minPc5']<=f['pc5']<=P['maxPc5'] and f['v5']>=P['minVol5']
EA=[(m,o['t'],o['symbol']) for m,o in O.items() if F(o,A)];EC=[(m,o['t'],o['symbol']) for m,o in O.items() if F(o,Cl)]
now=dict(sl=30,ladder=[(2,0.8)],trail2=45,pct2=1,maxH=24)
V=[('NOW A: 80% at 2x, 45% trail, 24h',EA,now),
 ('A: 50% at 2x',EA,{**now,'ladder':[(2,.5)]}),('A: 60% at 2x',EA,{**now,'ladder':[(2,.6)]}),('A: 70% at 2x',EA,{**now,'ladder':[(2,.7)]}),
 ('A: ladder 50%@2x 25%@5x 15%@10x',EA,{**now,'ladder':[(2,.5),(5,.25),(10,.15)]}),
 ('A: ladder 60%@2x 20%@5x 10%@10x',EA,{**now,'ladder':[(2,.6),(5,.2),(10,.1)]}),
 ('A: 80%@2x trail 55%',EA,{**now,'trail2':55}),('A: 80%@2x trail 60%',EA,{**now,'trail2':60}),
 ('A: 80%@2x 48h',EA,{**now,'maxH':48}),
 ('A: ladder 50/25/15 trail 55 48h',EA,{**now,'ladder':[(2,.5),(5,.25),(10,.15)],'trail2':55,'maxH':48}),
 ('C: 80%@2x 45% 24h',EC,now),('C: ladder 50/25/15',EC,{**now,'ladder':[(2,.5),(5,.25),(10,.15)]}),
 ('C: ladder 50/25/15 trail 55 48h',EC,{**now,'ladder':[(2,.5),(5,.25),(10,.15)],'trail2':55,'maxH':48}),
 ('C: 60%@2x 45%',EC,{**now,'ladder':[(2,.6)]})]
print('entries A',len(EA),'C',len(EC))
for n,E,R in V:
  r=run(n,E,R)
  if r and '-v' in sys.argv:s=sorted(r,key=lambda x:-x[1]);print('     top',[(a,round(b),round(c,1)) for a,b,c in s[:3]],'net w/o best',round(sum(x[1] for x in s[1:])*0.05/100,4))
