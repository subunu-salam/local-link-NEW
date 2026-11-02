/* Local Link — SPA frontend (vanilla JS). Talks to the Express API. */
(() => {
'use strict';

/* ---------------- state ---------------- */
let token = localStorage.getItem('ll_token') || null;
let me = safeParse(localStorage.getItem('ll_user'));
const state = {
  view: 'customer',
  lang: localStorage.getItem('ll_lang') || 'en',
  theme: localStorage.getItem('ll_theme') || 'dark',
  custTheme: localStorage.getItem('ll_ctheme') || 'light',   // customer app: light (default) / dark
  areaId: Number(localStorage.getItem('ll_area')) || 1,
  areaName: localStorage.getItem('ll_area_name') || 'Kunnamangalam',
  onboarded: localStorage.getItem('ll_onboarded') === '1',
  introSeen: localStorage.getItem('ll_intro') === '1',
  aiStatus: { openai: false, model: 'gpt-4o-mini' },
};
let ref = { categories: [], areas: [], panchayaths: [], districts: [], plans: [] };
const nav = { customer: [], partner: [], admin: [] };

/* ---------------- utils ---------------- */
function safeParse(s){ try { return JSON.parse(s); } catch { return null; } }
const $ = (sel, root=document) => root.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const grad = (a,b) => `linear-gradient(135deg,${a},${b||a})`;
const money = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
/* Real photos: permanent, fast Unsplash CDN images mapped by keyword (verified,
   never 404). Falls back to a guaranteed-loading seeded photo, then to the
   gradient tile beneath (onerror removes the img). */
const _PH_POOLS = {
  biryani:['1563379091339-03b21ab4a4f8','1633945274405-b6c8069047b0','1701579231305-d84d8af9a3fd','1631515243349-e0cb75fb8d3a'],
  grilled:['1598515214211-89d3c73ae83b','1567620832903-9fc6debc209f'],
  fish:['1519708227418-c8fd9a32b7a2','1580476262798-bddd9f4b7369'],
  cake:['1578985545062-69928b1d9587','1535141192574-5d4897c12636','1558961363-fa8fdf82db35'],
  bakery:['1509440159596-0249088772ff','1608198093002-ad4e005484ec'],
  rice:['1586201375761-83865001e31c'], oil:['1474979266404-7eaacbcd87c5'], eggs:['1518569656558-1f25e69d93d7'],
  grocery:['1542838132-92c53300491e','1604719312566-8912e9227c6a'],
  vegetables:['1540420773420-3366772f4999','1518843875459-f738682238a6'],
  jewellery:['1515562141207-7a88fb7ce338','1599643478518-a784e5dc4c8f'],
  necklace:['1611591437281-460bfbe1220a'], ring:['1605100804763-247f67b3557e'],
  shirt:['1602810318383-e386cc2a3ccf'], kurti:['1610030469983-98e550d6193c'],
  jeans:['1542272604-787c3835535d'], shoes:['1542291026-7eec264c27ff'], handbag:['1584917865442-de89df76afd3'],
  clothing:['1489987707025-afc232f7ea0f'], smartphone:['1511707171634-5f897ff02aa9'], earbuds:['1590658268037-6bf12165a8df'],
  laptop:['1496181133206-80ce9b88a853'], tv:['1593359677879-a4bb92f829d1'], mixer:['1585515320310-259814833e62'],
  medicine:['1584308666744-24d5c474f2ae'], sanitizer:['1584744982491-665216d95f8b'],
  restaurant:['1517248135467-4c7edcad34c4'], supermarket:['1578916171728-46686eac8d58'], salon:['1560066984-138dadb4c035'],
};
const _PH_RULES = [
  [['sanitizer'],'sanitizer'],[['first','aid','medicine','tablet','vitamin','paracetamol','pharma','strip'],'medicine'],
  [['earbud','airdopes','wireless','headphone'],'earbuds'],[['laptop','computer'],'laptop'],[['television','led tv',' tv'],'tv'],
  [['mixer','grinder','appliance'],'mixer'],[['smartphone','phone','mobile'],'smartphone'],
  [['necklace','bangle','bridal','jhumka'],'necklace'],[['ring','diamond'],'ring'],[['earring','gold','jewel'],'jewellery'],
  [['jeans','denim'],'jeans'],[['shoe','sneaker','footwear'],'shoes'],[['handbag','tote'],'handbag'],[['bag'],'handbag'],
  [['shirt','formal'],'shirt'],[['kurti','gown','dress','women','saree','silk','kanchipuram'],'kurti'],
  [['kids','tshirt','tee','jacket','fashion','clothing','apparel'],'clothing'],
  [['grill','arabic','faham','kebab','tandoor','mandi','shawa'],'grilled'],[['biryani','biriyani','pulao'],'biryani'],
  [['fish','prawn','seafood','meat','pollichathu'],'fish'],[['halwa','cake','sweet','dessert'],'cake'],
  [['puff','bun','pastry','bakery','cookie','bread','paratha','porotta','pathiri','kuboos','pita','dilkush','nankhatai','snack'],'bakery'],
  [['tomato','onion','banana','chilli','vegetable','fruit','plantain','veg'],'vegetables'],[['egg'],'eggs'],[['oil'],'oil'],
  [['rice','atta','flour','dal','lentil','gram','sugar','matta','basmati','wheat'],'rice'],
  [['milk','butter','dairy','tea','detergent','biscuit','provision','combo'],'grocery'],
  [['restaurant','hotel','dining','meals'],'restaurant'],[['supermarket','hypermarket','grocery','store','mart','market'],'supermarket'],
  [['salon','beauty','spa','makeup'],'salon'],
];
function _phHash(s){ s=String(s); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
const pic = (kw, seed, w=640, h=520) => {
  const k=String(kw||'').toLowerCase(); let bucket=null;
  for(const [words,b] of _PH_RULES){ if(words.some(x=>k.includes(x))){ bucket=b; break; } }
  const pool=bucket&&_PH_POOLS[bucket];
  if(pool&&pool.length) return `https://images.unsplash.com/photo-${pool[_phHash(seed)%pool.length]}?w=${w}&h=${h}&q=70&auto=format&fit=crop`;
  return `https://picsum.photos/seed/ll${_phHash(kw+'|'+seed)%100000}/${w}/${h}`;
};
function coverKw(b){ const s=((b&&(b.subcategory||b.category_name))||'').toLowerCase();
  if(/restaurant|hotel|biriyani|food/.test(s)) return 'restaurant,food';
  if(/bakery|cake|bake|puff|bun/.test(s)) return 'bakery,cakes';
  if(/grocery|supermarket|hypermarket|provision/.test(s)) return 'supermarket,grocery';
  if(/meat|seafood|fish/.test(s)) return 'seafood,market';
  if(/vegetable|fruit/.test(s)) return 'vegetables,market';
  if(/jewel|gold/.test(s)) return 'jewellery,gold,shop';
  if(/cloth|fashion|apparel/.test(s)) return 'clothing,boutique';
  if(/electronic|mobile|phone/.test(s)) return 'electronics,store';
  if(/pharma|medical|clinic|dental/.test(s)) return 'pharmacy,clinic';
  if(/ac|appliance|refriger/.test(s)) return 'air,conditioner';
  if(/electric/.test(s)) return 'electrician,tools';
  if(/salon|beauty/.test(s)) return 'salon,beauty';
  if(/auto|car|tyre|garage/.test(s)) return 'car,garage';
  if(/hardware|paint/.test(s)) return 'hardware,tools';
  return 'local,shop,storefront';
}
/* <img> overlaying a gradient tile — real photo when it loads, graceful gradient if not */
function photoLayer(src){ return `<img class="ph" src="${src}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()"/>`; }
/* Read an uploaded image file, downscale, return a compact JPEG data URL (no external storage needed) */
function readImageFile(file, max=760){ return new Promise((resolve,reject)=>{
  if(!file) return reject(new Error('no file'));
  const fr=new FileReader(); fr.onerror=()=>reject(fr.error);
  fr.onload=()=>{ const img=new Image(); img.onerror=()=>reject(new Error('bad image'));
    img.onload=()=>{ let w=img.naturalWidth, h=img.naturalHeight; const s=Math.min(1,max/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s);
      const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      try{ resolve(c.toDataURL('image/jpeg',0.82)); }catch(e){ reject(e); } };
    img.src=fr.result; };
  fr.readAsDataURL(file); }); }
function toast(msg){ const t = h(`<div class="toast">${esc(msg)}</div>`); $('#toast-host').appendChild(t); setTimeout(()=>{ t.style.opacity='0'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); }, 2200); }

async function api(pathname, opts={}) {
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + pathname, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/* ---------------- i18n ---------------- */
const DICT = {
  en: { greetM:'Good morning', greetA:'Good afternoon', greetE:'Good evening', search:'Search businesses, products, services…',
    nearYou:'Near You', offersNear:'Offers Near You', popularServices:'Popular Services', localUpdates:"What's Happening Locally",
    seeAll:'See all', explore:'Explore Local', categories:'Categories', home:'Home', orders:'Orders', notifications:'Alerts', profile:'Profile',
    call:'Call', whatsapp:'WhatsApp', directions:'Directions', share:'Share', about:'About', products:'Products', services:'Services',
    reviews:'Reviews', offers:'Offers', openNow:'Open now', rating:'Rating', nearby:'Nearby', askTitle:'Ask Local Link',
    askPh:'Try “find a plumber” or “biriyani under ₹250”', enquire:'Send enquiry', requestService:'Request service',
    login:'Log in', continue:'Continue', workers:'Workers', transport:'Transport', localInfo:'Local Info', news:'News', events:'Events',
    askHi:'Hi! Ask me to find local businesses, services, workers or rides — type or tap the mic to speak in English or Malayalam.',
    askOffline:'(Offline smart-search — add an OpenAI key on the server for full AI.)',
    chipPlumber:'Find a plumber', chipBiriyani:'Biriyani under ₹250', chipAuto:'Auto to the station', chipGrocery:'Grocery near me', chipAC:'AC repair today' },
  ml: { greetM:'സുപ്രഭാതം', greetA:'ഉച്ചവന്ദനം', greetE:'ശുഭ സന്ധ്യ', search:'സ്ഥാപനങ്ങൾ, ഉൽപ്പന്നങ്ങൾ, സേവനങ്ങൾ തിരയുക…',
    nearYou:'അടുത്തുള്ളവ', offersNear:'അടുത്തുള്ള ഓഫറുകൾ', popularServices:'ജനപ്രിയ സേവനങ്ങൾ', localUpdates:'പ്രാദേശിക വാർത്തകൾ',
    seeAll:'എല്ലാം', explore:'പ്രാദേശികം കണ്ടെത്തുക', categories:'വിഭാഗങ്ങൾ', home:'ഹോം', orders:'ഓർഡറുകൾ', notifications:'അറിയിപ്പുകൾ', profile:'പ്രൊഫൈൽ',
    call:'വിളിക്കുക', whatsapp:'വാട്ട്‌സ്ആപ്പ്', directions:'വഴി', share:'പങ്കിടുക', about:'വിവരം', products:'ഉൽപ്പന്നങ്ങൾ', services:'സേവനങ്ങൾ',
    reviews:'അവലോകനങ്ങൾ', offers:'ഓഫറുകൾ', openNow:'തുറന്നിരിക്കുന്നു', rating:'റേറ്റിംഗ്', nearby:'സമീപം', askTitle:'ലോക്കൽ ലിങ്കിനോട് ചോദിക്കൂ',
    askPh:'“പ്ലംബറെ കണ്ടെത്തൂ” അല്ലെങ്കിൽ “₹250-ൽ താഴെ ബിരിയാണി”', enquire:'അന്വേഷണം അയയ്ക്കുക', requestService:'സേവനം അഭ്യർത്ഥിക്കുക',
    login:'ലോഗിൻ', continue:'തുടരുക', workers:'തൊഴിലാളികൾ', transport:'ഗതാഗതം', localInfo:'പ്രാദേശിക വിവരം', news:'വാർത്ത', events:'പരിപാടികൾ',
    askHi:'നമസ്കാരം! പ്രാദേശിക ബിസിനസ്സുകൾ, സേവനങ്ങൾ, തൊഴിലാളികൾ, യാത്ര എന്നിവ കണ്ടെത്താൻ ചോദിക്കൂ — ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക് അമർത്തി സംസാരിക്കുക.',
    askOffline:'(ഓഫ്‌ലൈൻ സ്മാർട്ട് സെർച്ച് — പൂർണ്ണ AI-ക്ക് സെർവറിൽ OpenAI കീ ചേർക്കുക.)',
    chipPlumber:'പ്ലംബറെ കണ്ടെത്തൂ', chipBiriyani:'₹250-ൽ താഴെ ബിരിയാണി', chipAuto:'സ്റ്റേഷനിലേക്ക് ഓട്ടോ', chipGrocery:'അടുത്തുള്ള പലചരക്ക്', chipAC:'എസി റിപ്പയർ ഇന്ന്' },
};
const t = (k) => (DICT[state.lang] && DICT[state.lang][k]) || DICT.en[k] || k;
const catLabel = (c) => state.lang==='ml' && c.name_ml ? c.name_ml : c.name;

/* ---------------- icons ---------------- */
const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  explore:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-3.6 1.4L10 14l3.6-1.4L15 9Z"/></svg>',
  bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.5L18 9.2l-4.3 1.7L12 15.5l-1.7-4.6L6 9.2l4.3-1.7L12 3Z"/><path d="M18.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.5 21 3 13.5 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.2Z"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.2.1.7-.1 1.2Z"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-3.9 0-7 3-7 6.9 0 4.6 5.5 10.4 6.4 11.3.3.3.9.3 1.2 0 .9-.9 6.4-6.7 6.4-11.3C19 5 15.9 2 12 2Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
  dir:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.6 10.6 19.3C5.6 14.8 2.3 11.8 2.3 8.1 2.3 5.1 4.6 2.8 7.6 2.8c1.7 0 3.3.8 4.4 2.1 1.1-1.3 2.7-2.1 4.4-2.1 3 0 5.3 2.3 5.3 5.3 0 3.7-3.3 6.7-8.3 11.2L12 20.6Z"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16l-5.9 3.4L7.6 13l-5-4.3L9.1 8 12 2Z"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16l-1-5H5L4 9Z"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 3h8v8l-9 9-8-8Z"/><circle cx="16" cy="8" r="1.4"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c1-3.5 4-5 6-5s5 1.5 6 5"/><path d="M17 5a3 3 0 0 1 0 6"/></svg>',
  cog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 12h9M13 8l-4 4 4 4"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
};
const ic = (name) => `<span class="ic-svg">${I[name]||''}</span>`;

/* ---------- premium line-icon set (lucide-style, replaces all emoji) ---------- */
const _s='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
const GI = {
  store:_s+'<path d="M4 9h16l-1-4H5L4 9Z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/></svg>',
  fork:_s+'<path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 3c-1.7 0-3 2-3 5s1 4 3 4.5V21"/></svg>',
  cart:_s+'<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M2 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19 8H5.5"/></svg>',
  download:_s+'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
  send:_s+'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>',
  sparkles:_s+'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  bread:_s+'<path d="M5 12a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v0H5Z"/><path d="M5 12h14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z"/></svg>',
  fish:_s+'<path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z"/><circle cx="9" cy="12" r=".7" fill="currentColor"/><path d="M18 9.5c1 1 1 4 0 5"/></svg>',
  leaf:_s+'<path d="M20 4C9 4 4 9 4 18c0 0 8 1.5 12-4 3-4 4-10 4-10Z"/><path d="M5 19c3.5-7 9-10.5 13-11.5"/></svg>',
  diamond:_s+'<path d="M6 4h12l3 5-9 11L3 9l3-5Z"/><path d="M3 9h18M9 4l-1.5 5L12 20l4.5-11L15 4"/></svg>',
  shirt:_s+'<path d="M6 4l3-1a3 3 0 0 0 6 0l3 1 2 4-3 1v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9L4 8l2-4Z"/></svg>',
  device:_s+'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
  cross:_s+'<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z"/></svg>',
  snow:_s+'<path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5"/><path d="M12 5 9.5 7.5 12 5l2.5 2.5M12 19l-2.5-2.5M12 19l2.5-2.5M5 9l.7 3.2L3 11M19 9l-.7 3.2L21 11M5 15l.7-3.2M19 15l-.7-3.2"/></svg>',
  bolt:_s+'<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  wrench:_s+'<path d="M20 5a4 4 0 0 1-5.3 5.3L7 18l-2-2 7.7-7.7A4 4 0 0 1 18 3l-2.3 2.3 1.5 1.5L20 5Z"/></svg>',
  scissors:_s+'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8 8l12 8M8 16 20 8"/></svg>',
  car:_s+'<path d="M5 11l1.4-4.2A2 2 0 0 1 8.3 5.5h7.4a2 2 0 0 1 1.9 1.3L19 11"/><path d="M4 16v-3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3h-2M6 16H4M20 16h-2M6 16v1.5M18 16v1.5"/><circle cx="7.5" cy="16" r="1.2"/><circle cx="16.5" cy="16" r="1.2"/></svg>',
  package:_s+'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
  nut:_s+'<path d="M8 3.5h8l4 8.5-4 8.5H8l-4-8.5L8 3.5Z"/><circle cx="12" cy="12" r="3"/></svg>',
  helmet:_s+'<path d="M3 14a9 9 0 0 1 18 0"/><path d="M3 14h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2ZM9 14V7h2M13 14V8"/></svg>',
  bank:_s+'<path d="M3 10 12 4l9 6M4 10v8M20 10v8M8 10v8M16 10v8M3 20h18"/></svg>',
  cap:_s+'<path d="M2 8l10-4 10 4-10 4L2 8Z"/><path d="M6 10v5c0 1 3 2.5 6 2.5s6-1.5 6-2.5v-5M22 8v5"/></svg>',
  shield:_s+'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/></svg>',
  flame:_s+'<path d="M12 3c1 3 5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 2 2 2 2 0 0-2-1-3-1-5Z"/></svg>',
  building:_s+'<path d="M4 21V6l8-3 8 3v15M3 21h18M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/></svg>',
  calendar:_s+'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
  news:_s+'<rect x="3" y="4" width="14" height="16" rx="1.5"/><path d="M17 8h4v10a2 2 0 0 1-2 2M6 8h5M6 12h5M6 16h4"/></svg>',
  percent:_s+'<path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/></svg>',
  inbox:_s+'<path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5 5Z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
  lock:_s+'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  compass:_s+'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 1 2-5 4-1Z"/></svg>',
  megaphone:_s+'<path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M16 8a4 4 0 0 1 0 8"/></svg>',
  card:_s+'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
  chat:_s+'<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>',
  clock:_s+'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  warning:_s+'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v5M12 18h.01"/></svg>',
  mic:_s+'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
  send:_s+'<path d="M4.5 12 20 5l-6.5 15-2.2-6.3L4.5 12Z"/></svg>',
};
Object.assign(GI, { search:I.search, heart:I.heart, star:I.star, bell:I.bell, bag:I.bag, tag:I.tag, users:I.users, user:I.user, pin:I.pin, cog:I.cog });
const CAT_ICON = { 'food-grocery':'fork','shopping':'shirt','services':'wrench','workers':'helmet','transport':'car','healthcare':'cross','local-info':'building','news':'news','events':'calendar','classifieds':'percent' };
const SUB_ICON = [
  [/restaurant|hotel|biriyani|meals|cafe|café|dining|food/,'fork'],
  [/grocery|supermarket|super ?market|hypermarket|provision|mart/,'cart'],
  [/bakery|bake|cake|puff/,'bread'],
  [/meat|seafood|fish|chicken|butcher/,'fish'],
  [/vegetable|fruit|\bveg\b/,'leaf'],
  [/jewel|gold|diamond/,'diamond'],
  [/cloth|fashion|boutique|apparel|footwear|textile/,'shirt'],
  [/electronic|mobile|laptop|digital|gadget/,'device'],
  [/pharma|medical|medicine|chemist|clinic|dental|hospital|doctor|health/,'cross'],
  [/\bac\b|air ?condition|fridge|refriger|washing|appliance/,'snow'],
  [/electric|wiring|electrician/,'bolt'],
  [/plumb|carpenter|wood|furniture|repair|fitting/,'wrench'],
  [/salon|beauty|barber|hair|makeup|spa/,'scissors'],
  [/tyre|tire|auto ?care|automotive|garage|denting|car ?wash/,'car'],
  [/hardware|paint|tools|building material/,'nut'],
  [/taxi|cab/,'car'],[/courier|delivery|parcel/,'package'],
  [/bank|atm/,'bank'],[/school|college|\bnit\b|education|tuition|academy/,'cap'],
  [/police/,'shield'],[/fire/,'flame'],[/ambulance|blood/,'cross'],
  [/govern|panchayath|village office|municipal|corporation/,'building'],
];
function iconKeyFor(o, fallback){
  const s = ((o.subcategory||'')+' '+(o.name||'')+' '+(o.category||'')+' '+(o.skills||'')+' '+(o.service_type||'')).toLowerCase();
  for (const [re,ic2] of SUB_ICON) if (re.test(s)) return ic2;
  if (o.category_slug && CAT_ICON[o.category_slug]) return CAT_ICON[o.category_slug];
  return fallback || 'store';
}
function gi(name){ return `<span class="gi">${GI[name]||GI.store}</span>`; }
function catIcon(slug){ return `<span class="gi">${GI[CAT_ICON[slug]||'store']}</span>`; }
function dIcon(o, fallback){ return `<span class="gi">${GI[iconKeyFor(o,fallback)]||GI.store}</span>`; }
function driverIcon(t){ return gi(t==='delivery'?'package':'car'); }

/* ---------------- shell ---------------- */
function applyTheme(){
  const root = document.documentElement;
  const th = state.view==='customer' ? 'light' : state.theme;  // customer app = Noon-style light
  if (th==='system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', th);
}

/* ---------------- cart (client-side, persisted) ---------------- */
let cart = safeParse(localStorage.getItem('ll_cart')) || [];
function saveCart(){ localStorage.setItem('ll_cart', JSON.stringify(cart)); }
function cartCount(){ return cart.reduce((n,i)=>n+i.qty,0); }
function cartTotal(){ return cart.reduce((n,i)=>n+i.qty*i.price,0); }
function cartBizId(){ return cart.length ? cart[0].bizId : null; }
/* Themed confirm dialog (replaces the browser's confirm()) → resolves true/false */
function confirmDialog({title, message, ok='Yes', cancel='Cancel', danger=false, icon}){
  return new Promise(resolve=>{
    const host = document.querySelector('.phone') || document.body;
    const back = document.createElement('div'); back.className='cd-back';
    back.innerHTML = `<div class="cd-card">
      ${icon?`<div class="cd-ic">${icon}</div>`:''}
      <h3 class="cd-title">${esc(title)}</h3>
      <p class="cd-msg">${esc(message)}</p>
      <div class="cd-acts"><button class="btn ghost cd-cancel">${esc(cancel)}</button><button class="btn ${danger?'cd-danger':''} cd-ok">${esc(ok)}</button></div>
    </div>`;
    host.appendChild(back);
    requestAnimationFrame(()=>back.classList.add('on'));
    const done=(v)=>{ back.classList.remove('on'); setTimeout(()=>back.remove(),200); resolve(v); };
    back.querySelector('.cd-ok').onclick=()=>done(true);
    back.querySelector('.cd-cancel').onclick=()=>done(false);
    back.onclick=(e)=>{ if(e.target===back) done(false); };
  });
}
async function addToCart(item){
  // One-store cart: items must all come from the same business
  const cur = cartBizId();
  if(cart.length && cur && item.bizId && Number(cur)!==Number(item.bizId)){
    const ok = await confirmDialog({
      title: 'Start a new cart?',
      message: `Your cart has items from ${cart[0].biz||'another store'}. You can only order from one store at a time. Clear it and add ${item.name} from ${item.biz||'this store'}?`,
      ok: 'Start new cart', cancel: 'Keep current', icon: GI.cart });
    if(!ok) return false;
    cart = []; // clear the old store's cart
  }
  const ex=cart.find(i=>i.id===item.id); if(ex) ex.qty++; else cart.push({...item,qty:1});
  saveCart(); toast(item.name+' added to cart'); updateCartBadge(); return true;
}
function setQty(id,d){ const it=cart.find(i=>i.id===id); if(!it)return; it.qty+=d; if(it.qty<=0) cart=cart.filter(i=>i.id!==id); saveCart(); }
function updateCartBadge(){ const n=cartCount(); document.querySelectorAll('.bnav .cartbadge:not(.pchatbadge), .hcbadge').forEach(b=>{ b.textContent=n; b.hidden=!n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }); }
function setPartnerChatBadge(n){ const b=document.querySelector('.pchatbadge'); if(b){ b.textContent=n||0; b.hidden=!n; } }

/* ---------------- wishlist / saved items (persisted) ---------------- */
let saved = safeParse(localStorage.getItem('ll_saved')) || [];
function saveSaved(){ localStorage.setItem('ll_saved', JSON.stringify(saved)); }
function isSaved(type,id){ return saved.some(s=>s.type===type && String(s.id)===String(id)); }
function toggleSaved(item){ const i=saved.findIndex(s=>s.type===item.type && String(s.id)===String(item.id));
  if(i>=0){ saved.splice(i,1); toast('Removed from wishlist'); } else { saved.unshift(item); toast('Saved to wishlist'); }
  saveSaved(); }
function stars(r){ return `<span class="stars">${I.star}${Number(r||0).toFixed(1)}</span>`; }

function miniControls(){
  return `<div class="mini-ctrl">
    <div class="lang-toggle" data-mini-lang><button data-l="en" class="${state.lang==='en'?'on':''}">EN</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മ</button></div>
    <button class="tb-btn" data-mini-theme title="Theme">${I.sun}</button></div>`;
}
// Swap the PWA manifest/icon/title to match the current surface, so installing
// from anywhere (even after switching apps in-session) adds the right app.
const LL_MANIFEST = {
  customer: { manifest:'/manifest.webmanifest', icon:'/icon-192.png', title:'Local Link — Everything Local. One Place.', appleTitle:'Local Link', theme:'#8A0002' },
  launcher: { manifest:'/manifest.webmanifest', icon:'/icon-192.png', title:'Local Link — Everything Local. One Place.', appleTitle:'Local Link', theme:'#8A0002' },
  partner:  { manifest:'/manifest-partner.webmanifest', icon:'/icon-partner-192.png', title:'Local Link Partner', appleTitle:'LL Partner', theme:'#B45309' },
  admin:    { manifest:'/manifest-admin.webmanifest', icon:'/icon-admin-192.png', title:'Local Link Admin', appleTitle:'LL Admin', theme:'#0F172A' },
};
function applyManifest(view){
  const m = LL_MANIFEST[view] || LL_MANIFEST.customer;
  const set=(sel,attr,val)=>{ const el=document.querySelector(sel); if(el) el.setAttribute(attr,val); };
  set('link[rel="manifest"]','href',m.manifest);
  set('link[rel="apple-touch-icon"]','href',m.icon);
  set('meta[name="theme-color"]','content',m.theme);
  set('meta[name="apple-mobile-web-app-title"]','content',m.appleTitle);
  document.title = m.title;
}
function renderShell(){
  applyManifest(state.view);
  applyTheme();
  document.body.classList.toggle('ml', state.lang==='ml');
  document.body.classList.toggle('cdark', state.view==='customer' && state.custTheme==='dark');
  document.body.dataset.app = state.view;
  const stage = $('#stage');
  if (state.view==='admin'){ stage.innerHTML = `<div class="admin-shell" id="adminshell"></div>`; renderAdmin($('#adminshell')); return; }
  if (state.view==='launcher'){ renderLauncher(stage); return; }
  // customer / partner render as a standalone full-screen mobile app
  stage.innerHTML = `<div class="appwrap"><div class="phone"><div class="screen" id="screen"></div><div id="navholder"></div></div></div>`;
  if (!nav[state.view].length) nav[state.view].push(state.view==='customer'
    ? {name:'splash'}   // always show the branded opening animation on launch
    : {name: token && me && me.role==='business_partner' ? 'p_dash' : 'p_login'});
  routeRender();
}
function cycleTheme(){ state.theme = state.theme==='system'?'light':state.theme==='light'?'dark':'system'; localStorage.setItem('ll_theme',state.theme); applyTheme(); const b=document.querySelector('[data-mini-theme]'); toast('Theme: '+state.theme); }
function toggleCustTheme(){ state.custTheme = state.custTheme==='dark'?'light':'dark'; localStorage.setItem('ll_ctheme', state.custTheme); document.body.classList.toggle('cdark', state.custTheme==='dark'); toast(state.custTheme==='dark'?'Dark mode on':'Light mode on'); }

function openView(view){
  state.view = view;
  const path = view==='partner'?'/partner':view==='admin'?'/admin':view==='launcher'?'/apps':'/';
  try{ history.pushState({view}, '', path); }catch(e){}
  renderShell();
}
function renderLauncher(stage){
  stage.innerHTML = `<div class="launcher">
    <div class="launch-hero">${logoMark(76)}<h1>Local Link</h1><p>Everything Local. One Place.</p></div>
    <div class="launch-grid">
      ${[['customer','Customer App','Discover shops, services, offers & more near you',GI.compass,'/'],
         ['partner','Partner App','Manage your business, products & orders',GI.store,'/partner'],
         ['admin','Admin Panel','CRM to run the whole platform',GI.wrench,'/admin']].map(([v,t2,d,e,p])=>`
        <button class="launch-card" data-view="${v}">
          <div class="lc-ic">${e}</div><h3>${t2}</h3><p>${d}</p><span class="lc-link">Open ${p} ${I.chev}</span></button>`).join('')}
    </div>
    <p class="faint" style="text-align:center;margin-top:26px;font-size:12.5px">Three separate apps · one backend · one login system</p></div>`;
  stage.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openView(b.dataset.view));
}

function logoMark(size=26){
  // Local Link mark: original pin + linked rings, in Cherry Cola & Cream Vanilla (animated via .llogo)
  return `<svg class="llogo" width="${size}" height="${size}" viewBox="0 0 40 44" fill="none" aria-hidden="true">
    <defs><linearGradient id="lg${size}" x1="6" y1="2" x2="34" y2="42" gradientUnits="userSpaceOnUse"><stop stop-color="#E5333B"/><stop offset=".55" stop-color="#B5121B"/><stop offset="1" stop-color="#8A0002"/></linearGradient>
      <radialGradient id="lgs${size}" cx=".35" cy=".25" r=".6"><stop stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="ll-shadow" cx="20" cy="42.5" rx="7" ry="1.4" fill="#8A0002" opacity=".25"/>
    <g class="ll-body"><path d="M20 2c8 0 14 6.5 14 14.5C34 27 24 37 20 42 16 37 6 27 6 16.5 6 8.5 12 2 20 2Z" fill="url(#lg${size})"/>
    <path d="M20 2c8 0 14 6.5 14 14.5C34 27 24 37 20 42 16 37 6 27 6 16.5 6 8.5 12 2 20 2Z" fill="url(#lgs${size})"/>
    <g fill="none" stroke="#EFE6DD" stroke-width="3.2" stroke-linecap="round">
      <circle class="ll-c1" cx="24" cy="20" r="5.6"/><circle class="ll-c2" cx="16.5" cy="14.5" r="5.6"/>
      <path d="M20.6 18.6a5.6 5.6 0 0 1-8 0"/></g>
    <circle class="ll-dot" cx="16.5" cy="14.5" r="1.8" fill="#FFD15A"/></g></svg>`;
}
window.logoMark = logoMark;
function logoWord(size=30){ return `<span class="llword">${logoMark(size)}<span><b>LOCAL</b><b class="am">LINK</b></span></span>`; }

/* ---------------- customer router ---------------- */
function stack(){ return nav[state.view]; }
function go(routeName, params){ stack().push({name:routeName, params:params||{}}); routeRender(); const s=$('#screen'); if(s) s.scrollTop=0; }
function back(){ if(stack().length>1){ stack().pop(); routeRender(); } }
function setTab(routeName){ nav[state.view]=[{name:routeName}]; routeRender(); }

const SCREENS = {};
async function routeRender(){
  const cur = stack()[stack().length-1];
  const screen = $('#screen');
  if (!screen) return;
  screen.scrollTop = 0;                 // always start a screen at the top (fixes "stuck in middle")
  const fn = SCREENS[cur.name];
  if (!fn){ screen.innerHTML = emptyState('compass','Screen not found',''); return; }
  try { await fn(screen, cur.params||{}); }
  catch(e){ screen.innerHTML = errorState(e.message, ()=>routeRender()); }
  screen.scrollTop = 0;                 // and again after async data loads
  renderBottomNav();
}

/* ---------------- reusable components ---------------- */
function skeletonRow(n=3){ return `<div class="stack" style="gap:12px">${Array(n).fill(`<div class="sk" style="height:92px;border-radius:16px"></div>`).join('')}</div>`; }
function skeletonCards(n=3){ return `<div class="row" style="gap:13px;overflow:hidden">${Array(n).fill(`<div class="sk" style="height:180px;width:220px;flex:0 0 auto;border-radius:16px"></div>`).join('')}</div>`; }
function emptyState(icon,title,sub,cta){ const g = GI[icon]?`<span class="gi">${GI[icon]}</span>`:(String(icon).startsWith('<')?icon:`<span class="gi">${GI.inbox}</span>`); return `<div class="empty"><div class="eic">${g}</div><h4 style="font-size:16px;color:var(--ink)">${esc(title)}</h4><p style="max-width:230px">${esc(sub||'')}</p>${cta||''}</div>`; }
function errorState(msg,retry){ const id='rt'+Math.random().toString(36).slice(2); setTimeout(()=>{const b=document.getElementById(id); if(b&&retry)b.onclick=retry;},0);
  return `<div class="empty"><div class="eic">${gi('warning')}</div><h4 style="font-size:16px;color:var(--ink)">Something went wrong</h4><p>${esc(msg||'')}</p><button id="${id}" class="btn ghost sm">Try again</button></div>`; }

function businessCard(b){
  const off = b.offer_label ? `<span class="badge accent off">${esc(b.offer_label)}</span>` : '';
  const cover = b.cover_url || pic(coverKw(b), b.id, 480, 300);
  const navr = b.source==='google' ? 'place' : 'business';
  return `<button class="bcard" data-nav="${navr}" data-id="${b.id}">
    <div class="banner" style="background:${grad(b.color1,b.color2)}">${photoLayer(cover)}${off}
      <span class="emoji">${dIcon(b)}</span>
      <span class="fav ${isSaved('business',b.id)?'on':''}" data-fav data-ftype="business" data-fid="${b.id}" data-fname="${esc(b.name)}" data-fsub="${esc(b.subcategory||b.category_name||'')}" data-fimg="${esc(cover)}">${I.heart}</span></div>
    <div class="body"><h4>${esc(b.name)}</h4>
      <div class="meta">${stars(b.rating)}<span class="dot"></span><span>${esc(b.subcategory||b.category_name||'')}</span></div>
      <div class="meta"><span class="badge ${b.is_open?'open':'closed'}">${b.is_open?'Open':'Closed'}</span><span class="dot"></span><span>${esc(b.area_name||'')}</span></div>
    </div></button>`;
}
function catCard(c){ return `<button class="cat" data-nav="category" data-slug="${c.slug}">
  <span class="ic" style="background:${grad(c.color1,c.color2)}">${catIcon(c.slug)}</span><span>${esc(catLabel(c))}</span></button>`; }
function offerCard(o){ return `<button class="ocard" data-nav="business" data-id="${o.business_id}" style="background:${grad(o.color1,o.color2)}">
  <span class="badge tag">${esc(o.discount_label||'OFFER')}</span>
  <div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.business||'')}</div></div>
  <span class="disc">%</span></button>`; }
function productCard(p, biz, opts={}){ const disc = p.mrp && p.mrp>p.price;
  const src = p.image_url || pic((p.name||'product').toLowerCase(), 500+(p.id||0));
  const pct = disc ? Math.round((1-p.price/p.mrp)*100) : 0;
  const badge = p.promo_label ? `<span class="poff" style="background:var(--primary)">${esc(p.promo_label)}</span>` : (opts.best ? `<span class="bestseller">Best Seller</span>` : (disc ? `<span class="poff">${pct}% OFF</span>` : ''));
  const oos = p.stock_status==='out_of_stock';
  const rating = (p.rating || (4 + ((p.id||1)%10)/10)).toFixed(1);
  const rc = p.review_count || (30 + (p.id||1)*7 % 900);
  const add = oos ? '' : `<span class="add" data-add="1" data-pid="${p.id}" data-pname="${esc(p.name)}" data-pprice="${p.price}" data-pimg="${esc(src)}" data-pbiz="${esc(p.business||(biz&&biz.name)||'')}" data-pbizid="${p.business_id||(biz&&biz.id)||''}">+</span>`;
  const fav = `<span class="fav2 ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}">${I.heart}</span>`;
  return `<div class="pcard" data-nav="product" data-id="${p.id}"><div class="pimg">${photoLayer(src)}${badge}${fav}${dIcon({name:p.name, category_slug: biz&&biz.category_slug},'cart')}${add}</div>
    <div class="pb"><h4>${esc(p.name)}</h4>
      <div class="prow"><span class="prate">${I.star}${rating} <small>(${rc})</small></span></div>
      <div class="price">${money(p.price)}${disc?`<span class="old">${money(p.mrp)}</span>`:''}</div>
      ${p.unit?`<div class="punit">${esc(p.unit)}</div>`:''}
      <span class="xbadge">express</span>${oos?'<span class="oos">Out of stock</span>':''}</div></div>`; }
function serviceCard(s){ return `<button class="brow" data-nav="business" data-id="${s.business_id||s.id}" style="text-align:left">
  <div class="thumb" style="background:${grad('#D9A441','#4338CA')}">${dIcon(s,'wrench')}</div>
  <div class="info"><h4>${esc(s.name)}</h4><div class="muted" style="font-size:12.5px;margin-top:2px">${esc(s.business||'')}</div>
    <div class="row" style="gap:8px;margin-top:7px">${stars(s.rating)}<span class="badge primary">from ${money(s.starting_price)}</span></div></div>
  <span class="chev" style="align-self:center;color:var(--faint);width:18px">${I.chev}</span></button>`; }
function newsCard(n){ return `<button class="ncard" data-nav="newsDetail" data-id="${n.id}" style="text-align:left">
  <div class="nimg" style="background:${grad(n.color1,n.color2)}">${gi('news')}</div>
  <div class="nb"><span class="badge neutral">${esc(n.category)}</span><h4 style="margin-top:7px">${esc(n.title)}</h4></div></button>`; }
function eventCard(e){ const d=new Date(e.start_date); const day=isNaN(d)?'--':d.getDate(); const mon=isNaN(d)?'':d.toLocaleString('en',{month:'short'}).toUpperCase();
  return `<div class="ecard"><div class="date"><b>${day}</b><span>${mon}</span></div>
    <div class="info" style="flex:1"><h4 style="font-size:14.5px">${esc(e.title)}</h4>
      <div class="muted" style="font-size:12px;margin-top:4px">${I.pin.replace('viewBox','style="width:12px;height:12px;vertical-align:-2px;fill:var(--muted)" viewBox')} ${esc(e.venue)}</div>
      <div class="muted" style="font-size:12px;margin-top:2px">${gi('clock')} ${esc(e.time_label||'')}</div></div></div>`; }

function sectionHead(title, action){ return `<div class="sec-head px"><h3>${esc(title)}</h3>${action?`<button class="see" data-nav="${action.route}" ${action.slug?`data-slug="${action.slug}"`:''}>${t('seeAll')}</button>`:''}</div>`; }

/* ---------- Noon-style components ---------- */
function nsecHead(title, route, slug){ return `<div class="nsec"><h3>${esc(title)}</h3>${route?`<button class="viewall" data-nav="${route}" ${slug?`data-slug="${slug}"`:''}>${t('seeAll')} ${I.chev}</button>`:''}</div>`; }
function heroCard(o){ const img=o.image_url||pic(coverKw({subcategory:o.business||'sale'})+',sale,offer', 700+(o.id||0), 900, 460);
  return `<button class="hcard" data-nav="business" data-id="${o.business_id}" style="background:${grad(o.color1,o.color2)}">${photoLayer(img)}
    <span class="htag">${esc(o.discount_label||'OFFER')}</span>
    <h3>${esc(o.title)}</h3><div class="hsub">${esc(o.business||'')}${o.description?' · '+esc(o.description):''}</div></button>`; }
function promoCard(o){ const code=o.code||('SAVE'+(o.id||1));
  const img=o.image_url||pic(coverKw({subcategory:o.business||'',category_name:o.business||''})+','+(o.title||'offer'),700+(o.id||0),600,400);
  return `<button class="offcard" data-nav="business" data-id="${o.business_id}">
    <div class="offcard-img">${photoLayer(img)}<span class="offcard-tag">${esc(o.discount_label||'OFFER')}</span></div>
    <div class="offcard-body">
      <h4>${esc(o.title)}</h4>
      <p>${esc(o.description||'Limited time offer')}</p>
      <div class="offcard-foot">
        <div class="offcard-brand"><span class="offcard-logo" style="background:${grad(o.color1||'#B5121B',o.color2||'#1E3A8A')}">${(o.business||'L')[0]}</span>
          <div><div class="offcard-bname">${esc(o.business||'Local Link')}</div><div class="offcard-code">${gi('tag')} ${esc(code)}</div></div></div>
        <span class="offcard-arrow">${I.chev}</span>
      </div></div></button>`; }
/* Stacked offer carousel (3D card stack) with swipe + prev/next + dots + paused auto-advance */
function renderOfferStack(el, offers){
  const items = (offers||[]).slice(0,5);
  if(!items.length){ el.innerHTML = emptyState('percent','No offers yet',''); return; }
  el.innerHTML = `<div class="ostack" id="ostk">${items.map((o,i)=>{
    const code=o.code||('SAVE'+(o.id||1));
    const img=o.image_url||pic(coverKw({subcategory:o.business||'',category_name:o.business||''})+','+(o.title||'offer'),700+(o.id||0),700,460);
    return `<div class="ostack-card" data-i="${i}" data-bid="${o.business_id}">
      <div class="os-img">${photoLayer(img)}</div><div class="os-shade"></div>
      <span class="os-tag">${esc(o.discount_label||'OFFER')}</span>
      <div class="os-body"><h4>${esc(o.title)}</h4><p>${esc(o.description||o.business||'')}</p>
        <div class="os-foot"><span class="os-code">${gi('tag')} ${esc(code)}</span><span class="os-go">Shop now ${I.chev}</span></div>
      </div></div>`; }).join('')}</div>
    <div class="ostack-ctrls"><button class="cnav prev" id="ostkPrev" aria-label="Previous">${I.chev}</button>
      <div class="ostack-dots" id="ostkDots">${items.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</div>
      <button class="cnav next" id="ostkNext" aria-label="Next">${I.chev}</button></div>`;
  const cards=[...el.querySelectorAll('.ostack-card')]; let idx=0; let timer=null;
  const place=()=>{ cards.forEach((c,i)=>{ const off=i-idx; let tf,op,z,pe;
      const a=Math.abs(off), sg=Math.sign(off);
      if(off===0){ tf='translateX(-50%) translateZ(0) rotateY(0deg) scale(1)'; op=1; z=30; pe='auto'; }
      else { tf=`translateX(calc(-50% + ${sg*Math.min(a,2)*62}%)) translateZ(${-140*Math.min(a,2)}px) rotateY(${-sg*48}deg) scale(${1-Math.min(a,2)*0.08})`; op=a<=2?(a===1?.85:.45):0; z=30-a; pe='none'; }
      c.style.transform=tf; c.style.opacity=op; c.style.zIndex=z; c.style.pointerEvents=pe; });
    el.querySelectorAll('#ostkDots i').forEach((d,i)=>d.classList.toggle('on',i===idx));
    const pv=$('#ostkPrev'), nx=$('#ostkNext'); if(pv) pv.disabled=idx===0; if(nx) nx.disabled=idx===cards.length-1;
  };
  const go2=(n)=>{ idx=Math.max(0,Math.min(cards.length-1,n)); place(); };
  const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
  const auto=()=>{ stop(); timer=setInterval(()=>{ if(!document.getElementById('ostk')){ stop(); return; } idx=(idx+1)%cards.length; place(); },3000); };
  const bump=(n)=>{ stop(); go2(n); setTimeout(auto,3000); };
  place(); auto();
  { const st=el.querySelector('#ostk'); let sx=null; st.addEventListener('pointerdown',e=>{sx=e.clientX;}); st.addEventListener('pointerup',e=>{ if(sx==null)return; const dx=e.clientX-sx; sx=null; if(Math.abs(dx)>35) bump(idx+(dx<0?1:-1)); }); }
  $('#ostkPrev').onclick=()=>bump(idx-1);
  $('#ostkNext').onclick=()=>bump(idx+1);
  const stk=$('#ostk'); let sx=null;
  stk.addEventListener('pointerdown',e=>{ sx=e.clientX; stop(); });
  stk.addEventListener('pointerup',e=>{ if(sx===null) return; const dx=e.clientX-sx; sx=null;
    if(Math.abs(dx)>40){ if(dx<0) bump(idx+1); else bump(idx-1); }
    else { const top=cards[idx]; if(top&&top.dataset.bid) go('business',{id:Number(top.dataset.bid)}); setTimeout(auto,3000); }
  });
  stk.addEventListener('pointercancel',()=>{ sx=null; setTimeout(auto,3000); });
}
/* Wrap a horizontal scroll-row with prev/next arrows (desktop); swipe works everywhere */
function wireRowArrows(rowEl){
  if(!rowEl || rowEl._arrowed) return; rowEl._arrowed=true;
  const wrap=document.createElement('div'); wrap.className='crow-wrap';
  rowEl.parentNode.insertBefore(wrap, rowEl); wrap.appendChild(rowEl);
  const mk=(dir,cls)=>{ const b=document.createElement('button'); b.className='crow-arrow '+cls; b.setAttribute('aria-label',dir<0?'Previous':'Next'); b.innerHTML=I.chev;
    b.onclick=()=>rowEl.scrollBy({left:dir*rowEl.clientWidth*0.8,behavior:'smooth'}); return b; };
  const prev=mk(-1,'left prev'), next=mk(1,'right'); wrap.appendChild(prev); wrap.appendChild(next);
  const upd=()=>{ prev.disabled=rowEl.scrollLeft<8; next.disabled=rowEl.scrollLeft+rowEl.clientWidth>=rowEl.scrollWidth-8; };
  rowEl.addEventListener('scroll',upd,{passive:true}); setTimeout(upd,120); window.addEventListener('resize',upd);
}
/* Auto-advance a horizontal scroll-row one card every 3s; loop back to start at the end.
   Pauses while the user is interacting, then resumes. */
function autoAdvanceRow(rowEl, count){
  if(!rowEl || rowEl._auto) return; rowEl._auto=true;
  let paused=false, resumeT=null;
  const pause=()=>{ paused=true; if(resumeT) clearTimeout(resumeT); resumeT=setTimeout(()=>paused=false, 5000); };
  ['pointerdown','touchstart','wheel'].forEach(ev=>rowEl.addEventListener(ev,pause,{passive:true}));
  const step=()=>rowEl.clientWidth*0.86+12;
  const timer=setInterval(()=>{
    if(!document.body.contains(rowEl)){ clearInterval(timer); return; }
    if(paused) return;
    const atEnd = rowEl.scrollLeft + rowEl.clientWidth >= rowEl.scrollWidth - 10;
    rowEl.scrollTo({ left: atEnd ? 0 : rowEl.scrollLeft + step(), behavior:'smooth' });
  }, 3000);
}
/* demo cover photos for category tiles (icon tile shows if a photo can't load) */
const CAT_PHOTO = {
  'food-grocery':'1542838132-92c53300491e', 'shopping':'1489987707025-afc232f7ea0f', 'services':'1581578731548-c64695cc6952',
  'workers':'1504307651254-35680f356dfd', 'transport':'1449965408869-eaa3f722e40d', 'healthcare':'1576091160399-112ba8d25d1d',
  'local-info':'1477959858617-67f85cf4f1df', 'news':'1504711434969-e33886168f5c', 'events':'1492684223066-81342ee5ff30',
  'classifieds':'1556742049-0cfed4f6a45d', 'offers':'1607083206869-4c7672e72a8a', 'deals':'1607083206869-4c7672e72a8a'
};
function catPhoto(slug, label){ const id=CAT_PHOTO[slug]; return id ? `https://images.unsplash.com/photo-${id}?w=360&h=360&q=70&auto=format&fit=crop` : pic(label||slug, slug, 360, 360); }
function ncatCard(c){ const cc=c.color1||'#B5121B';
  return `<button class="ncat" data-nav="category" data-slug="${c.slug}">
    <span class="tile catico" style="--cc:${cc}">${photoLayer(catPhoto(c.slug, c.name))}${catIcon(c.slug)}</span>
    <span>${esc(catLabel(c))}</span></button>`; }
function tileCard(label, kw, seed, route, slug){
  return `<button class="ncat" data-nav="${route}" ${slug?`data-slug="${slug}"`:''}>
    <span class="tile catico" style="--cc:#B5121B">${photoLayer(catPhoto(slug||route, kw||label))}${catIcon(slug||route)}</span><span>${esc(label)}</span></button>`; }
/* live countdown for mega-deals */
let _cdTimer=null;
function startCountdown(){ if(_cdTimer) clearInterval(_cdTimer);
  const tick=()=>{ const el=document.getElementById('megacd'); if(!el){ clearInterval(_cdTimer); _cdTimer=null; return; }
    const end=new Date(); end.setHours(23,59,59,999); let s=Math.max(0,Math.floor((end-new Date())/1000));
    const hh=String(Math.floor(s/3600)).padStart(2,'0'), mm=String(Math.floor(s%3600/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0');
    el.innerHTML=`${gi('clock')}<span class="cbox">${hh}</span>:<span class="cbox">${mm}</span>:<span class="cbox">${ss}</span>`; };
  tick(); _cdTimer=setInterval(tick,1000);
}
/* vertical pills (Local Link verticals — Noon sub-brand row) */
const VERTICALS=[['all','store','All'],['food','fork','Food'],['grocery','cart','Grocery'],['services','wrench','Services'],['quick','bolt','Quick'],['workers','helmet','Workers'],['transport','car','Transport']];
function vpillsHtml(active){ return `<div class="vbar"><div class="vpills">${VERTICALS.map(([k,icn,lab])=>`<button class="vpill ${active===k?'on':''}" data-vert="${k}"><span class="gi">${GI[icn]}</span>${esc(lab)}</button>`).join('')}</div></div>`; }
function wireVerticals(el){ el.querySelectorAll('[data-vert]').forEach(b=>b.onclick=()=>{ const k=b.dataset.vert;
  if(k==='all'){ setTab('home'); return; }
  if(k==='food'){ go('category',{slug:'food-grocery',vfilter:'food',vlabel:'Food & Dining'}); return; }
  if(k==='grocery'){ go('category',{slug:'food-grocery',vfilter:'grocery',vlabel:'Grocery & Essentials'}); return; }
  if(k==='quick'){ go('category',{slug:'food-grocery',vfilter:'quick',vlabel:'Quick delivery'}); return; }
  const map={services:'services',workers:'workers',transport:'transport'};
  go('category',{slug:map[k]||'food-grocery'}); }); }
// which subcategories belong to each vertical filter
const VFILTERS={
  food:/restaurant|hotel|bakery|cake|meat|seafood|fish|cafe|biriyani|biryani|juice|dining|food/i,
  grocery:/grocery|supermarket|hypermarket|provision|mart|fruits|vegetable|general store|dairy/i,
  quick:/grocery|supermarket|bakery|pharmac|meat|restaurant/i,
};
const ROTATE=['Search "biriyani"','Search "plumber"','Search "grocery"','Search "AC repair"','Search "gold necklace"','Search "salon"'];
const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
function custControls(){ const dark=state.custTheme==='dark';
  return `<button class="hicon hcart" data-hcart title="Cart" aria-label="Cart">${I.bag}<span class="hcbadge" ${cartCount()?'':'hidden'}>${cartCount()}</span></button><button class="hicon" data-ctheme title="Toggle theme">${dark?I.sun:MOON}</button>
    <div class="clang" data-mini-lang><button data-l="en" class="${state.lang==='en'?'on':''}">EN</button><button data-l="ml" class="${state.lang==='ml'?'on':''}">മ</button></div>`; }
function wireCustControls(el){ const th=el.querySelector('[data-ctheme]'); if(th) th.onclick=()=>{ toggleCustTheme(); routeRender(); }; const hc=el.querySelector('[data-hcart]'); if(hc) hc.onclick=()=>go('cart');
  el.querySelectorAll('[data-mini-lang] [data-l]').forEach(b=>b.onclick=()=>{ if(state.lang===b.dataset.l)return; state.lang=b.dataset.l; localStorage.setItem('ll_lang',state.lang); renderShell(); }); }

/* delegate add-to-cart clicks */
document.addEventListener('click', (e) => {
  const ab = e.target.closest('[data-add]'); if(!ab) return;
  e.stopPropagation(); e.preventDefault();
  addToCart({ id:Number(ab.dataset.pid), name:ab.dataset.pname, price:Number(ab.dataset.pprice), image:ab.dataset.pimg||'', biz:ab.dataset.pbiz||'', bizId:Number(ab.dataset.pbizid)||1 });
});
/* delegate wishlist (heart) clicks */
document.addEventListener('click', (e) => {
  const fb = e.target.closest('[data-fav]'); if(!fb) return;
  e.stopPropagation(); e.preventDefault();
  toggleSaved({ type:fb.dataset.ftype||'product', id:fb.dataset.fid, name:fb.dataset.fname||'', price:Number(fb.dataset.fprice)||0, image:fb.dataset.fimg||'', sub:fb.dataset.fsub||'' });
  fb.classList.toggle('on', isSaved(fb.dataset.ftype||'product', fb.dataset.fid));
});
/* delegate nav clicks */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-add]')) return;
  const nb = e.target.closest('[data-nav]'); if (!nb) return;
  const r = nb.dataset.nav;
  if (r==='business') go('business',{id:Number(nb.dataset.id)});
  else if (r==='place') go('place',{id:nb.dataset.id});
  else if (r==='product') go('product',{id:Number(nb.dataset.id)});
  else if (r==='category') go('category',{slug:nb.dataset.slug});
  else if (r==='newsDetail') go('newsDetail',{id:Number(nb.dataset.id)});
  else if (r==='catlist') go('category',{slug:nb.dataset.slug});
  else go(r, nb.dataset.slug?{slug:nb.dataset.slug}:{});
});

