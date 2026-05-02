# CLAUDE.md — VIVI Themed OpenAPI

Context for any future Claude (or other agent) session working on this project. Read this first.

---

## What this project is

A **Next.js 16 / Vercel** app that consumes the source ASP.NET swagger at
`https://pprvmw.com/swagger/v1/swagger.json` (title: *MiddleWare v1*, OpenAPI 3.0.4)
and republishes it as **multiple smaller, theme-scoped OpenAPI schemas** at:

```
GET /themes                              -> JSON list of available themes
GET /themes/{theme}/openapi.json         -> sliced OpenAPI 3.0 schema for that theme
GET /health                              -> 200 OK
```

Each `/themes/{theme}/openapi.json` URL is imported into **VIVI.bot** as a separate Custom API integration. The VIVI agent decides — from the user's prompt + its system prompt — which theme/integration (and therefore which endpoints) to call.

Why themes instead of importing the full swagger: 182 tools = slow, inaccurate routing. Per-theme integrations = the agent only sees ~5-30 relevant tools at a time.

---

## Source API at a glance (from `lib/catalog/inspect-report.json`)

| Field | Value |
|---|---|
| OpenAPI version | 3.0.4 |
| API title / version | MiddleWare v1 |
| Total endpoints | **182** |
| Methods | 173 POST · 9 GET |
| Unique tags | 22 (all endpoints tagged, 0 untagged) |
| Component schemas | 418 |
| Auth scheme | `Bearer` (HTTP, JWT-style) declared in `components.securitySchemes` |
| Global `security` | none — endpoints opt-in per-op |
| `servers` field | **missing** — we inject `https://pprvmw.com` in every sliced schema |
| `operationId` coverage | **0 / 182** — none present, must be generated |
| Non-JSON response ops | 0 |

### Tag breakdown (source)

```
  34  BookingCatalog       12  Department          5  Property
  31  Communication        10  Request             5  Transactions
  18  Membership            7  List                5  Vehicle
   7  Survey                4  Document            4  Report
   7  TemplateRenderer      4  GroupImport         3  AppUser
   6  Tiles                 5  Invoice             3  MiddleWare
   6  Venue                 3  QrCode              2  Media
                                                    1  Chat
```

---

## Architecture

```
https://pprvmw.com/swagger/v1/swagger.json   ← source of truth
                  │
                  │  (build time)
                  ▼
   scripts/fetch-swagger.ts  →  lib/catalog/swagger-source.json
   scripts/build-catalog.ts  →  lib/catalog/catalog.json   (normalized)
                  │
                  │  (request time, baked-in catalog)
                  ▼
   app/themes/[theme]/openapi.json/route.ts
        ├─ reads config/themes.ts
        ├─ filters paths by tag + allowedMethods
        ├─ walks $ref graph → keeps only referenced components
        ├─ injects servers: [{ url: "https://pprvmw.com" }]
        ├─ preserves components.securitySchemes (Bearer)
        └─ generates deterministic operationIds
                  │
                  ▼
   https://<vercel>/themes/auth/openapi.json
   https://<vercel>/themes/booking/openapi.json
   ... etc                  ← imported into VIVI as Custom APIs
```

**No proxying in v1.** Themed schemas point `servers` directly at pprvmw. VIVI calls pprvmw, not us.

**No cross-theme orchestration in code.** That lives in the VIVI agent's system prompt.

---

## Decisions already made

1. **Hosting:** Vercel.
2. **Catalog baked at build time** (Vercel is stateless, source rarely changes).
3. **No request proxy in v1** — direct VIVI → pprvmw.
4. **Read-only first** for new themes — `allowedMethods` opts-in per theme. Initial pass exposes both GET + POST because the source API is overwhelmingly POST-based (RPC-style).
5. **Themes are config-driven** — `config/themes.ts` is the single source of truth. New theme = edit config + redeploy + import URL into VIVI.
6. **Auth handled by VIVI**, not us. We preserve `securitySchemes` so VIVI can collect the Bearer token after `/Login` and pass it on subsequent calls.
7. **operationId generation:** because the source has zero operationIds, the slicer must synthesize them deterministically. Format: `<tag>_<METHOD>_<sanitized_path>` (lowercase, non-alnum → `_`). This makes them stable across rebuilds.

