import { db } from './db.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Build a compact catalogue the model (or local search) can reason over.
function catalogue() {
  const businesses = db.prepare(`
    SELECT b.id, b.name, b.subcategory, c.name AS category, a.name AS area,
           b.rating, b.price_level, b.phone, b.whatsapp
    FROM businesses b JOIN categories c ON c.id=b.category_id
    LEFT JOIN areas a ON a.id=b.area_id WHERE b.status='approved'`).all();
  const products = db.prepare(`SELECT p.id, p.name, p.price, b.name AS business, b.id AS business_id
    FROM products p JOIN businesses b ON b.id=p.business_id`).all();
  const services = db.prepare(`SELECT s.id, s.name, s.starting_price, b.name AS business, b.id AS business_id
    FROM services s JOIN businesses b ON b.id=s.business_id`).all();
  const workers = db.prepare(`SELECT w.id, w.name, w.skills, w.rate, w.phone FROM workers w`).all();
  const drivers = db.prepare(`SELECT d.id, d.name, d.service_type, d.fare_note, d.phone FROM drivers d`).all();
  return { businesses, products, services, workers, drivers };
}

// ---- Local fallback: keyword + intent matching (works with no API key) ----
const STOP = new Set(['i','need','a','an','the','me','my','for','to','near','find','want','looking','get','some','can','you','is','are','where','how','of','in','on','and','today','please','with','best','good','cheap','under','below','₹','rs']);

function tokens(q){return q.toLowerCase().replace(/[^a-z0-9ഀ-ൿ\s]/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));}

