import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, seed } from './src/db.js';
import { login, signToken, publicUser, attachUser, requireAuth, requireRole } from './src/auth.js';
import { ask } from './src/assistant.js';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(attachUser);

// Ensure DB has data (self-seeds on first boot / after an ephemeral reset)
seed();

/* ---------------- helpers ---------------- */
const IST_OFFSET = 5.5 * 60; // minutes
function nowISTminutes() {
  const utc = new Date();
  const m = utc.getUTCHours() * 60 + utc.getUTCMinutes() + IST_OFFSET;
  return ((m % 1440) + 1440) % 1440;
}
function withOpen(b) {
  if (b == null) return b;
  const n = nowISTminutes();
  const open = b.open_min <= b.close_min ? (n >= b.open_min && n < b.close_min) : (n >= b.open_min || n < b.close_min);
  const fmt = (mins) => { let h = Math.floor(mins / 60), mm = mins % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(mm).padStart(2,'0')} ${ap}`; };
  return { ...b, is_open: open, hours_label: (b.open_min===0 && b.close_min>=1439) ? 'Open 24 hours' : (open ? `Open until ${fmt(b.close_min)}` : `Opens ${fmt(b.open_min)}`) };
}
const catName = db.prepare('SELECT id,name,slug,name_ml,icon,color1,color2,kind FROM categories');

/* ---------------- auth ---------------- */
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  const user = login(identifier, password);
  if (!user) return res.status(401).json({ error: 'Invalid email/phone or password.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});
app.post('/api/auth/register', (req, res) => {
  let { name, email, phone, password } = req.body || {};
  name = (name||'').trim(); email = (email||'').trim().toLowerCase(); phone = (phone||'').trim();
  if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Please fill in all fields.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const exists = db.prepare('SELECT id FROM users WHERE email=? OR phone=?').get(email, phone);
  if (exists) return res.status(409).json({ error: 'An account already exists with this email or phone.' });
  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#1D4ED8','#FFC53D','#6366F1','#0EA5E9','#EC4899','#F59E0B'];
  const info = db.prepare("INSERT INTO users(name,email,phone,password_hash,role,avatar_color) VALUES (?,?,?,?,'customer',?)")
    .run(name, email, phone, hash, colors[Math.floor(Math.random()*colors.length)]);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  res.json({ token: signToken(user), user: publicUser(user) });
});
app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------------- reference / bootstrap ---------------- */
app.get('/api/bootstrap', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY sort').all();
  const districts = db.prepare('SELECT * FROM districts').all();
  const panchayaths = db.prepare('SELECT * FROM panchayaths').all();
  const areas = db.prepare('SELECT * FROM areas').all();
  const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY sort').all().map(p => ({ ...p, features: JSON.parse(p.features) }));
  res.json({ categories, districts, panchayaths, areas, plans });
});

app.get('/api/categories', (_req, res) => res.json(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY sort').all()));

/* ---------------- businesses ---------------- */
app.get('/api/businesses', (req, res) => {
  const { category, area, q, sort, featured } = req.query;
  let sql = `SELECT b.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon, a.name AS area_name
             FROM businesses b JOIN categories c ON c.id=b.category_id LEFT JOIN areas a ON a.id=b.area_id
             WHERE b.status='approved'`;
  const args = [];
  if (category) { sql += ' AND c.slug=?'; args.push(category); }
  if (area) { sql += ' AND b.area_id=?'; args.push(area); }
  if (featured) { sql += ' AND b.featured=1'; }
  if (q) { sql += ' AND (b.name LIKE ? OR b.subcategory LIKE ? OR b.description LIKE ?)'; args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (sort === 'rating') sql += ' ORDER BY b.rating DESC';
  else if (sort === 'reviews') sql += ' ORDER BY b.review_count DESC';
  else sql += ' ORDER BY b.featured DESC, b.rating DESC';
  res.json(db.prepare(sql).all(...args).map(withOpen));
});

app.get('/api/products', (req, res) => {
  const { deal, category, limit } = req.query;
  let sql = `SELECT p.*, b.name AS business, b.id AS business_id, b.color1, b.color2, b.rating AS biz_rating, c.slug AS category_slug
             FROM products p JOIN businesses b ON b.id=p.business_id JOIN categories c ON c.id=b.category_id
             WHERE b.status='approved'`;
  const args = [];
  if (deal) sql += ' AND p.mrp IS NOT NULL AND p.mrp>p.price';
  if (category) { sql += ' AND c.slug=?'; args.push(category); }
  sql += deal ? ' ORDER BY (p.mrp-p.price)*1.0/p.mrp DESC' : ' ORDER BY p.sort ASC, p.id ASC';
  if (limit) { sql += ' LIMIT ?'; args.push(Number(limit)); }
  res.json(db.prepare(sql).all(...args));
});
// Single product detail (for the customer product page)
app.get('/api/products/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, b.name AS business, b.id AS business_id, b.color1, b.color2,
      b.rating AS biz_rating, b.area_id, b.phone, b.whatsapp, c.slug AS category_slug, c.name AS category_name
      FROM products p JOIN businesses b ON b.id=p.business_id JOIN categories c ON c.id=b.category_id WHERE p.id=?`).get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  p.related = db.prepare(`SELECT p2.*, b.name AS business, b.id AS business_id FROM products p2
      JOIN businesses b ON b.id=p2.business_id JOIN categories c ON c.id=b.category_id
      WHERE c.slug=? AND p2.id<>? ORDER BY RANDOM() LIMIT 8`).all(p.category_slug, p.id);
  res.json(p);
});
/* ---------- Live Google Places (real nearby shops + photos), gated on GOOGLE_PLACES_API_KEY ---------- */
const PLACES_KW = {
  'food-grocery':'best restaurants and supermarkets',
  'shopping':'shopping stores and boutiques',
  'services':'home repair and local services',
  'healthcare':'pharmacy clinic and hospital',
  'workers':'handyman and technicians',
  'transport':'taxi and auto stand',
};
const placesCache = new Map();  // key -> { t, data }
const PLACES_TTL = 6 * 60 * 60 * 1000;
app.get('/api/places', async (req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.json([]);                       // no key → client uses seeded data
  const { category = '', area_id, q } = req.query;
  const area = area_id ? db.prepare('SELECT * FROM areas WHERE id=?').get(Number(area_id)) : null;
  const areaName = area ? area.name : 'Kunnamangalam';
  const textQuery = (q || PLACES_KW[category] || (category || 'local shops')) + ' near ' + areaName + ', Kozhikode, Kerala';
  const ck = `${category}|${area_id}|${q||''}`;
  const hit = placesCache.get(ck);
  if (hit && Date.now() - hit.t < PLACES_TTL) return res.json(hit.data);
  try {
    const body = { textQuery, maxResultCount: 16 };
    if (area && area.lat && area.lng) body.locationBias = { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: 7000 } };
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.photos,places.primaryTypeDisplayName,places.currentOpeningHours.openNow,places.nationalPhoneNumber',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.warn('Places API', r.status); return res.json([]); }
    const data = await r.json();
    const out = (data.places || []).map(p => ({
      id: 'g_' + p.id,
      place_id: p.id,
      source: 'google',
      name: p.displayName?.text || 'Local place',
      subcategory: p.primaryTypeDisplayName?.text || '',
      rating: p.rating || 0,
      review_count: p.userRatingCount || 0,
      address: p.formattedAddress || '',
      area_name: areaName,
      is_open: p.currentOpeningHours?.openNow ? 1 : 0,
      phone: p.nationalPhoneNumber || '',
      whatsapp: (p.nationalPhoneNumber || '').replace(/[^0-9]/g, ''),
      lat: p.location?.latitude, lng: p.location?.longitude,
      cover_url: p.photos?.[0]?.name ? '/api/place-photo?ref=' + encodeURIComponent(p.photos[0].name) : null,
      photos: (p.photos || []).slice(0, 6).map(ph => '/api/place-photo?ref=' + encodeURIComponent(ph.name) + '&w=800'),
    }));
    placesCache.set(ck, { t: Date.now(), data: out });
    res.json(out);
  } catch (e) { console.warn('places error', e.message); res.json([]); }
});
app.get('/api/place-photo', async (req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY; const ref = req.query.ref;
  if (!key || !ref) return res.status(404).end();
  try {
    const w = Number(req.query.w) || 500;
    const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${w}&maxWidthPx=${w}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).end();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (e) { res.status(404).end(); }
});
app.get('/api/places/:id', async (req, res) => {
  // best-effort: return from cache by scanning cached lists
  const gid = req.params.id;
  for (const v of placesCache.values()) { const f = v.data.find(x => x.id === gid); if (f) return res.json(f); }
  res.status(404).json({ error: 'not found' });
});
app.get('/api/businesses/:id', (req, res) => {
  const b = db.prepare(`SELECT b.*, c.name AS category_name, c.slug AS category_slug, a.name AS area_name
    FROM businesses b JOIN categories c ON c.id=b.category_id LEFT JOIN areas a ON a.id=b.area_id WHERE b.id=?`).get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  const plan = planFor(b.plan_id);
  // Basic plan = listing only (company details + contact); no catalogue / ordering.
  const products = plan.products ? db.prepare('SELECT * FROM products WHERE business_id=? ORDER BY sort').all(b.id) : [];
  const services = plan.products ? db.prepare('SELECT * FROM services WHERE business_id=?').all(b.id) : [];
  const offers = db.prepare("SELECT * FROM offers WHERE business_id=? AND status='active'").all(b.id);
  const reviews = db.prepare("SELECT * FROM reviews WHERE business_id=? AND status='published' ORDER BY created_at DESC").all(b.id);
  res.json({ ...withOpen(b), products, services, offers, reviews,
    plan_name: plan.name, can_order: plan.products, can_chat: plan.chat,
    payment_methods: (b.payment_methods || 'cash').split(',').filter(Boolean), upi_id: b.upi_id || null });
});