---

## Project structure (target)

```
vivi-themed-openapi/
├── app/
│   ├── themes/
│   │   ├── route.ts                       # GET /themes — list of themes
│   │   └── [theme]/
│   │       └── openapi.json/route.ts      # GET /themes/{theme}/openapi.json
│   └── health/route.ts                    # GET /health
├── config/
│   └── themes.ts                          # ⭐ THE config — theme definitions
├── lib/
│   ├── catalog/
│   │   ├── swagger-source.json            # ← fetched, gitignored or committed
│   │   ├── catalog.json                   # ← normalized, build artifact
│   │   ├── inspect-report.json            # ← inspection output
│   │   ├── types.ts
│   │   └── load.ts                        # in-memory loader
│   ├── openapi/
│   │   ├── slice.ts                       # filter + ref-walking + opId gen
│   │   └── slice.test.ts                  # unit tests with fake swagger
│   └── env.ts                             # zod-validated env
├── scripts/
│   ├── fetch-swagger.ts                   # download → swagger-source.json
│   ├── build-catalog.ts                   # → catalog.json
│   └── inspect-tags.ts                    # one-off: tag/op stats, auth scheme
├── package.json
├── next.config.ts
├── tsconfig.json
├── README.md
└── CLAUDE.md  ← you are here
```

---

## Theme map (single source of truth: `config/themes.ts`)

19 themes cover all 182 endpoints. Each theme description is written to help the VIVI agent route by user intent.

| Theme key | Source tag(s) | # ops | Purpose |
|---|---|---:|---|
| `auth` | AppUser | 3 | Login, fetch/update user profile |
| `membership` | Membership | 18 | Members, member types, member reports, authorized visitors |
| `booking` | BookingCatalog | 34 | Booking catalog, services, packages, cart, blackouts, operational hours |
| `venue` | Venue | 6 | Venues + menus |
| `communication` | Communication, Chat | 32 | Email/SMS templates, blasts, scheduled/recurring comms, SMS conversations, chat messages |
| `requests` | Request | 10 | Service tickets — create, edit, list, notes, reports |
| `survey` | Survey | 7 | Surveys, questions, answers, survey reports |
| `department` | Department | 12 | Department settings, services, escalation, operational hours |
| `tiles` | Tiles | 6 | UI tile items |
| `list` | List | 7 | Guest lists, end users by property |
| `vehicle` | Vehicle | 5 | Vehicle CRUD by membership |
| `financials` | Invoice, Transactions | 10 | Invoices and transactions tied to profiles |
| `media` | Document, Media | 6 | Profile documents, media assets |
| `templates` | TemplateRenderer | 7 | Content blocks/parts, render templates to HTML |
| `reports` | Report | 4 | Top services, items, locations, room-service reports |
| `property` | Property | 5 | Properties, dashboard, CMS view, property QR test |
| `qr` | QrCode | 3 | QR creation, tracking, reporting |
| `group-import` | GroupImport | 4 | Bulk member import jobs (status, errors, cancel) |
| `system` | MiddleWare | 3 | Root, healthz, ACS SMS webhook (admin/internal — **probably do NOT expose to VIVI**) |

**Total: 182 endpoints. No endpoint is dropped unless its theme is intentionally omitted from VIVI.**

`system` is included for completeness but you likely don't import it into VIVI — it's webhooks/health.

---

## VIVI integration plan (manual step after each deploy)

For each theme key `T`, create a Custom API integration in VIVI pointing to:

```
https://<vercel-domain>/themes/T/openapi.json
```

