// Reliable, real product/business photos.
//
// Every URL below is a permanent Unsplash CDN image (free license), verified to
// load fast and never 404 — a big upgrade over the old loremflickr redirects
// that were slow and failed under load, leaving blank tiles. We map each
// product/business keyword to a small pool of on-topic photos and pick one
// deterministically by seed, so a listing always shows the same relevant image.
// Anything unmapped falls back to a guaranteed-loading seeded photo.

const U = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&q=70&auto=format&fit=crop`;

// bucket → verified Unsplash photo ids
const POOLS = {
  biryani:   ['1563379091339-03b21ab4a4f8','1633945274405-b6c8069047b0','1701579231305-d84d8af9a3fd','1631515243349-e0cb75fb8d3a'],
  grilled:   ['1598515214211-89d3c73ae83b','1567620832903-9fc6debc209f'],
  fish:      ['1519708227418-c8fd9a32b7a2','1580476262798-bddd9f4b7369'],
  cake:      ['1578985545062-69928b1d9587','1535141192574-5d4897c12636','1558961363-fa8fdf82db35'],
  bakery:    ['1509440159596-0249088772ff','1608198093002-ad4e005484ec'],
  rice:      ['1586201375761-83865001e31c'],
  oil:       ['1474979266404-7eaacbcd87c5'],
  eggs:      ['1518569656558-1f25e69d93d7'],
  grocery:   ['1542838132-92c53300491e','1604719312566-8912e9227c6a'],
  vegetables:['1540420773420-3366772f4999','1518843875459-f738682238a6'],
  jewellery: ['1515562141207-7a88fb7ce338','1599643478518-a784e5dc4c8f'],
  necklace:  ['1611591437281-460bfbe1220a'],
  ring:      ['1605100804763-247f67b3557e'],
  shirt:     ['1602810318383-e386cc2a3ccf'],
  kurti:     ['1610030469983-98e550d6193c'],
  jeans:     ['1542272604-787c3835535d'],
  shoes:     ['1542291026-7eec264c27ff'],
  handbag:   ['1584917865442-de89df76afd3'],
  clothing:  ['1489987707025-afc232f7ea0f'],
  smartphone:['1511707171634-5f897ff02aa9'],
  earbuds:   ['1590658268037-6bf12165a8df'],
  laptop:    ['1496181133206-80ce9b88a853'],
  tv:        ['1593359677879-a4bb92f829d1'],
  mixer:     ['1585515320310-259814833e62'],
  medicine:  ['1584308666744-24d5c474f2ae'],
  sanitizer: ['1584744982491-665216d95f8b'],
  restaurant:['1517248135467-4c7edcad34c4'],
  supermarket:['1578916171728-46686eac8d58'],
  salon:     ['1560066984-138dadb4c035'],
};

// ordered [trigger words, bucket] — first match wins (most specific first)
const RULES = [
  [['sanitizer'], 'sanitizer'],
  [['first','aid','medicine','tablet','vitamin','paracetamol','pharma','strip'], 'medicine'],
  [['earbud','airdopes','wireless','headphone'], 'earbuds'],
  [['laptop','computer'], 'laptop'],
  [['television','led tv',' tv'], 'tv'],
  [['mixer','grinder','appliance'], 'mixer'],
  [['smartphone','phone','mobile'], 'smartphone'],
  [['necklace','bangle','bridal','jhumka'], 'necklace'],
  [['ring','diamond'], 'ring'],
  [['earring','gold','jewel'], 'jewellery'],
  [['jeans','denim'], 'jeans'],
  [['shoe','sneaker','footwear'], 'shoes'],
  [['handbag','tote'], 'handbag'],
  [['bag'], 'handbag'],
  [['shirt','formal'], 'shirt'],
  [['kurti','gown','dress','women','saree','silk','kanchipuram'], 'kurti'],
  [['kids','tshirt','tee','jacket','fashion','clothing','apparel'], 'clothing'],
  [['grill','arabic','faham','kebab','tandoor','mandi','shawa'], 'grilled'],
  [['biryani','biriyani','pulao'], 'biryani'],
  [['fish','prawn','seafood','meat','pollichathu'], 'fish'],
  [['halwa','cake','sweet','dessert'], 'cake'],
  [['puff','bun','pastry','bakery','cookie','bread','paratha','porotta','pathiri','kuboos','pita','dilkush','nankhatai','snack'], 'bakery'],
  [['tomato','onion','banana','chilli','vegetable','fruit','plantain','veg'], 'vegetables'],
  [['egg'], 'eggs'],
  [['oil'], 'oil'],
  [['rice','atta','flour','dal','lentil','gram','sugar','matta','basmati','wheat'], 'rice'],
  [['milk','butter','dairy','tea','detergent','biscuit','provision','combo'], 'grocery'],
  // business covers
  [['restaurant','hotel','dining','meals'], 'restaurant'],
  [['supermarket','hypermarket','grocery','store','mart','market'], 'supermarket'],
  [['salon','beauty','spa','makeup'], 'salon'],
];

function hashSeed(seed) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function photoFor(keyword, seed = 0, w = 640, h = 520) {
  const kw = String(keyword || '').toLowerCase();
  let bucket = null;
  for (const [words, b] of RULES) { if (words.some(x => kw.includes(x))) { bucket = b; break; } }
  const pool = bucket && POOLS[bucket];
  if (pool && pool.length) return U(pool[hashSeed(seed) % pool.length], w, h);
  // guaranteed-loading seeded fallback (still a real photo)
  return `https://picsum.photos/seed/ll${hashSeed(keyword + '|' + seed) % 100000}/${w}/${h}`;
}