/* ---------------- other catalogues ---------------- */
app.get('/api/services', (_req, res) => res.json(db.prepare(`SELECT s.*, b.name AS business, b.area_id, a.name AS area_name
  FROM services s JOIN businesses b ON b.id=s.business_id LEFT JOIN areas a ON a.id=b.area_id`).all()));
app.get('/api/workers', (req, res) => {
  let sql = 'SELECT w.*, a.name AS area_name FROM workers w LEFT JOIN areas a ON a.id=w.area_id';
  res.json(db.prepare(sql).all());
});
app.get('/api/drivers', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT d.*, a.name AS area_name FROM drivers d LEFT JOIN areas a ON a.id=d.area_id';
  const args = [];
  if (type) { sql += ' WHERE d.service_type=?'; args.push(type); }
  res.json(db.prepare(sql).all(...args));
});
app.get('/api/offers', (_req, res) => res.json(db.prepare(`SELECT o.*, b.name AS business, b.area_id FROM offers o JOIN businesses b ON b.id=o.business_id WHERE o.status='active'`).all()));
app.get('/api/news', (_req, res) => res.json(db.prepare("SELECT * FROM news WHERE status='published' ORDER BY published_at DESC").all()));
app.get('/api/news/:id', (req, res) => { const n = db.prepare('SELECT * FROM news WHERE id=?').get(req.params.id); n ? res.json(n) : res.status(404).json({ error:'Not found' }); });
app.get('/api/events', (_req, res) => res.json(db.prepare('SELECT * FROM events ORDER BY start_date').all()));
app.get('/api/local-info', (_req, res) => res.json(db.prepare('SELECT * FROM local_info ORDER BY emergency DESC, category').all()));
app.get('/api/subscription-plans', (_req, res) => res.json(db.prepare('SELECT * FROM subscription_plans ORDER BY sort').all().map(p=>({...p,features:JSON.parse(p.features)}))));

/* ---------------- unified search ---------------- */
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ businesses: [], products: [], services: [], workers: [], drivers: [] });
  const like = `%${q}%`;
  res.json({
    businesses: db.prepare(`SELECT b.*, c.icon AS category_icon, a.name AS area_name FROM businesses b JOIN categories c ON c.id=b.category_id LEFT JOIN areas a ON a.id=b.area_id WHERE b.status='approved' AND (b.name LIKE ? OR b.subcategory LIKE ?) LIMIT 12`).all(like,like).map(withOpen),
    products: db.prepare('SELECT p.*, b.name AS business, b.id AS business_id FROM products p JOIN businesses b ON b.id=p.business_id WHERE p.name LIKE ? LIMIT 12').all(like),
    services: db.prepare('SELECT s.*, b.name AS business, b.id AS business_id FROM services s JOIN businesses b ON b.id=s.business_id WHERE s.name LIKE ? LIMIT 12').all(like),
    workers: db.prepare('SELECT * FROM workers WHERE name LIKE ? OR skills LIKE ? LIMIT 12').all(like,like),
    drivers: db.prepare('SELECT * FROM drivers WHERE name LIKE ? OR service_type LIKE ? LIMIT 12').all(like,like),
  });
});