Then in the agent's system prompt, describe each integration so the agent can route by intent. Skeleton:

```
You have access to themed APIs. Choose the integration that matches the user's intent:
- Authentication API → user logs in / profile lookups → use BEFORE any write op needing a user session
- Membership API → questions about members, member types, member reports
- Booking API → booking/reservation creation, cart, services, packages, blackouts
- ...
Authentication rule: if the user wants to do anything tied to their account
(create a request, modify a booking, etc.), call the Authentication API's /Login
first using their credentials, then pass the returned Bearer token on subsequent calls.

Read-first rule: before creating or modifying anything, look it up first.

Never invent endpoint names. Only call endpoints from imported APIs.
```

---

## Working rules for Claude on this project

1. **Step 1 (inspection) is done.** Findings are in `lib/catalog/inspect-report.json` and summarized above. Don't redo it unless source swagger changes.
2. **Generate operationIds deterministically** in the slicer. Format: `<tag>_<METHOD>_<sanitized_path>`. Example: `POST /api/Request/CreateRequest` → `Request_POST_api_Request_CreateRequest`.
3. **Walk `$ref` graph fully and recursively** when slicing. Missing components = VIVI parse failure. Test with a fake swagger before pointing at real one.
4. **Preserve `components.securitySchemes`** (Bearer) in every themed schema.
5. **Inject `servers: [{ url: "https://pprvmw.com" }]`** in every themed schema.
6. **No silent workarounds.** If something fails (fetch, parse, mismatch), stop and ask.
7. **Credentials/secrets:** flag before touching. There's no API key needed to fetch swagger, but `/Login` handles real user creds — never hardcode them anywhere.
8. **Files, not chat dumps.** Code goes into the project.
9. **Browser tasks:** Playwright CLI first, Claude-in-Chrome fallback.
10. **Bilingual** — respond in whichever language Christian writes in.
11. **Stack:** TypeScript strict, App Router, Node runtime for routes (not Edge — schema gen is heavier than Edge limits warrant), npm, GitHub, Vercel.

---

## Auth notes (confirmed)

- `POST /Login` returns a **JWT Bearer token**. Base64-decode the middle segment (`header.PAYLOAD.signature`) to read claims (user id, property, role, exp, etc.). Standard JWT — VIVI can store the raw token and pass `Authorization: Bearer <token>` on subsequent calls.
- `system` theme is **NOT exposed to VIVI** (`exposeToVivi: false`). `/healthz` and the ACS SMS webhook are not for the agent.

## operationId generation (confirmed strategy)

Source swagger has **zero** operationIds across all 182 endpoints. The slicer must synthesize them. Format:

```
<Tag>_<METHOD>_<path with non-alphanumerics → underscores>
```

Examples:
- `POST /Login` (tag AppUser) → `AppUser_POST_Login`
- `POST /api/Request/CreateRequest` (tag Request) → `Request_POST_api_Request_CreateRequest`
- `GET /api/Membership/members` (tag Membership) → `Membership_GET_api_Membership_members`

Properties:
- Deterministic → stable across rebuilds (VIVI tool names don't churn on redeploy)
- Unique → no collisions across the 182 ops
- Readable → easy to identify in agent traces

## Open items / known gaps

- [ ] Decide where the source swagger is committed: `lib/catalog/swagger-source.json` is currently downloaded; consider gitignoring it and refreshing in `prebuild`.
- [ ] Add ISR/revalidate to themed routes if you want runtime catalog refresh later.

---

## v2 ideas (do not build until v1 ships)

- Proxy mode (VIVI → us → pprvmw) for logging, rate limit, transformation
- Predefined `workflows/*` endpoints for cross-theme orchestration in code
- `search_endpoints` meta-tool inside themes that grow past ~30 ops (Booking is at 34 — watch this one)
- `POST /admin/refresh` (shared-secret) → Vercel deploy hook on swagger change
