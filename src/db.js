import Database from 'libsql';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { photoFor } from './photos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'local-link.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// ---------------------------------------------------------------------------
// Storage: a plain local SQLite file by default (great for local dev / demos).
// Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) to make the data PERSIST across
// restarts on hosts with an ephemeral disk (e.g. Render's free tier). We use
// libsql's embedded-replica mode: reads are served from a fast local copy,
// writes are forwarded to the free Turso cloud database, and on boot we pull
// the latest so nothing is lost when the container restarts.
// Turso free tier: https://turso.tech  — create a DB, copy its URL + token.
// ---------------------------------------------------------------------------
const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
export const PERSISTENT = !!TURSO_URL;

export const db = PERSISTENT
  ? new Database(DB_FILE, { syncUrl: TURSO_URL, authToken: TURSO_TOKEN })
  : new Database(DB_FILE);

// Pull the latest data from the cloud primary before anything reads/seeds.
export function syncDb() {
  if (!PERSISTENT) return false;
  try { db.sync(); return true; }
  catch (e) { console.warn('⚠️  Turso sync failed (continuing with local copy):', e.message); return false; }
}
syncDb();

try { db.pragma('journal_mode = WAL'); } catch (e) {}
try { db.pragma('foreign_keys = ON'); } catch (e) {}
if (PERSISTENT) console.log('🌐 Persistent storage enabled (Turso/libSQL embedded replica).');

