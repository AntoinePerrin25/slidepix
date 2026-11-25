/**
 * Converts CSS colors to OKLCH so a morph can interpolate text and borders in that space.
 * The presentation runtime is this same source, spliced into the generated slide script.
 */

const TO_OKLCH = `function toOklch(value){
  const raw=String(value||'').trim().toLowerCase();
  if(!raw||raw==='none') return '';
  const parsed=parseCssColor(raw)||probeCssColor(raw);
  if(!parsed) return '';
  if(parsed.kind==='oklch') return formatOklch(parsed.l, parsed.c, parsed.h, parsed.a);
  const [l,c,h]=srgbToOklch(parsed.r, parsed.g, parsed.b);
  return formatOklch(l, c, h, parsed.a);
}
function formatOklch(l,c,h,a){
  if(!(c>0.0001)) h=0;
  return 'oklch('+roundColor(l)+' '+roundColor(c)+' '+roundColor(h)+' / '+roundColor(a)+')';
}
function roundColor(n){return String(Math.round(n*10000)/10000)}
function linSrgb(channel){const x=channel/255; return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4)}
function srgbToOklch(r,g,b){
  const rl=linSrgb(r), gl=linSrgb(g), bl=linSrgb(b);
  const l=Math.cbrt(0.4122214708*rl+0.5363325363*gl+0.0514459929*bl);
  const m=Math.cbrt(0.2119034982*rl+0.6806995451*gl+0.1073969566*bl);
  const s=Math.cbrt(0.0883024619*rl+0.2817188376*gl+0.6299787005*bl);
  const L=0.2104542553*l+0.7936177850*m-0.0040720468*s;
  const A=1.9779984951*l-2.4285922050*m+0.4505937099*s;
  const B=0.0259040371*l+0.7827717662*m-0.8086757660*s;
  let H=Math.atan2(B,A)*180/Math.PI;
  if(H<0) H+=360;
  return [L, Math.hypot(A,B), H];
}
function parseCssColor(raw){
  if(raw==='transparent') return {kind:'rgb', r:0, g:0, b:0, a:0};
  if(raw[0]==='#'){
    let hex=raw.slice(1);
    if(hex.length===3||hex.length===4) hex=[...hex].map((ch)=>ch+ch).join('');
    if(hex.length!==6&&hex.length!==8||/[^0-9a-f]/.test(hex)) return;
    const n=parseInt(hex,16);
    if(hex.length===6) return {kind:'rgb', r:(n>>16)&255, g:(n>>8)&255, b:n&255, a:1};
    return {kind:'rgb', r:(n>>24)&255, g:(n>>16)&255, b:(n>>8)&255, a:(n&255)/255};
  }
  const oklch=raw.match(/^oklch\\(\\s*([+-]?\\d*\\.?\\d+)(%)?\\s+([+-]?\\d*\\.?\\d+)\\s+([+-]?\\d*\\.?\\d+)(?:\\s*\\/\\s*([+-]?\\d*\\.?\\d+)(%)?)?\\s*\\)$/);
  if(oklch){
    const a=oklch[5]==null?1:oklch[6]?Number(oklch[5])/100:Number(oklch[5]);
    return {kind:'oklch', l:oklch[2]?Number(oklch[1])/100:Number(oklch[1]), c:Number(oklch[3]), h:Number(oklch[4]), a};
  }
  const rgb=raw.match(/^rgba?\\(\\s*([+-]?\\d*\\.?\\d+)(%)?\\s*[, ]\\s*([+-]?\\d*\\.?\\d+)(%)?\\s*[, ]\\s*([+-]?\\d*\\.?\\d+)(%)?(?:\\s*[,/]\\s*([+-]?\\d*\\.?\\d+)(%)?)?\\s*\\)$/);
  if(!rgb) return;
  const channel=(v,pct)=>pct?Number(v)*2.55:Number(v);
  const a=rgb[7]==null?1:rgb[8]?Number(rgb[7])/100:Number(rgb[7]);
  return {kind:'rgb', r:channel(rgb[1],rgb[2]), g:channel(rgb[3],rgb[4]), b:channel(rgb[5],rgb[6]), a};
}
function probeCssColor(raw){
  if(typeof document==='undefined'||!document.documentElement) return;
  const probe=document.createElement('span');
  probe.style.color=raw;
  if(!probe.style.color) return;
  document.documentElement.appendChild(probe);
  const computed=getComputedStyle(probe).color;
  probe.remove();
  return parseCssColor(String(computed||'').trim().toLowerCase());
}`;

