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

## Arborescence

```
app/
├── app.vue              # Layout racine : header (titre, nav, langue, dark) + main + footer + bannière PWA
├── app.config.ts        # { title: "Nest List" }
├── assets/css/main.css  # @import tailwindcss + @nuxt/ui
├── components/
│   ├── MobileMenu.vue       # Menu responsive (langue + dark mode)
│   └── PwaUpdateBanner.vue  # Bannière « mise à jour disponible »
├── composables/         # auto-import Nuxt
├── pages/
│   └── index.vue        # Page d'accueil
├── plugins/
│   └── pwa.client.ts    # Enregistrement du service worker + état de mise à jour
└── types/
locales/                 # fr.json, en.json, es.json, zh.json
public/                  # manifest, sw.js, icônes, _redirects, _headers, robots.txt
```

## Règle i18n (importante)

**Tout texte visible par l'utilisateur passe par i18n.** Toute nouvelle clé doit être
ajoutée **simultanément aux 4 fichiers** `locales/{fr,en,es,zh}.json`.

- Template : `$t("key")`
- Script : `const { t } = useI18n()` puis `t("key")`

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (`localhost:3000`) |
| `npm run generate` | Build statique de prod → `.output/public` |
| `npm run preview` | Prévisualise le build |
| `npm run lint` | ESLint + Prettier (`--fix`) |

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

## Déploiement — Cloudflare Pages

| Réglage | Valeur |
|---|---|
| Build command | `npm run generate` |
| Build output | `.output/public` |
| Node version | `NODE_VERSION=20` (ou +) |

- `public/_redirects` (`/* /index.html 200`) couvre les routes dynamiques de la SPA.
- `public/_headers` force `Cache-Control: no-cache` sur `/sw.js`.