/* ---------------- Ask Local Link (AI) ---------------- */
app.post('/api/ask', async (req, res) => {
  try { res.json(await ask((req.body && req.body.query) || '', req.body && req.body.lang)); }
  catch (e) { res.status(500).json({ error: 'Assistant unavailable', detail: e.message }); }
});
app.get('/api/ai-status', (_req, res) => res.json({ openai: !!process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' }));

/* ---------------- customer actions ---------------- */
app.get('/api/notifications', requireAuth, (req, res) =>
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
app.get('/api/orders', requireAuth, (req, res) =>
  res.json(db.prepare('SELECT o.*, b.name AS business, b.emoji FROM orders o JOIN businesses b ON b.id=o.business_id WHERE o.customer_id=? ORDER BY o.created_at DESC').all(req.user.id)));
app.post('/api/enquiries', requireAuth, (req, res) => {
  const { business_id, message } = req.body || {};
  if (!business_id || !message) return res.status(400).json({ error: 'business_id and message required' });
  const info = db.prepare('INSERT INTO enquiries(customer_id,business_id,customer_name,message) VALUES (?,?,?,?)').run(req.user.id, business_id, req.user.name, message);
  res.json({ id: info.lastInsertRowid, ok: true });
});
app.post('/api/reviews', requireAuth, (req, res) => {
  const { business_id, rating, comment } = req.body || {};
  if (!business_id || !rating) return res.status(400).json({ error: 'business_id and rating required' });
  db.prepare('INSERT INTO reviews(business_id,user_id,author_name,rating,comment) VALUES (?,?,?,?,?)').run(business_id, req.user.id, req.user.name, rating, comment || '');
  const agg = db.prepare("SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE business_id=? AND status='published'").get(business_id);
  db.prepare('UPDATE businesses SET rating=ROUND(?,1), review_count=? WHERE id=?').run(agg.a, agg.c, business_id);
  res.json({ ok: true });
});
app.post('/api/orders', requireAuth, (req, res) => {
  const { business_id, total, item_summary, payment_method, items_json } = req.body || {};
  const info = db.prepare("INSERT INTO orders(customer_id,business_id,status,total,item_summary,payment_method,items_json) VALUES (?,?,'pending',?,?,?,?)")
    .run(req.user.id, business_id, total || 0, item_summary || '', payment_method || 'cod', items_json ? JSON.stringify(items_json) : null);
  res.json({ id: info.lastInsertRowid, ok: true });
});
app.get('/api/saved', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM saved_items WHERE user_id=?').all(req.user.id)));
app.post('/api/saved', requireAuth, (req, res) => {
  const { entity_type, entity_id } = req.body || {};
  try { db.prepare('INSERT INTO saved_items(user_id,entity_type,entity_id) VALUES (?,?,?)').run(req.user.id, entity_type, entity_id); } catch {}
  res.json({ ok: true });
});

/* ---------------- partner ---------------- */
const partnerOnly = requireRole('business_partner');
function ownerBusinessIds(uid) { return db.prepare('SELECT id FROM businesses WHERE owner_id=?').all(uid).map(r => r.id); }

/* ---- subscription plan capabilities (single source of truth) ---- */
const PLAN = {
  1: { id:1, name:'Basic',    products:false, offers:0, chat:false, leads:0, highlight:false },
  2: { id:2, name:'Standard', products:true,  offers:0, chat:false, leads:0, highlight:false },
  3: { id:3, name:'Premium',  products:true,  offers:5, chat:true,  leads:10, highlight:true },
};
const planFor = (pid) => PLAN[pid] || PLAN[1];
const bizPlan = (businessId) => { const b = db.prepare('SELECT plan_id FROM businesses WHERE id=?').get(businessId); return planFor(b ? b.plan_id : 1); };
function topPlan(uid) { // best plan across a partner's businesses
  const rows = db.prepare('SELECT plan_id FROM businesses WHERE owner_id=?').all(uid);
  return rows.reduce((best, r) => (planFor(r.plan_id).id > best.id ? planFor(r.plan_id) : best), PLAN[1]);
}
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); };

app.get('/api/partner/overview', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id);
  if (!ids.length) return res.json({ businesses: [], stats: { orders:0, enquiries:0, revenue:0, views:0, products:0 }, recentOrders: [], recentEnquiries: [] });
  const ph = ids.map(()=>'?').join(',');
  const orders = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total),0) rev FROM orders WHERE business_id IN (${ph})`).get(...ids);
  const enq = db.prepare(`SELECT COUNT(*) c FROM enquiries WHERE business_id IN (${ph}) AND status='new'`).get(...ids);
  const prod = db.prepare(`SELECT COUNT(*) c FROM products WHERE business_id IN (${ph})`).get(...ids);
  const businesses = db.prepare(`SELECT b.*, c.name category_name FROM businesses b JOIN categories c ON c.id=b.category_id WHERE b.owner_id=?`).all(req.user.id).map(withOpen);
  const recentOrders = db.prepare(`SELECT o.*, b.name business FROM orders o JOIN businesses b ON b.id=o.business_id WHERE o.business_id IN (${ph}) ORDER BY o.created_at DESC LIMIT 6`).all(...ids);
  const recentEnquiries = db.prepare(`SELECT * FROM enquiries WHERE business_id IN (${ph}) ORDER BY created_at DESC LIMIT 6`).all(...ids);
  const plan = topPlan(req.user.id);
  const offersUsed = db.prepare(`SELECT COUNT(*) c FROM offers WHERE business_id IN (${ph}) AND date(start_date) >= date(?)`).get(...ids, monthStart()).c;
  const leadsUsed = db.prepare(`SELECT COUNT(*) c FROM lead_claims WHERE partner_id=? AND date(created_at) >= date(?)`).get(req.user.id, monthStart()).c;
  const unreadChats = db.prepare(`SELECT COUNT(*) c FROM chat_messages WHERE business_id IN (${ph}) AND sender='user' AND read_by_partner=0`).get(...ids).c;
  res.json({ businesses, stats: { orders: orders.c, revenue: orders.rev, enquiries: enq.c, products: prod.c, views: 1240 + orders.c*37 }, recentOrders, recentEnquiries,
    plan, usage: { offersUsed, offersLimit: plan.offers, leadsUsed, leadsLimit: plan.leads, unreadChats } });
});
app.get('/api/partner/analytics', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id);
  if (!ids.length) return res.json({ revenue7: [], byStatus: [], totalRevenue: 0, orderCount: 0, avgOrder: 0, topProducts: [] });
  const ph = ids.map(()=>'?').join(',');
  const all = db.prepare(`SELECT total, status, item_summary, created_at FROM orders WHERE business_id IN (${ph})`).all(...ids);
  // last 7 days revenue
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    days.push({ key: d.toISOString().slice(0,10), label: d.toLocaleDateString('en',{weekday:'short'}), value: 0 }); }
  const byKey = Object.fromEntries(days.map(d=>[d.key,d]));
  all.forEach(o => { const k = (o.created_at||'').slice(0,10); if (byKey[k]) byKey[k].value += o.total||0; });
  const totalRevenue = all.reduce((s,o)=>s+(o.total||0),0);
  const byStatusMap = {}; all.forEach(o=>{ byStatusMap[o.status]=(byStatusMap[o.status]||0)+1; });
  const byStatus = Object.entries(byStatusMap).map(([label,value])=>({label,value}));
  // top products by frequency in order summaries (best-effort from historical text)
  const prods = db.prepare(`SELECT name FROM products WHERE business_id IN (${ph})`).all(...ids);
  const topProducts = prods.map(p=>({ name: p.name, count: all.filter(o=>(o.item_summary||'').toLowerCase().includes(p.name.toLowerCase())).length }))
    .filter(p=>p.count>0).sort((a,b)=>b.count-a.count).slice(0,5);
  res.json({ revenue7: days, byStatus, totalRevenue, orderCount: all.length, avgOrder: all.length?Math.round(totalRevenue/all.length):0, topProducts });
});
/* ---------------- AI demand forecasting (DevX Nexus V2 logic) ----------------
   Flow: partner selects a product → forecast is generated instantly → every number
   carries a confidence level. History = this product's real orders blended with a
   seeded 56-day demo history (so every product has data to learn from).
   Model: day-of-week seasonality × exponentially-smoothed level + linear trend;
   confidence from history volume, error variance (CV) and trend stability. */
function seededRand(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function forecastFor(p, realOrders) {
  const rnd = seededRand(p.id * 7919 + 13);
  const price = p.price || 100;
  const base = Math.max(2, Math.round(60 / Math.sqrt(price / 40)));      // cheaper items sell more units
  const dow = [0.85, 0.9, 0.95, 1.0, 1.15, 1.35, 1.3];                  // Mon..Sun (weekend uplift)
  const drift = (rnd() - 0.35) * 0.012;                                   // gentle growth or decline
  const hist = [];
  for (let i = 55; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const w = (d.getDay() + 6) % 7, t = 55 - i;
    let u = base * dow[w] * (1 + drift * t) * (0.78 + rnd() * 0.44);
    if (rnd() < 0.04) u *= 1.8;                                           // occasional spike (event / festival)
    hist.push({ date: d.toISOString().slice(0, 10), units: Math.max(0, Math.round(u)) });
  }
  // blend in real orders that mention this product
  const name = (p.name || '').toLowerCase();
  realOrders.forEach(o => { if ((o.item_summary || '').toLowerCase().includes(name)) {
    const k = (o.created_at || '').slice(0, 10); const h = hist.find(x => x.date === k);
    const m = (o.item_summary.toLowerCase().match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*x?(\\d+)')) || [])[1];
    if (h) h.units += +m || 1; } });
  // seasonality indices from history
  const byDow = Array(7).fill(0), cnt = Array(7).fill(0);
  hist.forEach(h => { const w = (new Date(h.date).getDay() + 6) % 7; byDow[w] += h.units; cnt[w]++; });
  const mean = hist.reduce((s, h) => s + h.units, 0) / hist.length || 1;
  const season = byDow.map((v, i) => (v / (cnt[i] || 1)) / mean || 1);
  // Holt smoothing on de-seasonalised series
  let level = hist[0].units / season[(new Date(hist[0].date).getDay() + 6) % 7], trend = 0; const a = 0.3, b = 0.08; const errs = [];
  hist.forEach(h => { const s_ = season[(new Date(h.date).getDay() + 6) % 7]; const y = h.units / s_;
    const pred = (level + trend) * s_; errs.push(h.units - pred);
    const nl = a * y + (1 - a) * (level + trend); trend = b * (nl - level) + (1 - b) * trend; level = nl; });
  const sd = Math.sqrt(errs.slice(-28).reduce((s, e) => s + e * e, 0) / 28);
  const cv = sd / mean;
  const fc = [];
  for (let k = 1; k <= 30; k++) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + k);
    const s_ = season[(d.getDay() + 6) % 7]; const v = Math.max(0, (level + trend * k) * s_);
    const band = 1.28 * sd * Math.sqrt(1 + k / 10);
    fc.push({ date: d.toISOString().slice(0, 10), units: Math.round(v), low: Math.max(0, Math.round(v - band)), high: Math.round(v + band) });
  }
  // confidence: data volume, noise, trend stability
  const volume = Math.min(1, hist.filter(h => h.units > 0).length / 50);
  const noise = Math.max(0, 1 - cv);
  const stability = Math.max(0, 1 - Math.abs(trend) / (mean * 0.08 + 0.01));
  const confidence = Math.round(Math.min(97, Math.max(52, (0.35 * volume + 0.45 * noise + 0.2 * stability) * 100)));
  const sum = (arr, n) => arr.slice(0, n).reduce((s, x) => s + x.units, 0);
  const next7 = sum(fc, 7), next30 = sum(fc, 30), last7 = hist.slice(-7).reduce((s, h) => s + h.units, 0), prev7 = hist.slice(-14, -7).reduce((s, h) => s + h.units, 0);
  const stock = p.stock_status === 'out_of_stock' ? 0 : Math.round(base * (2 + rnd() * 6));
  const safety = Math.round(1.65 * sd * Math.sqrt(3));
  const reorder = Math.max(0, next7 + safety - stock);
  const daysCover = next7 ? Math.round((stock / (next7 / 7)) * 10) / 10 : 99;
  const peakIdx = season.indexOf(Math.max(...season)); const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const growth = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;
  const level_ = confidence >= 85 ? 'High' : confidence >= 70 ? 'Medium' : 'Low';
  return {
    product: { id: p.id, name: p.name, price: p.price, mrp: p.mrp, business: p.business, stock_status: p.stock_status, category: p.category },
    model: 'Nexus V2 · seasonal Holt', generatedAt: new Date().toISOString(),
    confidence, confidenceLevel: level_,
    confidenceFactors: [
      { label: 'History depth', score: Math.round(volume * 100), note: `${hist.length} days of sales` },
      { label: 'Demand stability', score: Math.round(noise * 100), note: `±${Math.round(cv * 100)}% day-to-day variation` },
      { label: 'Trend consistency', score: Math.round(stability * 100), note: trend >= 0 ? 'steady upward / flat trend' : 'softening trend' } ],
    history: hist.slice(-28), forecast: fc,
    summary: { next7, next30, revenue30: Math.round(next30 * (p.price || 0)), avgDaily: Math.round((next7 / 7) * 10) / 10, growth,
      peakDay: DAYS[peakIdx], peakUplift: Math.round((season[peakIdx] - 1) * 100), stockOnHand: stock, daysCover, reorderQty: reorder, safetyStock: safety,
      stockoutRisk: daysCover < 3 ? 'High' : daysCover < 7 ? 'Medium' : 'Low' },
    insights: [
      `${DAYS[peakIdx]}s sell ~${Math.round((season[peakIdx] - 1) * 100)}% above average. Plan prep and staff for it.`,
      growth >= 0 ? `Demand is up ${growth}% week-on-week.` : `Demand dipped ${Math.abs(growth)}% week-on-week. Consider an offer.`,
      reorder > 0 ? `Restock ${reorder} units to cover the next 7 days plus safety stock.` : `Stock covers the next ${daysCover} days. No reorder needed yet.` ] };
}
app.get('/api/partner/forecast', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(() => '?').join(',');
  const prods = db.prepare(`SELECT p.*, b.name business FROM products p JOIN businesses b ON b.id=p.business_id WHERE p.business_id IN (${ph})`).all(...ids);
  const orders = db.prepare(`SELECT item_summary, created_at FROM orders WHERE business_id IN (${ph})`).all(...ids);
  res.json(prods.map(p => { const f = forecastFor(p, orders); return { id: p.id, name: p.name, business: p.business, price: p.price, confidence: f.confidence, confidenceLevel: f.confidenceLevel, next7: f.summary.next7, growth: f.summary.growth, stockoutRisk: f.summary.stockoutRisk, spark: f.history.slice(-14).map(h => h.units) }; }));
});
app.get('/api/partner/forecast/:id', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); const ph = ids.map(() => '?').join(',') || 'NULL';
  const p = db.prepare(`SELECT p.*, b.name business FROM products p JOIN businesses b ON b.id=p.business_id WHERE p.id=? AND p.business_id IN (${ph})`).get(+req.params.id, ...ids);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const orders = db.prepare(`SELECT item_summary, created_at FROM orders WHERE business_id IN (${ph})`).all(...ids);
  res.json(forecastFor(p, orders));
});

app.get('/api/partner/products', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(()=>'?').join(',');
  res.json(db.prepare(`SELECT p.*, b.name business FROM products p JOIN businesses b ON b.id=p.business_id WHERE p.business_id IN (${ph}) ORDER BY p.sort`).all(...ids));
});
app.post('/api/partner/products', partnerOnly, (req, res) => {
  const { business_id, name, price, mrp, emoji, unit, description, image_url, promo_label } = req.body || {};
  if (!ownerBusinessIds(req.user.id).includes(Number(business_id))) return res.status(403).json({ error: 'Not your business' });
  if (!bizPlan(Number(business_id)).products) return res.status(403).json({ error: 'Upgrade to the Standard plan to add products & services.' });
  const info = db.prepare('INSERT INTO products(business_id,name,description,price,mrp,emoji,image_url,promo_label,unit) VALUES (?,?,?,?,?,?,?,?,?)').run(business_id, name, description||'', price, mrp||null, emoji||'🛍️', image_url||null, promo_label||null, unit||'unit');
  res.json({ id: info.lastInsertRowid, ok: true });
});
function ownsProduct(uid, pid){ const p = db.prepare('SELECT business_id FROM products WHERE id=?').get(Number(pid)); return p && ownerBusinessIds(uid).includes(p.business_id); }
app.patch('/api/partner/products/:id', partnerOnly, (req, res) => {
  if (!ownsProduct(req.user.id, req.params.id)) return res.status(403).json({ error: 'Not your product' });
  const allow = ['name','price','mrp','unit','stock_status','image_url','promo_label','description'];
  const sets = [], vals = [];
  for (const k of allow) if (k in (req.body||{})) { sets.push(`${k}=?`); vals.push(req.body[k] === '' ? null : req.body[k]); }
  if (!sets.length) return res.json({ ok: true });
  vals.push(Number(req.params.id));
  db.prepare(`UPDATE products SET ${sets.join(',')} WHERE id=?`).run(...vals);
  res.json({ ok: true });
});
app.delete('/api/partner/products/:id', partnerOnly, (req, res) => {
  if (!ownsProduct(req.user.id, req.params.id)) return res.status(403).json({ error: 'Not your product' });
  db.prepare('DELETE FROM products WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});
// Partner-managed promotions/offers for their own business
app.get('/api/partner/offers', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(()=>'?').join(',');
  res.json(db.prepare(`SELECT o.*, b.name business FROM offers o JOIN businesses b ON b.id=o.business_id WHERE o.business_id IN (${ph}) ORDER BY o.id DESC`).all(...ids));
});
app.post('/api/partner/offers', partnerOnly, (req, res) => {
  const { business_id, title, description, discount_label, code, color1, color2 } = req.body || {};
  if (!ownerBusinessIds(req.user.id).includes(Number(business_id))) return res.status(403).json({ error: 'Not your business' });
  const plan = bizPlan(Number(business_id));
  if (!plan.offers) return res.status(403).json({ error: 'Promotions are a Premium feature. Upgrade to run offers.' });
  const used = db.prepare("SELECT COUNT(*) c FROM offers WHERE business_id=? AND date(start_date) >= date(?)").get(Number(business_id), monthStart()).c;
  if (used >= plan.offers) return res.status(403).json({ error: `You've used all ${plan.offers} promotions for this month.` });
  if (!title || !discount_label) return res.status(400).json({ error: 'Title and discount are required' });
  const info = db.prepare(`INSERT INTO offers(business_id,title,description,discount_label,code,color1,color2,start_date,end_date,status)
    VALUES (?,?,?,?,?,?,?,date('now'),date('now','+30 days'),'active')`)
    .run(business_id, title, description||'', discount_label, (code||'').toUpperCase()||null, color1||'#2563EB', color2||'#1E3A8A');
  res.json({ id: info.lastInsertRowid, ok: true });
});
app.delete('/api/partner/offers/:id', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id);
  const off = db.prepare('SELECT * FROM offers WHERE id=?').get(Number(req.params.id));
  if (!off || !ids.includes(off.business_id)) return res.status(403).json({ error: 'Not your offer' });
  db.prepare('DELETE FROM offers WHERE id=?').run(off.id);
  res.json({ ok: true });
});
// Partner business settings (payment methods, UPI, contact, hours, description)
app.get('/api/partner/businesses', partnerOnly, (req, res) => {
  res.json(db.prepare(`SELECT b.*, c.name category_name FROM businesses b JOIN categories c ON c.id=b.category_id WHERE b.owner_id=?`).all(req.user.id).map(withOpen));
});
app.patch('/api/partner/businesses/:id', partnerOnly, (req, res) => {
  const id = Number(req.params.id);
  if (!ownerBusinessIds(req.user.id).includes(id)) return res.status(403).json({ error: 'Not your business' });
  const allow = ['payment_methods','upi_id','phone','whatsapp','address','description','open_min','close_min','cover_url'];
  const sets = [], vals = [];
  for (const k of allow) if (k in (req.body||{})) { sets.push(`${k}=?`); vals.push(req.body[k] === '' ? null : req.body[k]); }
  if (!sets.length) return res.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE businesses SET ${sets.join(',')} WHERE id=?`).run(...vals);
  res.json({ ok: true });
});

app.get('/api/partner/orders', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(()=>'?').join(',');
  res.json(db.prepare(`SELECT o.*, b.name business, u.name customer FROM orders o JOIN businesses b ON b.id=o.business_id LEFT JOIN users u ON u.id=o.customer_id WHERE o.business_id IN (${ph}) ORDER BY o.created_at DESC`).all(...ids));
});
const ORDER_FLOW = { pending:['accepted','rejected'], accepted:['preparing'], preparing:['ready'], ready:['out_for_delivery','completed'], out_for_delivery:['completed'] };
app.post('/api/partner/orders/:id/status', partnerOnly, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o || !ownerBusinessIds(req.user.id).includes(o.business_id)) return res.status(403).json({ error: 'Not allowed' });
  const next = req.body?.status;
  if (!(ORDER_FLOW[o.status] || []).includes(next)) return res.status(400).json({ error: `Cannot move ${o.status} → ${next}` });
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(next, o.id);
  res.json({ ok: true, status: next });
});
app.get('/api/partner/enquiries', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(()=>'?').join(',');
  res.json(db.prepare(`SELECT e.*, b.name business FROM enquiries e JOIN businesses b ON b.id=e.business_id WHERE e.business_id IN (${ph}) ORDER BY e.created_at DESC`).all(...ids));
});

/* ---------------- customer ↔ store chat (Premium businesses) ---------------- */
app.get('/api/chat/:businessId', requireAuth, (req, res) => {
  const bid = Number(req.params.businessId);
  const b = db.prepare('SELECT id, name, plan_id FROM businesses WHERE id=?').get(bid);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  const msgs = db.prepare('SELECT * FROM chat_messages WHERE business_id=? AND user_id=? ORDER BY id').all(bid, req.user.id);
  db.prepare("UPDATE chat_messages SET read_by_user=1 WHERE business_id=? AND user_id=? AND sender='partner'").run(bid, req.user.id);
  res.json({ business: { id: b.id, name: b.name }, chat_enabled: planFor(b.plan_id).chat, messages: msgs });
});
app.post('/api/chat/:businessId', requireAuth, (req, res) => {
  const bid = Number(req.params.businessId);
  const b = db.prepare('SELECT id, plan_id FROM businesses WHERE id=?').get(bid);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  if (!planFor(b.plan_id).chat) return res.status(403).json({ error: 'This store is not on a plan that supports chat.' });
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message is empty' });
  const info = db.prepare("INSERT INTO chat_messages(business_id,user_id,sender,body,read_by_user,read_by_partner) VALUES (?,?,'user',?,1,0)").run(bid, req.user.id, body);
  res.json({ id: info.lastInsertRowid, ok: true });
});
app.get('/api/partner/chats', partnerOnly, (req, res) => {
  const ids = ownerBusinessIds(req.user.id); if (!ids.length) return res.json([]);
  const ph = ids.map(()=>'?').join(',');
  const rows = db.prepare(`SELECT m.business_id, m.user_id, b.name business, u.name customer,
      MAX(m.id) lastId, SUM(CASE WHEN m.sender='user' AND m.read_by_partner=0 THEN 1 ELSE 0 END) unread
    FROM chat_messages m JOIN businesses b ON b.id=m.business_id LEFT JOIN users u ON u.id=m.user_id
    WHERE m.business_id IN (${ph}) GROUP BY m.business_id, m.user_id ORDER BY lastId DESC`).all(...ids);
  const withLast = rows.map(r => { const last = db.prepare('SELECT body, sender, created_at FROM chat_messages WHERE id=?').get(r.lastId); return { ...r, last }; });
  res.json(withLast);
});
app.get('/api/partner/chats/:userId', partnerOnly, (req, res) => {
  const bid = Number(req.query.business_id);
  if (!ownerBusinessIds(req.user.id).includes(bid)) return res.status(403).json({ error: 'Not your business' });
  const uid = Number(req.params.userId);
  const msgs = db.prepare('SELECT * FROM chat_messages WHERE business_id=? AND user_id=? ORDER BY id').all(bid, uid);
  db.prepare("UPDATE chat_messages SET read_by_partner=1 WHERE business_id=? AND user_id=? AND sender='user'").run(bid, uid);
  const u = db.prepare('SELECT name FROM users WHERE id=?').get(uid);
  res.json({ customer: u ? u.name : 'Customer', messages: msgs });
});
app.post('/api/partner/chats/:userId', partnerOnly, (req, res) => {
  const bid = Number(req.body?.business_id);
  if (!ownerBusinessIds(req.user.id).includes(bid)) return res.status(403).json({ error: 'Not your business' });
  const body = (req.body?.body || '').trim(); if (!body) return res.status(400).json({ error: 'Message is empty' });
  const info = db.prepare("INSERT INTO chat_messages(business_id,user_id,sender,body,read_by_user,read_by_partner) VALUES (?,?,'partner',?,0,1)").run(bid, Number(req.params.userId), body);
  res.json({ id: info.lastInsertRowid, ok: true });
});

/* ---------------- leads (searches + bulk requirements → premium partners) ---------------- */
app.post('/api/leads', requireAuth, (req, res) => {
  const { type, category_id, area_id, query, message, budget } = req.body || {};
  const info = db.prepare('INSERT INTO leads(type,user_id,user_name,user_phone,category_id,area_id,query,message,budget) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(type === 'bulk' ? 'bulk' : 'enquiry', req.user.id, req.user.name, req.user.phone || null, category_id || null, area_id || null, query || null, message || null, budget || null);
  res.json({ id: info.lastInsertRowid, ok: true });
});
app.post('/api/leads/search', requireAuth, (req, res) => {
  const q = (req.body?.query || '').trim(); if (q.length < 3) return res.json({ ok: false });
  // de-dupe: skip if the same user logged the same query in the last 6 hours
  const dup = db.prepare("SELECT id FROM leads WHERE user_id=? AND type='search' AND lower(query)=lower(?) AND created_at >= datetime('now','-6 hours')").get(req.user.id, q);
  if (dup) return res.json({ ok: true, deduped: true });
  db.prepare('INSERT INTO leads(type,user_id,user_name,user_phone,category_id,area_id,query) VALUES (?,?,?,?,?,?,?)')
    .run('search', req.user.id, req.user.name, req.user.phone || null, req.body?.category_id || null, req.body?.area_id || null, q);
  res.json({ ok: true });
});
app.get('/api/partner/leads', partnerOnly, (req, res) => {
  const plan = topPlan(req.user.id);
  if (!plan.leads) return res.json({ plan, leads: [], used: 0, limit: 0, locked: true });
  const cats = [...new Set(db.prepare('SELECT category_id FROM businesses WHERE owner_id=?').all(req.user.id).map(r => r.category_id))];
  const catPh = cats.length ? cats.map(()=>'?').join(',') : 'NULL';
  const rows = db.prepare(`SELECT l.* FROM leads l WHERE (l.category_id IN (${catPh}) OR l.category_id IS NULL)
    AND l.status='new' AND l.created_at >= datetime('now','-30 days') ORDER BY l.created_at DESC LIMIT 40`).all(...cats);
  const myClaims = new Set(db.prepare('SELECT lead_id FROM lead_claims WHERE partner_id=?').all(req.user.id).map(r => r.lead_id));
  const used = db.prepare("SELECT COUNT(*) c FROM lead_claims WHERE partner_id=? AND date(created_at) >= date(?)").get(req.user.id, monthStart()).c;
  const leads = rows.map(l => {
    const claimed = myClaims.has(l.id);
    return claimed ? l : { ...l, user_phone: null, user_name: (l.user_name||'Customer').split(' ')[0] + ' ••', locked: true };
  });
  res.json({ plan, leads, used, limit: plan.leads });
});
app.post('/api/partner/leads/:id/claim', partnerOnly, (req, res) => {
  const plan = topPlan(req.user.id);
  if (!plan.leads) return res.status(403).json({ error: 'Leads are a Premium feature.' });
  const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const already = db.prepare('SELECT id FROM lead_claims WHERE lead_id=? AND partner_id=?').get(lead.id, req.user.id);
  if (already) return res.json({ ok: true, lead });
  const used = db.prepare("SELECT COUNT(*) c FROM lead_claims WHERE partner_id=? AND date(created_at) >= date(?)").get(req.user.id, monthStart()).c;
  if (used >= plan.leads) return res.status(403).json({ error: `You've used all ${plan.leads} leads for this month.` });
  const biz = db.prepare('SELECT id FROM businesses WHERE owner_id=? LIMIT 1').get(req.user.id);
  db.prepare('INSERT INTO lead_claims(lead_id,partner_id,business_id) VALUES (?,?,?)').run(lead.id, req.user.id, biz ? biz.id : null);
  res.json({ ok: true, lead });
});

