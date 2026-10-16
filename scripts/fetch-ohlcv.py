# Fetch real 5m candles (GeckoTerminal, public) after each entry time, cached in /workspace/bt/ohlcv/
import json,os,sys,time,urllib.request
C='/workspace/bt/ohlcv/';os.makedirs(C,exist_ok=True)
def get(u):
  for i in range(4):
    try:
      r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'bt','Accept':'application/json'}),timeout=20);time.sleep(2.1);return json.load(r)
    except Exception as e:
      time.sleep(8*(i+1))
  return None
def fetch(mint,t0):
  f=C+mint+'.json'
  if os.path.exists(f):return
  d=get(f'https://api.geckoterminal.com/api/v2/networks/solana/tokens/{mint}/pools?page=1')
  if not d or not d.get('data'):json.dump({'err':'nopool'},open(f,'w'));return
  pool=d['data'][0]['attributes']['address'];bars=[]
  before=int(t0/1000)+48*3600
  for _ in range(2):
    o=get(f'https://api.geckoterminal.com/api/v2/networks/solana/pools/{pool}/ohlcv/minute?aggregate=5&limit=1000&before_timestamp={before}&currency=usd')
    if not o:break
    L=o['data']['attributes']['ohlcv_list'];bars+=L
    if not L or min(b[0] for b in L)<=t0/1000:break
    before=min(b[0] for b in L)
  json.dump({'pool':pool,'bars':sorted({b[0]:b for b in bars}.values())},open(f,'w'))
jobs=json.load(open(sys.argv[1]))
for i,(m,t) in enumerate(jobs):fetch(m,t);print(i,len(jobs),flush=True) if i%10==0 else None
