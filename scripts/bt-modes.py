# Per-mode filter check: 60/40 time split + drop-best on closed trades (archive + current). Usage: python3 scripts/bt-modes.py
import json
T=[]
for f in ['data/archive-20261022/positions.json','data/archive-20261022b/positions.json','data/positions.json']:
    try:T+=json.load(open(f))['closed']
    except Exception:pass
seen=set();U=[]
for c in sorted(T,key=lambda c:c['opened']):
    k=(c['mint'],c['opened'])
    if k not in seen:seen.add(k);U.append(c)
def ev(L):
    p=[c['pnl'] for c in L];return (round(sum(p),4),len(p),round(sum(p)-max(p),4) if p else 0)
def run(tier,name,flt):
    L=[c for c in U if c.get('tier')==tier];cut=int(len(L)*.6);A,B=L[:cut],L[cut:]
    k=lambda S:[c for c in S if flt(c.get('features') or {})]
    print(tier,name,'train',ev(A),'->',ev(k(A)),'| holdout',ev(B),'->',ev(k(B)))
run('BIG','liq<=mcap',lambda f:not(f.get('liq') and f.get('mcap') and f['liq']>f['mcap']))
run('BIG','h1<=200',lambda f:(f.get('pc') or {}).get('h1',0)<=200)
run('RUNNER','v5>=10k',lambda f:(f.get('v5') or 0)>=10000)
run('RUNNER','pc5>=0',lambda f:(f.get('pc5') or 0)>=0)
run('RUNNER','liq>=20k',lambda f:(f.get('liq') or 0)>=20000)
run('SWING','v5>=10k',lambda f:(f.get('v5') or 0)>=10000)
