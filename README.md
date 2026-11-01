# Local Link Amber — Everything Local. One Place.

A **location-first local marketplace & community platform** for Kozhikode, Kerala —
built as a real, deployable full-stack app (not a prototype). One codebase, one
backend, three surfaces:

Each surface is its **own standalone app at its own link** — no shared chrome:

| App | Link | Layout | Who it's for |
|---|---|---|---|
| **Customer app** | `/` | Mobile app | Residents — discover businesses, services, workers, transport, offers, news, events & local info |
| **Partner app** | `/partner` | Mobile app | Vendors — dashboard, products, orders, offers, enquiries |
| **Admin panel** | `/admin` | Desktop CRM | The Local Link team — approvals, moderation, categories, content, analytics, **live Google import** |

There's also a launcher at **`/apps`** linking to all three.

### Live shops from Google (no manual entry)
In **Admin → Locations**, every area (Kunnamangalam, Inapura, Chelavur, Nadakkavu, Mananchira, and more) has an **Import from Google** button. Set a `GOOGLE_PLACES_API_KEY` (Places API New) and one click pulls real restaurants, groceries, pharmacies, salons, etc. into that area automatically. Without a key, the app ships with a full Kozhikode demo dataset.

---

## ✨ What's inside

- **Premium, mobile-first UI** — teal + coral brand system, Poppins/Inter type, light **and** dark themes, custom pin-with-rings logo.
- **Amber edition** — deep navy + golden amber identity, new animated pin-and-rings logo, split-screen partner/admin logins, a distinct search and bottom navigation per app.
- **3D & motion layer** (`public/fx.js` + `public/fx.css`, zero dependencies) — live 3D "local network" globe with orbiting map pins behind every app, 3D intro, screen transitions, staggered reveals, 3D card tilt, animated dashboards (wave sparklines, drawn-in donut, growing bars, count-up KPIs), ripples and a load progress bar. Respects reduced-motion.
- **English + Malayalam** live language toggle (i18n).
- **Location-first** — districts → panchayaths → areas, "near you" discovery, open/closed hours computed live (IST).
- **Ask Local Link** — an AI assistant that understands intent (“find a plumber”, “biriyani under ₹250”, “auto to the station”). Uses **OpenAI** when a key is set, and a built-in **offline smart-search** fallback otherwise.
- **Real backend** — Node + Express + SQLite, JWT auth with 7 roles, row-level ownership checks, controlled order-status transitions, and a rich Kozhikode seed dataset (businesses, products, services, workers, drivers, offers, news, events, local info, plans).
- **Admin analytics** — live stat cards, a category donut and order-status bars drawn from real data, plus moderation actions (approve/suspend businesses, hide/publish reviews, create categories).

## 🔑 Demo accounts

All demo accounts use the password **`password`**.

| Role | Email |
|---|---|
| Customer | `customer@locallink.app` |
| Partner | `partner@locallink.app` |
| Admin | `admin@locallink.app` |

The login screen has one-tap buttons to fill each of these.

---

## 🚀 Deploy to Render (free)

### Option A — Blueprint (one click)
1. Push this folder to a **GitHub repo**.
2. In Render: **New + → Blueprint**, connect the repo. Render reads `render.yaml` and provisions a free Web Service.
3. (Optional) In the service's **Environment** tab, add `OPENAI_API_KEY` to enable the full AI assistant.
4. Deploy. Your app is live at `https://<your-service>.onrender.com`.

### Option B — Manual Web Service
1. New + → **Web Service** → connect the repo.
2. **Build command:** `npm install` — **Start command:** `npm start`.
3. Add env vars: `JWT_SECRET` (any long random string) and optionally `OPENAI_API_KEY`.
4. Create Web Service.

> **Note on data:** Render's free tier has an ephemeral filesystem, so by default
> the SQLite database **re-seeds itself** on each cold start — ideal for a fresh
> live demo. To make data **persist for free**, create a free
> [Turso](https://turso.tech) database and set `TURSO_DATABASE_URL` +
> `TURSO_AUTH_TOKEN` (steps in `.env.example`). The app then serves reads from a
> fast local copy and syncs writes to the cloud automatically — no code changes,
> no paid disk.

## 🧠 Enable the OpenAI assistant

Set one environment variable and redeploy:

```
OPENAI_API_KEY=sk-...          # your key (stays server-side, never exposed to the browser)
OPENAI_MODEL=gpt-4o-mini       # optional, this is the default
```

Without a key, **Ask Local Link still works** using the built-in offline matcher — so the app is fully functional either way.

---

## 💻 Run locally

```bash
npm install
cp .env.example .env      # then edit values (JWT_SECRET, optional OPENAI_API_KEY)
npm start                 # → http://localhost:3000
```

Reseed the database at any time:

```bash
npm run seed              # wipes & re-seeds with fresh Kozhikode demo data
```

## 🗂 Project structure

```
local-link/
├─ server.js            Express app: REST API + static SPA + role guards
├─ src/
│  ├─ db.js             SQLite schema + rich Kozhikode seed data
│  ├─ auth.js           JWT login, role middleware
│  └─ assistant.js      Ask Local Link — OpenAI + offline fallback
├─ public/
│  ├─ index.html        SPA shell
│  ├─ styles.css        Design system (light/dark, tokens, components)
│  ├─ app.js            Customer + Partner + Admin front-end
│  └─ favicon.svg
├─ render.yaml          Render blueprint (free web service)
├─ .env.example
└─ package.json
```

## 🧩 Tech

Node.js · Express · libSQL/SQLite (optional free Turso cloud persistence) · JWT (jsonwebtoken) · bcryptjs · vanilla JS SPA · CSS design tokens · OpenAI Chat Completions.

## 🛣 Roadmap (already scaffolded)

Cart & online ordering · payment gateway · delivery partners · classifieds · push notifications · advanced advertising & subscriptions billing · multi-district expansion · richer AI recommendations. The Admin panel's Locations, Subscriptions, Advertisements, Notifications and Settings sections are stubbed and ready to build out.

---

Built for **DevX Technologies**. Local Link — *Everything Local. One Place.*