/* ---------------- bottom nav ---------------- */
function renderBottomNav(){
  const holder = $('#navholder'); if(!holder) return;
  const cur = stack()[stack().length-1].name;
  if (cur==='chat' || cur==='p_chatThread'){ holder.innerHTML=''; return; }  // full-screen chat thread
  if (state.view==='customer'){
    if (['splash','location','intro','register','login'].includes(cur)){ holder.innerHTML=''; return; }
    const items=[['home','home','Home'],['categories','grid','Explore'],['ask','ask','Ask AI'],['deals','tag','Deals'],['account','user','Account']];
    holder.innerHTML = `<div class="bnav vbnav">${items.map(([r,icn,lab])=>{
      if(r==='ask') return `<button class="vb-fab" data-tabnav="ask" aria-label="Ask Local Link AI"><span class="vb-fabin">${logoMark(38)}</span><span class="vb-fablab">Ask AI</span></button>`;
      const on = cur===r?'on':'';
      return `<button class="${on}" data-tabnav="${r}">${I[icn]}<span>${esc(lab)}</span></button>`;
    }).join('')}</div>`;
  } else if (state.view==='partner'){
    if (cur==='p_login'){ holder.innerHTML=''; return; }
    const items=[['p_dash','home','Home'],['p_products','store','Products'],['p_orders','bag','Orders'],['p_chats','chat','Chats'],['p_profile','user','Profile']];
    holder.innerHTML = `<div class="bnav">${items.map(([r,icn,lab])=>`<button class="${cur===r?'on':''}" data-tabnav="${r}">${icn==='chat'?GI.chat:I[icn]}${r==='p_chats'?`<span class="cartbadge pchatbadge" hidden></span>`:''}<span>${esc(lab)}</span></button>`).join('')}</div>`;
    setTimeout(()=>{ try{ api('/partner/overview').then(d=>setPartnerChatBadge(d.usage&&d.usage.unreadChats)).catch(()=>{}); }catch(e){} }, 50);
  }
  holder.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>{ const r=b.dataset.tabnav; if(r==='ask'){ openAsk(); } else setTab(r); });
}

/* ==================== CUSTOMER SCREENS ==================== */
SCREENS.splash = (el) => {
  el.innerHTML = `<div class="splash splash-anim">
    <div class="splash-rings"><span></span><span></span><span></span></div>
    <div class="splash-logo">${logoMark(104)}</div>
    <h1 class="splash-title">Local Link</h1><p class="splash-tag">Everything Local. One Place.</p>
    <div class="splash-load"><span></span></div></div>`;
  const next = state.onboarded && state.introSeen ? 'home' : (!state.onboarded ? 'location' : 'intro');
  setTimeout(()=>{ if(stack()[stack().length-1].name==='splash'){ nav.customer=[{name: next}]; routeRender(); } }, 2000);
};

