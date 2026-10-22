# Moon v2 entry grid: 60/40 time split + drop-best on closed MOON trades (archive + current). Export /tmp/moon.json with the mb block in this file's docstring first.
import json,itertools
U=json.load(open('/tmp/moon.json'));n=len(U);cut=int(n*.6);A,B=U[:cut],U[cut:]
def ev(S,flt):
    k=[c for c in S if flt(c.get('features',{}))];p=[c['pnl'] for c in k]
    return round(sum(p),4),len(k),round(sum(p)-max(p),4) if p else 0
base=lambda f:True
print('base',ev(A,base),ev(B,base))
res=[]
for mb,mv,mr,pmin,pmax in itertools.product([0,20,50,100,200],[0,2000,5000,10000,20000],[0,1,1.3],[-100,-5,0],[100000,50,30,20]):
    fl=lambda f,mb=mb,mv=mv,mr=mr,pmin=pmin,pmax=pmax:(f.get('buys')or 0)>=mb and (f.get('v5')or 0)>=mv and (f.get('ratio')or 0)>=mr and pmin<=(f.get('pc5')or 0)<=pmax
    a,b=ev(A,fl),ev(B,fl)
    if a[1] and b[1]:res.append((a[0]+b[0],mb,mv,mr,pmin,pmax,a,b))
for r in sorted(res,reverse=True)[:12]:print(r)
