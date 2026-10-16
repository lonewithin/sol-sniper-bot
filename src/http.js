// fetch JSON with timeout. GET requests retry once on 429 / 5xx / timeout (rate limits on free APIs), with a short wait.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function j(url,opt={},ms=8000){const get=!opt.method||opt.method==='GET';let last;
 for(let a=0;a<(get?2:1);a++){try{const r=await fetch(url,{...opt,signal:AbortSignal.timeout(ms),headers:{'content-type':'application/json','user-agent':'sol-sniper-bot',...(opt.headers||{})}});
  if(!r.ok){last=new Error(r.status+' '+url.split('?')[0]);if(get&&(r.status===429||r.status>=500)&&a===0){await wait(r.status===429?1500:800);continue}throw last}return await r.json()}
  catch(e){last=e;if(get&&a===0&&/timeout|aborted|fetch failed/i.test(e.message||'')){await wait(500);continue}throw e}}throw last};