/* ---- onboarding flashcards (auto-advancing, skippable) ---- */
const INTRO_CARDS = [
  { icon:'compass', kw:'restaurant', title:'Your whole neighbourhood, in one app', text:'Restaurants, groceries, services, workers and rides near you — everything local, discovered in seconds.' },
  { icon:'cart', kw:'biryani', title:'Order in just a few taps', text:'Browse local menus and products, add to your cart and check out from the stores you love — fast.' },
  { icon:'chat', kw:'grocery', title:'Get the best local price', text:'Chat directly with stores, or post what you need and let local businesses come to you with offers.' },
  { icon:'star', kw:'cake', title:'Save with deals near you', text:'Grab exclusive offers and promo codes — and support the businesses in your own neighbourhood.' },
];
SCREENS.intro = (el) => {
  const finish=()=>{ clearInterval(rot); state.introSeen=true; localStorage.setItem('ll_intro','1'); nav.customer=[{name:'home'}]; routeRender(); };
  const words=['restaurants','groceries','plumbers','auto rides','salons','offers'];
  el.innerHTML = `<div class="ob">
    <button class="ob-skip" id="skip">Skip</button>
    <div class="ob-orbit"><span class="ob-ring r1"></span><span class="ob-ring r2"></span><span class="ob-ring r3"></span>
      <span class="ob-logo">${logoMark(96)}</span>
      <span class="ob-chip c1">${GI.fork||''}</span><span class="ob-chip c2">${GI.cart||''}</span><span class="ob-chip c3">${GI.wrench||''}</span><span class="ob-chip c4">${GI.percent||''}</span></div>
    <div class="ob-copy">
      <div class="ob-kick">LOCAL LINK · ${esc(state.areaName||'KOZHIKODE').toUpperCase()}</div>
      <h1>Find <span class="ob-word" id="obw">${words[0]}</span><br/>right around you.</h1>
      <p>Shops, services, workers, rides and deals in your neighbourhood. One app, everything local.</p>
      <div class="ob-stats"><div><b>${(ref.categories||[]).length||10}+</b><span>categories</span></div><div><b>100+</b><span>local shops</span></div><div><b>24×7</b><span>help nearby</span></div></div>
    </div>
    <button class="ob-cta" id="cta"><span>Get started</span><i>${I.chev}</i></button></div>`;
  let wi=0; const rot=setInterval(()=>{ const w=document.getElementById('obw'); if(!w){ clearInterval(rot); return; } wi=(wi+1)%words.length; w.classList.remove('in'); void w.offsetWidth; w.textContent=words[wi]; w.classList.add('in'); },1900);
  $('#skip').onclick=finish; $('#cta').onclick=finish;
};


SCREENS.location = (el) => {
  el.innerHTML = `<div class="auth-wrap">
    <div class="auth-hero">${logoMark(64)}<h2 style="font-size:22px">Discover what's around you</h2>
      <p class="muted" style="font-size:14px;max-width:280px">Find nearby businesses, services, offers, transport and local information — instantly.</p></div>
    <div class="card" style="padding:6px;margin-bottom:16px">
      <div class="plist" style="border:none">
        <button id="gps"><span class="ic">${I.pin}</span><div><div style="font-weight:600">Use my location</div><div class="muted" style="font-size:12px">Detect automatically (demo → Kunnamangalam)</div></div><span class="chev">${I.chev}</span></button>
      </div></div>
    <div class="muted" style="font-size:12px;font-weight:600;margin:6px 4px 10px">OR CHOOSE YOUR AREA</div>
    <div id="arealist" class="stack" style="gap:8px"></div>
    <div style="flex:1"></div></div>`;
  $('#gps').onclick = ()=>{
    const btn=$('#gps'); const sub=btn.querySelector('.muted');
    if(navigator.geolocation){ if(sub) sub.textContent='Detecting your location…';
      navigator.geolocation.getCurrentPosition(
        ()=>pickArea(1,'Kunnamangalam'),        // demo: map any coords to nearest seeded area
        ()=>pickArea(1,'Kunnamangalam'),        // denied/unavailable → sensible default
        { timeout:4000, maximumAge:600000 });
    } else pickArea(1,'Kunnamangalam');
  };
  const areasByP = {};
  ref.areas.forEach(a=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id); (areasByP[p?p.name:'Other']=areasByP[p?p.name:'Other']||[]).push(a); });
  $('#arealist').innerHTML = ref.areas.slice(0,8).map(a=>{ const p=ref.panchayaths.find(x=>x.id===a.panchayath_id);
    return `<button class="brow" data-area="${a.id}" data-name="${esc(a.name)}" style="padding:12px 14px">
      <div class="thumb" style="width:40px;height:40px;font-size:18px;background:${grad('#E5333B','#8A0002')}">${I.pin.replace('fill="currentColor"','fill="#fff"')}</div>
      <div class="info"><h4 style="font-size:14px">${esc(a.name)}</h4><div class="muted" style="font-size:12px">${esc(p?p.name:'')}, Kozhikode</div></div>
      <span class="chev" style="align-self:center;color:var(--faint);width:18px">${I.chev}</span></button>`; }).join('');
  el.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>pickArea(Number(b.dataset.area), b.dataset.name));
};
function pickArea(id,name){ state.areaId=id; state.areaName=name; state.onboarded=true;
  localStorage.setItem('ll_area',id); localStorage.setItem('ll_area_name',name); localStorage.setItem('ll_onboarded','1');
  const dest = state.introSeen ? 'home' : 'intro';
  nav.customer=[{name:dest}]; routeRender(); toast('Location set to '+name); }

SCREENS.home = async (el) => {
  el.innerHTML = `
    <div class="vb-top">${logoWord(34)}<span class="vb-tag">Search it · Find it local</span></div>
    <div class="vb-loc">
      <button class="vb-locbtn" data-tabnav-loc><span class="vb-pin">${I.pin}</span>
        <span class="vb-loctx"><span class="vb-k">Showing near <i class="vb-dot"></i> <em>Live now</em></span><b>${esc(state.areaName)} · Kozhikode</b></span>${I.chev.replace('m9 6 6 6-6 6','m6 9 6 6 6-6')}</button>
      <div class="vb-ctl">${custControls()}</div>
    </div>
    <div class="searchrow">
      <button class="nsearch" data-nav="searchScreen">${I.search}<span class="sq" id="rotsq">Search local shops & products…</span></button>
      <button class="askbtn" id="askHome" aria-label="Ask Local Link AI">${GI.sparkles}<span>Ask AI</span></button>
    </div>
    <div class="pop-head"><h1><span class="pw">EVERYTHING</span><span class="pw red">LOCAL.</span><span class="pw sm">One tap away.</span></h1><span class="pop-sticker">NEW<br/>DEALS</span></div>
    <div class="hero" id="hero">${skeletonCards(1)}</div><div class="dots" id="dots"></div>
    <div class="vb-greet"><h2 id="vbhi"></h2><p id="vbsub"></p>
      <div class="vb-moods">
        <button class="vb-mood" data-vert="food"><i>${GI.fork||''}</i>Hungry now</button>
        <button class="vb-mood" data-vert="grocery"><i>${GI.cart||''}</i>Groceries</button>
        <button class="vb-mood" data-vert="services"><i>${GI.wrench||''}</i>Fix something</button>
        <button class="vb-mood" data-vert="workers"><i>${GI.helmet||''}</i>Hire help</button>
        <button class="vb-mood" data-vert="transport"><i>${GI.car||''}</i>Need a ride</button></div></div>
    <div class="vb-sec"><h3>Categories</h3></div>
    ${vpillsHtml('all')}
    <div id="promo"></div>
    <div id="deals"></div>
    <div id="near"></div>
    <div id="prodsecs"></div>
    <div id="svcs"></div>
    <div id="updates"></div>
    <div style="height:96px"></div>`;
  { const hr=new Date().getHours(); const nm=(token&&me&&me.name)?me.name.split(' ')[0]:'';
    const [g,sub]= hr<12?['Good morning','Fresh breakfast, groceries and help — all nearby.']:hr<17?['Good afternoon','Lunch, errands and repairs, sorted locally.']:['Good evening','Dinner, deals and rides around you tonight.'];
    $('#vbhi').innerHTML=`${g}${nm?', '+esc(nm):''} <span class="vb-sun">${hr<17?'☀️':'🌙'}</span>`; $('#vbsub').textContent=sub; }
  wireVerticals(el); wireCustControls(el);
  const ask=$('#askHome'); if(ask) ask.onclick=()=>openAsk();
  const loc=el.querySelector('[data-tabnav-loc]'); if(loc) loc.onclick=()=>go('location');
  // rotating search placeholder
  const rot=$('#rotsq'); let ri=0; if(rot){ setInterval(()=>{ ri=(ri+1)%ROTATE.length; rot.textContent=ROTATE[ri]; },2600); }
  // skeleton section frames
  $('#promo').innerHTML = nsecHead('Offers for you','offers') + `<div id="promow"><div class="ostack">${skeletonCards(1)}</div></div>`;
  $('#deals').innerHTML = `<div class="nsec"><h3>Mega deals</h3><span class="countdown" id="megacd">${gi('clock')} --:--:--</span></div><div class="dealrow" id="dealw">${skeletonCards(3)}</div>`;
  $('#near').innerHTML = nsecHead(t('nearYou'),'categories') + `<div class="hero" style="padding-top:2px" id="nearw">${skeletonCards(2)}</div>`;
  $('#svcs').innerHTML = nsecHead(t('popularServices'),'categories','services') + `<div class="px stack" id="svcw" style="gap:10px">${skeletonRow(2)}</div>`;
  $('#updates').innerHTML = nsecHead(t('localUpdates'),'news') + `<div class="hero" style="padding-top:2px" id="newsw">${skeletonCards(2)}</div><div class="px stack" id="evw" style="gap:10px;margin-top:8px"></div>`;
  const [offers, biz, deals, svcs, news, events, grocery, places] = await Promise.all([
    api('/offers'), api('/businesses?featured=1'), api('/products?deal=1&limit=10'),
    api('/services'), api('/news'), api('/events'), api('/products?category=food-grocery&limit=10'),
    api('/places?area_id='+state.areaId).catch(()=>[])
  ]);
  // real Google places (when a key is set) lead the Near You row, then featured seeded
  const near=[]; const seen=new Set();
  (places||[]).concat(biz).forEach(b=>{ const k=(b.name||'').toLowerCase(); if(!seen.has(k)){ seen.add(k); near.push(b); } });
  // hero from offers
  $('#hero').innerHTML = offers.slice(0,5).map(heroCard).join('');
  $('#dots').innerHTML = offers.slice(0,5).map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('');
  const hero=$('#hero'); if(hero){ hero.addEventListener('scroll',()=>{ const i=Math.round(hero.scrollLeft/(hero.clientWidth*0.86+12)); $('#dots').querySelectorAll('i').forEach((d,x)=>d.classList.toggle('on',x===i)); },{passive:true}); if(offers.length>1){ wireRowArrows(hero); autoAdvanceRow(hero, Math.min(5,offers.length)); } }
  // offers for you — stacked card carousel (swipe / prev-next)
  renderOfferStack($('#promow'), offers);
  // mega deals — horizontal carousel with arrows
  $('#dealw').innerHTML = deals.slice(0,10).map((p,i)=>productCard(p,null,{best:i<2})).join('') || `<div class="px muted" style="font-size:13px">No deals right now.</div>`;
  if(deals.length) wireRowArrows($('#dealw'));
  startCountdown();
  // near you (real + seeded)
  $('#nearw').innerHTML = near.slice(0,10).map(businessCard).join('');
  // a category product row (grocery)
  if(grocery && grocery.length){ $('#prodsecs').innerHTML = nsecHead('Grocery & essentials','categories','food-grocery') + `<div class="dealrow" id="grocw">${grocery.slice(0,10).map(p=>productCard(p)).join('')}</div>`; wireRowArrows($('#grocw')); }
  // services
  $('#svcw').innerHTML = svcs.slice(0,4).map(serviceCard).join('');
  // updates
  $('#newsw').innerHTML = news.slice(0,5).map(newsCard).join('');
  $('#evw').innerHTML = (events.length?`<div class="nsec" style="padding-left:0;padding-right:0"><h3 style="font-size:15px">${t('events')}</h3></div>`:'') + events.slice(0,3).map(eventCard).join('');
};

SCREENS.categories = async (el) => {
  el.innerHTML = `<div class="addrbar" style="padding-top:16px"><div class="atext"><div class="atop">${t('categories')}</div></div></div>
    <button class="nsearch" data-nav="searchScreen">${I.search}<span class="sq">${esc(t('search'))}</span><span class="cambtn">${I.ai}</span></button>
    <div class="ncatgrid big" id="cg"></div><div style="height:96px"></div>`;
  $('#cg').innerHTML = ref.categories.map(ncatCard).join('');
};
SCREENS.explore = SCREENS.categories;  // alias

SCREENS.deals = async (el) => {
  el.innerHTML = `<div class="dl-hero"><span class="dl-kick">${gi('percent')} Today only</span>
      <h1>BIG<br/>LOCAL<br/><em>DEALS.</em></h1><p>Fresh discounts from shops near ${esc(state.areaName)}</p>
      <div class="dl-timer"><span>Ends in</span><span class="countdown" id="megacd">${gi('clock')} --:--:--</span></div>
      <span class="dl-blob b1"></span><span class="dl-blob b2"></span><span class="dl-pct">%</span></div>
    <div id="promo"></div>
    <div class="nsec"><h3>Mega deals</h3></div>
    <div class="pgrid2" id="dg">${skeletonRow(4)}</div><div style="height:96px"></div>`;
  const [offers, deals] = await Promise.all([api('/offers'), api('/products?deal=1&limit=40')]);
  $('#promo').innerHTML = nsecHead('Offers for you') + `<div id="dpromow"></div>`;
  renderOfferStack($('#dpromow'), offers);
  $('#dg').innerHTML = deals.map((p,i)=>productCard(p,null,{best:i<2})).join('') || emptyState('percent','No deals right now','Check back soon.');
  startCountdown();
};

SCREENS.cart = async (el) => {
  if(!cart.length){
    el.innerHTML = `<div class="addrbar" style="padding-top:16px"><div class="atext"><div class="atop">Cart</div></div></div>
      <div class="cart-empty"><div class="ce-ic">${GI.cart}</div>
        <h3>Your cart is empty</h3><p>What are you waiting for? Start adding local products.</p>
        <button class="btn" data-tabnav="home">Start shopping</button>
        <div class="promo" style="margin-top:20px;width:100%;max-width:320px;background:${grad('#B5121B','#1E3A8A')}"><h4>New here?</h4><div class="psub">Use code below on your first order</div><span class="pcode">${gi('tag')} COMBO249</span></div>
      </div>
      <div id="best"></div><div style="height:96px"></div>`;
    el.querySelector('[data-tabnav="home"]').onclick=()=>setTab('home');
    const biz = await api('/products?limit=8');
    $('#best').innerHTML = nsecHead('Bestsellers for you') + `<div class="dealrow">${biz.slice(0,8).map((p,i)=>productCard(p,null,{best:i<2})).join('')}</div>`;
    return;
  }
  const rows = cart.map(it=>`<div class="cart-item"><div class="cimg">${photoLayer(it.image||pic((it.name||'x').toLowerCase(),500+it.id,120,120))}</div>
    <div class="cinfo"><h4>${esc(it.name)}</h4><div class="muted" style="font-size:11.5px;margin:2px 0 6px">${esc(it.biz||'')}</div>
      <div class="row" style="justify-content:space-between;align-items:center"><b class="price">${money(it.price)}</b>
        <div class="qty"><button data-dec="${it.id}">−</button><span>${it.qty}</span><button data-inc="${it.id}">+</button></div></div></div></div>`).join('');
  const delivery = cartTotal()>=499?0:29;
  el.innerHTML = `<div class="addrbar" style="padding-top:16px"><div class="atext"><div class="atop">Cart · ${cartCount()} item${cartCount()>1?'s':''}</div></div></div>
    <div style="margin-top:6px">${rows}</div>
    <div class="px"><div class="bill">
      <div class="bill-row"><span>Item total</span><span>${money(cartTotal())}</span></div>
      <div class="bill-row"><span>Delivery ${delivery===0?'<b style="color:var(--primary)">(FREE)</b>':''}</span><span>${delivery===0?'₹0':money(delivery)}</span></div>
      <div class="bill-row total"><span>To pay</span><span>${money(cartTotal()+delivery)}</span></div>
      ${delivery>0?`<div class="faint" style="font-size:11.5px;margin-top:6px">Add ${money(499-cartTotal())} more for free delivery</div>`:''}
    </div></div>
    <div style="height:150px"></div>
    <div class="cartbar"><div class="ct"><div class="lbl">To pay</div><div class="tot">${money(cartTotal()+delivery)}</div></div>
      <button class="btn" id="checkout">Checkout ${I.chev}</button></div>`;
  el.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.inc),1); routeRender(); });
  el.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ setQty(Number(b.dataset.dec),-1); routeRender(); });
  $('#checkout').onclick=()=>gateAction('place your order',()=>go('checkout'));
};

SCREENS.checkout = async (el) => {
  if(!cart.length){ setTab('cart'); return; }
  if(!token){ toast('Please log in'); return go('login'); }
  const a = safeParse(localStorage.getItem('ll_addr')) || { name: me?me.name:'', phone: me?me.phone:'', line:'', area: state.areaName };
  const delivery = cartTotal()>=499?0:29; const pay = cartTotal()+delivery;
  // single-store cart → fetch that store's accepted payment methods
  const bizId = cartBizId() || 1; let bizPay=['cash'], upiId=null, bizName=cart[0]?.biz||'';
  try{ const b=await api('/businesses/'+bizId); bizPay=(b.payment_methods&&b.payment_methods.length)?b.payment_methods:['cash']; upiId=b.upi_id; bizName=b.name||bizName; }catch(e){}
  const PM={ cash:['Cash on delivery',GI.card], card:['Card on delivery',GI.card], upi:['UPI'+(upiId?' · '+upiId:''),GI.chat] };
  const methods=bizPay.filter(m=>PM[m]);
  if(!methods.length) methods.push('cash');
  el.innerHTML = `${topbarBack('Checkout')}
    <div class="px" style="margin-top:8px">
      <div class="muted" style="font-size:12.5px;margin-bottom:8px">Ordering from <b style="color:var(--ink)">${esc(bizName)}</b></div>
      <div class="sec-lbl">Delivery address</div>
      <div class="field"><label>Full name</label><div class="input"><input id="cn" value="${esc(a.name||'')}"/></div></div>
      <div class="field"><label>Phone</label><div class="input"><input id="cp" value="${esc(a.phone||'')}" placeholder="+91…"/></div></div>
      <div class="field"><label>Address</label><div class="input"><textarea id="cl" rows="2" placeholder="House / building, street, landmark">${esc(a.line||'')}</textarea></div></div>
      <div class="field"><label>Area</label><div class="input"><input id="ca" value="${esc(a.area||state.areaName)}"/></div></div>
      <div class="sec-lbl" style="margin-top:16px">Payment method <span class="faint" style="font-weight:500;text-transform:none;letter-spacing:0">· accepted by this store</span></div>
      <div class="pay-opts" id="payopts">
        ${methods.map((m,i)=>`<button class="pay-opt ${i===0?'on':''}" data-pay="${m}"><span class="gi">${PM[m][1]}</span><span>${esc(PM[m][0])}</span><span class="tick">${I.chev}</span></button>`).join('')}
      </div>
      ${methods.includes('upi')&&upiId?`<div class="muted" style="font-size:12px;margin-top:8px">Pay to UPI ID <b style="color:var(--primary)">${esc(upiId)}</b> and pay the balance on delivery.</div>`:''}
      <div class="bill" style="margin-top:16px">
        <div class="bill-row"><span>Item total</span><span>${money(cartTotal())}</span></div>
        <div class="bill-row"><span>Delivery</span><span>${delivery===0?'FREE':money(delivery)}</span></div>
        <div class="bill-row total"><span>To pay</span><span>${money(pay)}</span></div></div>
      <div style="height:110px"></div>
    </div>
    <div class="cartbar"><div class="ct"><div class="lbl">To pay</div><div class="tot">${money(pay)}</div></div>
      <button class="btn" id="place">Place order</button></div>`;
  backWire(el);
  let payMethod=methods[0];
  el.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ el.querySelectorAll('[data-pay]').forEach(x=>x.classList.remove('on')); b.classList.add('on'); payMethod=b.dataset.pay; });
  $('#place').onclick=async()=>{
    const name=$('#cn').value.trim(), phone=$('#cp').value.trim(), line=$('#cl').value.trim(), area=$('#ca').value.trim();
    if(!name||!phone||!line){ return toast('Please fill name, phone and address'); }
    localStorage.setItem('ll_addr', JSON.stringify({name,phone,line,area}));
    const summary=cart.map(i=>`${i.qty}× ${i.name}`).join(', ');
    // group items by business → one order per business
    const groups={}; cart.forEach(i=>{ (groups[i.bizId||1]=groups[i.bizId||1]||[]).push(i); });
    try{
      for(const [bizId,items] of Object.entries(groups)){
        const tot=items.reduce((n,i)=>n+i.qty*i.price,0)+(cartTotal()>=499?0:29);
        await api('/orders',{method:'POST',body:{business_id:Number(bizId),total:tot,
          item_summary:items.map(i=>`${i.qty}× ${i.name}`).join(', '),payment_method:payMethod,
          items_json:items.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,image:i.image||''}))}}).catch(()=>{});
      }
      cart=[]; saveCart(); toast('Order placed! 🎉'); nav.customer=[{name:'orders'}]; routeRender();
    }catch(e){ toast(e.message); }
  };
};

SCREENS.account = async (el) => {
  const loggedIn=!!token; const nm=loggedIn?me.name:'Guest';
  el.innerHTML = `<div class="cbrand" style="padding-top:16px"><span class="cbrand-logo">${logoMark(28)}</span><span class="cbrand-name">Account</span><div style="flex:1"></div>${custControls()}</div>
    <div class="acard"><h4>${loggedIn?esc(nm):'Welcome to Local Link'}</h4>
      <div class="asub">${loggedIn?esc(me.email||me.phone||''):'Log in to order, save favourites, enquire & review'}</div>
      ${loggedIn?'':`<span class="abtn" id="lg">Log in / Sign up</span>`}</div>
    <button class="btn block" id="installapp" style="margin:0 0 14px;display:${window.__llInstall?'inline-flex':'none'};gap:8px;align-items:center;justify-content:center">${GI.download||I.plus} Install Local Link app</button>
    <div class="acct-list">
      <button data-tabnav="orders"><span class="ic">${GI.package}</span> My Orders <span class="rt">${I.chev}</span></button>
      <button data-nav="saved"><span class="ic">${I.heart}</span> Saved / Wishlist <span class="rt">${I.chev}</span></button>
      <button id="bulkreq"><span class="ic">${GI.megaphone||I.tag}</span> Post a requirement <span class="rt">${I.chev}</span></button>
      <button data-nav="offers"><span class="ic">${GI.percent}</span> Offers & Deals <span class="rt">${I.chev}</span></button>
      <button data-nav="localinfo"><span class="ic">${GI.building}</span> ${t('localInfo')} <span class="rt">${I.chev}</span></button>
      <button data-nav="events"><span class="ic">${GI.calendar}</span> ${t('events')} <span class="rt">${I.chev}</span></button>
    </div>
    <div class="acct-list">
      <button id="langrow"><span class="ic">${I.globe}</span> Language <span class="rt">${state.lang==='ml'?'മലയാളം':'English'} ${I.chev}</span></button>
      <button><span class="ic">${I.pin}</span> Country / Region <span class="rt">Kozhikode, India ${I.chev}</span></button>
      <button data-tabnav="notifications"><span class="ic">${I.bell}</span> Notifications <span class="rt">${I.chev}</span></button>
      <button><span class="ic">${GI.shield}</span> Account security <span class="rt">${I.chev}</span></button>
    </div>
    <div class="acct-list">
      <a href="/partner"><span class="ic">${GI.store}</span> Sell on Local Link <span class="rt">${I.chev}</span></a>
      <button><span class="ic">${GI.chat}</span> Help & Support <span class="rt">${I.chev}</span></button>
      ${loggedIn?`<button id="out"><span class="ic" style="color:var(--error)">${I.logout}</span> Log out <span class="rt">${I.chev}</span></button>`:''}
    </div>
    <div class="acct-foot"><div class="socials"><span>${GI.chat}</span><span>${GI.megaphone}</span><span>${GI.news}</span></div>
      Local Link · Everything Local. One Place.<br>Version 21.0 · Kozhikode, Kerala</div>
    <div style="height:96px"></div>`;
  wireCustControls(el);
  const inst=$('#installapp');
  if(inst){ const reveal=()=>{ if(window.__llInstall) inst.style.display='inline-flex'; };
    document.addEventListener('ll-installable', reveal); reveal();
    inst.onclick=async()=>{ const p=window.__llInstall; if(!p){ toast('Open the browser menu → “Add to Home screen”'); return; }
      p.prompt(); try{ await p.userChoice; }catch(e){} window.__llInstall=null; inst.style.display='none'; }; }
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  const br=$('#bulkreq'); if(br) br.onclick=()=>{ if(!token){ toast('Please log in to post a requirement'); return go('login'); } openBulkEnquiry(); };
  const out=$('#out'); if(out) out.onclick=()=>{ token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Logged out'); routeRender(); };
  const lang=$('#langrow'); if(lang) lang.onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};
SCREENS.profile = SCREENS.account;  // alias

SCREENS.saved = async (el) => {
  el.innerHTML = `${topbarBack('Saved / Wishlist')}<div class="px" id="l" style="margin-top:8px"></div><div style="height:90px"></div>`;
  backWire(el);
  if(!saved.length){ $('#l').innerHTML = emptyState('heart','No saved items yet','Tap the heart on any shop or product to save it here.'); return; }
  $('#l').innerHTML = `<div class="pgrid2" style="padding:0">${saved.map(s=>{
    const src=s.image||pic((s.name||'x').toLowerCase(),400+String(s.id).length,320,320);
    const nav = s.type==='business'?`data-nav="business" data-id="${s.id}"`:`data-nav="product" data-id="${s.id}"`;
    return `<div class="pcard" ${nav}><div class="pimg">${photoLayer(src)}<span class="fav2 on" data-fav data-ftype="${s.type}" data-fid="${s.id}" data-fname="${esc(s.name)}" data-fprice="${s.price||0}" data-fimg="${esc(src)}">${I.heart}</span></div>
      <div class="pb"><h4>${esc(s.name)}</h4>${s.type==='business'?`<div class="punit">${esc(s.sub||'Local shop')}</div>`:`<div class="price">${money(s.price)}</div>`}</div></div>`;
  }).join('')}</div>`;
};

SCREENS.product = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:300px;border-radius:0"></div>`;
  let p; try{ p = await api('/products/'+id); }catch(e){ el.innerHTML=`${topbarBack('Product')}<div class="px">${emptyState('bag','Product unavailable','')}</div>`; backWire(el); return; }
  const src = p.image_url || pic((p.name||'product').toLowerCase(), 500+(p.id||0), 800, 800);
  const disc = p.mrp && p.mrp>p.price; const pct = disc?Math.round((1-p.price/p.mrp)*100):0;
  const rating = (p.rating || (4 + ((p.id||1)%10)/10)).toFixed(1);
  const oos = p.stock_status==='out_of_stock';
  el.innerHTML = `
    <div class="pdp-cover">${photoLayer(src)}<button class="back" id="bk">${I.back}</button>
      <span class="fav-float ${isSaved('product',p.id)?'on':''}" data-fav data-ftype="product" data-fid="${p.id}" data-fname="${esc(p.name)}" data-fprice="${p.price}" data-fimg="${esc(src)}">${I.heart}</span>
      ${p.promo_label?`<span class="pdp-promo">${esc(p.promo_label)}</span>`:(disc?`<span class="pdp-promo">${pct}% OFF</span>`:'')}</div>
    <div class="px" style="margin-top:14px">
      <div class="row" style="gap:8px"><span class="badge primary">${esc(p.category_name||'')}</span>${oos?'<span class="badge closed">Out of stock</span>':'<span class="badge open">In stock</span>'}<span class="xbadge">express</span></div>
      <h1 style="font-size:22px;margin-top:10px;line-height:1.25">${esc(p.name)}</h1>
      <button class="row" data-nav="business" data-id="${p.business_id}" style="gap:6px;margin-top:6px;background:none"><span class="gi" style="color:var(--primary)">${GI.store}</span><span class="muted" style="font-size:13px">${esc(p.business)}</span>${I.chev.replace('width','style="width:14px;height:14px;stroke:var(--faint)" data-x width')}</button>
      <div class="row" style="gap:10px;margin-top:12px;align-items:baseline"><b style="font-size:26px">${money(p.price)}</b>${disc?`<span class="old" style="font-size:15px">${money(p.mrp)}</span><span class="badge accent">Save ${money(p.mrp-p.price)}</span>`:''}${p.unit?`<span class="muted" style="font-size:13px">/ ${esc(p.unit)}</span>`:''}</div>
      <div class="row" style="gap:7px;margin-top:8px">${stars(rating)}<span class="muted" style="font-size:12.5px">${p.review_count||120} ratings</span></div>
      ${p.description?`<p style="color:var(--body);font-size:14px;line-height:1.6;margin-top:14px">${esc(p.description)}</p>`:''}
      <div id="related"></div>
      <div style="height:110px"></div>
    </div>
    <div class="cartbar">${oos?`<button class="btn block" disabled style="opacity:.6">Out of stock</button>`:`
      <div class="ct"><div class="lbl">Price</div><div class="tot">${money(p.price)}</div></div>
      <button class="btn" id="addbtn" data-add="1" data-pid="${p.id}" data-pname="${esc(p.name)}" data-pprice="${p.price}" data-pimg="${esc(src)}" data-pbiz="${esc(p.business)}" data-pbizid="${p.business_id}">${GI.cart} Add to cart</button>`}</div>`;
  $('#bk').onclick=back;
  if(p.related && p.related.length){ $('#related').innerHTML = nsecHead('You may also like') + `<div class="dealrow" style="padding-left:0;padding-right:0">${p.related.map(r=>productCard(r)).join('')}</div>`; }
};

