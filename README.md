# UNMI.IO — Domain Asset Management & Showcase Platform

<p align="center">
  <img src="https://img.shields.io/npm/v/unmi-domain-manager?style=flat-square&color=red" alt="npm" />
  <img src="https://img.shields.io/badge/Nuxt-3.14-00DC82?style=flat-square&logo=nuxt.js" alt="Nuxt 3" />
  <img src="https://img.shields.io/badge/SQLite-WAL-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <b>English</b> | <a href="./README.zh-CN.md">中文</a>
</p>

A full-featured, local-first domain portfolio management system with public showcase, domain drop-catching, and enterprise-grade security. Built with **Nuxt 3 + SQLite + Tailwind CSS**.

**Live Demo:** [https://beta.unmi.io](https://beta.unmi.io)

---

## Features

### Domain Management System
- **Multi-account** — password-based accounts with data isolation
- **Domain CRUD** — add, edit, delete, batch operations, tags
- **WHOIS/RDAP Auto-detect** — 100+ TLD support, auto-fill registration info
- **Renewal Price Comparison** — nazhumi.com API, 2900+ TLDs, 59+ registrars
- **AI Domain Appraisal** — rule-based valuation (TLD tier, length, keywords, age)
- **Statistics & Analytics** — renewal budget, monthly trends, registrar distribution, portfolio valuation
- **Import/Export** — Excel (.xlsx) and CSV support
- **Notification Center** — expiry alerts (7d/30d), daily summaries
- **Email Alerts** — SMTP with 30+ provider presets, scheduled summaries
- **12 Registrant Fields** — name, org, email, phone, address, admin/tech contacts

### Domain Showcase System (Public)
- **dn.com-style** public domain marketplace
- **Search & Filter** — TLD, category, price range, domain length
- **Domain Detail Pages** — appraisal, inquiry form, SEO meta
- **Inquiry System** — form submission, backend management
- **FAQ & About Pages** — customizable content
- **i18n** — Chinese/English bilingual

### Domain Drop-Catch Module
- **DropCatch.com API** integration — real auction data
- **Full dataset** via AllAuctions CSV (27,000+ domains per refresh)
- **Smart price enrichment** — 36 API calls with filter combinations
- **All auction types** — Dropped, PrivateSeller, PreRelease
- **Daily auto-update** — cron job at 2:00 AM
- **Real-time countdown** — accurate to DropCatch ET timezone
- **Mobile-first card UI** — responsive grid layout

### Security
- **3 Authentication Methods:**
  - Password + TOTP (Google Authenticator compatible, RFC 6238)
  - Authorized Device + Password (ECDSA P-256 challenge-response, non-extractable private key)
  - Passkey / WebAuthn (FIDO2, iCloud Keychain sync)
- **10 backup codes** per account (one-time use)
- **Max 10 devices** per account
- **AES-256-GCM** data encryption (scrypt key derivation)
- **API rate limiting** — token bucket algorithm, per-IP + global
- **bcrypt** password hashing
- **Session timeout** — configurable (30m to 7 days)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 3 (v3.14), Vue 3, Nitro |
| Database | SQLite (better-sqlite3, WAL mode) |
| Styling | Tailwind CSS |
| Charts | ECharts + vue-echarts |
| Auth | bcryptjs, otpauth (TOTP), @simplewebauthn (WebAuthn) |
| Crypto | Web Crypto API (ECDSA P-256), AES-256-GCM |
| Email | Nodemailer |
| Excel | SheetJS (xlsx) |
| Process | PM2 |
| Proxy | Nginx + Let's Encrypt SSL |

---

## Quick Start

### Requirements

- Node.js 18+ (recommended: 20 LTS)
- npm 8+
- PM2 (`npm install -g pm2`)
- Nginx (optional, for reverse proxy)

### 1. Install

```bash
# Via npm
npm install unmi-domain-manager

# Or clone repository
git clone https://github.com/wresource/unmi_web.git
cd unmi_web
npm install
```

### 2. Development

```bash
npm run dev
# Open http://localhost:3000
```

### 3. Production Deployment

```bash
# Build
npm run build

# Configure PM2
cp ecosystem.config.example.cjs ecosystem.config.cjs
# Edit ecosystem.config.cjs with your settings

# Start
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

### 4. Nginx + SSL

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `localhost` | Listen address |
| `DB_PATH` | `./data/domain-manager.db` | SQLite database path |
| `DROPCATCH_CLIENT_ID` | — | DropCatch.com API client ID |
| `DROPCATCH_CLIENT_SECRET` | — | DropCatch.com API secret |
| `WEBAUTHN_RP_ID` | `beta.unmi.io` | WebAuthn relying party ID |
| `WEBAUTHN_ORIGIN` | `https://beta.unmi.io` | WebAuthn origin URL |

### Optional Integrations

| Service | Purpose | Auth |
|---------|---------|------|
| [DropCatch.com API](https://www.dropcatch.com/hiw/dropcatch-api) | Real auction data | API key (env var) |
| [nazhumi.com](https://www.nazhumi.com/) | Domain pricing comparison | None (free) |
| IANA RDAP Bootstrap | WHOIS server discovery | None |

---

## Project Structure

```
├── pages/                    # 22 page routes
│   ├── show/                 # Public showcase (no auth)
│   ├── domains/              # Domain CRUD
│   ├── dropcatch.vue         # Drop-catch auctions
│   ├── security.vue          # 2FA settings
│   └── ...
├── server/
│   ├── api/                  # 55+ API endpoints
│   ├── utils/                # WHOIS, pricing, appraisal, crypto, email
│   └── database/             # SQLite schema (18 tables)
├── components/               # 10 reusable components
├── composables/              # useI18n, useToast, useDeviceAuth
├── i18n/                     # zh-CN.json, en.json (900+ keys)
├── layouts/                  # default, showcase, auth
└── scripts/                  # Cron jobs
```

### Database (18 tables)

`accounts` · `domains` · `tags` · `domain_tags` · `renewal_records` · `settings` · `show_categories` · `inquiries` · `notifications` · `notification_settings` · `domain_views` · `drop_domains` · `domain_watchlist` · `device_auth` · `totp_config` · `passkey_credentials` · `whois_query_logs` · `sync_backup_logs`

---

## API Overview

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Auth | 14 | Password, TOTP, Device, Passkey |
| Domains | 9 | CRUD, stats, import/export |
| WHOIS | 3 | Query, autofill, history |
| Pricing | 2 | TLD pricing, registrar list |
| Appraisal | 1 | Domain valuation |
| Showcase | 12 | Public listing, inquiry, categories |
| Drop-catch | 7 | Auctions, watchlist, stats |
| Notifications | 5 | Alerts, settings, generate |
| Email | 6 | SMTP config, send, test |
| Settings | 2 | Key-value configuration |
| Backup | 3 | Export, import, logs |
| Tags | 3 | CRUD |

---

## Screenshots

### Domain Management
- Dashboard with renewal trends and registrar distribution
- Domain list with search, filter, sort, batch operations
- Auto-detect: WHOIS + pricing + appraisal in one click

### Public Showcase
- Professional dn.com-style domain marketplace
- Responsive domain cards with pricing
- Inquiry form with rate limiting

### Drop-Catch
- Real DropCatch.com auction data
- Mobile-first card layout with countdown timers
- Filter by type, length, TLD, end time

### Security
- TOTP setup with QR code
- Device management with ECDSA crypto auth
- Passkey (WebAuthn) with iCloud Keychain sync

---

## Changelog

### v2.1 (2026-03-25)
- **2FA Authentication System** — TOTP + Device Auth (ECDSA P-256) + Passkey (WebAuthn/FIDO2)
- Cryptographic device verification with non-extractable private keys
- 10 backup codes, max 10 devices per account
- Passkey cross-device sync via iCloud Keychain
- Security settings page with device/passkey management

### v2.0 (2026-03-25)
- **DropCatch-only rewrite** — real auction data via AllAuctions CSV (27,000+ domains)
- Mobile-first card UI replacing table view
- All auction types: Dropped, PrivateSeller, PreRelease
- Smart price enrichment (36 API calls with filter combinations)
- Daily cron job for auto-update (2:00 AM)
- DropCatch ET timezone correction (19:00 UTC = 3PM ET)

### v1.5 (2026-03-25)
- **DropCatch.com API** integration with OAuth2
- Real auction prices and bidder counts

### v1.4 (2026-03-25)
- **Domain drop-catch module** with RDAP scanning → DropCatch API
- Watchlist, filtering, appraisal

### v1.3 (2026-03-25)
- **Email notification system** — SMTP with 30+ providers, scheduled summaries

### v1.2 (2026-03-25)
- WHOIS registrant fields (11 new), privacy protection detection
- Database stability (busy_timeout, synchronous)

### v1.1 (2026-03-25)
- 12 registrant fields, notification center, view statistics
- Domain view tracking with time granularity

### v1.0 (2026-03-25)
- Initial release: domain management, showcase, WHOIS, pricing, appraisal
- Multi-account, i18n (zh-CN/en), AES-256-GCM encryption
- 20 pages, 49 API endpoints, 10 components, 11 tables

---

## License

[MIT](LICENSE) © 2026 [wresource](https://github.com/wresource)