/* ---------------- admin ---------------- */
const adminOnly = requireRole('admin');
app.get('/api/admin/overview', adminOnly, (_req, res) => {
  const one = (q) => db.prepare(q).get().c;
  const stats = {
    users: one('SELECT COUNT(*) c FROM users'),
    businesses: one("SELECT COUNT(*) c FROM businesses WHERE status='approved'"),
    pending: one("SELECT COUNT(*) c FROM businesses WHERE status='pending'"),
    orders: one('SELECT COUNT(*) c FROM orders'),
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) c FROM orders WHERE status='completed'").get().c,
    reviews: one('SELECT COUNT(*) c FROM reviews'),
    news: one("SELECT COUNT(*) c FROM news WHERE status='published'"),
    events: one('SELECT COUNT(*) c FROM events'),
    leads: one('SELECT COUNT(*) c FROM leads'),
    premium: one('SELECT COUNT(*) c FROM businesses WHERE plan_id=3'),
    ads: one("SELECT COUNT(*) c FROM advertisements WHERE status='active'"),
  };
  const byCategory = db.prepare(`SELECT c.name label, COUNT(b.id) value FROM categories c LEFT JOIN businesses b ON b.category_id=c.id WHERE c.kind='business' GROUP BY c.id HAVING value>0 ORDER BY value DESC`).all();
  const ordersByStatus = db.prepare('SELECT status label, COUNT(*) value FROM orders GROUP BY status').all();
  const topRated = db.prepare("SELECT name, rating, review_count FROM businesses WHERE status='approved' ORDER BY rating DESC LIMIT 5").all();
  res.json({ stats, byCategory, ordersByStatus, topRated });
});
const ADMIN_TABLES = {
  businesses: `SELECT b.id, b.name, c.name category, a.name area, b.rating, b.verification_status, b.status FROM businesses b JOIN categories c ON c.id=b.category_id LEFT JOIN areas a ON a.id=b.area_id`,
  users: `SELECT id, name, email, phone, role, created_at FROM users`,
  categories: `SELECT id, name, slug, kind, sort, active FROM categories`,
  products: `SELECT p.id, p.name, b.name business, p.price, p.stock_status FROM products p JOIN businesses b ON b.id=p.business_id`,
  reviews: `SELECT r.id, r.author_name, b.name business, r.rating, r.comment, r.status, r.created_at FROM reviews r JOIN businesses b ON b.id=r.business_id`,
  orders: `SELECT o.id, b.name business, o.total, o.status, o.created_at FROM orders o JOIN businesses b ON b.id=o.business_id`,
  news: `SELECT id, title, category, status, published_at FROM news`,
  events: `SELECT id, title, venue, start_date FROM events`,
  offers: `SELECT o.id, o.title, b.name business, o.discount_label, o.status FROM offers o JOIN businesses b ON b.id=o.business_id`,
  workers: `SELECT w.id, w.name, c.name category, a.name area, w.rate, w.available FROM workers w LEFT JOIN categories c ON c.id=w.category_id LEFT JOIN areas a ON a.id=w.area_id`,
  drivers: `SELECT d.id, d.name, d.service_type, d.vehicle_model, a.name area, d.available FROM drivers d LEFT JOIN areas a ON a.id=d.area_id`,
  local_info: `SELECT l.id, l.name, l.category, l.phone, a.name area, l.emergency FROM local_info l LEFT JOIN areas a ON a.id=l.area_id`,
  subscription_plans: `SELECT id, name, price, period, tagline, popular FROM subscription_plans`,
  leads: `SELECT l.id, l.type, l.user_name, l.user_phone, c.name category, a.name area, COALESCE(l.query,l.message) detail, l.budget, l.status, l.created_at FROM leads l LEFT JOIN categories c ON c.id=l.category_id LEFT JOIN areas a ON a.id=l.area_id`,
  advertisements: `SELECT ad.id, ad.title, ad.placement, b.name business, ad.status, ad.impressions, ad.clicks, ad.start_date, ad.end_date FROM advertisements ad LEFT JOIN businesses b ON b.id=ad.business_id`,
};
app.get('/api/admin/table/:name', adminOnly, (req, res) => {
  const base = ADMIN_TABLES[req.params.name];
  if (!base) return res.status(404).json({ error: 'Unknown table' });
  res.json(db.prepare(base + ' ORDER BY 1 DESC').all());
});
app.get('/api/admin/businesses/:id/full', adminOnly, (req, res) => {
  const id = req.params.id;
  const b = db.prepare(`SELECT b.*, c.name category_name, a.name area_name, u.name owner_name, sp.name plan_name
    FROM businesses b LEFT JOIN categories c ON c.id=b.category_id LEFT JOIN areas a ON a.id=b.area_id
    LEFT JOIN users u ON u.id=b.owner_id LEFT JOIN subscription_plans sp ON sp.id=b.plan_id WHERE b.id=?`).get(id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json({
    business: b,
    products: db.prepare('SELECT * FROM products WHERE business_id=? ORDER BY sort').all(id),
    services: db.prepare('SELECT * FROM services WHERE business_id=?').all(id),
    offers: db.prepare('SELECT * FROM offers WHERE business_id=? ORDER BY id DESC').all(id),
    reviews: db.prepare('SELECT * FROM reviews WHERE business_id=? ORDER BY created_at DESC').all(id),
    orders: db.prepare('SELECT * FROM orders WHERE business_id=? ORDER BY created_at DESC').all(id),
  });
});
app.post('/api/admin/businesses/:id/status', adminOnly, (req, res) => {
  const { status } = req.body || {};
  if (!['approved','pending','rejected','suspended'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  db.prepare('UPDATE businesses SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/reviews/:id/status', adminOnly, (req, res) => {
  const { status } = req.body || {};
  db.prepare('UPDATE reviews SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/categories/:id/toggle', adminOnly, (req, res) => {
  db.prepare('UPDATE categories SET active = 1-active WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
// Admin creates a partner login (hashed password) and optionally links it to a business.
app.post('/api/admin/partners', adminOnly, (req, res) => {
  let { name, email, phone, password, business_id, plan_id } = req.body || {};
  name=(name||'').trim(); email=(email||'').trim().toLowerCase(); phone=(phone||'').trim();
  if (!name || !email || !phone) return res.status(400).json({ error: 'Name, email and phone are required.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email=? OR phone=?').get(email, phone)) return res.status(409).json({ error: 'A user already exists with this email or phone.' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users(name,email,phone,password_hash,role,avatar_color) VALUES (?,?,?,?,'business_partner','#0A2472')").run(name, email, phone, hash);
  const uid = info.lastInsertRowid;
  if (business_id) { // link an existing business to this partner
    db.prepare('UPDATE businesses SET owner_id=?' + (plan_id?', plan_id=?':'') + ' WHERE id=?')
      .run(...(plan_id ? [uid, Number(plan_id), Number(business_id)] : [uid, Number(business_id)]));
  }
  res.json({ ok: true, user: { id: uid, name, email, phone }, credentials: { email, phone, password } });
});

/* ---------------- admin: full CRUD ---------------- */
const WRITABLE = {
  businesses:['owner_id','name','slug','category_id','subcategory','area_id','description','phone','whatsapp','address','rating','review_count','price_level','emoji','color1','color2','cover_url','open_min','close_min','verification_status','status','plan_id','featured'],
  news:['title','summary','body','category','emoji','color1','color2','area_id','status','published_at'],
  events:['title','description','venue','area_id','emoji','color1','color2','start_date','time_label','organizer','contact'],
  offers:['business_id','title','description','discount_label','color1','color2','start_date','end_date','status'],
  products:['business_id','name','description','price','mrp','emoji','image_url','promo_label','unit','stock_status'],
  services:['business_id','category_id','name','description','starting_price','pricing_type','emoji','rating','available'],
  categories:['slug','name','name_ml','icon','color1','color2','kind','sort','active'],
  local_info:['category','name','description','phone','address','area_id','emergency','hours','emoji'],
  workers:['name','category_id','area_id','skills','experience_years','rate','phone','whatsapp','rating','review_count','available','emoji','color1','color2'],
  drivers:['name','service_type','vehicle_model','vehicle_number','area_id','fare_note','phone','whatsapp','rating','available','emoji'],
  subscription_plans:['name','price','period','tagline','features','sort','popular'],
  users:['name','email','phone','role','avatar_color','area_id'],
  advertisements:['title','image_url','placement','business_id','target_url','start_date','end_date','impressions','clicks','status'],
};
const ENTITIES = Object.keys(WRITABLE);
function slugify(s){ return String(s||'item').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,50) + '-' + Math.random().toString(36).slice(2,6); }
function pick(obj, cols){ const o={}; for(const c of cols) if(obj[c]!==undefined) o[c]=obj[c]; return o; }
function applyDefaults(entity, data, isCreate){
  const cat = data.category_id ? db.prepare('SELECT color1,color2,icon FROM categories WHERE id=?').get(data.category_id) : null;
  if(entity==='businesses'){
    if(isCreate){ if(!data.slug) data.slug=slugify(data.name); }
    if(data.color1===undefined && cat) data.color1=cat.color1;
    if(data.color2===undefined && cat) data.color2=cat.color2;
    if(data.emoji===undefined && cat) data.emoji=cat.icon;
    if(isCreate){ data.verification_status??='verified'; data.status??='approved'; data.plan_id??=1; data.rating??=0; data.review_count??=0; data.price_level??=2; data.open_min??=540; data.close_min??=1290; data.featured??=0; }
  }
  if(entity==='news' && isCreate){ data.status??='published'; data.published_at??=new Date().toISOString().slice(0,19).replace('T',' '); data.color1??='#8B5CF6'; data.color2??='#6D28D9'; data.emoji??='📰'; }
  if(entity==='events' && isCreate){ data.color1??='#F43F5E'; data.color2??='#BE123C'; data.emoji??='🎉'; }
  if(entity==='offers' && isCreate){ data.status??='active'; data.color1??='#2563EB'; data.color2??='#0A2472'; data.start_date??=new Date().toISOString().slice(0,10); }
  if(entity==='categories' && isCreate){ if(!data.slug) data.slug=slugify(data.name); data.sort??=(db.prepare('SELECT MAX(sort) m FROM categories').get().m||0)+1; data.active??=1; data.kind??='business'; data.icon??='🏷️'; }
  if(entity==='local_info' && isCreate){ data.emergency??=0; }
  if((entity==='workers'||entity==='drivers') && isCreate){ data.available??=1; data.rating??=4.5; }
  if(entity==='subscription_plans' && Array.isArray(data.features)) data.features=JSON.stringify(data.features);
  if(entity==='users' && isCreate){ data.role??='customer'; data.avatar_color??='#1D4ED8'; }
  if(entity==='advertisements' && isCreate){ data.status??='active'; data.placement??='home_banner'; data.impressions??=0; data.clicks??=0; }
  return data;
}
function requireEntity(req,res,next){ if(!ENTITIES.includes(req.params.entity)) return next('route'); next(); }

app.get('/api/admin/:entity/:id', adminOnly, requireEntity, (req,res)=>{
  const row = db.prepare(`SELECT * FROM ${req.params.entity} WHERE id=?`).get(req.params.id);
  row ? res.json(row) : res.status(404).json({error:'Not found'});
});
app.post('/api/admin/:entity', adminOnly, requireEntity, (req,res)=>{
  const entity=req.params.entity;
  const data = applyDefaults(entity, pick(req.body||{}, WRITABLE[entity]), true);
  const cols = Object.keys(data); if(!cols.length) return res.status(400).json({error:'No fields'});
  const info = db.prepare(`INSERT INTO ${entity} (${cols.join(',')}) VALUES (${cols.map(c=>'@'+c).join(',')})`).run(data);
  res.json({ ok:true, id: info.lastInsertRowid });
});
app.patch('/api/admin/:entity/:id', adminOnly, requireEntity, (req,res)=>{
  const entity=req.params.entity;
  const data = applyDefaults(entity, pick(req.body||{}, WRITABLE[entity]), false);
  const cols = Object.keys(data); if(!cols.length) return res.status(400).json({error:'No fields'});
  db.prepare(`UPDATE ${entity} SET ${cols.map(c=>c+'=@'+c).join(',')} WHERE id=@__id`).run({...data, __id:Number(req.params.id)});
  res.json({ ok:true });
});
app.delete('/api/admin/:entity/:id', adminOnly, requireEntity, (req,res)=>{
  const entity=req.params.entity, id=Number(req.params.id);
  if(entity==='businesses'){ for(const t of ['products','services','offers','reviews']) db.prepare(`DELETE FROM ${t} WHERE business_id=?`).run(id); }
  db.prepare(`DELETE FROM ${entity} WHERE id=?`).run(id);
  res.json({ ok:true });
});
// options for form selects (businesses list for offers/products)
app.get('/api/admin/options', adminOnly, (_req,res)=>{
  res.json({
    businesses: db.prepare('SELECT id,name FROM businesses ORDER BY name').all(),
    categories: db.prepare('SELECT id,name,kind FROM categories ORDER BY sort').all(),
    areas: db.prepare('SELECT a.id, a.name, p.name panchayath FROM areas a LEFT JOIN panchayaths p ON p.id=a.panchayath_id ORDER BY a.name').all(),
    plans: db.prepare('SELECT id,name FROM subscription_plans ORDER BY sort').all(),
  });
});

/* ---------------- admin: platform settings ---------------- */
app.get('/api/admin/settings', adminOnly, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {}; rows.forEach(r => out[r.key] = r.value);
  res.json(out);
});
app.put('/api/admin/settings', adminOnly, (req, res) => {
  const body = req.body || {};
  const up = db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx = db.transaction((obj) => { for (const [k, v] of Object.entries(obj)) up.run(String(k), v == null ? '' : String(v)); });
  tx(body);
  res.json({ ok: true });
});
// Public (read-only) subset so the customer/partner apps can reflect platform config.
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {}; rows.forEach(r => out[r.key] = r.value);
  res.json(out);
});

/* ---------------- admin: notifications (broadcast) ---------------- */
app.get('/api/admin/notifications', adminOnly, (_req, res) => {
  const sent = db.prepare(`SELECT title, body, type, COUNT(*) recipients, MAX(created_at) sent_at
    FROM notifications GROUP BY title, body, type ORDER BY sent_at DESC LIMIT 40`).all();
  res.json({ sent, totalUsers: db.prepare('SELECT COUNT(*) c FROM users').get().c });
});
app.post('/api/admin/notifications/broadcast', adminOnly, (req, res) => {
  let { title, body, type, audience, role, area_id } = req.body || {};
  title = (title || '').trim(); body = (body || '').trim();
  if (!title || !body) return res.status(400).json({ error: 'Title and message are required.' });
  type = type || 'announcement';
  let users;
  if (audience === 'role' && role) users = db.prepare('SELECT id FROM users WHERE role=?').all(role);
  else if (audience === 'area' && area_id) users = db.prepare('SELECT id FROM users WHERE area_id=?').all(Number(area_id));
  else users = db.prepare('SELECT id FROM users').all();
  if (!users.length) return res.status(400).json({ error: 'No users match that audience.' });
  const ins = db.prepare("INSERT INTO notifications(user_id,type,title,body,read,created_at) VALUES (?,?,?,?,0,datetime('now'))");
  const tx = db.transaction((list) => { for (const u of list) ins.run(u.id, type, title, body); });
  tx(users);
  res.json({ ok: true, sent: users.length });
});

/* ---------------- admin: locations + live Google import ---------------- */
app.get('/api/admin/areas', adminOnly, (_req, res) => {
  const rows = db.prepare(`SELECT a.id, a.name, a.lat, a.lng, p.name AS panchayath,
      (SELECT COUNT(*) FROM businesses b WHERE b.area_id=a.id) AS business_count
      FROM areas a LEFT JOIN panchayaths p ON p.id=a.panchayath_id ORDER BY p.name, a.name`).all();
  res.json({ areas: rows, googleEnabled: !!process.env.GOOGLE_PLACES_API_KEY });
});

const IMPORT_QUERIES = [
  { q: 'restaurants',        cat: 1, sub: 'Restaurant',       emoji: '🍽️', c1: '#2563EB', c2: '#0A2472' },
  { q: 'bakery',            cat: 1, sub: 'Bakery',           emoji: '🧁', c1: '#EC4899', c2: '#BE185D' },
  { q: 'supermarket grocery',cat: 1, sub: 'Grocery',         emoji: '🛒', c1: '#0369A1', c2: '#2563EB' },
  { q: 'pharmacy',          cat: 6, sub: 'Pharmacy',         emoji: '💊', c1: '#EC4899', c2: '#BE185D' },
  { q: 'clothing store',    cat: 2, sub: 'Clothing',         emoji: '👗', c1: '#FFC53D', c2: '#E14B36' },
  { q: 'electronics store', cat: 2, sub: 'Electronics',      emoji: '📱', c1: '#6366F1', c2: '#4338CA' },
  { q: 'beauty salon',      cat: 3, sub: 'Salon',            emoji: '💇', c1: '#EC4899', c2: '#9D174D' },
  { q: 'hardware store',    cat: 2, sub: 'Hardware',         emoji: '🔩', c1: '#64748B', c2: '#334155' },
];
app.post('/api/admin/import-google', adminOnly, async (req, res) => {
  const areaId = Number(req.body?.area_id);
  const area = db.prepare('SELECT * FROM areas WHERE id=?').get(areaId);
  if (!area) return res.status(400).json({ error: 'Unknown area' });
  if (!process.env.GOOGLE_PLACES_API_KEY)
    return res.json({ ok: false, needsKey: true, message: 'Add a GOOGLE_PLACES_API_KEY environment variable to import live shops from Google.' });

  const insert = db.prepare(`INSERT INTO businesses
    (owner_id,name,slug,category_id,subcategory,area_id,description,phone,whatsapp,address,rating,review_count,price_level,emoji,color1,color2,open_min,close_min,verification_status,status,plan_id,featured)
    VALUES (NULL,@name,@slug,@cat,@sub,@area,@desc,@phone,@wa,@addr,@rating,@rc,2,@emoji,@c1,@c2,540,1290,'verified','approved',1,0)`);
  const exists = db.prepare('SELECT 1 FROM businesses WHERE lower(name)=lower(?) AND area_id=?');
  let imported = 0, skipped = 0, errors = 0;

  for (const spec of IMPORT_QUERIES) {
    try {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.primaryTypeDisplayName',
        },
        body: JSON.stringify({ textQuery: `${spec.q} in ${area.name}, Kozhikode, Kerala`, maxResultCount: 6, regionCode: 'IN' }),
      });
      if (!r.ok) { errors++; continue; }
      const data = await r.json();
      for (const pl of (data.places || [])) {
        const name = pl.displayName?.text;
        if (!name) continue;
        if (exists.get(name, areaId)) { skipped++; continue; }
        const phone = (pl.internationalPhoneNumber || '').replace(/\s/g, '') || '';
        insert.run({
          name, slug: slugify(name), cat: spec.cat, sub: pl.primaryTypeDisplayName?.text || spec.sub, area: areaId,
          desc: `${pl.primaryTypeDisplayName?.text || spec.sub} in ${area.name}. Imported from Google.`,
          phone, wa: phone, addr: pl.formattedAddress || area.name,
          rating: pl.rating || 4.2, rc: pl.userRatingCount || 0, emoji: spec.emoji, c1: spec.c1, c2: spec.c2,
        });
        imported++;
      }
    } catch (e) { errors++; }
  }
  res.json({ ok: true, imported, skipped, errors, area: area.name });
});

/* ---------------- static SPA ---------------- */
app.use(express.static(path.join(__dirname, 'public')));

// Per-surface PWA config so each app (Customer / Partner / Admin) installs to the
// home screen as its own separate app with its own icon, name and start URL.
const SURFACE = {
  partner: { manifest: '/manifest-partner.webmanifest', icon: '/icon-partner-192.png',
    title: 'Local Link Partner', appleTitle: 'LL Partner', theme: '#B45309' },
  admin:   { manifest: '/manifest-admin.webmanifest', icon: '/icon-admin-192.png',
    title: 'Local Link Admin', appleTitle: 'LL Admin', theme: '#0F172A' },
};
let INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
function renderIndexFor(reqPath) {
  const key = reqPath.startsWith('/admin') ? 'admin' : reqPath.startsWith('/partner') ? 'partner' : null;
  if (!key) return INDEX_HTML; // customer + launcher use the default (customer) manifest
  const s = SURFACE[key];
  return INDEX_HTML
    .replace('href="/manifest.webmanifest"', `href="${s.manifest}"`)
    .replace('href="/icon-192.png"', `href="${s.icon}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${s.title}</title>`)
    .replace('content="Local Link"', `content="${s.appleTitle}"`)
    .replace('content="#8A0002"', `content="${s.theme}"`);
}
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.type('html').send(renderIndexFor(req.path));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌿 Local Link running on http://localhost:${PORT}`));