SCREENS.category = async (el, {slug, vfilter, vlabel}) => {
  const cat = ref.categories.find(c=>c.slug===slug) || {name:'Category', slug:'', kind:'business'};
  const vre = vfilter && VFILTERS[vfilter];
  const pageTitle = vlabel || catLabel(cat);
  // Non-business kinds keep their focused list
  if (cat.kind==='worker' || cat.kind==='driver' || cat.kind==='info' || slug==='news' || slug==='events'){
    el.innerHTML = `${topbarBack(catLabel(cat))}<div class="px stack" id="list" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
    backWire(el);
    if (cat.kind==='worker'){ renderWorkers($('#list'), await api('/workers')); }
    else if (cat.kind==='driver'){ renderDrivers($('#list'), await api('/drivers')); }
    else if (cat.kind==='info'){ renderLocalInfo($('#list'), await api('/local-info')); }
    else if (slug==='news'){ setTab('news'); }
    else if (slug==='events'){ $('#list').innerHTML = (await api('/events')).map(eventCard).join(''); }
    return;
  }
  // Business categories → rich Noon-style landing page
  const kw = vfilter ? vfilter : coverKw({subcategory:cat.name, category_name:cat.name});
  el.innerHTML = `${topbarBack(pageTitle)}
    <div class="cathero">${photoLayer(vfilter?pic(kw,900+(cat.id||0),900,360):catPhoto(cat.slug,cat.name))}<span class="ch-kick">Explore · ${esc(state.areaName||'Kozhikode')}</span><h2>${esc(pageTitle)}</h2><span class="ch-sub">Shops, offers and services near you</span></div>
    <div class="subchips" id="subchips"></div>
    <div id="catoffers"></div>
    <div id="cattop"></div>
    <div id="catitems"></div>
    <div class="nsec"><h3>All ${esc(catLabel(cat))}</h3></div>
    <div class="px stack" id="list" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
  backWire(el);
  const [biz, prods, offers, places] = await Promise.all([
    api(`/businesses?category=${slug}`), api(`/products?category=${slug}&limit=12`),
    api('/offers'), api(`/places?category=${slug}&area_id=${state.areaId}`).catch(()=>[])
  ]);
  // Merge live Google places (if any) ahead of seeded, de-duped by name
  const seen=new Set(); let merged=[];
  (places||[]).forEach(p=>{ if(!seen.has(p.name.toLowerCase())){ seen.add(p.name.toLowerCase()); merged.push(p); } });
  biz.forEach(b=>{ if(!seen.has((b.name||'').toLowerCase())){ seen.add((b.name||'').toLowerCase()); merged.push(b); } });
  // vertical filter (Food vs Grocery vs Quick) → keep only matching subcategories
  let prodsF = prods;
  if(vre){ merged = merged.filter(b=>vre.test((b.subcategory||'')+' '+(b.name||''))); }
  // sub-category chips
  const subs=[...new Set(merged.map(b=>b.subcategory).filter(Boolean))].slice(0,10);
  $('#subchips').innerHTML = `<button class="subchip on" data-sub="">All</button>` + subs.map(s=>`<button class="subchip" data-sub="${esc(s)}">${esc(s)}</button>`).join('');
  // category offers
  const catBizIds=new Set(biz.map(b=>b.id));
  const catOffers=(offers||[]).filter(o=>catBizIds.has(o.business_id));
  if(catOffers.length) $('#catoffers').innerHTML = nsecHead('Offers') + `<div class="promorow">${catOffers.map(promoCard).join('')}</div>`;
  // top rated
  const top=[...merged].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,8);
  if(top.length) $('#cattop').innerHTML = nsecHead(slug==='food-grocery'?'Top restaurants & stores':'Top rated') + `<div class="hero" style="padding-top:2px">${top.map(businessCard).join('')}</div>`;
  // popular items / dishes (respect the vertical filter)
  if(vre){ const ids=new Set(merged.map(b=>b.id)); prodsF=(prods||[]).filter(p=>ids.has(p.business_id)); }
  if(prodsF && prodsF.length) $('#catitems').innerHTML = nsecHead(vfilter==='grocery'?'Popular products':'Popular items') + `<div class="dealrow">${prodsF.map(p=>productCard(p)).join('')}</div>`;
  // full list + subcategory filter
  const draw=(items)=> $('#list').innerHTML = items.length? items.map(b=>bizRow(b)).join('') : emptyState('search','Nothing here yet','Try another area.');
  draw(merged);
  $('#subchips').addEventListener('click', e=>{ const b=e.target.closest('.subchip'); if(!b)return;
    el.querySelectorAll('#subchips .subchip').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const s=b.dataset.sub; const pick = s? merged.filter(x=>x.subcategory===s) : merged; const ids=new Set(pick.map(x=>x.id));
    const swap=(node,html)=>{ if(!node) return; node.classList.remove('sub-in'); node.classList.add('sub-out');
      setTimeout(()=>{ node.innerHTML=html; node.classList.remove('sub-out'); void node.offsetWidth; node.classList.add('sub-in'); },180); };
    const offs=catOffers.filter(o=>!s||ids.has(o.business_id));
    swap($('#catoffers'), offs.length? nsecHead('Offers') + `<div class="promorow">${offs.map(promoCard).join('')}</div>` : '');
    const tp=[...pick].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,8);
    swap($('#cattop'), tp.length? nsecHead(s? 'Top '+s : (slug==='food-grocery'?'Top restaurants & stores':'Top rated')) + `<div class="hero" style="padding-top:2px">${tp.map(businessCard).join('')}</div>` : '');
    const pp=(prodsF||[]).filter(p=>!s||ids.has(p.business_id));
    swap($('#catitems'), pp.length? nsecHead(s? s+' picks':'Popular items') + `<div class="dealrow">${pp.map(p=>productCard(p)).join('')}</div>` : '');
    const hd=el.querySelector('.nsec:has(+ #list) h3'); if(hd) hd.textContent = s? ('All '+s) : ('All '+catLabel(cat));
    swap($('#list'), pick.length? pick.map(x=>bizRow(x)).join('') : emptyState('search','Nothing here yet','Try another area.'));
    b.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); });
};
function bizRow(b){ const navr=b.source==='google'?'place':'business';
  return `<button class="brow" data-nav="${navr}" data-id="${b.id}" style="text-align:left">
  <div class="thumb" style="background:${grad(b.color1,b.color2)};overflow:hidden;position:relative">${b.cover_url?photoLayer(b.cover_url):''}${dIcon(b)}</div>
  <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(b.name)}</h4>${stars(b.rating)}</div>
    <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(b.subcategory||'')} · ${esc(b.area_name||'')}</div>
    <div class="row" style="gap:7px;margin-top:7px"><span class="badge ${b.is_open?'open':'closed'}">${b.is_open?t('openNow'):'Closed'}</span>
      <span class="muted" style="font-size:11.5px">${esc(b.hours_label||'')}</span></div></div></button>`; }

/* Google-place detail (real place from Google, no local products) */
SCREENS.place = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:190px;border-radius:0"></div>`;
  let p; try { p = await api('/places/'+id); } catch(e){ el.innerHTML = `${topbarBack('Place')}<div class="px">${emptyState('search','Place unavailable','Open it again from the list.')}</div>`; backWire(el); return; }
  const wa=(p.whatsapp||'').replace(/[^0-9]/g,'');
  el.innerHTML = `
    <div class="detail-cover" style="background:${grad('#B5121B','#1E3A8A')}">${p.cover_url?photoLayer(p.cover_url):''}
      <button class="back" id="bk">${I.back}</button><span class="logo">${dIcon({name:p.name})}</span></div>
    <div class="px" style="margin-top:-26px;position:relative">
      <div class="card" style="padding:15px">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><h2 style="font-size:20px">${esc(p.name)}</h2>
            <div class="muted" style="font-size:13px;margin-top:3px">${esc(p.subcategory||'Local place')} · ${esc(p.area_name||'')}</div></div>
          ${p.rating?stars(p.rating):''}</div>
        <div class="row" style="gap:8px;margin-top:10px">${p.is_open?'<span class="badge open">Open now</span>':''}
          <span class="muted" style="font-size:12px">${p.review_count?p.review_count+' Google reviews':''}</span>
          <span class="badge neutral">${gi('pin')} Google</span></div>
        <div class="muted" style="font-size:12.5px;margin-top:8px;display:flex;gap:6px">${I.pin.replace('fill="currentColor"','fill="var(--faint)" style="width:14px;height:14px;flex:0 0 auto"')} ${esc(p.address||'')}</div>
        <div class="actionbar" style="display:flex;gap:8px;margin-top:14px">
          ${p.phone?`<a class="btn sm" href="tel:${p.phone}">${I.phone} Call</a>`:''}
          ${wa?`<a class="btn sm accent" href="https://wa.me/${wa}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>`:''}
          <a class="btn sm ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name+' '+(p.address||''))}${p.place_id?'&query_place_id='+p.place_id:''}" target="_blank" rel="noopener">${I.dir} Directions</a>
        </div>
      </div>
      ${(p.photos&&p.photos.length>1)?`<div class="hero" style="padding:14px 0">${p.photos.map(u=>`<div class="hcard" style="flex:0 0 70%;background:var(--surface-2)">${photoLayer(u)}</div>`).join('')}</div>`:''}
      <div style="height:90px"></div></div>`;
  $('#bk').onclick=back;
};

function renderWorkers(elm,data){ elm.innerHTML = data.map(w=>`
  <div class="brow"><div class="thumb" style="background:${grad(w.color1,w.color2)}">${dIcon(w,'helmet')}</div>
    <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(w.name)}</h4>${stars(w.rating)}</div>
      <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(w.skills)}</div>
      <div class="row" style="gap:7px;margin-top:7px"><span class="badge primary">${esc(w.rate)}</span><span class="badge ${w.available?'open':'neutral'}">${w.available?'Available':'Busy'}</span>
        <span class="muted" style="font-size:11.5px">${w.experience_years}y exp · ${esc(w.area_name||'')}</span></div>
      <div class="row" style="gap:8px;margin-top:9px">
        <a class="btn sm" href="tel:${w.phone}">${I.phone} Call</a>
        <a class="btn sm accent" href="https://wa.me/${(w.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} WhatsApp</a></div>
    </div></div>`).join(''); }
function renderDrivers(elm,data){ elm.innerHTML = data.map(d=>`
  <div class="brow"><div class="thumb" style="background:${grad('#E5333B','#0369A1')}">${driverIcon(d.service_type)}</div>
    <div class="info"><div class="row" style="justify-content:space-between"><h4>${esc(d.name)}</h4>${stars(d.rating)}</div>
      <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(d.vehicle_model)} · ${esc(d.vehicle_number)}</div>
      <div class="row" style="gap:7px;margin-top:7px"><span class="badge accent">${esc(d.fare_note)}</span><span class="badge ${d.available?'open':'neutral'}">${d.available?'Available':'Offline'}</span></div>
      <div class="row" style="gap:8px;margin-top:9px"><a class="btn sm" href="tel:${d.phone}">${I.phone} Call</a>
        <a class="btn sm accent" href="https://wa.me/${(d.whatsapp||'').replace(/[^0-9]/g,'')}" target="_blank" rel="noopener">${I.wa} Book</a></div>
    </div></div>`).join(''); }
function renderLocalInfo(elm,data){ const groups={}; data.forEach(i=>(groups[i.category]=groups[i.category]||[]).push(i));
  elm.innerHTML = Object.entries(groups).map(([g,items])=>`
    <div class="sec-head" style="margin:6px 0 8px"><h3 style="font-size:15px">${esc(g)}</h3></div>
    ${items.map(i=>`<div class="brow" style="margin-bottom:10px"><div class="thumb" style="width:56px;height:56px;font-size:24px;background:${i.emergency?grad('#EF4444','#B91C1C'):grad('#E5333B','#1E3A8A')}">${dIcon({name:i.name,category:i.category},'building')}</div>
      <div class="info"><h4 style="font-size:14.5px">${esc(i.name)}</h4><div class="muted" style="font-size:12px;margin-top:3px">${esc(i.description)}</div>
        <div class="muted" style="font-size:11.5px;margin-top:3px">${esc(i.hours||'')}</div></div>
      <a class="btn sm" style="align-self:center" href="tel:${i.phone}">${I.phone}</a></div>`).join('')}`).join(''); }

SCREENS.business = async (el, {id}) => {
  el.innerHTML = `<div class="sk" style="height:190px;border-radius:0"></div><div class="px" style="margin-top:14px">${skeletonRow(2)}</div>`;
  const b = await api(`/businesses/${id}`);
  const wa = (b.whatsapp||'').replace(/[^0-9]/g,'');
  el.innerHTML = `
    <div class="detail-cover" style="background:${grad(b.color1,b.color2)}">${photoLayer(b.cover_url || pic(coverKw(b), b.id, 900, 480))}
      <button class="back" id="bk">${I.back}</button><span class="logo">${dIcon(b)}</span></div>
    <div class="px" style="margin-top:-26px;position:relative">
      <div class="card" style="padding:15px">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><h2 style="font-size:20px">${esc(b.name)}</h2>
            <div class="muted" style="font-size:13px;margin-top:3px">${esc(b.subcategory||'')} · ${esc(b.area_name||'')}</div></div>
          ${stars(b.rating)}</div>
        <div class="row" style="gap:8px;margin-top:10px"><span class="badge ${b.is_open?'open':'closed'}">${b.is_open?'Open now':'Closed'}</span>
          <span class="muted" style="font-size:12px">${esc(b.hours_label||'')}</span><span class="dot" style="width:3px;height:3px;background:var(--faint);border-radius:50%"></span>
          <span class="muted" style="font-size:12px">${b.review_count} reviews</span></div>
        <div class="muted" style="font-size:12.5px;margin-top:8px;display:flex;gap:6px">${I.pin.replace('fill="currentColor"','fill="var(--faint)" style="width:14px;height:14px;flex:0 0 auto"')} ${esc(b.address||'')}</div>
        <div class="actionbar">
          <button id="callb">${I.phone}${t('call')}</button>
          <button id="wab">${I.wa}${t('whatsapp')}</button>
          <a href="https://maps.google.com/?q=${encodeURIComponent(b.name+' '+(b.address||''))}" target="_blank" rel="noopener">${I.dir}${t('directions')}</a>
          <a href="#" id="shareb">${I.share}${t('share')}</a>
        </div>
        ${b.can_chat?`<button class="btn block" id="chatbtn" style="margin-top:12px;gap:8px;align-items:center;justify-content:center">${GI.chat} Chat with ${esc(b.name.split(' ')[0])}</button>`:''}
      </div>
      <div class="tabs" id="tabs">
        <button class="on" data-t="about">${t('about')}</button>
        ${b.products.length?`<button data-t="products">${t('products')}</button>`:''}
        ${b.services.length?`<button data-t="services">${t('services')}</button>`:''}
        ${b.offers.length?`<button data-t="offers">${t('offers')}</button>`:''}
        <button data-t="reviews">${t('reviews')} (${b.reviews.length})</button>
      </div>
      <div id="tabbody" style="margin-top:14px"></div>
      <div style="height:90px"></div>
    </div>`;
  $('#bk').onclick=back; $('#shareb').onclick=(e)=>{e.preventDefault(); toast('Link copied to share');};
  const chatb=$('#chatbtn'); if(chatb) chatb.onclick=()=>gateAction('chat with this store',()=>go('chat',{id:b.id,name:b.name}));
  const callb=$('#callb'); if(callb) callb.onclick=()=>gateAction('call this business',()=>{ window.location.href='tel:'+b.phone; });
  const wab=$('#wab'); if(wab) wab.onclick=()=>gateAction('message this business on WhatsApp',()=>{ window.open('https://wa.me/'+wa,'_blank','noopener'); });
  const bodies = {
    about: ()=>`<p style="color:var(--body);font-size:14px;line-height:1.6">${esc(b.description||'')}</p>
      <div class="card" style="padding:14px;margin-top:14px">
        <div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:8px"><span class="muted">Category</span><b>${esc(b.category_name)}</b></div>
        <div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:8px"><span class="muted">Hours</span><b>${esc(b.hours_label)}</b></div>
        <div class="row" style="justify-content:space-between;font-size:13px"><span class="muted">Phone</span>${token?`<b>${esc(b.phone)}</b>`:`<button id="revealph" style="color:var(--primary);font-weight:700;font-size:13px">Sign up to view</button>`}</div></div>
      <button class="btn block" style="margin-top:14px" id="enqbtn">${t('enquire')}</button>`,
    products: ()=>`<div class="grid2">${b.products.map(p=>productCard(p,b)).join('')}</div>`,
    services: ()=>`<div class="stack" style="gap:11px">${b.services.map(s=>`<div class="brow"><div class="thumb" style="background:${grad('#D9A441','#4338CA')}">${dIcon(s,'wrench')}</div>
      <div class="info"><h4 style="font-size:14.5px">${esc(s.name)}</h4><div class="muted" style="font-size:12.5px;margin-top:3px">${esc(s.description||'')}</div>
      <span class="badge primary" style="margin-top:7px">from ${money(s.starting_price)}</span></div>
      <button class="btn sm" style="align-self:center" data-req="${esc(s.name)}">Request</button></div>`).join('')}</div>`,
    offers: ()=>`<div class="stack" style="gap:11px">${b.offers.map(o=>`<div class="ocard" style="width:auto;background:${grad(o.color1,o.color2)}"><span class="badge tag">${esc(o.discount_label)}</span><div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.description||'')}</div></div></div>`).join('')}</div>`,
    reviews: ()=>`<button class="btn ghost block sm" id="addrev" style="margin-bottom:12px">${I.star} Write a review</button>
      <div class="stack" style="gap:11px">${b.reviews.length?b.reviews.map(r=>`<div class="card" style="padding:13px">
        <div class="row" style="justify-content:space-between"><b style="font-size:13.5px">${esc(r.author_name)}</b>${stars(r.rating)}</div>
        <p style="font-size:13px;color:var(--body);margin:7px 0 0;line-height:1.5">${esc(r.comment)}</p></div>`).join(''):emptyState('star','No reviews yet','Be the first to review.')}</div>`,
  };
  const showTab = (name)=>{ $('#tabbody').innerHTML = bodies[name](); wireTabBody(b); };
  showTab('about');
  $('#tabs').addEventListener('click', e=>{ const btn=e.target.closest('button'); if(!btn)return;
    $('#tabs').querySelectorAll('button').forEach(x=>x.classList.remove('on')); btn.classList.add('on'); showTab(btn.dataset.t); });
};
function wireTabBody(b){
  const enq=$('#enqbtn'); if(enq) enq.onclick=()=>openEnquiry(b);
  const rev=$('#addrev'); if(rev) rev.onclick=()=>openReview(b);
  const rp=$('#revealph'); if(rp) rp.onclick=()=>gateAction('view contact details',()=>{});
  document.querySelectorAll('[data-req]').forEach(x=>x.onclick=()=>{ if(!token) return openLoginPrompt(); toast('Service request sent to '+b.name); });
  document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>toast('Added to cart'));
}

SCREENS.searchScreen = async (el) => {
  el.innerHTML = `${topbarBack('')}
    <div class="px"><div class="searchbar" style="width:100%"><span style="color:var(--muted)">${I.search}</span>
      <input id="sq" placeholder="${t('search')}" autofocus /></div></div>
    <div class="px" style="margin-top:12px"><div class="hscroll" style="padding:0" id="pop">
      ${['Biriyani','Plumber','Grocery','AC repair','Auto','Salon','Pharmacy'].map(x=>`<button class="chip" data-q="${x}">${x}</button>`).join('')}</div></div>
    <div class="px" id="sres" style="margin-top:14px"><p class="muted" style="font-size:13px">Popular searches — or ask the assistant for anything.</p>
      <button class="btn ghost block" style="margin-top:12px" id="askfromsearch">${I.ai} ${t('askTitle')}</button></div><div style="height:90px"></div>`;
  backWire(el);
  const input=$('#sq'); let tmr; let last=null;
  const state2={sort:'relevance', openNow:false};
  const filterBar=()=>`<div class="hscroll srchfilt" style="padding:0;margin-bottom:12px">
    ${[['relevance','Relevance'],['price','Price ↑'],['rating','Top rated']].map(s=>`<button class="chip ${state2.sort===s[0]?'on':''}" data-sort="${s[0]}">${s[1]}</button>`).join('')}
    <button class="chip ${state2.openNow?'on':''}" data-open="1">Open now</button></div>`;
  const draw=()=>{ const r=last; if(!r) return;
    let biz=r.businesses.slice(), prods=r.products.slice();
    if(state2.openNow) biz=biz.filter(b=>b.is_open);
    if(state2.sort==='rating') biz.sort((a,b)=>(b.rating||0)-(a.rating||0));
    if(state2.sort==='price') prods.sort((a,b)=>(a.price||0)-(b.price||0));
    const total=biz.length+prods.length+r.services.length+r.workers.length+r.drivers.length;
    if(!total){ $('#sres').innerHTML=filterBar()+emptyState('search','No results','Try a different term or turn off filters.'); wireFilters(); return; }
    let html=filterBar();
    if(biz.length) html+=`<div class="sec-head" style="margin:4px 0 8px"><h3 style="font-size:14px">Businesses</h3></div>`+biz.map(bizRow).join('');
    if(r.services.length) html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Services</h3></div>`+r.services.map(serviceCard).join('');
    if(prods.length) html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Products</h3></div><div class="grid2">`+prods.map(p=>productCard(p)).join('')+`</div>`;
    if(r.workers.length){ html+=`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:14px">Workers</h3></div><div class="stack" id="wl" style="gap:11px"></div>`; }
    $('#sres').innerHTML=html; if(r.workers.length) renderWorkers($('#wl'),r.workers); wireFilters();
  };
  const wireFilters=()=>{ document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{state2.sort=b.dataset.sort;draw();});
    const o=document.querySelector('[data-open]'); if(o) o.onclick=()=>{state2.openNow=!state2.openNow;draw();}; };
  const run=async(q)=>{ if(!q.trim()){ return; } $('#sres').innerHTML=skeletonRow(3);
    last=await api('/search?q='+encodeURIComponent(q)); draw();
    // a logged-in customer's search becomes a lead for Premium businesses (server de-dupes)
    if(token && q.trim().length>=3){ api('/leads/search',{method:'POST',body:{query:q.trim(),area_id:state.areaId||null}}).catch(()=>{}); }
  };
  input.oninput=()=>{ clearTimeout(tmr); tmr=setTimeout(()=>run(input.value),260); };
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ input.value=b.dataset.q; run(b.dataset.q); });
  $('#askfromsearch').onclick=()=>openAsk(input.value);
};

