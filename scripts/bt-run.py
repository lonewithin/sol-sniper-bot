import json,sys;sys.path.insert(0,'scripts');exec(open('scripts/bt-ohlcv.py').read())
BE={}
for l in open(D+'trades.jsonl'):
  t=json.loads(l)
  if t['tier']=='BIG':BE[t['mint']]=(t['mint'],t['opened'],t['symbol'])
for l in open(D+'big_shadow.jsonl'):
  t=json.loads(l);BE.setdefault(t['mint'],(t['mint'],t['t'],t['symbol']))
BE=list(BE.values())
cur=dict(sl=25,ladder=[(1.5,0.5)],trail1=25,trail2=25,arm=30,armMin=3,lockAt=20,lockPct=3,flatMin=50,maxH=8,be=True)
V={'NOW: half at +50%, 25pt trail, lock':cur,
 'half at 2x, rest 40% trail':{**cur,'ladder':[(2,0.5)],'trail2':40,'pct2':1},
 '40% at 2x, rest 50% trail, 24h':{**cur,'ladder':[(2,0.4)],'trail2':50,'pct2':1,'maxH':24},
 '1/3 at 2x, 1/3 at 3x, rest 50% trail 24h':{**cur,'ladder':[(2,1/3),(3,1/3)],'trail2':50,'pct2':1,'maxH':24},
 'half at 3x, rest 50% trail 24h':{**cur,'ladder':[(3,0.5)],'trail2':50,'pct2':1,'maxH':24},
 'NOW + 24h hold':{**cur,'maxH':24},
 'half +50%, rest 40% pct-trail 24h':{**cur,'trail2':40,'pct2':1,'maxH':24},
}
print('BIG PLAY entries:',len(BE))
for n,R in V.items():run(n,BE,R)
print('--- sensitivity (rest after +50% half-sell rides a %-of-peak trail)')
for tr in (30,40,50):
  for mh in (8,24):
    R={**cur,'trail2':tr,'pct2':1,'maxH':mh};r=run(f'trail {tr}% of peak, max {mh}h',BE,R)
    s=sorted(r,key=lambda x:-x[1]);print('     top:',[(a,round(b),round(c,1)) for a,b,c in s[:3]],' net w/o best:',round(sum(x[1] for x in s[1:])*0.05/100,4))
