# MyFinance

```
├── *.html                    Pages (kept at root so Supabase redirect URLs & links keep working)
├── sw.js                     Service worker (must stay at root for scope)
├── Web.config
├── assets/
│   ├── css/
│   │   ├── base/global.css           Theme variables, buttons, alerts, loader
│   │   ├── layout/app-shell.css      App layout, sticky header, drawer, shared components
│   │   └── pages/                    One stylesheet per page (auth, calendar, goals, ...)
│   └── js/
│       ├── core/
│       │   ├── supabase-client.js    Supabase client
│       │   ├── app-shared.js         Shared helpers (menu, theme, profile, formatting, toasts)
│       │   └── emi-utils.js          EMI date helpers
│       └── pages/                    One script per page
└── database/migrations/      Run in order 001 → 005
```