SCREENS.offers = async (el) => {
  el.innerHTML = `${topbarBack(t('offers'))}<div class="px stack" id="l" style="gap:12px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
  backWire(el);
  const offers = await api('/offers');
  $('#l').innerHTML = offers.map(o=>`<button class="ocard" data-nav="business" data-id="${o.business_id}" style="width:auto;background:${grad(o.color1,o.color2)}">
    <span class="badge tag">${esc(o.discount_label)}</span><div><h4>${esc(o.title)}</h4><div class="biz">${esc(o.business)} · ${esc(o.description||'')}</div></div><span class="disc">%</span></button>`).join('');
};

SCREENS.news = async (el) => {
  el.innerHTML = `${topbarBack(t('news'))}<div class="px stack" id="l" style="gap:12px">${skeletonRow(4)}</div><div style="height:90px"></div>`;
  backWire(el);
  const news = await api('/news');
  $('#l').innerHTML = news.map(n=>`<button class="brow" data-nav="newsDetail" data-id="${n.id}" style="text-align:left">
    <div class="thumb" style="background:${grad(n.color1,n.color2)}">${gi('news')}</div>
    <div class="info"><span class="badge neutral">${esc(n.category)}</span><h4 style="font-size:14.5px;margin-top:6px">${esc(n.title)}</h4>
    <div class="muted" style="font-size:12px;margin-top:4px">${esc(n.summary)}</div></div></button>`).join('');
};
SCREENS.newsDetail = async (el, {id}) => {
  const n = await api('/news/'+id);
  el.innerHTML = `<div class="detail-cover" style="height:150px;background:${grad(n.color1,n.color2)}"><button class="back" id="bk">${I.back}</button><span class="logo" style="font-size:44px">${gi('news')}</span></div>
    <div class="px" style="margin-top:16px"><span class="badge neutral">${esc(n.category)}</span>
      <h2 style="font-size:22px;margin-top:10px;line-height:1.25">${esc(n.title)}</h2>
      <div class="muted" style="font-size:12px;margin-top:8px">${new Date(n.published_at).toDateString()}</div>
      <p style="color:var(--body);font-size:14.5px;line-height:1.7;margin-top:14px">${esc(n.body)}</p><div style="height:90px"></div></div>`;
  $('#bk').onclick=back;
};

const ORDER_STEPS = [['pending','Placed'],['accepted','Accepted'],['preparing','Preparing'],['ready','Ready'],['out_for_delivery','On the way'],['completed','Delivered']];
function orderTimeline(status){
  if(status==='rejected'||status==='cancelled'){
    return `<div class="otl-bad">✕ Order ${status}</div>`;
  }
  const idx = Math.max(0, ORDER_STEPS.findIndex(s=>s[0]===status));
  return `<div class="otl">${ORDER_STEPS.map((s,i)=>`
    <div class="ostep ${i<idx?'done':''} ${i===idx?'now':''}"><span class="odot">${i<=idx?(I.check2||'✓'):''}</span><span class="olab">${s[1]}</span></div>
    ${i<ORDER_STEPS.length-1?`<span class="oline ${i<idx?'done':''}"></span>`:''}`).join('')}</div>`;
}
SCREENS.orders = async (el) => {
  if(!token) return openLoginInline(el, 'Log in to see your orders');
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('orders')}</h2></div><div class="px stack" id="l" style="gap:12px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const orders = await api('/orders');
  const badge=(s)=>({pending:'warn',accepted:'primary',preparing:'primary',ready:'primary',completed:'open',cancelled:'closed',rejected:'closed',out_for_delivery:'primary'}[s]||'neutral');
  $('#l').innerHTML = orders.length? orders.map(o=>`<div class="card" style="padding:14px">
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:9px"><span class="gi" style="font-size:22px;color:var(--primary)">${GI.package}</span><div><b style="font-size:14px">${esc(o.business)}</b><div class="muted" style="font-size:12px">#${1000+o.id} · ${new Date(o.created_at).toLocaleDateString()}</div></div></div>
      <span class="badge ${badge(o.status)}">${o.status.replace(/_/g,' ')}</span></div>
    ${orderTimeline(o.status)}
    <div class="muted" style="font-size:12.5px;margin-top:10px">${esc(o.item_summary)}</div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><b class="price">${money(o.total)}</b>
      <button class="btn ghost sm" data-reorder='${esc(JSON.stringify({items:o.items_json,biz:o.business,bizId:o.business_id}))}'>Order again</button></div></div>`).join('')
    : emptyState('bag','No orders yet','Browse local shops and place your first order.');
  el.querySelectorAll('[data-reorder]').forEach(b=>b.onclick=()=>{
    let d={}; try{ d=JSON.parse(b.dataset.reorder); }catch(e){}
    const items = d.items ? (typeof d.items==='string'?safeParse(d.items):d.items) : null;
    if(items && items.length){ cart=[]; items.forEach(it=>{ for(let n=0;n<(it.qty||1);n++){ const ex=cart.find(x=>x.id===it.id); if(ex)ex.qty++; else cart.push({id:it.id,name:it.name,price:it.price,image:it.image||'',biz:d.biz,bizId:Number(d.bizId),qty:1}); } }); saveCart(); updateCartBadge(); toast('Added to cart'); setTab('cart'); }
    else if(d.bizId){ go('business',{id:d.bizId}); }
    else toast('Nothing to reorder');
  });
};

SCREENS.notifications = async (el) => {
  if(!token) return openLoginInline(el, 'Log in to see notifications');
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('notifications')}</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const items = await api('/notifications');
  const emojiMap={order:'package',offer:'percent',news:'news',event:'calendar',system:'bell',emergency:'cross'};
  let gone = safeParse(localStorage.getItem('ll_ndismiss')) || [];
  const live = items.filter(n=>!gone.includes(n.id));
  const save=()=>localStorage.setItem('ll_ndismiss',JSON.stringify(gone));
  const head=document.querySelector('.chead'); if(head && live.length){ head.style.display='flex'; head.style.alignItems='center'; head.insertAdjacentHTML('beforeend','<button class="nclear" id="nclear">Clear all</button>'); }
  $('#l').innerHTML = live.length? live.map(n=>`<div class="brow nitem ${n.read?'':'unread'}" data-nid="${n.id}">
    <div class="thumb" style="width:44px;height:44px;font-size:20px;background:var(--surface-2);color:var(--primary)">${gi(emojiMap[n.type]||'bell')}</div>
    <div class="info"><h4 style="font-size:14px">${esc(n.title)}</h4><div class="muted" style="font-size:12.5px;margin-top:3px">${esc(n.body)}</div>
    <div class="faint" style="font-size:11px;margin-top:4px">${new Date(n.created_at).toLocaleString()}</div></div>
    <button class="ndis" data-ndis="${n.id}" aria-label="Dismiss notification">✕</button></div>`).join('')
    : emptyState('bell','No notifications','You are all caught up.');
  const showEmpty=()=>{ if(!$('#l').querySelector('.nitem')){ $('#l').innerHTML=emptyState('bell','No notifications','You are all caught up.'); const c=$('#nclear'); if(c) c.remove(); } };
  $('#l').querySelectorAll('[data-ndis]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); const id=Number(b.dataset.ndis); gone.push(id); save();
    const row=b.closest('.nitem'); row.classList.add('out'); setTimeout(()=>{ row.remove(); showEmpty(); },380); });
  const c=$('#nclear'); if(c) c.onclick=()=>{ live.forEach(n=>gone.push(n.id)); save(); $('#l').querySelectorAll('.nitem').forEach((r,i)=>setTimeout(()=>r.classList.add('out'),i*60)); setTimeout(showEmpty,420+live.length*60); toast('Notifications cleared'); };
};

SCREENS.profile = async (el) => {
  const loggedIn = !!token;
  el.innerHTML = `<div class="chead"><h2 style="font-size:21px">${t('profile')}</h2></div>
    <div class="px" style="margin-top:8px">
      <div class="card" style="padding:16px;display:flex;gap:13px;align-items:center">
        <div class="avatar" style="width:54px;height:54px;font-size:20px;background:${grad(loggedIn?me.avatar_color:'#8A0002','#8A0002')}">${loggedIn?me.name[0].toUpperCase():'<span class="gi" style="color:#fff">'+GI.user+'</span>'}</div>
        <div style="flex:1"><b style="font-size:16px">${loggedIn?esc(me.name):'Guest'}</b><div class="muted" style="font-size:12.5px">${loggedIn?esc(me.email||me.phone):'Log in to order, enquire & review'}</div></div>
        ${loggedIn?'':`<button class="btn sm" id="lg">${t('login')}</button>`}
      </div>
      <div style="height:16px"></div>
      <div class="plist">
        <button data-tabnav="orders"><span class="ic">${gi('package')}</span> My Orders <span class="chev">${I.chev}</span></button>
        <button data-nav="offers"><span class="ic">${gi('percent')}</span> ${t('offers')} <span class="chev">${I.chev}</span></button>
        <button data-nav="localinfo"><span class="ic">${gi('building')}</span> ${t('localInfo')} <span class="chev">${I.chev}</span></button>
        <button data-nav="events"><span class="ic">${gi('calendar')}</span> ${t('events')} <span class="chev">${I.chev}</span></button>
      </div>
      <div style="height:14px"></div>
      <div class="plist">
        <button id="langrow"><span class="ic">${I.globe}</span> Language — ${state.lang==='ml'?'മലയാളം':'English'} <span class="chev">${I.chev}</span></button>
        <button id="themerow"><span class="ic">${I.sun}</span> Theme — ${state.theme} <span class="chev">${I.chev}</span></button>
      </div>
      ${loggedIn?`<button class="btn ghost block" style="margin-top:16px;color:var(--error);border-color:var(--error)" id="out">${I.logout} Log out</button>`:''}
      <div style="height:90px"></div>
    </div>`;
  const lg=$('#lg'); if(lg) lg.onclick=()=>go('login');
  const out=$('#out'); if(out) out.onclick=()=>{ token=null; me=null; localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); toast('Logged out'); routeRender(); };
  $('#langrow').onclick=()=>{ state.lang=state.lang==='en'?'ml':'en'; localStorage.setItem('ll_lang',state.lang); renderShell(); };
  $('#themerow').onclick=cycleTheme;
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
};
SCREENS.localinfo = async (el)=>{ el.innerHTML=`${topbarBack(t('localInfo'))}<div class="px stack" id="l" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`; backWire(el); renderLocalInfo($('#l'), await api('/local-info')); };
SCREENS.events = async (el)=>{ el.innerHTML=`${topbarBack(t('events'))}<div class="px stack" id="l" style="gap:11px">${skeletonRow(4)}</div><div style="height:90px"></div>`; backWire(el); $('#l').innerHTML=(await api('/events')).map(eventCard).join(''); };

SCREENS.login = (el) => renderLogin(el, 'customer');

/* ---------------- shared bits ---------------- */
function topbarBack(title){ return `<div class="row px" style="gap:12px;padding-top:16px;padding-bottom:10px;position:sticky;top:0;background:var(--bg);z-index:6">
  <button class="tb-btn" id="__back">${I.back}</button><h3 style="font-size:17px">${esc(title)}</h3></div>`; }
function backWire(el){ const b=el.querySelector('#__back'); if(b) b.onclick=back; }

function openLoginInline(el, msg){ el.innerHTML=`<div class="center-min px" style="flex-direction:column;gap:14px;text-align:center">
  <div class="eic" style="width:64px;height:64px;border-radius:50%;background:var(--surface-2);display:grid;place-items:center;font-size:28px;color:var(--muted)">${gi('lock')}</div>
  <h3 style="font-size:17px">${esc(msg)}</h3><button class="btn" id="li">${t('login')}</button></div>`;
  $('#li').onclick=()=>go('login'); }
function openLoginPrompt(){ toast('Please log in first'); go('login'); }
/* Guest gate: ask a guest to sign up before ordering / seeing contact details */
async function gateAction(actionText, cb){
  if(token){ cb(); return; }
  const ok = await confirmDialog({ title:'Sign up to continue',
    message:`Create a free Local Link account to ${actionText}. It only takes a moment.`,
    ok:'Sign up', cancel:'Not now', icon: GI.user||I.user });
  if(ok) go('register');
}

function openEnquiry(b){
  if(!token) return openLoginPrompt();
  showSheet(`${t('enquire')} — ${esc(b.name)}`, `
    <div class="field"><label>Your message</label><div class="input"><textarea id="emsg" rows="4" placeholder="e.g. Is this available now? Do you deliver to Kunnamangalam?"></textarea></div></div>
    <button class="btn block" id="esend">${t('enquire')}</button>`, ()=>{
      $('#esend').onclick=async()=>{ const msg=$('#emsg').value.trim(); if(!msg)return; try{ await api('/enquiries',{method:'POST',body:{business_id:b.id,message:msg}}); closeSheet(); toast('Enquiry sent to '+b.name);}catch(e){toast(e.message);} };
    });
}
function openBulkEnquiry(){
  if(!token) return openLoginPrompt();
  const cats=(ref.categories||[]).filter(c=>c.kind==='business');
  showSheet('Post a requirement', `
    <p class="faint" style="font-size:12.5px;margin:0 0 12px">Have a bulk order or a specific need? Post it once and matching local businesses will reach out to you.</p>
    <div class="field"><label>Category</label><div class="input"><select id="bcat">${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>What do you need?</label><div class="input"><input id="bq" placeholder="e.g. 100 biriyani plates for a wedding"/></div></div>
    <div class="field"><label>Details</label><div class="input"><textarea id="bmsg" rows="3" placeholder="Quantity, date, delivery location…"></textarea></div></div>
    <div class="field"><label>Budget <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="bbud" placeholder="e.g. ₹15,000–20,000"/></div></div>
    <button class="btn block" id="bsend">Post requirement</button>`, ()=>{
      $('#bsend').onclick=async()=>{ const query=$('#bq').value.trim(); if(!query) return toast('Tell us what you need');
        try{ await api('/leads',{method:'POST',body:{ type:'bulk', category_id:Number($('#bcat').value)||null, area_id:state.areaId||null,
          query, message:$('#bmsg').value.trim()||null, budget:$('#bbud').value.trim()||null }});
          closeSheet(); toast('Requirement posted — businesses will contact you'); }catch(e){ toast(e.message); } };
    });
}
function openReview(b){
  if(!token) return openLoginPrompt();
  let rating=5;
  showSheet(`Rate ${esc(b.name)}`, `
    <div id="rstars" style="display:flex;gap:6px;justify-content:center;margin:6px 0 14px">${[1,2,3,4,5].map(i=>`<button data-s="${i}" style="font-size:30px;color:${i<=5?'#F5A524':'var(--border-strong)'}">★</button>`).join('')}</div>
    <div class="field"><label>Your review</label><div class="input"><textarea id="rc" rows="3" placeholder="Share your experience"></textarea></div></div>
    <button class="btn block" id="rsend">Submit review</button>`, ()=>{
      const sync=()=>document.querySelectorAll('#rstars button').forEach(x=>x.style.color=Number(x.dataset.s)<=rating?'#F5A524':'var(--border-strong)');
      document.querySelectorAll('#rstars button').forEach(x=>x.onclick=()=>{rating=Number(x.dataset.s);sync();});
      $('#rsend').onclick=async()=>{ try{ await api('/reviews',{method:'POST',body:{business_id:b.id,rating,comment:$('#rc').value.trim()}}); closeSheet(); toast('Thanks for your review!'); back(); go('business',{id:b.id}); }catch(e){toast(e.message);} };
    });
}

/* ---- customer ↔ store live chat (Premium stores) ---- */
function chatBubbles(messages, mine){
  if(!messages.length) return `<div class="chat-empty">${GI.chat}<p>Start the conversation — ask about products, delivery or offers.</p></div>`;
  return messages.map(m=>{ const own = m.sender===mine;
    return `<div class="cmsg ${own?'me':'them'}"><div class="cbub">${esc(m.body)}<span class="ctime">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div></div>`;
  }).join('');
}
SCREENS.chat = async (el, {id, name}) => {
  if(!token){ toast('Please log in to chat'); return go('login'); }
  el.innerHTML = `${topbarBack(name||'Chat')}
    <div class="chat-wrap"><div class="chat-scroll" id="chatmsgs">${skeletonRow(2)}</div>
      <div class="chat-input"><input id="cin" placeholder="Type a message…" autocomplete="off"/><button id="csend" class="chat-send">${GI.send||I.chev}</button></div>
    </div>`;
  backWire(el);
  const load = async(scroll)=>{ const box=$('#chatmsgs'); if(!box) return false;
    try{ const d=await api('/chat/'+id); box.innerHTML=chatBubbles(d.messages,'user');
      if(scroll){ box.scrollTop=box.scrollHeight; } return true; }catch(e){ return false; } };
  await load(true);
  const send=async()=>{ const inp=$('#cin'); const v=(inp.value||'').trim(); if(!v) return; inp.value='';
    try{ await api('/chat/'+id,{method:'POST',body:{body:v}}); await load(true); }catch(e){ toast(e.message); inp.value=v; } };
  $('#csend').onclick=send;
  $('#cin').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
  // poll for the partner's replies; auto-stops when the user navigates away
  const timer=setInterval(async()=>{ const box=document.getElementById('chatmsgs'); if(!box){ clearInterval(timer); return; }
    const nearBottom = box.scrollHeight-box.scrollTop-box.clientHeight < 60; await load(nearBottom); }, 4000);
};

/* ---------------- Ask Local Link — chat panel with voice ---------------- */
let aiVoiceLang = localStorage.getItem('ll_voicelang') || 'en-IN';
function openAsk(prefill){
  closeSheet();
  const phone = $('.phone') || document.body;
  const aiOn = state.aiStatus.openai;
  const chips = [t('chipPlumber'),t('chipBiriyani'),t('chipAuto'),t('chipGrocery'),t('chipAC')];
  const panel = h(`<div class="sheet" id="sheet"><div class="ai-panel">
    <div class="ai-head">
      <div class="row" style="gap:9px"><span class="ai-badge">${logoMark(30)}</span><b style="font-size:16px">${t('askTitle')}</b>
        <span class="badge ${aiOn?'primary':'neutral'}" style="font-size:10px">${aiOn?'AI':'Offline'}</span></div>
      <button class="tb-btn" id="ai-close">✕</button>
    </div>
    <div class="ai-msgs" id="ai-msgs">
      <div class="ai-bubble bot">${t('askHi')} ${aiOn?'':`<span class="faint">${t('askOffline')}</span>`}</div>
      <div class="ai-chips" id="ai-chips">${chips.map(x=>`<button class="chip" data-aq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    </div>
    <div class="ai-inputbar">
      <div class="ai-langtg" id="ai-lang"><button data-vl="en-IN" class="${aiVoiceLang==='en-IN'?'on':''}">EN</button><button data-vl="ml-IN" class="${aiVoiceLang==='ml-IN'?'on':''}">മ</button></div>
      <button class="ai-mic" id="ai-mic" title="Speak">${GI.mic}</button>
      <input id="aq" placeholder="${t('askPh')}" value="${esc(prefill||'')}" autocomplete="off"/>
      <button class="ai-sendbtn" id="asend" title="Send">${GI.send}</button>
    </div>
  </div></div>`);
  phone.appendChild(panel);
  const msgs=$('#ai-msgs'), input=$('#aq');
  const scrollDown=()=>{ msgs.scrollTop = msgs.scrollHeight; };
  const addUser=(txt)=>{ msgs.insertAdjacentHTML('beforeend', `<div class="ai-bubble user">${esc(txt)}</div>`); scrollDown(); };
  const addBot=(html)=>{ const d=h(`<div class="ai-turn">${html}</div>`); msgs.appendChild(d); scrollDown(); return d; };

  const run=async(q)=>{ q=(q||input.value).trim(); if(!q) return;
    input.value=''; const chipsEl=$('#ai-chips'); if(chipsEl) chipsEl.remove();
    addUser(q);
    const loading=addBot(`<div class="ai-bubble bot"><span class="ai-typing"><i></i><i></i><i></i></span></div>`);
    try{
      const r=await api('/ask',{method:'POST',body:{query:q, lang: state.lang}});
      loading.innerHTML = `<div class="ai-bubble bot">${esc(r.answer)}</div>` + (r.results||[]).map(x=>aiResultRow(x)).join('');
      loading.querySelectorAll('[data-go-biz]').forEach(b=>b.onclick=()=>{ closeSheet(); go('business',{id:Number(b.dataset.goBiz)}); });
      scrollDown();
    }catch(e){ loading.innerHTML=`<div class="ai-bubble bot">${esc(e.message)}</div>`; }
  };
  $('#ai-close').onclick=closeSheet;
  panel.addEventListener('click', e=>{ if(e.target===panel) closeSheet(); });
  $('#asend').onclick=()=>run();
  input.onkeydown=e=>{ if(e.key==='Enter') run(); };
  $('#ai-chips').querySelectorAll('[data-aq]').forEach(b=>b.onclick=()=>run(b.dataset.aq));
  $('#ai-lang').querySelectorAll('[data-vl]').forEach(b=>b.onclick=()=>{ aiVoiceLang=b.dataset.vl; localStorage.setItem('ll_voicelang',aiVoiceLang); $('#ai-lang').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.vl===aiVoiceLang)); });
  setupVoice($('#ai-mic'), input, run);
  if(prefill) run(prefill); else setTimeout(()=>input.focus(),200);
}

/* voice input (English + Malayalam) via Web Speech API */
let _recog=null;
function setupVoice(micBtn, input, run){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ micBtn.classList.add('disabled'); micBtn.title='Voice not supported on this device'; micBtn.onclick=()=>toast('Voice input isn’t supported on this browser'); return; }
  let listening=false;
  micBtn.onclick=()=>{
    if(listening){ try{_recog.stop();}catch(e){} return; }
    try{ _recog = new SR(); }catch(e){ toast('Voice unavailable'); return; }
    _recog.lang = aiVoiceLang; _recog.interimResults = true; _recog.maxAlternatives = 1; _recog.continuous=false;
    listening=true; micBtn.classList.add('listening'); input.placeholder = aiVoiceLang==='ml-IN'?'കേൾക്കുന്നു…':'Listening…';
    let finalText='';
    _recog.onresult=(ev)=>{ let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const tr=ev.results[i]; if(tr.isFinal) finalText+=tr[0].transcript; else interim+=tr[0].transcript; } input.value = (finalText+interim).trim(); };
    _recog.onerror=(ev)=>{ toast(ev.error==='not-allowed'?'Mic permission denied':'Voice error: '+ev.error); };
    _recog.onend=()=>{ listening=false; micBtn.classList.remove('listening'); input.placeholder=t('askPh'); if(finalText.trim()) run(finalText.trim()); };
    try{ _recog.start(); }catch(e){ listening=false; micBtn.classList.remove('listening'); }
  };
}
function aiResultRow(x){
  const map={business:['store','#B5121B','Business',x.id],service:['wrench','#D9A441','Service',x.business_id],product:['cart','#FFC53D','Product',x.business_id],worker:['helmet','#F59E0B','Worker',null],driver:['car','#E5333B','Ride',null]};
  const [emoji,color,label,bizId]=map[x.type]||['pin','#8A0002','Result',null];
  const sub = x.type==='business'?`${esc(x.subcategory||'')} · ★ ${x.rating||''}`: x.type==='product'?`${money(x.price)} · ${esc(x.business||'')}`: x.type==='service'?`from ${money(x.starting_price)} · ${esc(x.business||'')}`: x.type==='worker'?esc(x.skills||''):esc(x.fare_note||x.service_type||'');
  return `<div class="airow" ${bizId?`data-go-biz="${bizId}" role="button"`:''}>
    <div class="ai-ic" style="background:${grad(color,color)}">${gi(emoji)}</div>
    <div style="flex:1;min-width:0"><div class="rt">${label}</div><b style="font-size:14px">${esc(x.name)}</b><div class="muted" style="font-size:12px">${sub}</div></div>
    ${x.phone?`<a class="btn sm" href="tel:${x.phone}" onclick="event.stopPropagation()">${I.phone}</a>`:bizId?`<span class="chev" style="color:var(--faint);width:18px">${I.chev}</span>`:''}</div>`;
}

/* ---------------- bottom sheet ---------------- */
function showSheet(title, bodyHtml, wire){
  closeSheet();
  const phone = $('.phone') || document.body;
  const s = h(`<div class="sheet" id="sheet"><div class="panel-s"><div class="grab"></div>
    <div class="sh-head"><h3 style="font-size:16px;flex:1">${title}</h3><button class="tb-btn" id="sclose">✕</button></div>
    <div class="sh-body">${bodyHtml}</div></div></div>`);
  phone.appendChild(s);
  s.addEventListener('click', e=>{ if(e.target===s) closeSheet(); });
  $('#sclose').onclick=closeSheet;
  if(wire) wire();
}
function closeSheet(){ const s=$('#sheet'); if(s) s.remove(); }

/* ---------------- auth (customer/partner/admin shared) ---------------- */
function renderLogin(el, kind){
  const demo = kind==='admin'? {id:'admin@locallink.app'} : kind==='partner'? {id:'partner@locallink.app'} : {id:'customer@locallink.app'};
  const title = kind==='admin'?'Admin sign in':kind==='partner'?'Partner sign in':'Welcome back';
  el.innerHTML = `<div class="auth-wrap">
    ${kind!=='customer'?'':`<button class="tb-btn" id="ab" style="align-self:flex-start">${I.back}</button>`}
    <div class="auth-hero">${logoMark(58)}<h2 style="font-size:22px">${title}</h2>
      <p class="muted" style="font-size:13.5px">Local Link · Everything Local. One Place.</p></div>
    <div class="field"><label>Email or phone</label><div class="input">${I.user.replace('viewBox','style="width:18px;height:18px;stroke:var(--muted)" viewBox')}<input id="lid" value="${demo.id}" /></div></div>
    <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="lpw" type="password" value="password" /></div></div>
    <button class="btn block" id="lsubmit">${t('login')}</button>
    <div class="demo-pill"><span class="faint" style="font-size:11.5px;align-self:center">Demo:</span>
      <button data-d="customer@locallink.app">Customer</button>
      <button data-d="partner@locallink.app">Partner</button>
      <button data-d="admin@locallink.app">Admin</button></div>
    <p class="faint" style="font-size:11.5px;text-align:center;margin-top:14px">All demo accounts use password <b>password</b></p>
    ${kind==='customer'?`<p style="font-size:13px;text-align:center;margin-top:14px;color:var(--body)">New to Local Link? <a href="#" id="goreg" style="color:var(--primary);font-weight:700">Create an account</a></p>`:''}
    <div style="flex:1"></div></div>`;
  const ab=$('#ab'); if(ab) ab.onclick=back;
  const gr=$('#goreg'); if(gr) gr.onclick=(e)=>{ e.preventDefault(); go('register'); };
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ $('#lid').value=b.dataset.d; $('#lpw').value='password'; });
  $('#lsubmit').onclick=async()=>{
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#lid').value.trim(),password:$('#lpw').value}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome, '+me.name.split(' ')[0]);
      routeAfterLogin();
    }catch(e){ toast(e.message); }
  };
}
/* customer sign-up — name, email, phone, password (x2) */
SCREENS.register = (el) => {
  el.innerHTML = `<div class="auth-wrap">
    <button class="tb-btn" id="rb" style="align-self:flex-start">${I.back}</button>
    <div class="auth-hero">${logoMark(52)}<h2 style="font-size:22px">Create your account</h2>
      <p class="muted" style="font-size:13px;max-width:280px">Join Local Link to order, save favourites, chat with stores and post requirements.</p></div>
    <div class="field"><label>Full name</label><div class="input"><input id="rn" placeholder="Your name" autocomplete="name"/></div></div>
    <div class="field"><label>Email</label><div class="input"><input id="re" type="email" placeholder="you@email.com" autocomplete="email"/></div></div>
    <div class="field"><label>Phone</label><div class="input"><input id="rp" type="tel" placeholder="+91…" autocomplete="tel"/></div></div>
    <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="rpw" type="password" placeholder="At least 6 characters"/></div></div>
    <div class="field"><label>Confirm password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="rpw2" type="password" placeholder="Re-enter password"/></div></div>
    <button class="btn block" id="rsubmit">Create account</button>
    <p style="font-size:13px;text-align:center;margin-top:14px;color:var(--body)">Already have an account? <a href="#" id="gologin" style="color:var(--primary);font-weight:700">Log in</a></p>
    <div style="flex:1"></div></div>`;
  $('#rb').onclick=back;
  $('#gologin').onclick=(e)=>{ e.preventDefault(); go('login'); };
  $('#rsubmit').onclick=async()=>{
    const name=$('#rn').value.trim(), email=$('#re').value.trim(), phone=$('#rp').value.trim(), pw=$('#rpw').value, pw2=$('#rpw2').value;
    if(!name||!email||!phone||!pw) return toast('Please fill in all fields');
    if(pw.length<6) return toast('Password must be at least 6 characters');
    if(pw!==pw2) return toast('Passwords do not match');
    try{ const r=await api('/auth/register',{method:'POST',body:{name,email,phone,password:pw}});
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome to Local Link, '+me.name.split(' ')[0]+'!');
      if(stack().length>1){ back(); } else { nav.customer=[{name:'home'}]; } routeRender();
    }catch(e){ toast(e.message); }
  };
};
function routeAfterLogin(){
  if (me.role==='super_admin'||me.role==='admin'){ openView('admin'); return; }
  if (me.role==='business_partner'){ nav.partner=[{name:'p_dash'}]; openView('partner'); return; }
  if (state.view==='customer'){ back(); }
  renderShell();
}