const PAINT_RUNTIME = `function cssPaint(style, names){for(const name of names){const value=style[name]; if(value) return value} return ''}
function readPaint(root){
  const text=root.querySelector('.slidepix-text-content, .slidepix-table-content');
  const shape=root.querySelector('.slidepix-shape-content');
  const clip=root.querySelector('.slidepix-image-clip');
  const cells=[...root.querySelectorAll('.slidepix-table-content th, .slidepix-table-content td')];
  const vectors=[...root.querySelectorAll('.slidepix-vector-stroke, .slidepix-vector-head')];
  return {
    text:text?toOklch(cssPaint(text.style,['color'])):'',
    fill:shape?toOklch(cssPaint(shape.style,['backgroundColor','background'])):'',
    border:toOklch(shape?cssPaint(shape.style,['borderTopColor','borderColor']):clip?cssPaint(clip.style,['borderTopColor','borderColor']):''),
    cells:cells.map((cell)=>toOklch(cssPaint(cell.style,['borderTopColor','borderColor']))),
    vectors:vectors.map((node)=>toOklch(node.getAttribute('stroke')&&node.getAttribute('stroke')!=='none'?node.getAttribute('stroke'):node.getAttribute('fill')||''))
  };
}
function animatePaint(root, prior, duration, easing){
  if(!prior) return;
  const next=readPaint(root), opts={duration, easing};
  const text=root.querySelector('.slidepix-text-content, .slidepix-table-content');
  if(text&&prior.text&&next.text&&prior.text!==next.text) text.animate([{color:prior.text},{color:next.text}], opts);
  const shape=root.querySelector('.slidepix-shape-content');
  if(shape&&prior.fill&&next.fill&&prior.fill!==next.fill) shape.animate([{backgroundColor:prior.fill},{backgroundColor:next.fill}], opts);
  const borderNode=shape||root.querySelector('.slidepix-image-clip');
  if(borderNode&&prior.border&&next.border&&prior.border!==next.border) borderNode.animate([{borderColor:prior.border},{borderColor:next.border}], opts);
  const cells=[...root.querySelectorAll('.slidepix-table-content th, .slidepix-table-content td')];
  cells.forEach((cell, index)=>{const from=prior.cells[index], to=next.cells[index]; if(from&&to&&from!==to) cell.animate([{borderColor:from},{borderColor:to}], opts)});
  const vectors=[...root.querySelectorAll('.slidepix-vector-stroke, .slidepix-vector-head')];
  vectors.forEach((node, index)=>{
    const from=prior.vectors[index], to=next.vectors[index];
    if(!from||!to||from===to) return;
    const prop=node.getAttribute('stroke')&&node.getAttribute('stroke')!=='none'?'stroke':'fill';
    node.animate([{[prop]:from},{[prop]:to}], opts);
  });
}`;

let compiled: ((value: string) => string) | undefined;

/** Specified CSS color as an `oklch()` string. Empty when the value is not a solid color. */
export function toOklchCss(value: string): string {
  compiled ??= new Function(`${TO_OKLCH}; return toOklch;`)() as (value: string) => string;
  return compiled(value);
}

/** Helpers inlined into the presentation script. Both morph endpoints are `oklch()`, so the browser interpolates in OKLCH. */
export function morphColorRuntime(): string {
  return `${TO_OKLCH}\n${PAINT_RUNTIME}`;
}