function schema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, name TEXT, phone TEXT UNIQUE, email TEXT UNIQUE,
    password_hash TEXT, role TEXT NOT NULL DEFAULT 'customer', avatar_color TEXT DEFAULT '#0D9488',
    lang TEXT DEFAULT 'en', area_id INTEGER, created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS districts( id INTEGER PRIMARY KEY, name TEXT, state TEXT );
  CREATE TABLE IF NOT EXISTS panchayaths( id INTEGER PRIMARY KEY, district_id INTEGER, name TEXT, type TEXT );
  CREATE TABLE IF NOT EXISTS areas( id INTEGER PRIMARY KEY, panchayath_id INTEGER, name TEXT, lat REAL, lng REAL );

  CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, name_ml TEXT, icon TEXT,
    color1 TEXT, color2 TEXT, kind TEXT DEFAULT 'business', sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1 );

  CREATE TABLE IF NOT EXISTS businesses(
    id INTEGER PRIMARY KEY, owner_id INTEGER, name TEXT, slug TEXT, category_id INTEGER, subcategory TEXT,
    area_id INTEGER, description TEXT, phone TEXT, whatsapp TEXT, address TEXT,
    rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, price_level INTEGER DEFAULT 2,
    emoji TEXT, color1 TEXT, color2 TEXT, cover_url TEXT, open_min INTEGER DEFAULT 540, close_min INTEGER DEFAULT 1290,
    verification_status TEXT DEFAULT 'verified', status TEXT DEFAULT 'approved', plan_id INTEGER DEFAULT 1,
    featured INTEGER DEFAULT 0, payment_methods TEXT DEFAULT 'cash', upi_id TEXT, created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY, business_id INTEGER, name TEXT, name_ml TEXT, description TEXT,
    price REAL, mrp REAL, emoji TEXT, image_url TEXT, promo_label TEXT, unit TEXT, stock_status TEXT DEFAULT 'in_stock', sort INTEGER DEFAULT 0 );

  CREATE TABLE IF NOT EXISTS services(
    id INTEGER PRIMARY KEY, business_id INTEGER, category_id INTEGER, name TEXT, description TEXT,
    starting_price REAL, pricing_type TEXT DEFAULT 'starting_from', emoji TEXT, rating REAL DEFAULT 4.6, available INTEGER DEFAULT 1 );

  CREATE TABLE IF NOT EXISTS workers(
    id INTEGER PRIMARY KEY, name TEXT, category_id INTEGER, area_id INTEGER, skills TEXT,
    experience_years INTEGER, rate TEXT, phone TEXT, whatsapp TEXT, rating REAL DEFAULT 4.6,
    review_count INTEGER DEFAULT 0, available INTEGER DEFAULT 1, emoji TEXT, color1 TEXT, color2 TEXT );

  CREATE TABLE IF NOT EXISTS drivers(
    id INTEGER PRIMARY KEY, name TEXT, service_type TEXT, vehicle_model TEXT, vehicle_number TEXT,
    area_id INTEGER, fare_note TEXT, phone TEXT, whatsapp TEXT, rating REAL DEFAULT 4.7, available INTEGER DEFAULT 1, emoji TEXT );

  CREATE TABLE IF NOT EXISTS offers(
    id INTEGER PRIMARY KEY, business_id INTEGER, title TEXT, description TEXT, discount_label TEXT, code TEXT,
    color1 TEXT, color2 TEXT, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active' );

  CREATE TABLE IF NOT EXISTS news(
    id INTEGER PRIMARY KEY, title TEXT, summary TEXT, body TEXT, category TEXT, emoji TEXT,
    color1 TEXT, color2 TEXT, area_id INTEGER, published_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'published' );

  CREATE TABLE IF NOT EXISTS events(
    id INTEGER PRIMARY KEY, title TEXT, description TEXT, venue TEXT, area_id INTEGER, emoji TEXT,
    color1 TEXT, color2 TEXT, start_date TEXT, time_label TEXT, organizer TEXT, contact TEXT );

  CREATE TABLE IF NOT EXISTS local_info(
    id INTEGER PRIMARY KEY, category TEXT, name TEXT, description TEXT, phone TEXT, address TEXT,
    area_id INTEGER, emergency INTEGER DEFAULT 0, hours TEXT, emoji TEXT );

  CREATE TABLE IF NOT EXISTS reviews(
    id INTEGER PRIMARY KEY, business_id INTEGER, user_id INTEGER, author_name TEXT, rating INTEGER,
    comment TEXT, status TEXT DEFAULT 'published', created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY, customer_id INTEGER, business_id INTEGER, status TEXT DEFAULT 'pending',
    total REAL, item_summary TEXT, payment_method TEXT DEFAULT 'cod', created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS enquiries(
    id INTEGER PRIMARY KEY, customer_id INTEGER, business_id INTEGER, customer_name TEXT, message TEXT,
    status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS subscription_plans(
    id INTEGER PRIMARY KEY, name TEXT, price REAL, period TEXT, tagline TEXT, features TEXT, sort INTEGER, popular INTEGER DEFAULT 0 );

  CREATE TABLE IF NOT EXISTS notifications(
    id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT, title TEXT, body TEXT, read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS saved_items(
    id INTEGER PRIMARY KEY, user_id INTEGER, entity_type TEXT, entity_id INTEGER,
    UNIQUE(user_id, entity_type, entity_id) );

  CREATE TABLE IF NOT EXISTS chat_messages(
    id INTEGER PRIMARY KEY, business_id INTEGER, user_id INTEGER, sender TEXT,
    body TEXT, read_by_user INTEGER DEFAULT 0, read_by_partner INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS leads(
    id INTEGER PRIMARY KEY, type TEXT DEFAULT 'search', user_id INTEGER, user_name TEXT, user_phone TEXT,
    category_id INTEGER, area_id INTEGER, query TEXT, message TEXT, budget TEXT, status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now')) );
  CREATE TABLE IF NOT EXISTS lead_claims(
    id INTEGER PRIMARY KEY, lead_id INTEGER, partner_id INTEGER, business_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')), UNIQUE(lead_id, partner_id) );

  CREATE TABLE IF NOT EXISTS advertisements(
    id INTEGER PRIMARY KEY, title TEXT, image_url TEXT, placement TEXT DEFAULT 'home_banner',
    business_id INTEGER, target_url TEXT, start_date TEXT, end_date TEXT,
    impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')) );

  CREATE TABLE IF NOT EXISTS settings( key TEXT PRIMARY KEY, value TEXT );

  CREATE INDEX IF NOT EXISTS idx_chat ON chat_messages(business_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_leads_cat ON leads(category_id);
  CREATE INDEX IF NOT EXISTS idx_biz_cat ON businesses(category_id);
  CREATE INDEX IF NOT EXISTS idx_biz_area ON businesses(area_id);
  CREATE INDEX IF NOT EXISTS idx_prod_biz ON products(business_id);
  CREATE INDEX IF NOT EXISTS idx_off_biz ON offers(business_id);
  `);
}

// Add columns to existing databases without wiping data (idempotent).
function migrate() {
  const add = (t, c, def) => { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); } catch (e) {} };
  add('products', 'image_url', 'TEXT');
  add('products', 'promo_label', 'TEXT');
  add('businesses', 'cover_url', 'TEXT');
  add('offers', 'code', 'TEXT');
  add('orders', 'payment_method', "TEXT DEFAULT 'cod'");
  add('orders', 'items_json', 'TEXT');
  add('businesses', 'payment_methods', "TEXT DEFAULT 'cash'");
  add('businesses', 'upi_id', 'TEXT');
}

export function seed({ force = false } = {}) {
  schema();
  migrate();
  const count = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (count > 0 && !force) return;
  if (force) {
    for (const t of ['users','districts','panchayaths','areas','categories','businesses','products','services','workers','drivers','offers','news','events','local_info','reviews','orders','enquiries','subscription_plans','notifications','saved_items','advertisements','settings','chat_messages','leads','lead_claims'])
      db.exec(`DELETE FROM ${t}`);
  }

  const tx = db.transaction(() => {
    // Location hierarchy
    db.prepare('INSERT INTO districts(id,name,state) VALUES (1,?,?)').run('Kozhikode', 'Kerala');
    const panch = [
      [1,1,'Kunnamangalam','Panchayath'],[2,1,'Kozhikode Corporation','Municipality'],
      [3,1,'Mavoor','Panchayath'],[4,1,'Thamarassery','Panchayath'],
      [5,1,'Feroke','Municipality'],[6,1,'Koyilandy','Municipality'],
    ];
    const pStmt = db.prepare('INSERT INTO panchayaths(id,district_id,name,type) VALUES (?,?,?,?)');
    panch.forEach(p => pStmt.run(...p));
    const areas = [
      [1,1,'Kunnamangalam',11.3178,75.8897],[2,1,'Manassery',11.34,75.90],[3,1,'Karanthur',11.30,75.86],
      [11,1,'Inapura',11.3260,75.8720],[12,1,'Chelavur',11.3050,75.8420],[13,1,'Vengeri',11.2960,75.8180],
      [16,1,'Engapuzha',11.3520,75.9080],
      [4,2,'Mananchira',11.2489,75.7803],[5,2,'Mavoor Road',11.26,75.79],[6,2,'Palayam',11.25,75.78],
      [14,2,'Nadakkavu',11.2720,75.7850],[15,2,'Vellimadukunnu',11.2890,75.8050],
      [7,3,'Mavoor',11.28,75.92],[8,4,'Thamarassery',11.41,75.93],[9,5,'Feroke',11.18,75.84],[10,6,'Koyilandy',11.44,75.70],
    ];
    const aStmt = db.prepare('INSERT INTO areas(id,panchayath_id,name,lat,lng) VALUES (?,?,?,?,?)');
    areas.forEach(a => aStmt.run(...a));

    // Categories
    // Refined, muted, harmonious palette (premium — not a saturated rainbow)
    const cats = [
      [1,'food-grocery','Food & Grocery','ഭക്ഷണം & പലവ്യഞ്ജനം','🍽️','#12A594','#0C7A6E','business',1],
      [2,'shopping','Shopping','ഷോപ്പിംഗ്','🛍️','#D9876A','#B4623F','business',2],
      [3,'services','Services','സേവനങ്ങൾ','🛠️','#6B70C4','#4A4F9E','business',3],
      [4,'workers','Workers','തൊഴിലാളികൾ','👷','#C99742','#A2761F','worker',4],
      [5,'transport','Transport','ഗതാഗതം','🚕','#4E93C9','#2F6E9E','driver',5],
      [6,'healthcare','Healthcare','ആരോഗ്യം','⚕️','#C56A86','#9C4A66','business',6],
      [7,'local-info','Local Info','പ്രാദേശിക വിവരം','🏛️','#4FA58F','#2E7A68','info',7],
      [8,'news','News','വാർത്ത','📰','#8A7BC0','#63549C','content',8],
      [9,'events','Events','പരിപാടികൾ','🎉','#CE6C6C','#A6474F','content',9],
      [10,'classifieds','Classifieds','ക്ലാസിഫൈഡ്സ്','🏷️','#6E7C90','#4A5768','content',10],
    ];
    const cStmt = db.prepare('INSERT INTO categories(id,slug,name,name_ml,icon,color1,color2,kind,sort) VALUES (?,?,?,?,?,?,?,?,?)');
    cats.forEach(c => cStmt.run(...c));

    // Users (demo). password for all = "password"
    const hash = bcrypt.hashSync('password', 10);
    const uStmt = db.prepare('INSERT INTO users(id,name,phone,email,password_hash,role,avatar_color,area_id) VALUES (?,?,?,?,?,?,?,?)');
    uStmt.run(1,'Local Link Admin','+919000000001','admin@locallink.app',hash,'super_admin','#0B5A55',4);
    uStmt.run(2,'Ramya Nair','+919000000002','partner@locallink.app',hash,'business_partner','#F97362',1);
    uStmt.run(3,'Mohammed Anan','+919000000003','customer@locallink.app',hash,'customer','#0D9488',1);
    uStmt.run(4,'Suhail K','+919000000004','partner2@locallink.app',hash,'business_partner','#6366F1',4);

    // Businesses  (open_min/close_min in minutes from midnight)
    const B = db.prepare(`INSERT INTO businesses
      (id,owner_id,name,slug,category_id,subcategory,area_id,description,phone,whatsapp,address,rating,review_count,price_level,emoji,color1,color2,open_min,close_min,plan_id,featured)
      VALUES (@id,@owner,@name,@slug,@cat,@sub,@area,@desc,@phone,@wa,@addr,@rating,@rc,@pl,@emoji,@c1,@c2,@om,@cm,@plan,@feat)`);
    const biz = [
      {id:1,owner:2,name:'Paragon Restaurant',slug:'paragon-restaurant',cat:1,sub:'Restaurant',area:4,desc:'Legendary Malabar cuisine since 1939 — famed for its biriyani, seafood and Kozhikode specials.',phone:'+914952761020',wa:'+919000010001',addr:'Kannur Road, Mananchira, Kozhikode',rating:4.7,rc:2140,pl:3,emoji:'🍛',c1:'#0EA5A4',c2:'#0B5A55',om:660,cm:1410,plan:3,feat:1},
      {id:2,owner:2,name:"Zain's Hotel",slug:'zains-hotel',cat:1,sub:'Restaurant',area:1,desc:'Home-style Malabar meals, fresh biriyani and famous pathiri near Kunnamangalam.',phone:'+914952760111',wa:'+919000010002',addr:'NIT Road, Kunnamangalam',rating:4.5,rc:860,pl:2,emoji:'🍗',c1:'#F59E0B',c2:'#D97706',om:600,cm:1350,plan:2,feat:1},
      {id:3,owner:4,name:'Kunnamangalam Bake House',slug:'kmg-bake-house',cat:1,sub:'Bakery',area:1,desc:'Fresh cakes, puffs, and Kerala bakery classics baked every morning.',phone:'+914952760222',wa:'+919000010003',addr:'Bus Stand Road, Kunnamangalam',rating:4.6,rc:512,pl:2,emoji:'🧁',c1:'#EC4899',c2:'#BE185D',om:420,cm:1320,plan:2,feat:0},
      {id:4,owner:4,name:'Fresh Basket Supermarket',slug:'fresh-basket',cat:1,sub:'Grocery',area:1,desc:'Daily groceries, provisions and household essentials with home delivery.',phone:'+914952760333',wa:'+919000010004',addr:'Manassery Road, Kunnamangalam',rating:4.4,rc:388,pl:2,emoji:'🛒',c1:'#0EA5A4',c2:'#0369A1',om:480,cm:1320,plan:3,feat:1},
      {id:5,owner:4,name:'Calicut Fresh Meat & Seafood',slug:'calicut-fresh-meat',cat:1,sub:'Meat & Seafood',area:3,desc:'Fresh chicken, mutton and the day’s catch from Beypore harbour.',phone:'+914952760444',wa:'+919000010005',addr:'Karanthur Junction',rating:4.3,rc:210,pl:2,emoji:'🐟',c1:'#0891B2',c2:'#155E75',om:420,cm:1260,plan:1,feat:0},
      {id:6,owner:4,name:'Green Valley Vegetables',slug:'green-valley-veg',cat:1,sub:'Fruits & Vegetables',area:2,desc:'Farm-fresh vegetables and fruits sourced from local Wayanad farms.',phone:'+914952760555',wa:'+919000010006',addr:'Manassery',rating:4.5,rc:176,pl:1,emoji:'🥬',c1:'#22C55E',c2:'#15803D',om:390,cm:1230,plan:1,feat:0},
      {id:7,owner:4,name:'Malabar Gold & Diamonds',slug:'malabar-gold',cat:2,sub:'Jewellery',area:4,desc:'Trusted gold and diamond jewellery with BIS-hallmarked designs.',phone:'+914952761777',wa:'+919000010007',addr:'Mittai Theruvu (SM Street), Kozhikode',rating:4.8,rc:1320,pl:3,emoji:'💎',c1:'#F59E0B',c2:'#B45309',om:600,cm:1290,plan:3,feat:1},
      {id:8,owner:4,name:'Style Hub Fashion',slug:'style-hub',cat:2,sub:'Clothing',area:1,desc:'Latest men’s, women’s and kids’ fashion at everyday prices.',phone:'+914952760888',wa:'+919000010008',addr:'Kunnamangalam Town',rating:4.2,rc:264,pl:2,emoji:'👗',c1:'#F97362',c2:'#E14B36',om:600,cm:1290,plan:2,feat:0},
      {id:9,owner:4,name:'Digital World Electronics',slug:'digital-world',cat:2,sub:'Electronics',area:5,desc:'Mobiles, laptops, home appliances with genuine warranty and EMI options.',phone:'+914952760999',wa:'+919000010009',addr:'Mavoor Road, Kozhikode',rating:4.4,rc:430,pl:3,emoji:'📱',c1:'#6366F1',c2:'#4338CA',om:600,cm:1290,plan:2,feat:0},
      {id:10,owner:4,name:'Kunnamangalam Pharmacy',slug:'kmg-pharmacy',cat:6,sub:'Pharmacy',area:1,desc:'24x7 pharmacy with home delivery of medicines and health essentials.',phone:'+914952760100',wa:'+919000010010',addr:'Near Govt Hospital, Kunnamangalam',rating:4.6,rc:298,pl:2,emoji:'💊',c1:'#EC4899',c2:'#BE185D',om:0,cm:1439,plan:2,feat:0},
      {id:11,owner:4,name:'CoolCare AC & Appliance Service',slug:'coolcare-ac',cat:3,sub:'AC Repair',area:1,desc:'Doorstep AC, fridge and washing-machine service by certified technicians.',phone:'+914952760121',wa:'+919000010011',addr:'Kunnamangalam',rating:4.7,rc:186,pl:2,emoji:'❄️',c1:'#0EA5E9',c2:'#0369A1',om:480,cm:1200,plan:3,feat:1},
      {id:12,owner:4,name:'SparkFix Electricals',slug:'sparkfix',cat:3,sub:'Electrician',area:2,desc:'Wiring, repairs and electrical fittings — same-day service across Kunnamangalam.',phone:'+914952760131',wa:'+919000010012',addr:'Manassery',rating:4.5,rc:142,pl:2,emoji:'⚡',c1:'#F59E0B',c2:'#D97706',om:480,cm:1170,plan:1,feat:0},
      {id:13,owner:4,name:"Baby's Beauty Lounge",slug:'babys-beauty',cat:3,sub:'Salon',area:1,desc:'Ladies’ salon and bridal makeup studio with expert stylists.',phone:'+914952760141',wa:'+919000010013',addr:'Kunnamangalam Town',rating:4.6,rc:210,pl:2,emoji:'💇',c1:'#EC4899',c2:'#9D174D',om:540,cm:1200,plan:2,feat:0},
      {id:14,owner:4,name:'Highness Auto Care',slug:'highness-auto',cat:3,sub:'Automotive',area:3,desc:'Car service, wash and denting-painting with genuine spare parts.',phone:'+914952760151',wa:'+919000010014',addr:'Karanthur',rating:4.4,rc:98,pl:2,emoji:'🔧',c1:'#64748B',c2:'#334155',om:540,cm:1140,plan:1,feat:0},
      // ---- Inapura ----
      {id:15,owner:4,name:'Inapura Family Restaurant',slug:'inapura-family-restaurant',cat:1,sub:'Restaurant',area:11,desc:'Family dining with Malabar biriyani, meals and fresh juices at Inapura.',phone:'+914952762101',wa:'+919000010015',addr:'Inapura Junction, Kunnamangalam',rating:4.4,rc:184,pl:2,emoji:'🍚',c1:'#0EA5A4',c2:'#0B7A73',om:600,cm:1380,plan:2,feat:1},
      {id:16,owner:4,name:'Inapura Super Market',slug:'inapura-supermarket',cat:1,sub:'Grocery',area:11,desc:'Neighbourhood supermarket for provisions, dairy and daily needs at Inapura.',phone:'+914952762102',wa:'+919000010016',addr:'Inapura, Kunnamangalam',rating:4.3,rc:126,pl:2,emoji:'🛒',c1:'#0369A1',c2:'#0EA5A4',om:450,cm:1320,plan:1,feat:0},
      {id:17,owner:4,name:'Inapura Medicals',slug:'inapura-medicals',cat:6,sub:'Pharmacy',area:11,desc:'Pharmacy and health essentials with quick delivery around Inapura.',phone:'+914952762103',wa:'+919000010017',addr:'Inapura, Kunnamangalam',rating:4.5,rc:88,pl:2,emoji:'💊',c1:'#EC4899',c2:'#BE185D',om:420,cm:1380,plan:1,feat:0},
      {id:18,owner:4,name:'Al Salam Bakes Inapura',slug:'al-salam-inapura',cat:1,sub:'Bakery',area:11,desc:'Fresh bakes, snacks and tea-time favourites at Inapura.',phone:'+914952762104',wa:'+919000010018',addr:'Inapura, Kunnamangalam',rating:4.2,rc:64,pl:1,emoji:'🥐',c1:'#F59E0B',c2:'#D97706',om:360,cm:1290,plan:1,feat:0},
      // ---- Chelavur / Vengeri / Nadakkavu / Vellimadukunnu ----
      {id:19,owner:4,name:'Chelavur Hypermarket',slug:'chelavur-hypermarket',cat:1,sub:'Grocery',area:12,desc:'Large hypermarket with groceries, home & kitchen and fresh produce.',phone:'+914952762201',wa:'+919000010019',addr:'Chelavur, Kozhikode',rating:4.4,rc:302,pl:2,emoji:'🏬',c1:'#0EA5A4',c2:'#0369A1',om:480,cm:1320,plan:3,feat:1},
      {id:20,owner:4,name:'Vengeri Hardware & Paints',slug:'vengeri-hardware',cat:2,sub:'Hardware',area:13,desc:'Hardware, tools, paints and building materials for home & site.',phone:'+914952762202',wa:'+919000010020',addr:'Vengeri, Kozhikode',rating:4.3,rc:74,pl:2,emoji:'🔩',c1:'#64748B',c2:'#334155',om:510,cm:1170,plan:1,feat:0},
      {id:21,owner:4,name:'Nadakkavu Fashion Mall',slug:'nadakkavu-fashion',cat:2,sub:'Clothing',area:14,desc:'Trendy apparel and footwear for the whole family at Nadakkavu.',phone:'+914952762203',wa:'+919000010021',addr:'Nadakkavu, Kozhikode',rating:4.5,rc:410,pl:3,emoji:'🧥',c1:'#F97362',c2:'#E14B36',om:600,cm:1290,plan:2,feat:1},
      {id:22,owner:4,name:'Vellimadukunnu Dental Clinic',slug:'vmk-dental',cat:6,sub:'Clinic',area:15,desc:'Modern dental care — cleaning, fillings, and cosmetic dentistry.',phone:'+914952762204',wa:'+919000010022',addr:'Vellimadukunnu, Kozhikode',rating:4.7,rc:132,pl:2,emoji:'🦷',c1:'#0EA5E9',c2:'#0369A1',om:540,cm:1200,plan:1,feat:0},
      {id:23,owner:4,name:'Sagar Hotel Nadakkavu',slug:'sagar-hotel',cat:1,sub:'Restaurant',area:14,desc:'North Indian, Chinese and Kerala dishes — a Nadakkavu favourite.',phone:'+914952762205',wa:'+919000010023',addr:'Nadakkavu, Kozhikode',rating:4.4,rc:560,pl:2,emoji:'🍲',c1:'#F59E0B',c2:'#B45309',om:660,cm:1380,plan:2,feat:0},
      {id:24,owner:4,name:'Chelavur Tyres & Auto',slug:'chelavur-tyres',cat:3,sub:'Automotive',area:12,desc:'Tyres, batteries, wheel alignment and quick car care.',phone:'+914952762206',wa:'+919000010024',addr:'Chelavur, Kozhikode',rating:4.3,rc:56,pl:2,emoji:'🛞',c1:'#334155',c2:'#0F172A',om:510,cm:1140,plan:1,feat:0},
      // ---- Engapuzha (Iyyengapuzha) ----
      {id:25,owner:4,name:'Engapuzha Family Restaurant',slug:'engapuzha-family-restaurant',cat:1,sub:'Restaurant',area:16,desc:'Malabar meals, biriyani and fresh porotta at Engapuzha town.',phone:'+914952763101',wa:'+919000010025',addr:'Engapuzha Town, Kunnamangalam',rating:4.5,rc:212,pl:2,emoji:'🍛',c1:'#0EA5A4',c2:'#0B5A55',om:600,cm:1380,plan:2,feat:1},
      {id:26,owner:4,name:'Engapuzha Super Market',slug:'engapuzha-supermarket',cat:1,sub:'Grocery',area:16,desc:'Groceries, provisions and daily needs with home delivery in Engapuzha.',phone:'+914952763102',wa:'+919000010026',addr:'Engapuzha, Kunnamangalam',rating:4.4,rc:148,pl:2,emoji:'🛒',c1:'#0369A1',c2:'#0EA5A4',om:450,cm:1320,plan:2,feat:1},
      {id:27,owner:4,name:'Engapuzha Medicals',slug:'engapuzha-medicals',cat:6,sub:'Pharmacy',area:16,desc:'Pharmacy and health essentials serving Engapuzha and nearby.',phone:'+914952763103',wa:'+919000010027',addr:'Engapuzha, Kunnamangalam',rating:4.6,rc:96,pl:2,emoji:'💊',c1:'#EC4899',c2:'#BE185D',om:420,cm:1380,plan:1,feat:0},
      {id:28,owner:4,name:'Engapuzha Hardware & Paints',slug:'engapuzha-hardware',cat:2,sub:'Hardware',area:16,desc:'Hardware, tools, paints and building materials at Engapuzha.',phone:'+914952763104',wa:'+919000010028',addr:'Engapuzha, Kunnamangalam',rating:4.3,rc:52,pl:2,emoji:'🔩',c1:'#64748B',c2:'#334155',om:510,cm:1170,plan:1,feat:0},
      {id:29,owner:4,name:'Green Leaf Bakery Engapuzha',slug:'greenleaf-bakery-engapuzha',cat:1,sub:'Bakery',area:16,desc:'Fresh cakes, snacks and tea-time bakes in Engapuzha.',phone:'+914952763105',wa:'+919000010029',addr:'Engapuzha, Kunnamangalam',rating:4.4,rc:78,pl:1,emoji:'🧁',c1:'#EC4899',c2:'#9D174D',om:360,cm:1290,plan:1,feat:0},
    ];
    biz.forEach(b => B.run(b));

    // Demo payment methods + UPI per business (partners can edit these in their portal)
    const setPay = db.prepare('UPDATE businesses SET payment_methods=?, upi_id=? WHERE id=?');
    setPay.run('cash,card,upi', 'paragon@okhdfc', 1);
    setPay.run('cash,upi', 'zains@oksbi', 2);
    setPay.run('cash,card,upi', 'kmgbake@okicici', 3);
    setPay.run('cash,card,upi', 'freshbasket@okaxis', 4);
    setPay.run('cash,upi', 'digitalworld@okhdfc', 9);
    // everyone else keeps the default 'cash'
    // (plan tiers are set later, after products are seeded)

    // Business hours summary handled via open_min/close_min; add reviews
    const R = db.prepare('INSERT INTO reviews(business_id,user_id,author_name,rating,comment,created_at) VALUES (?,?,?,?,?,?)');
    const reviews = [
      [1,3,'Mohammed Anan',5,'Best biriyani in Kozhikode, hands down. The mutton was perfect.', "datetime('now','-2 days')"],
      [1,null,'Fathima R',5,'Fish curry and pathiri were amazing. Always crowded for a reason.', "datetime('now','-6 days')"],
      [1,null,'Vishnu P',4,'Great food but expect a wait during dinner time.', "datetime('now','-12 days')"],
      [2,null,'Aparna',5,'Zain’s biriyani near NIT is my go-to. Quick and tasty.', "datetime('now','-3 days')"],
      [4,3,'Mohammed Anan',4,'Fresh Basket delivery is reliable. Good vegetable quality.', "datetime('now','-1 days')"],
      [11,null,'Sajith',5,'CoolCare fixed my AC same day. Very professional.', "datetime('now','-4 days')"],
    ];
    reviews.forEach(r => db.prepare(`INSERT INTO reviews(business_id,user_id,author_name,rating,comment,created_at) VALUES (?,?,?,?,?,${r[5]})`).run(r[0],r[1],r[2],r[3],r[4]));

    // Products — real catalogue with photos.
    // Photos are fetched live by keyword (stable per seed) so every listing shows a
    // real product image; partners can replace image_url with their own product photo.
    const pic = (kw, seed, w = 640, h = 520) => photoFor(kw, seed, w, h);
    const P = db.prepare('INSERT INTO products(business_id,name,name_ml,description,price,mrp,emoji,image_url,unit,stock_status,sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    // [business_id, name, name_ml, description, price, mrp, emoji, unit, stock, sort, photo-keywords]
    const prods = [
      // Paragon Restaurant (1) — full Malabar menu
      [1,'Mutton Biriyani','മട്ടൻ ബിരിയാണി','Slow-cooked Malabar mutton dum biriyani',320,360,'🍛','plate','in_stock',1,'mutton,biryani,rice'],
      [1,'Chicken Biriyani','ചിക്കൻ ബിരിയാണി','Signature Kozhikode chicken biriyani',210,240,'🍗','plate','in_stock',2,'chicken,biryani'],
      [1,'Fish Biriyani','','Fresh seer-fish biriyani',260,290,'🐟','plate','in_stock',3,'fish,biryani,rice'],
      [1,'Fish Pollichathu','','Pearl spot grilled in banana leaf',280,null,'🐟','plate','in_stock',4,'grilled,fish,kerala'],
      [1,'Prawns Roast','','Malabar-style prawns roast',290,null,'🦐','plate','in_stock',5,'prawns,roast,curry'],
      [1,'Malabar Porotta','','Flaky layered porotta',18,null,'🫓','piece','in_stock',6,'paratha,bread'],
      [1,'Kozhikodan Halwa','','Classic sweet Kozhikode halwa',120,null,'🍮','250g','in_stock',7,'halwa,indian,sweet'],
      [1,'Sulaimani Chai','','Spiced black lemon tea',20,null,'🍵','glass','in_stock',8,'black,tea,glass'],
      // Zain's Hotel (2)
      [2,'Chicken Biriyani','','Home-style chicken biriyani',180,200,'🍗','plate','in_stock',1,'chicken,biryani'],
      [2,'Al Faham (Half)','','Charcoal-grilled arabian chicken',260,null,'🍗','half','in_stock',2,'grilled,chicken,arabic'],
      [2,'Chicken Mandi','','Yemeni-style mandi rice',240,null,'🍚','plate','in_stock',3,'mandi,rice,chicken'],
      [2,'Kuboos & Curry','','Arabic bread with chicken curry',120,null,'🫓','set','in_stock',4,'pita,bread,curry'],
      [2,'Beef Ularthiyathu','','Kerala dry beef fry',220,null,'🥩','plate','in_stock',5,'beef,fry,kerala'],
      // KMG Bake House (3)
      [3,'Fresh Cream Cake','','1kg vanilla cream cake',650,750,'🎂','1kg','in_stock',1,'cream,cake'],
      [3,'Black Forest Cake','','Chocolate & cherry, 1kg',700,800,'🍰','1kg','in_stock',2,'black,forest,cake'],
      [3,'Chicken Puff','','Flaky bakery chicken puff',25,null,'🥟','piece','in_stock',3,'puff,pastry'],
      [3,'Dilkush','','Sweet coconut bun',30,null,'🍞','piece','in_stock',4,'coconut,bun,bakery'],
      [3,'Plum Cake','','Kerala Christmas plum cake',180,null,'🍰','500g','in_stock',5,'plum,cake,fruit'],
      // Fresh Basket Supermarket (4)
      [4,'Basmati Rice 5kg','','India Gate premium basmati',560,620,'🍚','5kg','in_stock',1,'rice,bag,basmati'],
      [4,'Amul Butter 500g','','Salted table butter',265,275,'🧈','500g','in_stock',2,'butter,dairy'],
      [4,'Farm Eggs (30)','','Tray of 30 farm eggs',180,null,'🥚','30 pcs','in_stock',3,'eggs,tray'],
      [4,'Sunflower Oil 1L','','Refined cooking oil',140,165,'🛢️','1L','in_stock',4,'cooking,oil,bottle'],
      [4,'Sugar 1kg','','Fine white sugar',48,null,'🧂','1kg','in_stock',5,'sugar,bowl'],
      [4,'Toor Dal 1kg','','Premium toor dal',150,175,'🫘','1kg','in_stock',6,'lentils,dal'],
      [4,'Tea Powder 500g','','Strong Malabar tea dust',245,260,'🍵','500g','in_stock',7,'tea,leaves,powder'],
      [4,'Coconut Oil 1L','','Pure Kerala coconut oil',260,290,'🥥','1L','low_stock',8,'coconut,oil'],
      // Green Valley Vegetables (6)
      [6,'Tomato','','Fresh farm tomatoes',40,55,'🍅','kg','in_stock',1,'tomato,vegetable'],
      [6,'Nendran Banana','','Kerala nendran banana',60,null,'🍌','kg','in_stock',2,'banana,plantain'],
      [6,'Onion','','Nashik red onions',35,45,'🧅','kg','in_stock',3,'onion,vegetable'],
      [6,'Green Chilli','','Fresh green chillies',20,null,'🌶️','250g','in_stock',4,'green,chilli'],
      // Malabar Gold & Diamonds (7)
      [7,'Gold Necklace 22K','','BIS-hallmarked 22K design',148000,null,'📿','piece','in_stock',1,'gold,necklace,jewellery'],
      [7,'Gold Bangles (pair)','','Traditional 22K bangles',96000,null,'💫','pair','in_stock',2,'gold,bangles'],
      [7,'Diamond Ring','','Solitaire diamond ring',52000,null,'💍','piece','in_stock',3,'diamond,ring'],
      [7,'Gold Earrings','','22K jhumka earrings',38000,null,'👂','pair','in_stock',4,'gold,earrings,jewellery'],
      [7,'Bridal Set','','Complete bridal gold set',285000,null,'👰','set','in_stock',5,'bridal,gold,jewellery'],
      // Style Hub Fashion (8)
      [8,"Men's Formal Shirt",'','Cotton slim-fit shirt',899,1299,'👔','piece','in_stock',1,'formal,shirt,men'],
      [8,'Women Kurti','','Printed A-line kurti',749,999,'👗','piece','in_stock',2,'kurti,women,dress'],
      [8,'Kids T-Shirt','','Cotton graphic tee',349,499,'👕','piece','in_stock',3,'kids,tshirt'],
      [8,'Kanchipuram Saree','','Silk blend festive saree',2499,3200,'🥻','piece','in_stock',4,'saree,silk'],
      [8,'Denim Jeans','','Stretch slim-fit jeans',1199,1699,'👖','piece','low_stock',5,'jeans,denim'],
      // Digital World Electronics (9)
      [9,'Samsung Galaxy M15','','5G · 6GB / 128GB',13499,15999,'📱','unit','in_stock',1,'smartphone,phone'],
      [9,'boAt Airdopes','','TWS wireless earbuds',1199,2990,'🎧','unit','low_stock',2,'earbuds,wireless'],
      [9,'Preethi Mixer Grinder','','750W · 3 jars',3499,4200,'🍶','unit','in_stock',3,'mixer,grinder,kitchen'],
      [9,'LED TV 43"','','Full-HD smart LED TV',24999,29999,'📺','unit','in_stock',4,'television,tv'],
      [9,'HP Laptop 15','','Core i5 · 8GB / 512GB SSD',48999,54999,'💻','unit','in_stock',5,'laptop,computer'],
      // Kunnamangalam Pharmacy (10)
      [10,'Paracetamol 500mg','','Strip of 15 tablets',30,null,'💊','strip','in_stock',1,'medicine,tablets'],
      [10,'Hand Sanitizer 500ml','','70% alcohol sanitizer',120,150,'🧴','500ml','in_stock',2,'sanitizer,bottle'],
      [10,'Vitamin C Tablets','','Immunity chewable tablets',180,210,'🍊','bottle','in_stock',3,'vitamin,supplement'],
      [10,'First Aid Kit','','Home first-aid box',450,550,'🩹','box','in_stock',4,'first,aid,kit'],
      // Inapura Family Restaurant (15)
      [15,'Chicken Biriyani','','Inapura special biriyani',170,190,'🍗','plate','in_stock',1,'chicken,biryani'],
      [15,'Kerala Meals','','Unlimited veg sadya meals',110,null,'🍛','plate','in_stock',2,'kerala,meals,sadya'],
      [15,'Porotta & Beef','','2 porotta with beef curry',130,null,'🫓','set','in_stock',3,'paratha,beef,curry'],
      [15,'Fresh Lime Juice','','Cooling nannari lime',40,null,'🍋','glass','in_stock',4,'lime,juice,drink'],
      // Inapura Super Market (16)
      [16,'Matta Rice 10kg','','Kerala red matta rice',680,720,'🍚','10kg','in_stock',1,'rice,bag'],
      [16,'Coconut Oil 1L','','Cold-pressed coconut oil',255,290,'🥥','1L','in_stock',2,'coconut,oil'],
      [16,'Farm Eggs (12)','','Half-tray farm eggs',78,null,'🥚','12 pcs','in_stock',3,'eggs'],
      [16,'Sugar 1kg','','White crystal sugar',48,null,'🧂','1kg','in_stock',4,'sugar'],
      // Chelavur Hypermarket (19)
      [19,'Atta 5kg','','Whole-wheat chakki atta',245,275,'🌾','5kg','in_stock',1,'wheat,flour,atta'],
      [19,'Detergent 4kg','','Surf Excel matic powder',720,860,'🧼','4kg','in_stock',2,'detergent,powder'],
      [19,'Toned Milk 1L','','Milma toned milk',54,null,'🥛','1L','in_stock',3,'milk,carton'],
      [19,'Biscuits Combo','','Assorted biscuit pack',199,240,'🍪','pack','in_stock',4,'biscuits,cookies'],
      // Nadakkavu Fashion Mall (21)
      [21,'Party Wear Gown','','Embroidered evening gown',3499,4500,'👗','piece','in_stock',1,'gown,dress,party'],
      [21,'Men Casual Shoes','','Lightweight sneakers',1799,2400,'👟','pair','in_stock',2,'sneakers,shoes'],
      [21,'Handbag','','Faux-leather tote bag',1299,1799,'👜','piece','low_stock',3,'handbag,bag'],
      // Engapuzha Family Restaurant (25)
      [25,'Mutton Biriyani','','Engapuzha special mutton biriyani',300,340,'🍛','plate','in_stock',1,'mutton,biryani'],
      [25,'Kerala Meals','','Traditional lunch meals',100,null,'🍛','plate','in_stock',2,'kerala,meals'],
      [25,'Porotta & Chicken','','2 porotta with chicken curry',120,null,'🫓','set','in_stock',3,'paratha,chicken,curry'],
      [25,'Ghee Rice','','Fragrant ghee rice',90,null,'🍚','plate','in_stock',4,'ghee,rice'],
      // Engapuzha Super Market (26)
      [26,'Matta Rice 10kg','','Kerala red matta rice',670,710,'🍚','10kg','in_stock',1,'rice,bag'],
      [26,'Sunflower Oil 1L','','Refined cooking oil',138,165,'🛢️','1L','in_stock',2,'cooking,oil'],
      [26,'Farm Eggs (30)','','Tray of 30 eggs',176,null,'🥚','30 pcs','in_stock',3,'eggs,tray'],
      [26,'Tea Powder 500g','','Malabar strong tea',240,260,'🍵','500g','in_stock',4,'tea,powder'],
      [26,'Green Gram 1kg','','Whole moong dal',160,180,'🫘','1kg','in_stock',5,'green,gram,lentils'],
      // Green Leaf Bakery Engapuzha (29)
      [29,'Butter Cake','','Fresh-baked butter cake',220,null,'🍰','500g','in_stock',1,'butter,cake'],
      [29,'Veg Puff','','Crisp vegetable puff',20,null,'🥟','piece','in_stock',2,'puff,pastry'],
      [29,'Cream Bun','','Soft cream-filled bun',35,null,'🍞','piece','in_stock',3,'cream,bun'],
      [29,'Nankhatai','','Traditional shortbread cookies',90,null,'🍪','250g','in_stock',4,'cookies,shortbread'],
    ];
    prods.forEach((p, i) => P.run(p[0],p[1],p[2],p[3],p[4],p[5],p[6], pic(p[10], 100 + i), p[7],p[8],p[9]));

    // Plan tiers: any shop WITH a product catalogue is at least Standard (so its
    // menu shows); a few chosen shops are Premium (promotions + leads + chat);
    // service-only / listing shops stay Basic to demonstrate the listing-only tier.
    db.exec('UPDATE businesses SET plan_id=2 WHERE plan_id<2 AND id IN (SELECT DISTINCT business_id FROM products)');
    db.exec('UPDATE businesses SET plan_id=3 WHERE id IN (1,3,4,9,21)');  // premium demo stores

    // Services
    const S = db.prepare('INSERT INTO services(business_id,category_id,name,description,starting_price,pricing_type,emoji,rating,available) VALUES (?,?,?,?,?,?,?,?,?)');
    const svcs = [
      [11,3,'AC General Service','Deep cleaning & gas check for split/window AC',499,'starting_from','❄️',4.7,1],
      [11,3,'Refrigerator Repair','Diagnosis and repair at your doorstep',350,'starting_from','🧊',4.6,1],
      [12,3,'Electrical Wiring & Repair','Home wiring, switches and fault fixing',300,'starting_from','⚡',4.5,1],
      [13,3,'Bridal Makeup','Complete bridal package with trial',6000,'starting_from','💄',4.8,1],
      [13,3,'Haircut & Styling','Ladies haircut and blow-dry',350,'fixed','💇',4.6,1],
      [14,3,'Car Full Service','Oil change, wash and 30-point check',1800,'starting_from','🔧',4.4,1],
    ];
    svcs.forEach(s => S.run(s));

    // Workers
    const W = db.prepare('INSERT INTO workers(name,category_id,area_id,skills,experience_years,rate,phone,whatsapp,rating,review_count,available,emoji,color1,color2) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const workers = [
      ['Abdul Rahman',4,1,'Masonry, Concrete work, Tile laying',14,'₹1200/day','+919000020001','+919000020001',4.7,64,1,'🧱','#F59E0B','#B45309'],
      ['Suresh Kumar',4,2,'Carpentry, Furniture, Doors & windows',11,'₹1400/day','+919000020002','+919000020002',4.6,41,1,'🪚','#8B5CF6','#6D28D9'],
      ['Ramesh Nair',4,1,'Interior & exterior painting, Putty work',9,'₹1000/day','+919000020003','+919000020003',4.5,33,1,'🎨','#0EA5E9','#0369A1'],
      ['Fathima Beevi',4,3,'Domestic help, Cooking, House cleaning',6,'₹500/day','+919000020004','+919000020004',4.8,52,1,'🧹','#EC4899','#BE185D'],
      ['Anil Das',4,1,'Plumbing, Pipe fitting, Tank cleaning',12,'₹800/visit','+919000020005','+919000020005',4.6,48,0,'🔧','#0EA5A4','#0B5A55'],
      ['Joby Thomas',4,2,'General labour, Loading, Shifting',7,'₹700/day','+919000020006','+919000020006',4.3,19,1,'💪','#64748B','#334155'],
    ];
    workers.forEach(w => W.run(w));

    // Drivers
    const D = db.prepare('INSERT INTO drivers(name,service_type,vehicle_model,vehicle_number,area_id,fare_note,phone,whatsapp,rating,available,emoji) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const drivers = [
      ['Shaji K','auto','Bajaj Auto','KL-11-AC-4521',1,'₹30 base • ₹15/km','+919000030001','+919000030001',4.8,1,'🛺'],
      ['Rajeev Menon','taxi','Toyota Innova','KL-11-P-8890',1,'₹18/km • Airport ₹1200','+919000030002','+919000030002',4.9,1,'🚙'],
      ['Nowfal P','taxi','Maruti Dzire','KL-11-Q-3345',4,'₹14/km • Min ₹150','+919000030003','+919000030003',4.7,1,'🚕'],
      ['Quick Local Courier','delivery','Delivery Bike','KL-11-Z-7712',1,'₹40 within 5km','+919000030004','+919000030004',4.6,1,'📦'],
      ['Basheer Auto','auto','Piaggio Auto','KL-11-AC-1180',2,'₹30 base • ₹15/km','+919000030005','+919000030005',4.5,0,'🛺'],
    ];
    drivers.forEach(d => D.run(d));

    // Offers
    const O = db.prepare('INSERT INTO offers(business_id,title,description,discount_label,code,color1,color2,start_date,end_date) VALUES (?,?,?,?,?,?,?,date(\'now\'),date(\'now\',\'+14 days\'))');
    const offers = [
      [3,'Weekend Cake Fest','Flat 20% off on all 1kg cakes','20% OFF','CAKE20','#C56A86','#8F4761'],
      [1,'Biriyani Combo','Chicken biriyani + drink + halwa','₹249','COMBO249','#12A594','#0C6E64'],
      [4,'Grocery Bonanza','₹100 off on orders above ₹999','₹100 OFF','FRESH100','#3E7FA8','#2C6288'],
      [9,'Gadget Days','Up to 40% off on earbuds & accessories','40% OFF','GADGET40','#6B70C4','#4A4F9E'],
      [8,'Onam Fashion Sale','Buy 2 get 1 free on kurtas','B2G1','ONAM','#D9876A','#B0603E'],
    ];
    offers.forEach(o => O.run(o));

    // News
    const N = db.prepare('INSERT INTO news(title,summary,body,category,emoji,color1,color2,area_id,published_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const news = [
      ['Kunnamangalam Panchayath announces new waste-collection schedule','Door-to-door collection moves to alternate days from next week.','The Kunnamangalam Grama Panchayath has revised the household waste-collection schedule. From Monday, dry and wet waste will be collected on alternate days. Residents are requested to segregate waste and keep it ready by 8 AM.','Government','🗑️','#14B8A6','#0F766E',1,"datetime('now','-1 days')"],
      ['NIT Calicut tech fest Tathva returns this month','Three-day festival to feature workshops, hackathons and cultural nights.','Tathva, the annual technical festival of NIT Calicut in Kunnamangalam, is back with a packed schedule of workshops, a 24-hour hackathon, and star cultural performances. Local visitors are welcome to the exhibition zone.','Education','🎓','#8B5CF6','#6D28D9',1,"datetime('now','-3 days')"],
      ['Road widening work begins on Kunnamangalam–Mavoor route','Expect diversions near Manassery junction over the next two weeks.','The PWD has begun road-widening on the Kunnamangalam–Mavoor stretch. Traffic will be diverted via Karanthur during peak hours. Motorists are advised to plan for delays near Manassery junction.','Local','🚧','#F59E0B','#D97706',1,"datetime('now','-5 days')"],
      ['Free medical camp at Govt Hospital this Sunday','Free check-ups, sugar and BP screening for all residents.','A free medical camp organised by local physicians will be held at the Kunnamangalam Government Hospital this Sunday from 9 AM to 1 PM. Services include general check-ups, blood-sugar and blood-pressure screening.','Community','⚕️','#EC4899','#BE185D',1,"datetime('now','-7 days')"],
    ];
    news.forEach(n => db.prepare(`INSERT INTO news(title,summary,body,category,emoji,color1,color2,area_id,published_at) VALUES (?,?,?,?,?,?,?,?,${n[8]})`).run(n[0],n[1],n[2],n[3],n[4],n[5],n[6],n[7]));

    // Events
    const E = db.prepare('INSERT INTO events(title,description,venue,area_id,emoji,color1,color2,start_date,time_label,organizer,contact) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const events = [
      ['Kunnamangalam Weekly Market','Fresh produce, local crafts and street food every Saturday.','Town Ground, Kunnamangalam',1,'🧺','#22C55E','#15803D',"date('now','+2 days')",'6:00 AM – 12:00 PM','Panchayath','+914952760001'],
      ['Malabar Food Festival','Taste the best of Kozhikode cuisine — 40+ stalls.','Mananchira Square, Kozhikode',4,'🍢','#F97362','#E14B36',"date('now','+6 days')",'4:00 PM – 10:00 PM','Kozhikode Corporation','+914952761000'],
      ['Onam Cultural Evening','Traditional dance, music and pookalam competition.','Community Hall, Karanthur',3,'🌼','#F59E0B','#B45309',"date('now','+10 days')",'5:00 PM onwards','Karanthur Residents Assn.','+919000040001'],
    ];
    events.forEach(e => db.prepare(`INSERT INTO events(title,description,venue,area_id,emoji,color1,color2,start_date,time_label,organizer,contact) VALUES (?,?,?,?,?,?,?,${e[7]},?,?,?)`).run(e[0],e[1],e[2],e[3],e[4],e[5],e[6],e[8],e[9],e[10]));

    // Local info
    const L = db.prepare('INSERT INTO local_info(category,name,description,phone,address,area_id,emergency,hours,emoji) VALUES (?,?,?,?,?,?,?,?,?)');
    const info = [
      ['Emergency','Police Control Room','Kozhikode district police emergency line','100','Kozhikode',4,1,'24x7','🚓'],
      ['Emergency','Ambulance','Free 24x7 ambulance service','108','Kozhikode',4,1,'24x7','🚑'],
      ['Emergency','Fire & Rescue','Fire and rescue services','101','Kozhikode',4,1,'24x7','🚒'],
      ['Emergency','Blood Bank – IMA','Blood bank and donor helpline','+914952723456','Kozhikode Medical College',4,1,'24x7','🩸'],
      ['Government','Kunnamangalam Panchayath Office','Certificates, tax and civic services','+914952760001','Kunnamangalam',1,0,'Mon–Fri 10AM–5PM','🏛️'],
      ['Government','Village Office Kunnamangalam','Land records and revenue services','+914952760002','Kunnamangalam',1,0,'Mon–Fri 10AM–5PM','📋'],
      ['Healthcare','Govt Hospital Kunnamangalam','Government hospital and OP services','+914952760100','Kunnamangalam',1,0,'24x7 Emergency','🏥'],
      ['Bank','SBI Kunnamangalam Branch','Banking and ATM services','+914952760200','Kunnamangalam',1,0,'Mon–Fri 10AM–4PM','🏦'],
      ['Education','Govt Higher Secondary School','Public higher-secondary school','+914952760300','Kunnamangalam',1,0,'Mon–Sat 9AM–4PM','🏫'],
      ['Education','NIT Calicut','National Institute of Technology','+914952286100','Kunnamangalam',1,0,'Campus','🎓'],
    ];
    info.forEach(i => L.run(i));

    // Subscription plans
    const SP = db.prepare('INSERT INTO subscription_plans(id,name,price,period,tagline,features,sort,popular) VALUES (?,?,?,?,?,?,?,?)');
    SP.run(1,'Basic',199,'month','Get discovered locally', JSON.stringify(['Business listing','Company details & address','Phone number view','Map location','Customer reviews']),1,0);
    SP.run(2,'Standard',499,'month','Sell with a full catalogue', JSON.stringify(['Everything in Basic','Add products & services','Online ordering & cart','Customer enquiries','Basic analytics']),2,1);
    SP.run(3,'Premium',1499,'month','Grow with promotions & leads', JSON.stringify(['Everything in Standard','Run promotions (5 / month)','Highlighted & featured listing','Customer leads (10 / month)','Live chat with customers','Priority support']),3,0);

    // Orders & enquiries (partner demo data)
    const OR = db.prepare(`INSERT INTO orders(customer_id,business_id,status,total,item_summary,created_at) VALUES (?,?,?,?,?,?)`);
    [['pending',530,'Mutton Biriyani x1, Chicken Biriyani x1',"datetime('now','-2 hours')"],
     ['preparing',210,'Chicken Biriyani x1',"datetime('now','-5 hours')"],
     ['completed',900,'Fresh Cream Cake x1, Chicken Puff x10',"datetime('now','-1 days')"],
     ['completed',320,'Mutton Biriyani x1',"datetime('now','-2 days')"]]
      .forEach(o => db.prepare(`INSERT INTO orders(customer_id,business_id,status,total,item_summary,created_at) VALUES (3,1,?,?,?,${o[3]})`).run(o[0],o[1],o[2]));

    const EN = db.prepare('INSERT INTO enquiries(customer_id,business_id,customer_name,message,status,created_at) VALUES (?,?,?,?,?,?)');
    [[1,'Do you cater for a 50-person function next Sunday?','new',"datetime('now','-1 hours')"],
     [1,'Is the mutton biriyani available for parcel now?','responded',"datetime('now','-4 hours')"],
     [11,'AC not cooling, can a technician come today evening?','new',"datetime('now','-3 hours')"]]
      .forEach(e => db.prepare(`INSERT INTO enquiries(customer_id,business_id,customer_name,message,status,created_at) VALUES (3,?,'Mohammed Anan',?,?,${e[3]})`).run(e[0],e[1],e[2]));

    // Notifications for customer
    const NT = db.prepare('INSERT INTO notifications(user_id,type,title,body,read,created_at) VALUES (?,?,?,?,?,?)');
    [['order','Order confirmed','Paragon Restaurant accepted your order #1001.',0,"datetime('now','-2 hours')"],
     ['offer','New offer near you','Kunnamangalam Bake House: 20% off all cakes this weekend.',0,"datetime('now','-1 days')"],
     ['news','Local announcement','New waste-collection schedule in Kunnamangalam.',1,"datetime('now','-1 days')"],
     ['event','Event tomorrow','Kunnamangalam Weekly Market starts 6 AM.',1,"datetime('now','-6 hours')"]]
      .forEach(n => db.prepare(`INSERT INTO notifications(user_id,type,title,body,read,created_at) VALUES (3,?,?,?,?,${n[4]})`).run(n[0],n[1],n[2],n[3]));

    // Demo chat thread (customer 3 ↔ premium business Paragon #1)
    const cm=(b,u,s,body,ru,rp,when)=>db.prepare(`INSERT INTO chat_messages(business_id,user_id,sender,body,read_by_user,read_by_partner,created_at) VALUES (?,?,?,?,?,?,${when})`).run(b,u,s,body,ru,rp);
    cm(1,3,'user','Hi, do you deliver mutton biriyani to Kunnamangalam?',1,1,"datetime('now','-3 hours')");
    cm(1,3,'partner','Yes! We deliver across Kunnamangalam. Delivery takes about 40 minutes.',1,1,"datetime('now','-3 hours','+5 minutes')");
    cm(1,3,'user','Great, is the family pack available today?',1,0,"datetime('now','-2 hours')");

    // Demo leads (bulk requirements + searches from logged-in customer)
    const ld=(type,cat,area,query,message,budget,when)=>db.prepare(`INSERT INTO leads(type,user_id,user_name,user_phone,category_id,area_id,query,message,budget,status,created_at) VALUES (?,3,'Mohammed Anan','+919000000003',?,?,?,?,?,'new',${when})`).run(type,cat,area,query,message,budget);
    ld('bulk',1,1,'Bulk biriyani for event','Need 100 chicken biriyani plates for a wedding on Sunday. Please share best rate.','₹15,000–20,000',"datetime('now','-5 hours')");
    ld('bulk',2,4,'Corporate gifting','Looking for 50 gift hampers for Onam. Need delivery to office.','₹25,000',"datetime('now','-1 days')");
    ld('search',1,1,'wedding cake 3kg',null,null,"datetime('now','-2 hours')");

    // Platform settings (defaults)
    const SET = db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)');
    Object.entries({
      platform_name: 'Local Link',
      tagline: 'Everything Local. One Place.',
      city: 'Kozhikode, Kerala',
      support_email: 'hello@locallink.app',
      support_phone: '+91 90000 00000',
      default_language: 'en',
      currency: '₹',
      allow_signups: '1',
      require_verification: '1',
      enable_chat: '1',
      enable_leads: '1',
      leads_per_month: '10',
      promos_per_month: '5',
    }).forEach(([k,v]) => SET.run(k, v));

    // Demo advertisements (dates interpolated into SQL so they evaluate, not stored as text)
    const ad = (title,placement,biz,start,end,imp,clk,status)=>db.prepare(
      `INSERT INTO advertisements(title,image_url,placement,business_id,target_url,start_date,end_date,impressions,clicks,status,created_at)
       VALUES (?,'',?,?,'',${start},${end},?,?,?,datetime('now'))`).run(title,placement,biz,imp,clk,status);
    ad('Onam Mega Sale — up to 50% off','home_banner',1,"date('now','-3 days')","date('now','+10 days')",4210,318,'active');
    ad('Fresh groceries delivered in 30 min','home_banner',3,"date('now','-1 days')","date('now','+20 days')",2870,196,'active');
    ad('List your business free this month','search_top',null,"date('now','-6 days')","date('now','+2 days')",1540,88,'active');
    ad('Diwali specials (ended)','home_banner',4,"date('now','-40 days')","date('now','-20 days')",9800,720,'expired');
  });
  tx();
  console.log('✅ Seeded Local Link database:', DB_FILE);
}

// CLI: node src/db.js --seed  (force reseed)
if (process.argv[1] && process.argv[1].endsWith('db.js')) {
  seed({ force: process.argv.includes('--seed') });
  console.log('Done.');
}