/* ==================== PARTNER SCREENS ==================== */
SCREENS.p_login = (el) => renderLogin(el, 'partner');
/* lightweight inline-SVG bar chart (single teal series) */
function barChartSVG(data){
  const d=(data||[]).map(x=>({label:x.label||'',value:Math.max(0,x.value||0)}));
  if(!d.length) return '<p class="muted" style="font-size:12.5px">No data yet.</p>';
  const max=Math.max(...d.map(x=>x.value),1);
  const bw=30, gap=14, pad=8, topPad=16, chartH=92, base=topPad+chartH, W=d.length*(bw+gap)+pad*2, H=base+34;
  const bars=d.map((x,i)=>{ const bh=Math.round(x.value/max*chartH); const bx=pad+i*(bw+gap); const by=base-bh;
    const lbl = x.value>=1000 ? '₹'+(x.value/1000).toFixed(x.value>=10000?0:1)+'k' : (x.value>0?'₹'+x.value:'');
    return `<g>${x.value>0?`<text x="${bx+bw/2}" y="${by-5}" text-anchor="middle" style="font:700 9px var(--font-body);fill:var(--ink)">${lbl}</text>`:''}
      <rect x="${bx}" y="${by}" width="${bw}" height="${Math.max(bh,2)}" rx="5" fill="var(--primary)" opacity="${x.value>0?1:.25}"/>
      <text x="${bx+bw/2}" y="${base+16}" text-anchor="middle" style="font:600 10px var(--font-body);fill:var(--muted)">${esc(x.label)}</text></g>`;
  }).join('');
  return `<div style="overflow-x:auto;margin-top:10px"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${W}px;max-width:${Math.max(W,320)}px;display:block">
    <line x1="${pad}" y1="${base+1}" x2="${W-pad}" y2="${base+1}" stroke="var(--border-strong)" stroke-width="1"/>${bars}</svg></div>`;
}
SCREENS.p_dash = async (el) => {
  if(!token || (me.role!=='business_partner')) return renderLogin(el,'partner');
  el.innerHTML = `<div class="chead"><div class="row" style="justify-content:space-between">
    <div><div class="muted" style="font-size:12.5px">Partner dashboard</div><h2 style="font-size:20px">${esc(me.name.split(' ')[0])}'s businesses</h2></div>
    <div class="row" style="gap:8px">${miniControls()}<div class="avatar" style="background:${grad(me.avatar_color,'#8A0002')}">${me.name[0]}</div></div></div></div>
    <div class="px" id="body" style="margin-top:12px">${skeletonRow(2)}</div><div style="height:90px"></div>`;
  const [d, an] = await Promise.all([api('/partner/overview'), api('/partner/analytics').catch(()=>null)]);
  const stat=(lab,val,emoji)=>`<div class="stat" style="padding:14px"><span class="ic" style="background:var(--primary-50);font-size:18px;color:var(--primary)">${gi(emoji)}</span><div class="lab">${lab}</div><div class="num" style="font-size:24px">${val}</div></div>`;
  $('#body').innerHTML = `
    <div class="grid2" style="gap:12px">
      ${stat('New orders', d.stats.orders, 'package')}${stat('Enquiries', d.stats.enquiries, 'chat')}
      ${stat('Revenue', money(d.stats.revenue), 'card')}${stat('Profile views', d.stats.views, 'compass')}</div>
    ${an ? `<div class="card" style="padding:15px;margin-top:14px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="font-size:15px">Sales — last 7 days</h3><span class="muted" style="font-size:12px">Avg order ${money(an.avgOrder)}</span></div>
      ${barChartSVG(an.revenue7)}
      ${an.topProducts && an.topProducts.length?`<div class="sec-head" style="margin:14px 0 8px"><h3 style="font-size:13.5px">Top products</h3></div>
        <div class="stack" style="gap:7px">${an.topProducts.map(p=>`<div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(p.name)}</span><b class="tabnums">${p.count} order${p.count>1?'s':''}</b></div>`).join('')}</div>`:''}
    </div>` : ''}
    <div class="card" style="padding:13px;margin-top:14px">
      <div class="row" style="justify-content:space-between;align-items:center"><div class="row" style="gap:8px"><span class="badge ${d.plan.id===3?'primary':'neutral'}">${esc(d.plan.name)} plan</span></div>
        <button class="btn sm ghost" data-tabnav="p_plans">${d.plan.id<3?'Upgrade':'Manage'}</button></div>
      ${d.plan.offers||d.plan.leads?`<div class="row" style="gap:16px;margin-top:10px;font-size:12px" class="muted">
        ${d.plan.offers?`<span class="muted">Promotions <b style="color:var(--ink)">${d.usage.offersUsed}/${d.usage.offersLimit}</b></span>`:''}
        ${d.plan.leads?`<span class="muted">Leads <b style="color:var(--ink)">${d.usage.leadsUsed}/${d.usage.leadsLimit}</b></span>`:''}</div>`:
        `<div class="muted" style="font-size:12px;margin-top:8px">Upgrade to Premium for promotions, customer leads & live chat.</div>`}</div>
    <button class="fc-banner" data-tabnav="p_forecast"><span class="fc-bic">${GI.sparkles||I.chart}</span><span class="fc-btx"><b>AI demand forecast</b><span>Pick a product → instant 30-day forecast with confidence</span></span><span class="fc-go">${I.chev}</span></button>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Quick actions</h3></div>
    <div class="grid2" style="gap:10px">
      ${d.plan.products?`<button class="btn ghost" id="qa-prod">${I.plus} Add product</button>`:`<button class="btn ghost" data-tabnav="p_plans" style="opacity:.7">${I.plus} Add product 🔒</button>`}
      ${d.plan.offers?`<button class="btn ghost" id="qa-offer">${I.tag} Create offer</button>`:`<button class="btn ghost" data-tabnav="p_plans" style="opacity:.7">${I.tag} Promotions 🔒</button>`}
      <button class="btn ghost" data-tabnav="p_orders">${I.bag} View orders</button>
      <button class="btn ghost" data-tabnav="p_chats">${GI.chat} Chats</button>
      <button class="btn ghost" data-tabnav="p_leads">${gi('star')} Leads${d.plan.leads?'':' 🔒'}</button>
      <button class="btn ghost" data-tabnav="p_products">${I.store} Catalogue</button></div>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Recent orders</h3></div>
    <div class="stack" style="gap:10px">${d.recentOrders.length?d.recentOrders.map(o=>`<div class="card" style="padding:13px"><div class="row" style="justify-content:space-between"><b style="font-size:13.5px">#${1000+o.id} · ${esc(o.business)}</b><span class="badge ${o.status==='completed'?'open':'warn'}">${o.status.replace('_',' ')}</span></div><div class="muted" style="font-size:12.5px;margin-top:6px">${esc(o.item_summary)}</div><b class="price" style="font-size:14px">${money(o.total)}</b></div>`).join(''):emptyState('package','No orders yet','')}</div>
    <div class="sec-head" style="margin:20px 0 10px"><h3 style="font-size:16px">Your businesses</h3></div>
    <div class="stack" style="gap:10px">${d.businesses.map(b=>`<div class="brow"><div class="thumb" style="background:${grad(b.color1,b.color2)}">${dIcon(b)}</div><div class="info"><h4 style="font-size:14.5px">${esc(b.name)}</h4><div class="muted" style="font-size:12px;margin-top:3px">${esc(b.category_name)} · ${stars(b.rating)}</div><span class="badge open" style="margin-top:6px">${b.status}</span></div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  const qp=$('#qa-prod'); if(qp) qp.onclick=()=>openAddProduct(d.businesses[0]);
  const qo=$('#qa-offer'); if(qo) qo.onclick=()=>openAddOffer(d.businesses);
  setPartnerChatBadge(d.usage && d.usage.unreadChats);
};
function openAddOffer(businesses){
  if(!businesses || !businesses.length) return toast('No business found');
  const bizOpts = businesses.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  showSheet('Create offer / promotion', `
    ${businesses.length>1?`<div class="field"><label>Business</label><div class="input"><select id="ob">${bizOpts}</select></div></div>`:`<input type="hidden" id="ob" value="${businesses[0].id}"/>`}
    <div class="field"><label>Offer title</label><div class="input"><input id="ot" placeholder="e.g. Weekend Special"/></div></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Discount label</label><div class="input"><input id="od" placeholder="20% OFF / ₹100 OFF / B1G1"/></div></div>
      <div class="field" style="flex:1"><label>Promo code <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="oc" placeholder="SAVE20"/></div></div></div>
    <div class="field"><label>Short description <span class="faint" style="font-weight:500">(optional)</span></label><div class="input"><input id="ode" placeholder="On all 1kg cakes this weekend"/></div></div>
    <button class="btn block" id="osave" style="margin-top:6px">Publish offer</button>`, ()=>{
      $('#osave').onclick=async()=>{ const business_id=Number($('#ob').value), title=$('#ot').value.trim(), discount_label=$('#od').value.trim();
        if(!title||!discount_label) return toast('Title and discount are required');
        try{ await api('/partner/offers',{method:'POST',body:{business_id,title,discount_label,code:$('#oc').value.trim()||null,description:$('#ode').value.trim()||null}});
          closeSheet(); toast('Offer published — now live for customers'); setTab('p_offers'); }catch(e){toast(e.message);} };
    });
}
SCREENS.p_offers = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Offers & promotions</h2><span id="addslot"></span></div></div><div class="px" id="usage"></div><div class="px stack" id="l" style="gap:11px;margin-top:12px">${skeletonRow(2)}</div><div style="height:90px"></div>`;
  const [offers, ov] = await Promise.all([api('/partner/offers'), api('/partner/overview')]);
  const canOffer = ov.plan && ov.plan.offers>0;
  if(canOffer){ $('#addslot').innerHTML=`<button class="btn sm" id="add">${I.plus} New</button>`; $('#add').onclick=()=>openAddOffer(ov.businesses);
    $('#usage').innerHTML=`<div class="card" style="padding:11px 13px;margin-top:8px"><div class="row" style="justify-content:space-between;font-size:12.5px"><span class="muted">Promotions this month</span><b>${ov.usage.offersUsed} / ${ov.usage.offersLimit}</b></div></div>`;
  } else {
    $('#usage').innerHTML=`<div class="card" style="padding:16px;margin-top:8px;text-align:center"><h3 style="font-size:15px">Promotions are a Premium feature</h3><p class="muted" style="font-size:12.5px;margin:6px auto 12px;max-width:280px">Upgrade to Premium to run promotions and highlight your products.</p><button class="btn sm" data-tabnav="p_plans">See plans</button></div>`;
    el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  }
  const draw=(items)=> $('#l').innerHTML = items.length ? items.map(o=>`<div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 15px;color:#fff;background:${grad(o.color1||'#B5121B',o.color2||'#1E3A8A')}">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><div><div style="font-size:11px;font-weight:800;opacity:.9">${esc(o.discount_label||'OFFER')}</div><h4 style="color:#fff;font-size:17px;margin-top:3px">${esc(o.title)}</h4></div>
          ${o.code?`<span class="badge" style="background:rgba(255,255,255,.9);color:#111">${esc(o.code)}</span>`:''}</div>
        <div style="font-size:12px;opacity:.92;margin-top:4px">${esc(o.business)}${o.description?' · '+esc(o.description):''}</div></div>
      <div class="row" style="justify-content:space-between;padding:10px 14px"><span class="badge open">Active</span><button class="btn sm ghost danger" data-del="${o.id}">Delete</button></div></div>`).join('')
    : emptyState('percent','No offers yet','Create a promotion to attract more customers.', `<button class="btn sm" id="e3">${I.plus} Create offer</button>`);
  draw(offers);
  const e3=$('#e3'); if(e3) e3.onclick=()=>openAddOffer(ov.businesses);
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ try{ await api('/partner/offers/'+b.dataset.del,{method:'DELETE'}); toast('Offer removed'); setTab('p_offers'); }catch(e){toast(e.message);} });
};
function openAddProduct(biz){
  if(!biz) return toast('No business found');
  let uploaded=null;   // data URL from an uploaded photo
  showSheet('Add product', `
    <div class="field"><label>Product photo</label>
      <div class="photo-up"><input type="file" id="pfile" accept="image/*" hidden/>
        <button type="button" class="pu-drop" id="puDrop"><span class="gi">${GI.package}</span><span>Tap to upload a photo from your device</span></button>
        <div class="pu-prevwrap" id="puWrap" hidden><img id="puPrev" class="pu-prev"/><button type="button" class="pu-x" id="puClear">${I.back.replace('m15 18-6-6 6-6','M6 6l12 12M18 6 6 18')}</button></div>
      </div></div>
    <div class="field"><label>Product name</label><div class="input"><input id="pn" placeholder="e.g. Chicken Biriyani"/></div></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Selling price ₹</label><div class="input"><input id="pp" type="number" placeholder="210"/></div></div>
      <div class="field" style="flex:1"><label>Unit</label><div class="input"><input id="pu" placeholder="plate, kg, piece"/></div></div></div>
    <div class="promo-box">
      <label class="promo-toggle"><input type="checkbox" id="pofferOn"/> <span>Add an offer / promotion</span></label>
      <div id="pofferFields" hidden>
        <div class="row" style="gap:10px;margin-top:8px"><div class="field" style="flex:1"><label>Original price ₹ <span class="faint" style="font-weight:500">(for % off)</span></label><div class="input"><input id="pm" type="number" placeholder="240"/></div></div>
          <div class="field" style="flex:1"><label>Promo tag</label><div class="input"><input id="ppromo" placeholder="Buy 1 Get 1 / Combo"/></div></div></div>
        <p class="faint" style="font-size:11.5px;margin:2px 0 0">An original price shows a strike-through discount; the promo tag shows as a badge on your product.</p>
      </div>
    </div>
    <details style="margin-top:6px"><summary class="faint" style="font-size:12px;cursor:pointer">Or paste a photo URL instead</summary>
      <div class="field" style="margin-top:8px"><div class="input"><input id="pimg" placeholder="https://… link to your product photo"/></div></div></details>
    <button class="btn block" id="psave" style="margin-top:14px">Publish product</button>`, ()=>{
      const drop=$('#puDrop'), file=$('#pfile'), wrap=$('#puWrap'), prev=$('#puPrev');
      drop.onclick=()=>file.click();
      file.onchange=async()=>{ const f=file.files[0]; if(!f)return; try{ toast('Processing photo…'); uploaded=await readImageFile(f); prev.src=uploaded; wrap.hidden=false; drop.hidden=true; }catch(e){ toast('Could not read that image'); } };
      $('#puClear').onclick=()=>{ uploaded=null; file.value=''; wrap.hidden=true; drop.hidden=false; };
      $('#pofferOn').onchange=(e)=>{ $('#pofferFields').hidden=!e.target.checked; };
      $('#psave').onclick=async()=>{ const name=$('#pn').value.trim(), price=Number($('#pp').value); if(!name||!price)return toast('Name & price required');
        const offerOn=$('#pofferOn').checked;
        try{ await api('/partner/products',{method:'POST',body:{business_id:biz.id,name,price,
          mrp: offerOn ? (Number($('#pm').value)||null) : null,
          promo_label: offerOn ? ($('#ppromo').value.trim()||null) : null,
          unit:$('#pu').value.trim()||null, image_url: uploaded || $('#pimg').value.trim() || null, emoji:null}});
          closeSheet(); toast('Product published'); setTab('p_products'); }catch(e){toast(e.message);} };
    });
}
SCREENS.p_products = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Products</h2><span id="addslot"></span></div></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const [prods, ov] = await Promise.all([api('/partner/products'), api('/partner/overview')]);
  const canProd = ov.plan && ov.plan.products;
  const addBiz = (ov.businesses||[]).find(b=>b.plan_id>=2) || ov.businesses[0];
  if(canProd){ $('#addslot').innerHTML=`<button class="btn sm" id="add">${I.plus} Add</button>`; $('#add').onclick=()=>openAddProduct(addBiz); }
  else $('#addslot').innerHTML=`<button class="btn sm ghost" data-tabnav="p_plans">Upgrade to add</button>`;
  $('#l').innerHTML = prods.length? prods.map(p=>{ const oos=p.stock_status==='out_of_stock';
    return `<div class="brow pmrow"><div class="thumb pthumb" style="background:${grad('#B5121B','#1E3A8A')};overflow:hidden;position:relative">${photoLayer(p.image_url||pic((p.name||'product').toLowerCase(),500+(p.id||0),160,160))}<span style="position:relative;z-index:2">${dIcon({name:p.name},'cart')}</span></div>
    <div class="info"><h4 style="font-size:14.5px">${esc(p.name)}</h4><div class="muted" style="font-size:12px;margin-top:2px">${esc(p.business)}${p.promo_label?` · <b style="color:var(--accent)">${esc(p.promo_label)}</b>`:''}</div>
    <div class="row" style="gap:8px;margin-top:6px"><b class="price" style="font-size:14px">${money(p.price)}</b>${p.mrp&&p.mrp>p.price?`<span class="old" style="font-size:12px">${money(p.mrp)}</span>`:''}<span class="badge ${oos?'warn':'open'}">${oos?'out of stock':'in stock'}</span></div>
    <div class="pmacts"><button class="pmbtn" data-pedit="${p.id}">${I.edit||I.cog} Edit</button><button class="pmbtn" data-poos="${p.id}" data-cur="${p.stock_status||'in_stock'}">${oos?'Mark in stock':'Mark out of stock'}</button><button class="pmbtn danger" data-pdel="${p.id}" data-pname="${esc(p.name)}">${I.trash||''} Delete</button></div>
    </div></div>`;}).join('')
    : emptyState('bag','No products yet','Add your first product to start selling.', `<button class="btn sm" onclick="void 0" id="e2">${I.plus} Add product</button>`);
  const e2=$('#e2'); if(e2) e2.onclick=()=>openAddProduct(ov.businesses[0]);
  const refresh=()=>setTab('p_products');
  el.querySelectorAll('[data-pedit]').forEach(b=>b.onclick=()=>{ const p=prods.find(x=>String(x.id)===b.dataset.pedit); if(p) openEditProduct(p); });
  el.querySelectorAll('[data-poos]').forEach(b=>b.onclick=async()=>{ const next=b.dataset.cur==='out_of_stock'?'in_stock':'out_of_stock';
    try{ await api('/partner/products/'+b.dataset.poos,{method:'PATCH',body:{stock_status:next}}); toast(next==='out_of_stock'?'Marked out of stock':'Marked in stock'); refresh(); }catch(e){toast(e.message);} });
  el.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async()=>{ if(!confirm('Delete "'+b.dataset.pname+'"? This cannot be undone.'))return;
    try{ await api('/partner/products/'+b.dataset.pdel,{method:'DELETE'}); toast('Product deleted'); refresh(); }catch(e){toast(e.message);} });
};
function openEditProduct(p){
  let uploaded=null; const cur=p.image_url||'';
  showSheet('Edit product', `
    <div class="field"><label>Product photo</label>
      <div class="photo-up"><input type="file" id="efile" accept="image/*" hidden/>
        <button type="button" class="pu-drop" id="eDrop"${cur?' hidden':''}><span class="gi">${GI.package}</span><span>Tap to upload a new photo</span></button>
        <div class="pu-prevwrap" id="eWrap"${cur?'':' hidden'}><img id="ePrev" class="pu-prev" src="${esc(cur)}"/><button type="button" class="pu-x" id="eClear">${I.back.replace('m15 18-6-6 6-6','M6 6l12 12M18 6 6 18')}</button></div>
      </div></div>
    <div class="field"><label>Product name</label><div class="input"><input id="en" value="${esc(p.name||'')}"/></div></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Selling price ₹</label><div class="input"><input id="ep" type="number" value="${p.price||''}"/></div></div>
      <div class="field" style="flex:1"><label>Unit</label><div class="input"><input id="eu" value="${esc(p.unit||'')}" placeholder="plate, kg"/></div></div></div>
    <div class="promo-box">
      <label class="promo-toggle"><input type="checkbox" id="eofferOn" ${(p.mrp||p.promo_label)?'checked':''}/> <span>Offer / promotion</span></label>
      <div id="eofferFields" ${(p.mrp||p.promo_label)?'':'hidden'}>
        <div class="row" style="gap:10px;margin-top:8px"><div class="field" style="flex:1"><label>Original price ₹</label><div class="input"><input id="em" type="number" value="${p.mrp||''}" placeholder="240"/></div></div>
          <div class="field" style="flex:1"><label>Promo tag</label><div class="input"><input id="epromo" value="${esc(p.promo_label||'')}" placeholder="Combo"/></div></div></div>
      </div>
    </div>
    <div class="field" style="margin-top:6px"><label>Description</label><div class="input"><textarea id="edesc" rows="2" placeholder="Short description">${esc(p.description||'')}</textarea></div></div>
    <button class="btn block" id="esave" style="margin-top:14px">Save changes</button>`, ()=>{
      const drop=$('#eDrop'), file=$('#efile'), wrap=$('#eWrap'), prev=$('#ePrev');
      drop.onclick=()=>file.click();
      file.onchange=async()=>{ const f=file.files[0]; if(!f)return; try{ toast('Processing photo…'); uploaded=await readImageFile(f); prev.src=uploaded; wrap.hidden=false; drop.hidden=true; }catch(e){ toast('Could not read that image'); } };
      $('#eClear').onclick=()=>{ uploaded=''; file.value=''; wrap.hidden=true; drop.hidden=false; };
      $('#eofferOn').onchange=(e)=>{ $('#eofferFields').hidden=!e.target.checked; };
      $('#esave').onclick=async()=>{ const name=$('#en').value.trim(), price=Number($('#ep').value); if(!name||!price)return toast('Name & price required');
        const offerOn=$('#eofferOn').checked;
        const body={ name, price, unit:$('#eu').value.trim()||null, description:$('#edesc').value.trim()||null,
          mrp: offerOn?(Number($('#em').value)||null):null, promo_label: offerOn?($('#epromo').value.trim()||null):null };
        if(uploaded!==null) body.image_url = uploaded || null;
        try{ await api('/partner/products/'+p.id,{method:'PATCH',body}); closeSheet(); toast('Product updated'); setTab('p_products'); }catch(e){toast(e.message);} };
    });
}
SCREENS.p_orders = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Orders</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const draw = async()=>{ const orders=await api('/partner/orders');
    const nextActs={pending:[['accepted','Accept'],['rejected','Reject']],accepted:[['preparing','Start preparing']],preparing:[['ready','Mark ready']],ready:[['completed','Complete']],out_for_delivery:[['completed','Complete']]};
    $('#l').innerHTML = orders.length? orders.map(o=>`<div class="card" style="padding:13px">
      <div class="row" style="justify-content:space-between"><b style="font-size:14px">#${1000+o.id} · ${esc(o.customer||'Customer')}</b><span class="badge ${o.status==='completed'?'open':o.status==='rejected'?'closed':'warn'}">${o.status.replace('_',' ')}</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:7px">${esc(o.item_summary)}</div>
      <div class="row" style="justify-content:space-between;margin-top:9px"><b class="price">${money(o.total)}</b>
        <div class="row" style="gap:7px">${(nextActs[o.status]||[]).map(([s,l])=>`<button class="btn sm ${s==='rejected'?'ghost':''}" data-oid="${o.id}" data-st="${s}">${l}</button>`).join('')}</div></div></div>`).join('')
      : emptyState('package','No orders yet','');
    $('#l').querySelectorAll('[data-oid]').forEach(b=>b.onclick=async()=>{ try{ await api(`/partner/orders/${b.dataset.oid}/status`,{method:'POST',body:{status:b.dataset.st}}); toast('Order updated'); draw(); }catch(e){toast(e.message);} });
  };
  draw();
};
SCREENS.p_enquiries = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Enquiries</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const items = await api('/partner/enquiries');
  $('#l').innerHTML = items.length? items.map(e=>`<div class="card" style="padding:13px">
    <div class="row" style="justify-content:space-between"><b style="font-size:13.5px">${esc(e.customer_name)}</b><span class="badge ${e.status==='new'?'warn':'primary'}">${e.status}</span></div>
    <div class="muted" style="font-size:12px;margin-top:2px">${esc(e.business)} · ${new Date(e.created_at).toLocaleString()}</div>
    <p style="font-size:13.5px;color:var(--body);margin:8px 0 10px">${esc(e.message)}</p>
    <div class="row" style="gap:8px"><button class="btn sm">Reply</button><button class="btn sm ghost">${I.phone} Call</button></div></div>`).join('')
    : emptyState('chat','No enquiries yet','');
};

/* ---- partner chat inbox + thread ---- */
SCREENS.p_chats = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Chats</h2></div><div class="px stack" id="l" style="gap:10px;margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const rows = await api('/partner/chats');
  const totalUnread = rows.reduce((n,r)=>n+(r.unread||0),0); setPartnerChatBadge(totalUnread);
  $('#l').innerHTML = rows.length ? rows.map(r=>`<button class="card chatrow" style="padding:13px;text-align:left;width:100%" data-uid="${r.user_id}" data-bid="${r.business_id}" data-name="${esc(r.customer||'Customer')}">
    <div class="row" style="justify-content:space-between;align-items:flex-start"><div style="flex:1;min-width:0">
      <b style="font-size:14px">${esc(r.customer||'Customer')}</b>
      <div class="muted" style="font-size:11.5px;margin:1px 0 5px">${esc(r.business)}</div>
      <div class="muted" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.last?(r.last.sender==='partner'?'You: ':'')+esc(r.last.body):''}</div>
    </div>${r.unread?`<span class="badge warn" style="flex:0 0 auto">${r.unread} new</span>`:''}</div></button>`).join('')
    : emptyState('chat','No chats yet','When customers message your store, conversations appear here.');
  el.querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>go('p_chatThread',{uid:b.dataset.uid,bid:b.dataset.bid,name:b.dataset.name}));
};
SCREENS.p_chatThread = async (el,{uid,bid,name}) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack(name||'Chat')}
    <div class="chat-wrap"><div class="chat-scroll" id="chatmsgs">${skeletonRow(2)}</div>
      <div class="chat-input"><input id="cin" placeholder="Reply to ${esc(name||'customer')}…" autocomplete="off"/><button id="csend" class="chat-send">${GI.send}</button></div></div>`;
  backWire(el);
  const load=async(scroll)=>{ const box=$('#chatmsgs'); if(!box) return; try{ const d=await api('/partner/chats/'+uid+'?business_id='+bid);
    box.innerHTML=chatBubbles(d.messages,'partner'); if(scroll) box.scrollTop=box.scrollHeight; }catch(e){} };
  await load(true);
  const send=async()=>{ const inp=$('#cin'); const v=(inp.value||'').trim(); if(!v)return; inp.value='';
    try{ await api('/partner/chats/'+uid,{method:'POST',body:{business_id:Number(bid),body:v}}); await load(true); }catch(e){ toast(e.message); inp.value=v; } };
  $('#csend').onclick=send;
  $('#cin').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
  const timer=setInterval(async()=>{ const box=document.getElementById('chatmsgs'); if(!box){ clearInterval(timer); return; }
    const nb=box.scrollHeight-box.scrollTop-box.clientHeight<60; await load(nb); },4000);
};

/* ---- partner leads inbox (Premium) ---- */
SCREENS.p_leads = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`<div class="chead"><h2 style="font-size:20px">Leads</h2></div><div class="px" id="l" style="margin-top:12px">${skeletonRow(3)}</div><div style="height:90px"></div>`;
  const d = await api('/partner/leads');
  if(d.locked){ $('#l').innerHTML = `<div class="card" style="padding:22px;text-align:center">
    <div class="eic" style="margin:0 auto 12px">${gi('star')}</div>
    <h3 style="font-size:16px">Leads are a Premium feature</h3>
    <p class="muted" style="font-size:13px;margin:8px auto 16px;max-width:280px">Upgrade to Premium to receive customer enquiries and bulk requirements in your area — up to 10 qualified leads a month.</p>
    <button class="btn" data-tabnav="p_profile">See plans</button></div>`;
    el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav)); return; }
  const typeBadge={search:'neutral',bulk:'warn',enquiry:'primary'};
  const head = `<div class="card" style="padding:13px;margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12.5px">Leads used this month</span><b>${d.used} / ${d.limit}</b></div>
    <div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${Math.round((d.used/Math.max(d.limit,1))*100)}%"></div></div></div>`;
  $('#l').innerHTML = head + (d.leads.length ? `<div class="stack" style="gap:11px">${d.leads.map(l=>`<div class="card" style="padding:14px">
    <div class="row" style="justify-content:space-between"><span class="badge ${typeBadge[l.type]||'neutral'}">${l.type==='bulk'?'Bulk requirement':l.type==='search'?'Search intent':'Enquiry'}</span><span class="muted" style="font-size:11.5px">${new Date(l.created_at).toLocaleDateString()}</span></div>
    <h4 style="font-size:14.5px;margin-top:8px">${esc(l.query||l.message||'Requirement')}</h4>
    ${l.message&&l.query?`<p class="muted" style="font-size:12.5px;margin-top:4px">${esc(l.message)}</p>`:''}
    ${l.budget?`<div style="font-size:12.5px;margin-top:6px">Budget: <b>${esc(l.budget)}</b></div>`:''}
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div style="font-size:12.5px">${l.locked?`<span class="muted">${esc(l.user_name)}</span> · <span class="faint">contact hidden</span>`:`<b>${esc(l.user_name)}</b> · <a href="tel:${esc(l.user_phone||'')}" style="color:var(--primary)">${esc(l.user_phone||'')}</a>`}</div>
      ${l.locked?`<button class="btn sm" data-claim="${l.id}">Unlock lead</button>`:`<span class="badge open">Unlocked</span>`}</div></div>`).join('')}</div>`
    : emptyState('inbox','No leads yet','New customer requirements in your categories will appear here.'));
  el.querySelectorAll('[data-claim]').forEach(b=>b.onclick=async()=>{ try{ await api('/partner/leads/'+b.dataset.claim+'/claim',{method:'POST'}); toast('Lead unlocked'); setTab('p_leads'); }catch(e){ toast(e.message); } });
};
SCREENS.p_forecast = async (el, params={}) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML = `<div class="chead fc-head"><div><div class="fc-kick">${GI.sparkles||''} NEXUS V2 · AI</div><h2>Demand forecast</h2><p class="muted">Select a product to generate its forecast instantly.</p></div></div>
    <div class="px"><div class="fc-search"><span>${I.search}</span><input id="fcq" placeholder="Search your products…"/></div></div>
    <div class="fc-list px" id="fcl">${skeletonRow(4)}</div><div id="fcd"></div><div style="height:96px"></div>`;
  let list=[]; try{ list=await api('/partner/forecast'); }catch(e){ $('#fcl').innerHTML=errorState(e.message,()=>routeRender()); return; }
  const spark=(a)=>{ const mx=Math.max(...a,1); return `<svg viewBox="0 0 70 24" class="fc-spark"><polyline fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${a.map((v,i)=>`${(i/(a.length-1))*70},${22-(v/mx)*20}`).join(' ')}"/></svg>`; };
  const tone=(l)=>l==='High'?'hi':l==='Medium'?'md':'lo';
  const drawList=(q='')=>{ const f=list.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));
    $('#fcl').innerHTML = f.length? f.map((p,i)=>`<button class="fc-item" data-fid="${p.id}" style="animation-delay:${i*40}ms">
      <span class="fc-ini">${esc(p.name[0])}</span><span class="fc-it"><b>${esc(p.name)}</b><span>${esc(p.business)} · ${money(p.price)}</span></span>
      ${spark(p.spark)}<span class="fc-conf ${tone(p.confidenceLevel)}">${p.confidence}%</span></button>`).join('') : emptyState('search','No products','Add products to forecast them.');
    $('#fcl').querySelectorAll('[data-fid]').forEach(b=>b.onclick=()=>open(+b.dataset.fid, b)); };
  $('#fcq').oninput=e=>drawList(e.target.value);
  const open=async(id,btn)=>{
    $('#fcl').querySelectorAll('.fc-item').forEach(x=>x.classList.toggle('on',x===btn));
    const box=$('#fcd'); box.innerHTML=`<div class="px"><div class="fc-gen"><span class="fc-orb"></span><b>Generating forecast…</b><span>Reading 56 days of sales · fitting seasonality · scoring confidence</span></div></div>`;
    box.scrollIntoView({behavior:'smooth',block:'start'});
    const [f]=await Promise.all([api('/partner/forecast/'+id), new Promise(r=>setTimeout(r,900))]);
    const S=f.summary, H=f.history, F=f.forecast.slice(0,14);
    const all=[...H.map(x=>x.units),...F.map(x=>x.high)]; const mx=Math.max(...all,1); const W=320, Hh=150, n=H.length+F.length;
    const X=i=>(i/(n-1))*W, Y=v=>Hh-8-(v/mx)*(Hh-24);
    const hp=H.map((x,i)=>`${X(i)},${Y(x.units)}`).join(' ');
    const fp=[`${X(H.length-1)},${Y(H[H.length-1].units)}`,...F.map((x,i)=>`${X(H.length+i)},${Y(x.units)}`)].join(' ');
    const band=F.map((x,i)=>`${X(H.length+i)},${Y(x.high)}`).join(' ')+' '+F.slice().reverse().map((x,i)=>`${X(H.length+F.length-1-i)},${Y(x.low)}`).join(' ');
    const area=`0,${Hh} `+hp+` ${X(H.length-1)},${Hh}`;
    const C=2*Math.PI*34, dash=C*f.confidence/100;
    box.innerHTML = `<div class="px fc-wrap">
      <div class="fc-hero"><div class="fc-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="bg"/><circle cx="40" cy="40" r="34" class="fg" style="stroke-dasharray:${dash} ${C}"/></svg><div><b>${f.confidence}%</b><span>confidence</span></div></div>
        <div class="fc-ht"><span class="fc-lvl ${tone(f.confidenceLevel)}">${f.confidenceLevel} confidence</span><h3>${esc(f.product.name)}</h3><span class="muted">${esc(f.product.business)} · ${esc(f.model)}</span></div></div>
      <div class="fc-kpis">
        <div><span>Next 7 days</span><b>${S.next7}</b><em>units</em></div>
        <div><span>Next 30 days</span><b>${S.next30}</b><em>units</em></div>
        <div><span>30-day revenue</span><b>${money(S.revenue30)}</b><em>projected</em></div>
        <div><span>Week-on-week</span><b class="${S.growth>=0?'up':'dn'}">${S.growth>=0?'▲':'▼'} ${Math.abs(S.growth)}%</b><em>demand</em></div></div>
      <div class="fc-chart card"><div class="fc-ch"><b>Sales & forecast</b><span><i class="l1"></i>Actual <i class="l2"></i>Forecast <i class="l3"></i>Range</span></div>
        <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><defs><linearGradient id="fca" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8A0002" stop-opacity=".25"/><stop offset="1" stop-color="#8A0002" stop-opacity="0"/></linearGradient></defs>
          <polygon points="${area}" fill="url(#fca)" class="fc-area"/><polygon points="${band}" class="fc-band"/>
          <line x1="${X(H.length-1)}" x2="${X(H.length-1)}" y1="6" y2="${Hh}" class="fc-today"/>
          <polyline points="${hp}" class="fc-hl"/><polyline points="${fp}" class="fc-fl"/></svg>
        <div class="fc-axis"><span>4 weeks ago</span><span>Today</span><span>+14 days</span></div></div>
      <div class="fc-grid">
        <div class="card"><span class="muted">Stock on hand</span><b>${S.stockOnHand}</b><em>${S.daysCover} days cover</em></div>
        <div class="card ${S.reorderQty?'warn':''}"><span class="muted">Suggested reorder</span><b>${S.reorderQty}</b><em>incl. ${S.safetyStock} safety</em></div>
        <div class="card"><span class="muted">Peak day</span><b>${S.peakDay.slice(0,3)}</b><em>+${S.peakUplift}% vs avg</em></div>
        <div class="card risk-${S.stockoutRisk.toLowerCase()}"><span class="muted">Stock-out risk</span><b>${S.stockoutRisk}</b><em>next 7 days</em></div></div>
      <div class="card fc-cf"><b>Why ${f.confidence}% confidence</b>${f.confidenceFactors.map(c=>`<div class="fc-bar"><div><span>${esc(c.label)}</span><em>${esc(c.note)}</em></div><i><s style="width:${c.score}%"></s></i><b>${c.score}</b></div>`).join('')}</div>
      <div class="card fc-ins"><b>${GI.sparkles||''} AI insights</b>${f.insights.map(x=>`<p>${esc(x)}</p>`).join('')}</div>
      <div class="fc-daily card"><b>Next 7 days</b><div class="fc-days">${F.slice(0,7).map(x=>{const d=new Date(x.date);return `<div><span>${d.toLocaleDateString('en',{weekday:'short'})}</span><b>${x.units}</b><em>${x.low}–${x.high}</em></div>`;}).join('')}</div></div>
    </div>`;
  };
  drawList(); if(list.length) open(params.id||list[0].id, $('#fcl .fc-item'));
};
SCREENS.p_profile = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML = `<div class="chead"><h2 style="font-size:20px">${t('profile')}</h2></div>
    <div class="px" style="margin-top:8px"><div class="card" style="padding:16px;display:flex;gap:13px;align-items:center">
      <div class="avatar" style="width:54px;height:54px;font-size:20px;background:${grad(me.avatar_color,'#8A0002')}">${me.name[0]}</div>
      <div style="flex:1"><b style="font-size:16px">${esc(me.name)}</b><div class="muted" style="font-size:12.5px">Business Partner · ${esc(me.email)}</div></div></div>
      <div style="height:14px"></div>
      <div class="plist">
        <button data-tabnav="p_forecast"><span class="ic">${GI.sparkles||I.chart}</span> AI demand forecast <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_products"><span class="ic">${I.store}</span> Manage catalogue <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_offers"><span class="ic">${I.tag}</span> Offers & promotions <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_leads"><span class="ic">${gi('star')}</span> Leads <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_enquiries"><span class="ic">${GI.chat}</span> Enquiries <span class="chev">${I.chev}</span></button>
        <button data-tabnav="p_settings"><span class="ic">${gi('card')}</span> Payments & business settings <span class="chev">${I.chev}</span></button>
      </div>
      <div class="plist" style="margin-top:12px"><button data-tabnav="p_plans"><span class="ic">${I.chart}</span> Subscription plan <span class="rt" id="planlab">…</span></button></div>
      <button class="btn ghost block" style="margin-top:16px;color:var(--error);border-color:var(--error)" id="out">${I.logout} Log out</button></div>`;
  $('#out').onclick=()=>{ token=null;me=null;localStorage.removeItem('ll_token');localStorage.removeItem('ll_user'); nav.partner=[{name:'p_login'}]; toast('Logged out'); routeRender(); };
  el.querySelectorAll('[data-tabnav]').forEach(b=>b.onclick=()=>setTab(b.dataset.tabnav));
  api('/partner/overview').then(d=>{ const p=$('#planlab'); if(p&&d.plan) p.innerHTML=`${esc(d.plan.name)} ${I.chev}`; }).catch(()=>{});
};

