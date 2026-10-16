// Canvas that works everywhere: node-canvas if it is installed (PC), otherwise pure-JS pureimage (Android/Termux, no native build).
// toBuffer('image/png') returns a Buffer (node-canvas) or a Promise<Buffer> (pureimage): always `await` it.
const path=require('path');let NC=null;try{NC=require('canvas')}catch{}
let PI=null,fontsReady=null;
function loadFonts(){if(fontsReady)return fontsReady;PI=require('pureimage');const F=path.join(__dirname,'..','assets','fonts');
 const reg=(file,fam)=>{const f=PI.registerFont(path.join(F,file),fam);f.loadSync();return f};
 for(const fam of ['sans-serif','Sans','DejaVu Sans','Arial'])reg('DejaVuSans.ttf',fam);
 for(const fam of ['monospace','Mono'])reg('DejaVuSansMono.ttf',fam);
 fontsReady=true;return fontsReady}
// pureimage only knows "Npx Family"; drop bold/italic words and fall back to a registered family
const fixFont=f=>{const m=String(f).match(/(\d+(?:\.\d+)?)px\s*(.*)$/);if(!m)return '14px sans-serif';const fam=/mono/i.test(m[2])?'monospace':'sans-serif';return `${m[1]}px ${fam}`};
// emoji/other glyphs the font lacks would break pureimage; keep basic Latin, Latin-1 and common symbols
const clean=s=>String(s).replace(/[^\x20-\x7E\u00A0-\u024F\u2010-\u2027\u2030-\u205E\u2190-\u21FF\u2212\u2500-\u25FF]/g,'').replace(/\s{2,}/g,' ');
function createCanvas(W,H){if(NC)return NC.createCanvas(W,H);loadFonts();const img=PI.make(W,H);const raw=img.getContext('2d');
 const ctx=new Proxy(raw,{get(t,k){
  if(k==='setLineDash')return ()=>{};if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>{let c='#000';return {addColorStop:(o,col)=>{if(o===0||c==='#000')c=col},toString:()=>c,_solid:()=>c}};
  if(k==='fillText'||k==='strokeText')return (s,x,y,...a)=>{try{t[k](clean(s),x,y,...a)}catch{}};
  if(k==='measureText')return s=>{try{return t.measureText(clean(s))}catch{return {width:String(s).length*7}}};
  if(k==='strokeRect'&&!t.strokeRect)return (x,y,w,h)=>{t.beginPath();t.moveTo(x,y);t.lineTo(x+w,y);t.lineTo(x+w,y+h);t.lineTo(x,y+h);t.closePath();t.stroke()};
  const v=t[k];return typeof v==='function'?v.bind(t):v},
  set(t,k,v){if(k==='font')v=fixFont(v);else if((k==='fillStyle'||k==='strokeStyle')&&v&&typeof v==='object'&&v._solid)v=v._solid();else if(k==='shadowBlur'||k==='shadowColor'||k==='shadowOffsetX'||k==='shadowOffsetY')return true;try{t[k]=v}catch{}return true}});
 return {width:W,height:H,getContext:()=>ctx,toBuffer:async()=>{const {PassThrough}=require('stream');const s=new PassThrough(),ch=[];s.on('data',d=>ch.push(d));await PI.encodePNGToStream(img,s);return Buffer.concat(ch)}}}
module.exports={createCanvas,native:!!NC};
