# Nest List

Application de listes familiales partagées (« Family lists synced »).
PWA installable, multilingue, en mode sombre par défaut.

## Stack

- **Nuxt 4** (mode SPA, `ssr: false`) + **Vue 3.5** + **vue-router**
- **TypeScript** (ESM, `"type": "module"`)
- **@nuxt/ui 4** (composants + Tailwind intégré)
- **@nuxtjs/i18n 10** (4 langues : fr, en, es, zh)
- **@nuxt/eslint** + **ESLint 9** + **Prettier 3** (via `eslint-plugin-prettier`)
- **@iconify-json/heroicons** (icônes `i-heroicons-*`)
- **PWA** : manifest + service worker écrits à la main (pas de module PWA)
- **Backend** : routes Nitro (`server/api/*`) déployées avec le front sur Cloudflare Pages
  (preset Nitro `cloudflare-pages`, la SPA reste `ssr: false`)
- **Base de données** : Cloudflare D1 (SQLite), binding `DB` — voir `wrangler.toml`
- **Auth** : email-OTP maison (code envoyé par email via **Resend**), session cookie 90 j

## Arborescence

```
app/
├── app.vue              # Layout racine : header (titre, nav, langue, dark, logout) + main + footer + bannière PWA
├── app.config.ts        # { title: "Nest List" }
├── assets/css/main.css  # @import tailwindcss + @nuxt/ui
├── components/
│   ├── MobileMenu.vue       # Menu responsive (langue + dark mode + logout)
│   └── PwaUpdateBanner.vue  # Bannière « mise à jour disponible »
├── composables/         # auto-import Nuxt (useAuth, useLists, …)
├── middleware/
│   └── auth.global.ts   # Guard : redirige vers /auth si non connecté
├── pages/
│   ├── index.vue        # Page d'accueil
│   └── auth.vue         # Connexion email-OTP (2 étapes : email → code)
├── plugins/
│   ├── pwa.client.ts    # Enregistrement du service worker + état de mise à jour
│   └── auth.client.ts   # Hydrate la session (/api/auth/me) avant le guard
└── types/
server/                  # Backend Nitro (déployé avec le front sur CF Pages)
├── api/auth/            # request-code, verify, logout, me
├── utils/               # db, crypto, session, otp, rate-limit, email, validate (auto-import)
└── database/migrations/ # 0001_init.sql (schéma D1)
locales/                 # fr.json, en.json, es.json, zh.json
public/                  # manifest, sw.js, icônes, _redirects, _headers, robots.txt
wrangler.toml            # binding D1 + config migrations ; .dev.vars = secrets locaux (git-ignoré)
```

## Règle i18n (importante)

**Tout texte visible par l'utilisateur passe par i18n.** Toute nouvelle clé doit être
ajoutée **simultanément aux 4 fichiers** `locales/{fr,en,es,zh}.json`.

- Template : `$t("key")`
- Script : `const { t } = useI18n()` puis `t("key")`

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (`localhost:3000`), bindings D1 via `nitro-cloudflare-dev` |
| `npm run build` | Build de prod (SPA + worker) → `dist/` — **commande de déploiement** |
| `npm run generate` | Build purement statique, hérité (non utilisé pour le déploiement) |
| `npm run preview` | Prévisualise le build |
| `npm run lint` | ESLint + Prettier (`--fix`) |
| `npm run db:create` | Crée la base D1 (`wrangler d1 create nest-list`) — copier le `database_id` dans `wrangler.toml` |
| `npm run db:migrate` | Applique les migrations en local |
| `npm run db:migrate:remote` | Applique les migrations sur la base D1 de prod |

## Conventions

- TypeScript partout ; props et emits **typés**.
- Composants en `<script setup lang="ts">`.
- Composants et composables **auto-importés** (pas d'import explicite).
- Prettier : 2 espaces, point-virgule, double quotes, `printWidth: 100`, `trailingComma: all`.
- Icônes : `i-heroicons-*`.
- Tailwind : variantes `dark:` systématiques.

## PWA

- `public/sw.js` : `NetworkFirst` pour la navigation, `StaleWhileRevalidate` pour les assets.
  Le token `__BUILD_ID__` est remplacé par un timestamp au build (hook Nitro dans `nuxt.config.ts`),
  ce qui invalide le cache à chaque déploiement.
- Le client décide de la mise à jour : `PwaUpdateBanner.vue` envoie `SKIP_WAITING` au SW puis recharge.

## Backend & Auth

- **Compute** : preset Nitro `cloudflare-pages` → `nuxt build` produit `dist/` (assets statiques,
  `_worker.js`, `_routes.json`). La SPA reste `ssr: false` ; seules les routes `server/api/*` tournent côté serveur.
- **D1** : accès via `useDb(event)` (`event.context.cloudflare.env.DB`). Requêtes en SQL préparé
  (`.prepare().bind().run()/first()`). Schéma dans `server/database/migrations/`.
- **Auth email-OTP** (tout en D1, pas de KV) :
  - `POST /api/auth/request-code` → code 6 chiffres stocké hashé (`otp_codes`), envoyé par email + rate-limit.
  - `POST /api/auth/verify` → vérifie le code, upsert `users`, ouvre une session (`sessions`), pose le cookie
    `nest_session` (HttpOnly, 90 j).
  - `POST /api/auth/logout` / `GET /api/auth/me`.
  - Client : `useAuth()` + plugin d'hydratation + middleware global `auth.global.ts`.
- **Config** : en local tout est dans `.dev.vars` (`RESEND_API_KEY`, `EMAIL_FROM`, `SESSION_SECRET`).
  En prod : `EMAIL_FROM` + binding D1 dans `wrangler.toml`, secrets `RESEND_API_KEY`/`SESSION_SECRET` dans
  le dashboard. Sans vraie clé Resend, le code OTP est loggé dans la console serveur (test sans email).
- Le service worker **ne cache jamais `/api/*`** (bypass réseau dans `public/sw.js`).

## Déploiement — Cloudflare Pages

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Build output | `dist` |
| Node version | `NODE_VERSION=20` (ou +) |

- **Binding D1 + var `EMAIL_FROM`** : gérés dans `wrangler.toml` (avec un `wrangler.toml` présent,
  le dashboard ne gère plus les vars/bindings en clair). Ces réglages `wrangler.toml` s'appliquent à la
  **production** ; pour les preview deployments, dupliquer sous `[env.preview]`.
- **Secrets** (dashboard → Variables and Secrets, chiffrés) : `RESEND_API_KEY`, `SESSION_SECRET`.
- Migrations de prod : `npm run db:migrate:remote` (après `wrangler login`).
- `public/_redirects` (`/* /index.html 200`) couvre les routes dynamiques de la SPA.
- `public/_headers` force `Cache-Control: no-cache` sur `/sw.js`.