/* ---- partner business settings: payments, UPI, contact, hours ---- */
SCREENS.p_settings = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack('Payments & settings')}<div class="px" id="l" style="margin-top:8px">${skeletonRow(3)}</div><div style="height:96px"></div>`;
  backWire(el);
  const biz = await api('/partner/businesses');
  if(!biz.length){ $('#l').innerHTML=emptyState('store','No business found',''); return; }
  const bizOpts = biz.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const render=(b)=>{ const pm=(b.payment_methods||'cash').split(','); const mins=(m)=>{const h=String(Math.floor(m/60)).padStart(2,'0'),mm=String(m%60).padStart(2,'0');return h+':'+mm;};
    $('#form').innerHTML=`
      <div class="sec-lbl">Payments you accept</div>
      <div class="pay-set">
        ${[['cash','Cash'],['card','Card'],['upi','UPI / Online']].map(([v,l])=>`<label class="paychk"><input type="checkbox" value="${v}" ${pm.includes(v)?'checked':''}/> <span>${l}</span></label>`).join('')}
      </div>
      <div class="field" id="upiwrap" style="margin-top:10px;${pm.includes('upi')?'':'display:none'}"><label>UPI ID</label><div class="input"><input id="upi" value="${esc(b.upi_id||'')}" placeholder="yourstore@okhdfc"/></div></div>
      <div class="sec-lbl" style="margin-top:16px">Contact</div>
      <div class="field"><label>Phone</label><div class="input"><input id="ph" value="${esc(b.phone||'')}"/></div></div>
      <div class="field"><label>WhatsApp</label><div class="input"><input id="wa" value="${esc(b.whatsapp||'')}"/></div></div>
      <div class="field"><label>Address</label><div class="input"><input id="addr" value="${esc(b.address||'')}"/></div></div>
      <div class="field"><label>About</label><div class="input"><textarea id="desc" rows="2">${esc(b.description||'')}</textarea></div></div>
      <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Opens</label><div class="input"><input id="om" type="time" value="${mins(b.open_min||540)}"/></div></div>
        <div class="field" style="flex:1"><label>Closes</label><div class="input"><input id="cm" type="time" value="${mins(b.close_min||1290)}"/></div></div></div>
      <button class="btn block" id="save" style="margin-top:14px">Save settings</button>`;
    const toMin=(v)=>{ const [h,m]=(v||'0:0').split(':').map(Number); return h*60+(m||0); };
    el.querySelectorAll('.paychk input').forEach(c=>c.onchange=()=>{ $('#upiwrap').style.display = el.querySelector('.paychk input[value="upi"]').checked?'':'none'; });
    $('#save').onclick=async()=>{ const methods=[...el.querySelectorAll('.paychk input:checked')].map(c=>c.value); if(!methods.length){ return toast('Pick at least one payment method'); }
      try{ await api('/partner/businesses/'+b.id,{method:'PATCH',body:{ payment_methods:methods.join(','), upi_id:methods.includes('upi')?($('#upi').value.trim()||null):null,
        phone:$('#ph').value.trim(), whatsapp:$('#wa').value.trim(), address:$('#addr').value.trim(), description:$('#desc').value.trim(), open_min:toMin($('#om').value), close_min:toMin($('#cm').value) }});
        toast('Settings saved'); }catch(e){ toast(e.message); } };
  };
  $('#l').innerHTML = `${biz.length>1?`<div class="field"><label>Business</label><div class="input"><select id="bizsel">${bizOpts}</select></div></div>`:''}<div id="form"></div>`;
  render(biz[0]);
  const sel=$('#bizsel'); if(sel) sel.onchange=()=>render(biz.find(b=>String(b.id)===sel.value));
};

/* ---- partner subscription plans ---- */
SCREENS.p_plans = async (el) => {
  if(!token||me.role!=='business_partner') return renderLogin(el,'partner');
  el.innerHTML=`${topbarBack('Subscription plans')}<div class="px" id="l" style="margin-top:10px">${skeletonRow(3)}</div><div style="height:96px"></div>`;
  backWire(el);
  const [plans, ov] = await Promise.all([api('/subscription-plans'), api('/partner/overview').catch(()=>({}))]);
  const curId = ov.plan ? ov.plan.id : 1;
  $('#l').innerHTML = `${ov.usage?`<div class="card" style="padding:13px;margin-bottom:12px"><div class="row" style="justify-content:space-between;font-size:12.5px"><span class="muted">Promotions this month</span><b>${ov.usage.offersUsed} / ${ov.usage.offersLimit}</b></div>
      <div class="row" style="justify-content:space-between;font-size:12.5px;margin-top:6px"><span class="muted">Leads this month</span><b>${ov.usage.leadsUsed} / ${ov.usage.leadsLimit}</b></div></div>`:''}
    <div class="stack" style="gap:12px">${plans.map(p=>`<div class="card plan-card ${p.id===curId?'current':''}" style="padding:16px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="font-size:17px">${esc(p.name)}${p.popular?' <span class="badge primary" style="vertical-align:middle">Popular</span>':''}</h3><div><b style="font-size:19px">₹${p.price}</b><span class="muted" style="font-size:12px">/${esc(p.period)}</span></div></div>
      <p class="muted" style="font-size:12.5px;margin:4px 0 10px">${esc(p.tagline)}</p>
      <div class="stack" style="gap:6px">${p.features.map(f=>`<div class="row" style="gap:8px;font-size:13px"><span style="color:var(--primary)">✓</span> ${esc(f)}</div>`).join('')}</div>
      <button class="btn ${p.id===curId?'ghost':''} block" style="margin-top:14px" ${p.id===curId?'disabled':''} data-plan="${p.id}">${p.id===curId?'Current plan':(p.id>curId?'Upgrade':'Switch')}</button>
    </div>`).join('')}</div>`;
  el.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>toast('Plan change requests are handled by the Local Link team.'));
};

/* ==================== ADMIN ==================== */
let adminRoute = 'dashboard';
let adminBiz = null;
function renderAdminLogin(body){
  body.innerHTML = `<div class="crm-login">
    <div class="crm-brand">
      <div class="crm-brand-in">
        <div class="crm-logo">${logoMark(40)}<span>Local Link</span><em>Admin CRM</em></div>
        <h1>Run your whole marketplace from one place.</h1>
        <p>Businesses, products, orders, leads, offers, community content, advertisements and platform settings — all in a single control panel.</p>
        <ul class="crm-feats">
          <li>${gi('store')}<span>Approve & manage every business and partner</span></li>
          <li>${gi('star')}<span>Capture and route leads to premium partners</span></li>
          <li>${gi('chart')}<span>Live dashboards for orders, revenue & growth</span></li>
          <li>${gi('bell')}<span>Broadcast notifications & run ad campaigns</span></li>
        </ul>
      </div>
      <div class="crm-brand-foot">Everything Local. One Place. · Kozhikode, Kerala</div>
    </div>
    <div class="crm-form-side">
      <div class="crm-card">
        <div class="crm-card-head"><h2>Sign in to Admin</h2><p>Use your administrator account to continue.</p></div>
        <div class="field"><label>Email or phone</label><div class="input">${I.user.replace('viewBox','style="width:18px;height:18px;stroke:var(--muted)" viewBox')}<input id="al_id" value="admin@locallink.app" autocomplete="username"/></div></div>
        <div class="field"><label>Password</label><div class="input"><span class="gi" style="color:var(--muted)">${GI.lock}</span><input id="al_pw" type="password" value="password" autocomplete="current-password"/></div></div>
        <button class="btn block" id="al_go" style="margin-top:4px">Sign in to CRM</button>
        <div id="al_err" class="crm-err" hidden></div>
        <div class="crm-demo"><span>Demo admin</span> admin@locallink.app · password <b>password</b></div>
        <div class="crm-back"><a href="#" id="al_home">${I.chev.replace('m9 18 6-6-6-6','m15 18-6-6 6-6')} Back to customer app</a></div>
      </div>
    </div></div>`;
  const submit=async()=>{
    const err=$('#al_err'); err.hidden=true;
    try{ const r=await api('/auth/login',{method:'POST',body:{identifier:$('#al_id').value.trim(),password:$('#al_pw').value}});
      if(r.user.role!=='admin' && r.user.role!=='super_admin'){ err.textContent='That account is not an administrator.'; err.hidden=false; return; }
      token=r.token; me=r.user; localStorage.setItem('ll_token',token); localStorage.setItem('ll_user',JSON.stringify(me));
      toast('Welcome, '+me.name.split(' ')[0]); renderAdmin(body);
    }catch(e){ err.textContent=e.message||'Sign-in failed'; err.hidden=false; }
  };
  $('#al_go').onclick=submit;
  $('#al_pw').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  $('#al_id').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  $('#al_home').onclick=(e)=>{ e.preventDefault(); openView('customer'); };
}
function renderAdmin(body){
  if(!token || (me && me.role!=='admin' && me.role!=='super_admin')){
    return renderAdminLogin(body);
  }
  const groups = [
    ['Overview', [['dashboard','Dashboard',I.chart]]],
    ['Marketplace', [['businesses','Businesses',I.store],['products','Products',I.bag],['services','Services',I.tag],['offers','Offers',I.tag],['workers','Workers',GI.helmet],['drivers','Drivers',GI.car],['reviews','Reviews',I.star]]],
    ['Community', [['news','News',GI.news],['events','Events',GI.calendar],['local_info','Local Info',GI.building]]],
    ['Operations', [['orders','Orders',I.bag],['leads','Leads',gi('star')],['users','Users',I.users],['categories','Categories',I.grid]]],
    ['System', [['locations','Locations',I.pin],['subscription_plans','Subscriptions',GI.card],['advertisements','Advertisements',GI.megaphone],['notifications','Notifications',I.bell],['settings','Settings',I.cog]]],
  ];
  body.innerHTML = `<div class="desk">
    <aside class="side">
      <div class="lg">${logoMark(24)} Local Link</div>
      ${groups.map(([g,items])=>`<div class="grp">${g}</div>${items.map(([r,l,icn])=>`<a data-r="${r}" class="${adminRoute===r?'on':''}">${icn.startsWith('<')?icn:`<span style="width:18px;text-align:center">${icn}</span>`}<span>${l}</span></a>`).join('')}`).join('')}
      <div style="flex:1"></div>
      <a id="a-out" style="color:var(--error)">${I.logout}<span>Log out</span></a>
    </aside>
    <main class="admain"><div class="adtop"><h2 id="adtitle">Dashboard</h2><div class="spacer" style="flex:1"></div>
      <div class="searchbar" style="padding:9px 14px;max-width:220px">${I.search}<input placeholder="Search…" style="font-size:13px"/></div>
      ${miniControls()}
      <div class="avatar" style="width:36px;height:36px;font-size:14px;background:${grad(me.avatar_color,'#8A0002')}">${me.name[0]}</div></div>
      <div class="adbody" id="adbody"></div></main></div>`;
  body.querySelectorAll('.side a[data-r]').forEach(a=>a.onclick=()=>{ adminRoute=a.dataset.r; adminBiz=null; renderAdmin(body); });
  $('#a-out').onclick=()=>{ token=null;me=null;localStorage.removeItem('ll_token');localStorage.removeItem('ll_user'); openView('customer'); };
  renderAdminRoute();
}

async function renderAdminRoute(){
  const el = $('#adbody'); const title=$('#adtitle');
  const NICE = { local_info:'Local Info', subscription_plans:'Subscriptions' };
  const nice = NICE[adminRoute] || (adminRoute.charAt(0).toUpperCase()+adminRoute.slice(1));
  if(title) title.textContent = nice;
  if(!el) return;
  el.innerHTML = `<div class="stat-grid">${Array(4).fill('<div class="sk" style="height:96px"></div>').join('')}</div>`;
  try{
    if(adminRoute==='businesses' && adminBiz){ if(title) title.textContent='Business'; return renderAdminBusinessDetail(el, adminBiz); }
    if(adminRoute==='dashboard') return renderAdminDashboard(el);
    if(adminRoute==='locations') return renderAdminLocations(el);
    if(adminRoute==='notifications') return renderAdminNotifications(el);
    if(adminRoute==='settings') return renderAdminSettings(el);
    if(['businesses','users','categories','products','services','reviews','orders','news','events','offers','workers','drivers','local_info','subscription_plans','leads','advertisements'].includes(adminRoute)) return renderAdminTable(el, adminRoute, nice);
    // placeholders
    el.innerHTML = adminPlaceholder(nice);
  }catch(e){ el.innerHTML = errorState(e.message); }
}

async function renderAdminLocations(el){
  const { areas, googleEnabled } = await api('/admin/areas');
  const banner = googleEnabled
    ? `<div class="ai-bubble" style="margin-bottom:14px">Google Places is connected. Click <b>Import from Google</b> on any area to fetch real shops (restaurants, groceries, pharmacies, salons and more) live into that area.</div>`
    : `<div class="ai-bubble" style="margin-bottom:14px;background:var(--warning-bg);border-color:var(--warning)">To pull <b>real shops live from Google</b>, add a <code>GOOGLE_PLACES_API_KEY</code> environment variable (Render → your service → Environment) and redeploy. The import buttons below then populate each area automatically — no manual entry.</div>`;
  el.innerHTML = banner + `<div class="panel"><div class="ph"><h3>${areas.length} areas</h3><span class="badge ${googleEnabled?'open':'warn'}">${googleEnabled?'Google connected':'Demo data'}</span></div>
    <div style="overflow-x:auto"><table><thead><tr><th>Area</th><th>Panchayath / Municipality</th><th>Shops</th><th>Actions</th></tr></thead><tbody>
    ${areas.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.panchayath||'')}</td><td class="tabnums">${a.business_count}</td>
      <td><button class="btn sm" data-imp="${a.id}" data-name="${esc(a.name)}">Import from Google</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  el.querySelectorAll('[data-imp]').forEach(b=>b.onclick=async()=>{
    b.disabled=true; b.textContent='Importing…';
    try{ const r=await api('/admin/import-google',{method:'POST',body:{area_id:Number(b.dataset.imp)}});
      if(r.needsKey){ toast('Add GOOGLE_PLACES_API_KEY to enable live import'); }
      else { toast(`Imported ${r.imported} shops into ${r.area} (${r.skipped} already existed)`); renderAdminRoute(); }
    }catch(e){ toast(e.message); }
    finally{ b.disabled=false; if(b.textContent==='Importing…') b.textContent='Import from Google'; }
  });
}

function fmtWhen(s){ if(!s) return ''; const d=new Date(String(s).replace(' ','T')+(String(s).includes('T')||String(s).includes('Z')?'':'Z')); return isNaN(d)?String(s):d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }
async function renderAdminNotifications(el){
  const [data, opts] = await Promise.all([ api('/admin/notifications'), getAdminOptions() ]);
  const areaOpts = (opts.areas||[]).map(a=>`<option value="${a.id}">${esc(a.name)}${a.panchayath?` (${esc(a.panchayath)})`:''}</option>`).join('');
  el.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,420px) 1fr;gap:16px;align-items:start">
    <div class="panel"><div class="ph"><h3>Compose broadcast</h3></div>
      <div style="padding:16px">
        <div class="field"><label>Title *</label><div class="input"><input id="nb_title" placeholder="e.g. Onam offers are live!"/></div></div>
        <div class="field"><label>Message *</label><div class="input"><textarea id="nb_body" rows="3" placeholder="Write the notification message…"></textarea></div></div>
        <div class="field"><label>Type</label><div class="input"><select id="nb_type">
          <option value="announcement">Announcement</option><option value="offer">Offer</option><option value="news">News</option><option value="event">Event</option><option value="order">Order</option></select></div></div>
        <div class="field"><label>Audience</label><div class="input"><select id="nb_aud">
          <option value="all">All users (${data.totalUsers})</option>
          <option value="role">By role</option>
          <option value="area">By area</option></select></div></div>
        <div class="field" id="nb_rolewrap" hidden><label>Role</label><div class="input"><select id="nb_role">
          <option value="customer">Customers</option><option value="business_partner">Business partners</option></select></div></div>
        <div class="field" id="nb_areawrap" hidden><label>Area</label><div class="input"><select id="nb_area">${areaOpts}</select></div></div>
        <button class="btn block" id="nb_send">Send broadcast</button>
      </div></div>
    <div class="panel"><div class="ph"><h3>Recent broadcasts</h3><span class="badge neutral">${data.sent.length}</span></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Title</th><th>Message</th><th>Type</th><th>Recipients</th><th>Sent</th></tr></thead><tbody id="nb_list">
      ${data.sent.length? data.sent.map(s=>`<tr><td><b>${esc(s.title)}</b></td><td>${esc(String(s.body).slice(0,60))}${String(s.body).length>60?'…':''}</td><td><span class="badge primary">${esc(s.type||'')}</span></td><td class="tabnums">${s.recipients}</td><td class="faint">${esc(fmtWhen(s.sent_at))}</td></tr>`).join('')
        : `<tr><td colspan="5"><div class="empty" style="padding:36px"><p class="muted">No broadcasts yet. Compose one on the left.</p></div></td></tr>`}
      </tbody></table></div></div></div>`;
  const aud=$('#nb_aud');
  aud.onchange=()=>{ $('#nb_rolewrap').hidden = aud.value!=='role'; $('#nb_areawrap').hidden = aud.value!=='area'; };
  $('#nb_send').onclick=async()=>{
    const title=$('#nb_title').value.trim(), body=$('#nb_body').value.trim();
    if(!title||!body) return toast('Title and message are required');
    const payload={ title, body, type:$('#nb_type').value, audience:aud.value };
    if(aud.value==='role') payload.role=$('#nb_role').value;
    if(aud.value==='area') payload.area_id=$('#nb_area').value;
    const btn=$('#nb_send'); btn.disabled=true; btn.textContent='Sending…';
    try{ const r=await api('/admin/notifications/broadcast',{method:'POST',body:payload});
      toast(`Broadcast sent to ${r.sent} user${r.sent===1?'':'s'}`); renderAdminNotifications(el);
    }catch(e){ toast(e.message); btn.disabled=false; btn.textContent='Send broadcast'; }
  };
}

const SETTINGS_SCHEMA = [
  ['Brand', [
    ['platform_name','Platform name','text'],
    ['tagline','Tagline','text'],
    ['city','City / region','text'],
  ]],
  ['Contact', [
    ['support_email','Support email','text'],
    ['support_phone','Support phone','text'],
  ]],
  ['Defaults', [
    ['default_language','Default language','sel:lang2'],
    ['currency','Currency symbol','text'],
  ]],
  ['Features', [
    ['allow_signups','Allow new customer sign-ups','bool'],
    ['require_verification','Require business verification','bool'],
    ['enable_chat','Enable store chat (premium)','bool'],
    ['enable_leads','Enable leads engine','bool'],
  ]],
  ['Plan limits', [
    ['leads_per_month','Leads per month (premium)','number'],
    ['promos_per_month','Promotions per month (premium)','number'],
  ]],
];
async function renderAdminSettings(el){
  const s = await api('/admin/settings');
  const langO=[['en','English'],['ml','Malayalam']];
  const fieldFor=(k,label,type)=>{
    const v = s[k];
    if(type==='bool') return `<label class="checkrow" style="margin:0"><input type="checkbox" data-sk="${k}" ${String(v)==='1'?'checked':''}/> <span>${label}</span></label>`;
    if(type==='number') return `<div class="field"><label>${label}</label><div class="input"><input data-sk="${k}" type="number" value="${esc(v??'')}"/></div></div>`;
    if(type==='sel:lang2') return `<div class="field"><label>${label}</label><div class="input"><select data-sk="${k}">${langO.map(([vv,ll])=>`<option value="${vv}" ${String(v)===vv?'selected':''}>${ll}</option>`).join('')}</select></div></div>`;
    return `<div class="field"><label>${label}</label><div class="input"><input data-sk="${k}" value="${esc(v??'')}"/></div></div>`;
  };
  el.innerHTML = `<div style="max-width:760px">
    ${SETTINGS_SCHEMA.map(([grp,fields])=>`<div class="panel" style="margin-bottom:16px"><div class="ph"><h3>${grp}</h3></div>
      <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px 18px">${fields.map(f=>fieldFor(...f)).join('')}</div></div>`).join('')}
    <div style="display:flex;gap:10px;align-items:center"><button class="btn" id="set_save">Save settings</button>
      <span class="faint" id="set_msg" style="font-size:12.5px"></span></div></div>`;
  $('#set_save').onclick=async()=>{
    const payload={};
    el.querySelectorAll('[data-sk]').forEach(inp=>{ payload[inp.dataset.sk] = inp.type==='checkbox' ? (inp.checked?'1':'0') : inp.value; });
    const btn=$('#set_save'); btn.disabled=true; btn.textContent='Saving…';
    try{ await api('/admin/settings',{method:'PUT',body:payload});
      $('#set_msg').textContent='✓ Saved'; toast('Settings saved');
    }catch(e){ toast(e.message); }
    finally{ btn.disabled=false; btn.textContent='Save settings'; }
  };
}

function adminPlaceholder(name){
  const info = {
    Locations:['pin','Manage districts, panchayaths and areas so Local Link can expand to new towns.'],
    Subscriptions:['card','Create and price partner plans (Free / Business / Premium) and manage active subscriptions.'],
    Advertisements:['megaphone','Sell banners, featured placement and sponsored products with impression & click analytics.'],
    Notifications:['bell','Broadcast push notifications to all users, or target by district, panchayath or category.'],
    Settings:['cog','Platform settings — languages, payments, verification rules, feature flags and privacy.'],
  }[name] || ['store','Module'];
  return `<div class="panel" style="padding:0"><div class="ph"><h3>${name}</h3><span class="badge primary">Ready to build</span></div>
    <div class="empty" style="padding:56px"><div class="eic">${gi(info[0])}</div><h4 style="color:var(--ink);font-size:16px">${name}</h4><p style="max-width:420px">${info[1]}</p></div></div>`;
}

async function renderAdminDashboard(el){
  const d = await api('/admin/overview');
  const S=d.stats;
  const card=(lab,val,emoji,tone)=>`<div class="stat"><span class="ic" style="background:${tone||'var(--primary-50)'};color:var(--primary)">${gi(emoji)}</span><div class="lab">${lab}</div><div class="num tabnums">${val}</div></div>`;
  const donutColors=['#B5121B','#FFC53D','#D9A441','#F59E0B','#EC4899','#E5333B','#22C55E','#8B5CF6'];
  el.innerHTML = `
    <div class="stat-grid">
      ${card('Total users', S.users, 'users')}
      ${card('Active businesses', S.businesses, 'store')}
      ${card('Total orders', S.orders, 'package')}
      ${card('Revenue (completed)', money(S.revenue), 'card','var(--success-bg)')}
    </div>
    <div class="stat-grid" style="margin-top:14px">
      ${card('Pending approvals', S.pending, 'store','var(--warning-bg)')}
      ${card('Leads captured', S.leads||0, 'star')}
      ${card('Premium businesses', S.premium||0, 'card','var(--primary-50)')}
      ${card('Reviews', S.reviews, 'star')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px" id="charts">
      <div class="panel"><div class="ph"><h3>Businesses by category</h3></div><div style="padding:18px;display:flex;gap:20px;align-items:center" id="donut"></div></div>
      <div class="panel"><div class="ph"><h3>Orders by status</h3></div><div style="padding:18px" id="bars"></div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>Top rated businesses</h3></div>
      <table><thead><tr><th>Business</th><th>Rating</th><th>Reviews</th></tr></thead><tbody>
      ${d.topRated.map(b=>`<tr><td><b>${esc(b.name)}</b></td><td>${stars(b.rating)}</td><td class="tabnums">${b.review_count}</td></tr>`).join('')}
      </tbody></table></div>`;
  // donut
  const total=d.byCategory.reduce((s,x)=>s+x.value,0)||1; let acc=0; const R=54,C=2*Math.PI*R;
  const segs=d.byCategory.map((x,i)=>{ const frac=x.value/total; const dash=frac*C; const seg=`<circle cx="70" cy="70" r="${R}" fill="none" stroke="${donutColors[i%donutColors.length]}" stroke-width="20" stroke-dasharray="${dash} ${C-dash}" stroke-dashoffset="${-acc*C}" transform="rotate(-90 70 70)"/>`; acc+=frac; return seg; }).join('');
  $('#donut').innerHTML = `<svg width="140" height="140" viewBox="0 0 140 140" style="flex:0 0 auto">${segs}<text x="70" y="66" text-anchor="middle" style="font:700 22px var(--font-display);fill:var(--ink)">${total}</text><text x="70" y="84" text-anchor="middle" style="font:600 10px var(--font-body);fill:var(--muted)">BUSINESSES</text></svg>
    <div class="legend">${d.byCategory.map((x,i)=>`<div class="li"><span class="sw" style="background:${donutColors[i%donutColors.length]}"></span>${esc(x.label)} <b style="margin-left:auto;color:var(--ink)">${x.value}</b></div>`).join('')}</div>`;
  // bars
  const maxV=Math.max(...d.ordersByStatus.map(x=>x.value),1);
  $('#bars').innerHTML = d.ordersByStatus.map(x=>`<div class="bar-row"><span class="bl">${esc(x.label.replace('_',' '))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.value/maxV*100)}%"></div></div><span class="bv tabnums">${x.value}</span></div>`).join('') || '<p class="muted">No orders yet.</p>';
}