function localSearch(query) {
  const cat = catalogue();
  const ks = tokens(query);
  const priceMatch = query.match(/(?:under|below|less than)\s*₹?\s*(\d+)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

  const stem = (w) => w.replace(/(ers|er|ing|ians|ian|es|s)$/,'');
  // synonym expansion so casual words match the catalogue vocabulary
  const SYN = {
    plumber:['plumb','pipe','tank'], plumbing:['plumb','pipe','tank'],
    electrician:['electric','wiring'], electric:['wiring','electrician'], electrical:['wiring','electrician'],
    ac:['air','cool','refriger','snow'], cooling:['ac','air','refriger'], fridge:['refriger','appliance'],
    salon:['beauty','hair','barber','makeup'], barber:['salon','hair'], haircut:['salon','hair','barber'], parlour:['salon','beauty'],
    mechanic:['auto','car','garage','tyre','tire','denting'], garage:['auto','car','mechanic'],
    grocery:['supermarket','provision','mart','store','vegetable'], provisions:['grocery','supermarket'],
    biriyani:['biriyani','biryani','restaurant','hotel','meals'], biryani:['biriyani','restaurant','hotel'],
    food:['restaurant','hotel','meals','biriyani'], meals:['restaurant','hotel','food'],
    cake:['bakery','bake','puff'], bakery:['bake','cake','puff'], bread:['bakery','bake'],
    medicine:['pharma','medical','chemist','medicines'], pharmacy:['pharma','medical','medicine'], medicines:['pharma','medical'],
    doctor:['clinic','hospital','medical'], clinic:['medical','doctor','hospital','dental'], dentist:['dental','clinic'],
    taxi:['cab','car','taxi'], cab:['taxi','car'], auto:['auto','rickshaw','ride'], ride:['auto','taxi','cab'],
    carpenter:['wood','furniture','carpentry'], painter:['paint','painting'], painting:['paint'],
    cleaning:['clean','maid','domestic','housekeep'], maid:['domestic','cleaning'], mason:['masonry','construction'],
    jewellery:['gold','diamond','jewel'], gold:['jewellery','diamond'], clothes:['cloth','fashion','apparel'], clothing:['cloth','fashion'],
    mobile:['electronic','phone'], phone:['mobile','electronic'], electronics:['electronic','mobile','gadget'],
    hardware:['hardware','tools','paint'], school:['school','education'], college:['college','education'], bank:['bank','atm'],
  };
  const variants = (k) => {
    const set = new Set([k, stem(k), ...(SYN[k]||[]), ...(SYN[stem(k)]||[])]);
    return [...set].filter(v => v && v.length >= 3);
  };
  const score = (text) => {
    const hay = (text || '').toLowerCase();
    return ks.reduce((s,k)=> s + (variants(k).some(v => hay.includes(v)) ? 1 : 0), 0);
  };
  const results = [];
  cat.businesses.forEach(b => { const s = score(`${b.name} ${b.subcategory} ${b.category} ${b.area}`); if (s) results.push({ type:'business', score:s+ (b.rating||0)/10, ...b }); });
  cat.services.forEach(s => { const sc = score(`${s.name} ${s.business}`); if (sc) results.push({ type:'service', score:sc, ...s }); });
  cat.products.forEach(p => { let sc = score(`${p.name} ${p.business}`); if (maxPrice && p.price<=maxPrice) sc+=1; if (sc && (!maxPrice || p.price<=maxPrice)) results.push({ type:'product', score:sc, ...p }); });
  cat.workers.forEach(w => { const sc = score(`${w.name} ${w.skills}`); if (sc) results.push({ type:'worker', score:sc, ...w }); });
  cat.drivers.forEach(d => { const sc = score(`${d.name} ${d.service_type} auto taxi cab ride`); const rideWords = ks.some(k=>['auto','taxi','cab','ride','drop','pickup','airport','travel'].includes(k)); if (sc || rideWords) results.push({ type:'driver', score:sc + (rideWords?1:0), ...d }); });

  results.sort((a,b)=>b.score-a.score);
  const top = results.filter(r=>r.score>0).slice(0,6);
  let answer;
  if (!top.length) answer = `I couldn't find an exact match for "${query}" nearby yet. Try a category like "plumber", "biriyani", "grocery" or "auto".`;
  else {
    const kinds = [...new Set(top.map(r=>r.type))];
    answer = `Here ${top.length===1?'is':'are'} ${top.length} local ${kinds.join(' & ')} match${top.length>1?'es':''} for “${query}”${maxPrice?` under ₹${maxPrice}`:''}. Tap any result to view details, call, or message on WhatsApp.`;
  }
  return { answer, results: top, source: 'local' };
}

// ---- OpenAI-powered assistant (used when OPENAI_API_KEY is set) ----
async function openaiSearch(query, lang) {
  const cat = catalogue();
  const compact = {
    businesses: cat.businesses.map(b=>({id:b.id,name:b.name,type:b.subcategory,category:b.category,area:b.area,rating:b.rating})),
    services: cat.services.map(s=>({id:s.id,name:s.name,from:s.starting_price,business:s.business})),
    products: cat.products.map(p=>({id:p.id,name:p.name,price:p.price,business:p.business})),
    workers: cat.workers.map(w=>({id:w.id,name:w.name,skills:w.skills,rate:w.rate})),
    drivers: cat.drivers.map(d=>({id:d.id,name:d.name,type:d.service_type,fare:d.fare_note})),
  };
  const sys = `You are "Ask Local Link", a friendly local assistant for Kunnamangalam, Kozhikode (Kerala). ` +
    `You ONLY recommend from the provided local catalogue. Understand intent (category, budget, urgency). ` +
    `The user may write in English OR Malayalam; understand both. Write the "answer" in ${lang==='ml'?'Malayalam':'English'}. ` +
    `Reply with STRICT JSON: {"answer": string (<=45 words, warm, helpful), "results": [{"type":"business|service|product|worker|driver","id":number}]} ` +
    `Pick up to 6 most relevant results, best first. If nothing fits, return an empty results array and suggest a category.`;
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `Catalogue:\n${JSON.stringify(compact)}\n\nUser query: "${query}"` },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('OpenAI request failed: ' + resp.status);
  const data = await resp.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  // hydrate ids -> full records
  const byId = {
    business: Object.fromEntries(cat.businesses.map(b=>[b.id,{type:'business',...b}])),
    service: Object.fromEntries(cat.services.map(s=>[s.id,{type:'service',...s}])),
    product: Object.fromEntries(cat.products.map(p=>[p.id,{type:'product',...p}])),
    worker: Object.fromEntries(cat.workers.map(w=>[w.id,{type:'worker',...w}])),
    driver: Object.fromEntries(cat.drivers.map(d=>[d.id,{type:'driver',...d}])),
  };
  const results = (parsed.results||[]).map(r => byId[r.type]?.[r.id]).filter(Boolean).slice(0,6);
  return { answer: parsed.answer || 'Here are some local matches.', results, source: 'openai' };
}

export async function ask(query, lang) {
  if (!query || !query.trim()) return { answer: 'Ask me anything — “find a plumber”, “biriyani under ₹250”, “auto to the station”.', results: [], source: 'local' };
  if (process.env.OPENAI_API_KEY) {
    try { return await openaiSearch(query, lang); }
    catch (e) { console.warn('OpenAI fallback →', e.message); return localSearch(query); }
  }
  return localSearch(query);
}