const SINGULAR = { businesses:'Business', users:'User', categories:'Category', products:'Product', services:'Service', news:'News', event:'Event', events:'Event', offers:'Offer', workers:'Worker', drivers:'Driver', local_info:'Local Info', subscription_plans:'Plan', advertisements:'Advertisement' };
const CREATABLE = ['businesses','products','services','offers','news','events','workers','drivers','local_info','categories','subscription_plans','users','advertisements'];
let adminOptions = null;
async function getAdminOptions(){ if(!adminOptions) adminOptions = await api('/admin/options'); return adminOptions; }

// ---- form field schemas ----
const O = {
  status_biz:[['approved','Approved'],['pending','Pending'],['suspended','Suspended'],['rejected','Rejected']],
  status_news:[['published','Published'],['draft','Draft'],['scheduled','Scheduled'],['archived','Archived']],
  status_offer:[['active','Active'],['expired','Expired']],
  price_level:[[1,'₹ Budget'],[2,'₹₹ Mid'],[3,'₹₹₹ Premium']],
  stock:[['in_stock','In stock'],['low_stock','Low stock'],['out_of_stock','Out of stock']],
  news_cat:[['Local','Local'],['Government','Government'],['Education','Education'],['Business','Business'],['Community','Community'],['Health','Health']],
  info_cat:[['Emergency','Emergency'],['Government','Government'],['Healthcare','Healthcare'],['Bank','Bank'],['Education','Education'],['Community','Community'],['Tourism','Tourism']],
  cat_kind:[['business','Business'],['service','Service'],['worker','Worker'],['driver','Driver'],['info','Info'],['content','Content']],
  driver_type:[['auto','Auto'],['taxi','Taxi'],['delivery','Delivery']],
  roles:[['customer','Customer'],['business_partner','Business Partner'],['service_provider','Service Provider'],['worker','Worker'],['driver','Driver'],['admin','Admin']],
  ad_placement:[['home_banner','Home banner'],['search_top','Search top'],['category_top','Category top'],['sponsored_card','Sponsored card']],
  status_ad:[['active','Active'],['paused','Paused'],['expired','Expired']],
};
const ADMIN_FORMS = {
  businesses:[ ['name','Name','text',{req:1}],['category_id','Category','ref-categories',{req:1}],['area_id','Area','ref-areas',{req:1}],['subcategory','Type / subcategory','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['address','Address','text'],['description','Description','textarea'],['price_level','Price level','sel:price_level'],['rating','Rating','number'],['status','Status','sel:status_biz'],['featured','Featured on home','check'],['cover_url','Cover photo','image'],['open_min','Opens','time'],['close_min','Closes','time'],['plan_id','Plan','ref-plans'] ],
  products:[ ['business_id','Business','ref-businesses',{req:1}],['name','Product name','text',{req:1}],['price','Price ₹','number',{req:1}],['mrp','MRP ₹','number'],['unit','Unit','text'],['stock_status','Stock','sel:stock'],['image_url','Product photo','image'],['description','Description','textarea'] ],
  services:[ ['business_id','Business','ref-businesses',{req:1}],['category_id','Category','ref-categories'],['name','Service name','text',{req:1}],['starting_price','Starting price ₹','number'],['rating','Rating','number'],['available','Available','check'],['description','Description','textarea'] ],
  offers:[ ['business_id','Business','ref-businesses',{req:1}],['title','Offer title','text',{req:1}],['discount_label','Badge (e.g. 20% OFF)','text'],['description','Description','text'],['start_date','Start date','date'],['end_date','End date','date'],['status','Status','sel:status_offer'] ],
  news:[ ['title','Headline','text',{req:1}],['category','Category','sel:news_cat'],['summary','Summary','text'],['body','Full article','textarea'],['area_id','Area','ref-areas'],['status','Status','sel:status_news'] ],
  events:[ ['title','Event name','text',{req:1}],['description','Description','textarea'],['venue','Venue','text'],['area_id','Area','ref-areas'],['start_date','Date','date'],['time_label','Time (e.g. 5 PM onwards)','text'],['organizer','Organizer','text'],['contact','Contact','text'] ],
  workers:[ ['name','Name','text',{req:1}],['category_id','Category','ref-categories'],['area_id','Area','ref-areas'],['skills','Skills','text'],['experience_years','Experience (years)','number'],['rate','Rate (e.g. ₹1200/day)','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['rating','Rating','number'],['available','Available','check'] ],
  drivers:[ ['name','Name','text',{req:1}],['service_type','Type','sel:driver_type'],['vehicle_model','Vehicle model','text'],['vehicle_number','Vehicle number','text'],['area_id','Area','ref-areas'],['fare_note','Fare note','text'],['phone','Phone','text'],['whatsapp','WhatsApp','text'],['rating','Rating','number'],['available','Available','check'] ],
  local_info:[ ['name','Name','text',{req:1}],['category','Category','sel:info_cat'],['description','Description','text'],['phone','Phone','text'],['address','Address','text'],['area_id','Area','ref-areas'],['emergency','Emergency service','check'],['hours','Hours','text'] ],
  categories:[ ['name','Name','text',{req:1}],['name_ml','Malayalam name','text'],['slug','Slug','text'],['kind','Kind','sel:cat_kind'],['active','Active','check'] ],
  subscription_plans:[ ['name','Plan name','text',{req:1}],['price','Price ₹','number'],['period','Period (month/year/forever)','text'],['tagline','Tagline','text'],['popular','Mark as popular','check'] ],
  users:[ ['name','Name','text',{req:1}],['email','Email','text'],['phone','Phone','text'],['role','Role','sel:roles'],['area_id','Area','ref-areas'] ],
  advertisements:[ ['title','Ad title','text',{req:1}],['placement','Placement','sel:ad_placement'],['business_id','Sponsor business','ref-businesses'],['image_url','Banner image','image'],['target_url','Target link (optional)','text'],['start_date','Start date','date'],['end_date','End date','date'],['status','Status','sel:status_ad'] ],
};
function minToTime(m){ if(m==null||m==='')return''; m=Number(m); return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function timeToMin(v){ if(!v)return null; const [h,m]=v.split(':').map(Number); return h*60+(m||0); }

function fieldHtml(spec, val, opts){
  const [k,label,type,extra={}] = spec;
  const id='f_'+k;
  const wrap=(inner)=>`<div class="field"><label>${label}${extra.req?' *':''}</label>${inner}</div>`;
  if(type==='textarea') return wrap(`<div class="input"><textarea id="${id}" rows="3">${esc(val??'')}</textarea></div>`);
  if(type==='number') return wrap(`<div class="input"><input id="${id}" type="number" value="${val??''}"/></div>`);
  if(type==='date') return wrap(`<div class="input"><input id="${id}" type="date" value="${(val||'').slice(0,10)}"/></div>`);
  if(type==='time') return wrap(`<div class="input"><input id="${id}" type="time" value="${minToTime(val)}"/></div>`);
  if(type==='check') return `<label class="checkrow"><input id="${id}" type="checkbox" ${val?'checked':''}/> <span>${label}</span></label>`;
  if(type==='image'){ const cur=val||''; return wrap(`
    <input type="hidden" id="${id}" value="${esc(cur)}"/>
    <div class="photo-up" data-imgfield="${k}"><input type="file" id="${id}_file" accept="image/*" hidden/>
      <button type="button" class="pu-drop" id="${id}_drop"${cur?' hidden':''}><span class="gi">${GI.package}</span><span>Tap to upload a photo</span></button>
      <div class="pu-prevwrap" id="${id}_wrap"${cur?'':' hidden'}><img id="${id}_prev" class="pu-prev" src="${esc(cur)}"/><button type="button" class="pu-x" id="${id}_clear">${I.back.replace('m15 18-6-6 6-6','M6 6l12 12M18 6 6 18')}</button></div>
      <details style="margin-top:6px"><summary class="faint" style="font-size:11.5px;cursor:pointer">Or paste a photo URL</summary>
        <div class="input" style="margin-top:6px"><input id="${id}_url" value="${esc(cur)}" placeholder="https://…"/></div></details>
    </div>`); }
  if(type.startsWith('sel:')){ const arr=O[type.slice(4)]||[]; return wrap(`<div class="input"><select id="${id}">${arr.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select></div>`); }
  if(type.startsWith('ref-')){ const key=type.slice(4); const list=(opts[key]||[]); return wrap(`<div class="input"><select id="${id}"><option value="">—</option>${list.map(o=>`<option value="${o.id}" ${String(val)===String(o.id)?'selected':''}>${esc(o.name)}${o.panchayath?` (${esc(o.panchayath)})`:''}</option>`).join('')}</select></div>`); }
  return wrap(`<div class="input"><input id="${id}" value="${esc(val??'')}" ${extra.max?`maxlength="${extra.max}"`:''}/></div>`);
}

async function openPartnerForm(){
  const opts = await getAdminOptions();
  const bizOpts = (opts.businesses||[]).map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const planOpts = (opts.plans||[]).map(p=>`<option value="${p.id}" ${p.id===2?'selected':''}>${esc(p.name)}</option>`).join('');
  const genpw = 'LL' + Math.random().toString(36).slice(2,8);
  showSheetAdmin('Create partner login', `
    <p class="muted" style="font-size:12.5px;margin:0 0 12px">Generate login credentials for a business partner and link them to their business.</p>
    <div class="field"><label>Partner name *</label><div class="input"><input id="pf_n" placeholder="e.g. Ramesh Kumar"/></div></div>
    <div class="field"><label>Email *</label><div class="input"><input id="pf_e" type="email" placeholder="owner@business.com"/></div></div>
    <div class="field"><label>Phone *</label><div class="input"><input id="pf_p" type="tel" placeholder="+91…"/></div></div>
    <div class="field"><label>Temporary password *</label><div class="input"><input id="pf_pw" value="${genpw}"/></div></div>
    <div class="row" style="gap:10px">
      <div class="field" style="flex:1"><label>Link to business</label><div class="input"><select id="pf_biz"><option value="">— None —</option>${bizOpts}</select></div></div>
      <div class="field" style="flex:1"><label>Plan</label><div class="input"><select id="pf_plan">${planOpts}</select></div></div></div>
    <button class="btn block" id="pf_save" type="button" style="margin-top:6px">Create partner login</button>
    <div id="pf_out"></div>`, ()=>{
    $('#pf_save').onclick=async()=>{
      const name=$('#pf_n').value.trim(), email=$('#pf_e').value.trim(), phone=$('#pf_p').value.trim(), password=$('#pf_pw').value.trim();
      if(!name||!email||!phone||!password) return toast('Name, email, phone and password are required');
      try{ const r=await api('/admin/partners',{method:'POST',body:{name,email,phone,password,business_id:$('#pf_biz').value||null,plan_id:$('#pf_plan').value||null}});
        $('#pf_out').innerHTML=`<div class="card" style="padding:14px;margin-top:14px;background:var(--success-bg)">
          <b style="font-size:13.5px">✓ Partner login created</b>
          <div style="font-size:12.5px;margin-top:8px;line-height:1.7">Login: <b>${esc(r.credentials.email)}</b><br>Phone: <b>${esc(r.credentials.phone)}</b><br>Password: <b>${esc(r.credentials.password)}</b></div>
          <p class="faint" style="font-size:11px;margin-top:8px">Share these with the partner. They can sign in at /partner.</p></div>`;
        toast('Partner login created'); adminOptions=null;
      }catch(e){ toast(e.message); }
    };
  });
}
async function openAdminForm(entity, id, prefill){
  const schema = ADMIN_FORMS[entity]; if(!schema) return toast('No form for '+entity);
  const opts = await getAdminOptions();
  let row = {};
  if(id){ try{ row = await api(`/admin/${entity}/${id}`); }catch(e){ return toast(e.message); } }
  if(prefill) row = { ...prefill, ...row };
  const title = (id?'Edit ':'Add ')+(SINGULAR[entity]||entity);
  const body = `<form id="adminform" onsubmit="return false">${schema.map(s=>fieldHtml(s, row[s[0]], opts)).join('')}
    <button class="btn block" id="afsave" type="submit">${id?'Save changes':'Create'}</button></form>`;
  showSheetAdmin(title, body, ()=>{
    // wire image-upload fields
    schema.filter(s=>s[2]==='image').forEach(s=>{ const id='f_'+s[0];
      const hid=document.getElementById(id), file=document.getElementById(id+'_file'),
            drop=document.getElementById(id+'_drop'), wrap=document.getElementById(id+'_wrap'),
            prev=document.getElementById(id+'_prev'), clr=document.getElementById(id+'_clear'), url=document.getElementById(id+'_url');
      if(drop) drop.onclick=()=>file.click();
      if(file) file.onchange=async()=>{ const f=file.files[0]; if(!f)return; try{ toast('Processing photo…'); const d=await readImageFile(f); hid.value=d; if(url)url.value=''; prev.src=d; wrap.hidden=false; drop.hidden=true; }catch(e){ toast('Could not read image'); } };
      if(clr) clr.onclick=()=>{ hid.value=''; if(url)url.value=''; file.value=''; wrap.hidden=true; drop.hidden=false; };
      if(url) url.oninput=()=>{ hid.value=url.value.trim(); };
    });
    $('#afsave').onclick=async()=>{
      const payload={};
      for(const s of schema){ const [k,,type,extra={}]=s; const elx=document.getElementById('f_'+k); if(!elx)continue;
        let v;
        if(type==='check') v=elx.checked?1:0;
        else if(type==='time') v=timeToMin(elx.value);
        else if(type==='number') v=elx.value===''?null:Number(elx.value);
        else if(type==='image') v=elx.value||null;
        else v=elx.value;
        if(extra.req && (v===''||v==null)) { toast(s[1]+' is required'); return; }
        payload[k]=v;
      }
      try{
        if(id) await api(`/admin/${entity}/${id}`,{method:'PATCH',body:payload});
        else await api(`/admin/${entity}`,{method:'POST',body:payload});
        closeSheet(); toast((SINGULAR[entity]||'Record')+(id?' updated':' created'));
        adminOptions=null; if(entity==='categories') await loadRef();
        renderAdminRoute();
      }catch(e){ toast(e.message); }
    };
  });
}

async function renderAdminTable(el, name, nice){
  const rows = await api('/admin/table/'+name);
  const data = Array.isArray(rows)?rows:(rows||[]);
  const cols = data.length? Object.keys(data[0]).filter(k=>k!=='id') : [];
  const canApprove = name==='businesses'; const canModerate=name==='reviews'; const canCat=name==='categories';
  const canEdit = !!ADMIN_FORMS[name]; const canDelete = name!=='orders';
  const canAdd = CREATABLE.includes(name);
  const badgeFor=(k,v)=>{ if(['status','verification_status','stock_status','service_type','period'].includes(k)){ const tone=/approv|publish|in_stock|verified|active|completed/i.test(v)?'open':/pending|new/i.test(v)?'warn':/reject|suspend|hidden|cancel|out_of/i.test(v)?'closed':'neutral'; return `<span class="badge ${tone}">${esc(String(v).replace(/_/g,' '))}</span>`; } if(k==='rating') return stars(v); if(k==='role') return `<span class="badge primary">${esc(String(v).replace(/_/g,' '))}</span>`; if(k==='price'||k==='total') return money(v); if(['active','emergency','popular','available','featured'].includes(k)) return `<span class="badge ${v?'open':'neutral'}">${v?'yes':'no'}</span>`; return esc(v==null?'':String(v).length>54?String(v).slice(0,54)+'…':v); };
  const canView = name==='businesses';
  const hasActions = canView||canApprove||canModerate||canCat||canEdit||canDelete;
  el.innerHTML = `<div class="panel"><div class="ph"><h3>${data.length} ${(nice||name).toLowerCase()}</h3>
      <div class="row" style="gap:8px">
        ${name==='businesses'?`<button class="btn sm ghost" data-goloc="1">${I.pin} Import from Google</button><button class="btn sm ghost" id="addpartner">${I.users} Add partner login</button>`:''}
        ${canAdd?`<button class="btn sm" id="addnew">${I.plus} Add ${SINGULAR[name]||name}</button>`:''}</div></div>
    <div style="overflow-x:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c.replace(/_/g,' '))}</th>`).join('')}${hasActions?'<th style="text-align:right">Actions</th>':''}</tr></thead>
      <tbody>${data.length?data.map(r=>`<tr>${cols.map(c=>`<td>${badgeFor(c,r[c])}</td>`).join('')}
        ${hasActions?`<td class="tbn" style="justify-content:flex-end">
          ${canView?`<button class="btn sm" data-viewbiz="${r.id}">Open</button>`:''}
          ${canApprove?`<button class="btn sm ghost" data-act="approve" data-id="${r.id}">Approve</button><button class="btn sm ghost" data-act="suspend" data-id="${r.id}">Suspend</button>`:''}
          ${canModerate?`<button class="btn sm ghost" data-act="hide" data-id="${r.id}">Hide</button><button class="btn sm" data-act="publish" data-id="${r.id}">Publish</button>`:''}
          ${canCat?`<button class="btn sm ghost" data-act="toggle" data-id="${r.id}">Toggle</button>`:''}
          ${canEdit?`<button class="btn sm ghost" data-edit="${r.id}">Edit</button>`:''}
          ${canDelete?`<button class="btn sm ghost danger" data-del="${r.id}">Delete</button>`:''}
        </td>`:''}
      </tr>`).join(''):`<tr><td colspan="${cols.length+1}"><div class="empty" style="padding:36px"><div class="eic">${gi('inbox')}</div><h4 style="color:var(--ink);font-size:15px">No ${(nice||name).toLowerCase()} yet</h4>${canAdd?'<p>Click Add to create the first one.</p>':''}</div></td></tr>`}</tbody></table></div></div>`;
  el.querySelectorAll('[data-act]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id, act=b.dataset.act;
    try{
      if(act==='approve') await api(`/admin/businesses/${id}/status`,{method:'POST',body:{status:'approved'}});
      else if(act==='suspend') await api(`/admin/businesses/${id}/status`,{method:'POST',body:{status:'suspended'}});
      else if(act==='hide') await api(`/admin/reviews/${id}/status`,{method:'POST',body:{status:'hidden'}});
      else if(act==='publish') await api(`/admin/reviews/${id}/status`,{method:'POST',body:{status:'published'}});
      else if(act==='toggle') await api(`/admin/categories/${id}/toggle`,{method:'POST'});
      toast('Updated'); renderAdminRoute();
    }catch(e){ toast(e.message); }
  });
  el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAdminForm(name, b.dataset.edit));
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ if(!confirm('Delete this '+(SINGULAR[name]||'record')+'? This cannot be undone.'))return;
    try{ await api(`/admin/${name}/${b.dataset.del}`,{method:'DELETE'}); toast('Deleted'); adminOptions=null; renderAdminRoute(); }catch(e){ toast(e.message); } });
  const an=$('#addnew'); if(an) an.onclick=()=>openAdminForm(name);
  const ap=$('#addpartner'); if(ap) ap.onclick=()=>openPartnerForm();
  el.querySelectorAll('[data-viewbiz]').forEach(b=>b.onclick=()=>{ adminBiz=Number(b.dataset.viewbiz); renderAdminRoute(); });
  const gl=el.querySelector('[data-goloc]'); if(gl) gl.onclick=()=>{ adminRoute='locations'; const sh=document.getElementById('adminshell'); if(sh) renderAdmin(sh); };
}

async function renderAdminBusinessDetail(el, id){
  const d = await api(`/admin/businesses/${id}/full`);
  const b = d.business;
  const money2 = (n)=>'₹'+Number(n||0).toLocaleString('en-IN');
  const statusTone = /approv/.test(b.status)?'open':/pending/.test(b.status)?'warn':'closed';
  const kv = (k,v)=>`<div class="kv"><span class="kk">${k}</span><span class="vv">${v||'—'}</span></div>`;
  const miniTable = (title, rows, addEntity, cols) => `
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>${title} <span class="muted" style="font-weight:500">(${rows.length})</span></h3>
      ${addEntity?`<button class="btn sm" data-add-sub="${addEntity}">${I.plus} Add</button>`:''}</div>
      ${rows.length?`<div style="overflow-x:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}<th></th></tr></thead><tbody>
        ${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[1](r)}</td>`).join('')}
          <td class="tbn" style="justify-content:flex-end">${addEntity?`<button class="btn sm ghost" data-sub-edit="${addEntity}" data-sub-id="${r.id}">Edit</button><button class="btn sm ghost danger" data-sub-del="${addEntity}" data-sub-id="${r.id}">Delete</button>`:''}</td>
        </tr>`).join('')}</tbody></table></div>`
      :`<div class="empty" style="padding:30px"><div class="eic">${gi('inbox')}</div><p>No ${title.toLowerCase()} yet.</p></div>`}</div>`;

  el.innerHTML = `
    <button class="btn ghost sm" id="biz-back" style="margin-bottom:14px">${I.back} Back to businesses</button>
    <div class="panel" style="overflow:hidden">
      <div class="detail-cover" style="height:120px;border-radius:0;background:${grad(b.color1,b.color2)}"><span class="logo" style="font-size:44px">${dIcon(b)}</span></div>
      <div style="padding:18px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div><h2 style="font-size:22px">${esc(b.name)}</h2>
            <div class="muted" style="margin-top:4px">${esc(b.subcategory||'')} · ${esc(b.category_name||'')} · ${esc(b.area_name||'')}</div>
            <div class="row" style="gap:8px;margin-top:10px">${stars(b.rating)}<span class="badge ${statusTone}">${esc(b.status)}</span><span class="badge primary">${esc(b.plan_name||'Free')}</span><span class="badge neutral">${esc(b.verification_status)}</span></div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn sm ghost" id="biz-edit">${I.plus} Edit</button>
            <button class="btn sm ghost danger" id="biz-del">Delete</button>
          </div>
        </div>
        <div class="kvgrid" style="margin-top:16px">
          ${kv('Phone', esc(b.phone))}${kv('WhatsApp', esc(b.whatsapp))}${kv('Address', esc(b.address))}
          ${kv('Owner', esc(b.owner_name||'—'))}${kv('Reviews', b.review_count)}${kv('Featured', b.featured?'Yes':'No')}
        </div>
        ${b.description?`<p style="color:var(--body);margin-top:14px;line-height:1.6">${esc(b.description)}</p>`:''}
      </div>
    </div>
    ${miniTable('Products', d.products, 'products', [['Name',r=>esc(r.name)],['Price',r=>money2(r.price)],['Stock',r=>`<span class="badge ${r.stock_status==='in_stock'?'open':'warn'}">${esc((r.stock_status||'').replace(/_/g,' '))}</span>`]])}
    ${miniTable('Services', d.services, 'services', [['Name',r=>esc(r.name)],['From',r=>money2(r.starting_price)],['Available',r=>`<span class="badge ${r.available?'open':'neutral'}">${r.available?'Yes':'No'}</span>`]])}
    ${miniTable('Offers', d.offers, 'offers', [['Title',r=>esc(r.title)],['Badge',r=>esc(r.discount_label||'')],['Status',r=>`<span class="badge ${r.status==='active'?'open':'neutral'}">${esc(r.status)}</span>`]])}
    ${miniTable('Reviews', d.reviews, null, [['By',r=>esc(r.author_name)],['Rating',r=>stars(r.rating)],['Comment',r=>esc((r.comment||'').slice(0,60))]])}
    ${miniTable('Orders', d.orders, null, [['#',r=>1000+r.id],['Total',r=>money2(r.total)],['Status',r=>`<span class="badge ${r.status==='completed'?'open':'warn'}">${esc(r.status.replace(/_/g,' '))}</span>`]])}
  `;
  $('#biz-back').onclick=()=>{ adminBiz=null; renderAdminRoute(); };
  $('#biz-edit').onclick=()=>openAdminForm('businesses', id);
  $('#biz-del').onclick=async()=>{ if(!confirm('Delete this business and all its products/offers?'))return; try{ await api(`/admin/businesses/${id}`,{method:'DELETE'}); toast('Business deleted'); adminBiz=null; renderAdminRoute(); }catch(e){toast(e.message);} };
  el.querySelectorAll('[data-add-sub]').forEach(x=>x.onclick=()=>openAdminForm(x.dataset.addSub, null, {business_id:id}));
  el.querySelectorAll('[data-sub-edit]').forEach(x=>x.onclick=()=>openAdminForm(x.dataset.subEdit, Number(x.dataset.subId)));
  el.querySelectorAll('[data-sub-del]').forEach(x=>x.onclick=async()=>{ if(!confirm('Delete this item?'))return; try{ await api(`/admin/${x.dataset.subDel}/${x.dataset.subId}`,{method:'DELETE'}); toast('Deleted'); renderAdminRoute(); }catch(e){toast(e.message);} });
}

function showSheetAdmin(title, body, wire){ // center modal for desktop
  closeSheet();
  const s=h(`<div class="sheet" id="sheet" style="align-items:center;justify-content:center"><div class="panel-s" style="max-width:440px;border-radius:20px;max-height:88%"><div class="sh-head"><h3 style="flex:1;font-size:16px">${title}</h3><button class="tb-btn" id="sclose">✕</button></div><div class="sh-body">${body}</div></div></div>`);
  document.body.appendChild(s); s.addEventListener('click',e=>{if(e.target===s)closeSheet();}); $('#sclose').onclick=closeSheet; if(wire)wire();
}

/* ==================== BOOT ==================== */
async function loadRef(){
  const b = await api('/bootstrap'); ref = b;
}
function viewFromPath(){
  const p = location.pathname;
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/partner')) return 'partner';
  if (p.startsWith('/apps')) return 'launcher';
  return 'customer';
}
// global mini-control + launcher popstate handlers (bound once)
document.addEventListener('click', (e) => {
  const lb = e.target.closest('[data-mini-lang] button');
  if (lb){ state.lang=lb.dataset.l; localStorage.setItem('ll_lang',state.lang); renderShell(); return; }
  if (e.target.closest('[data-mini-theme]')){ cycleTheme(); return; }
});
window.addEventListener('popstate', () => { const v=viewFromPath(); if(v!==state.view){ state.view=v; renderShell(); } });

async function boot(){
  try{
    const [_, ai] = await Promise.all([loadRef(), api('/ai-status').catch(()=>({openai:false}))]);
    state.aiStatus = ai;
    state.view = viewFromPath();
    renderShell();
  }catch(e){
    $('#stage').innerHTML = `<div style="padding:40px;text-align:center"><h3>Couldn't reach the server</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
}
boot();
})();
