# VIVI Integration Setup Guide

Paste these into VIVI when creating each Custom API integration. One row = one integration. Total: **18 integrations**.

**Workflow per row:**
1. Edit "Untitled Custom API" → set **Name**
2. Paste **Description**
3. Set **Authentication** dropdown
4. Click **Import from URL** → paste **Schema URL**
5. Save

After all 18 are created, attach them all to your VIVI agent and paste the contents of `lib/agent/system-prompt.md` into the agent's system prompt field.

---

## All 18 integrations

| # | Name | Description | Auth | Schema URL |
|---|---|---|---|---|
| 1 | Authentication API | Log a user in and look up or update their profile. Call this BEFORE any action that requires an authenticated user — returns the JWT used by the other APIs. | None | https://pprvweb-swagger.vercel.app/themes/auth/openapi.json |
| 2 | Membership API | Manage members, member types, authorized visitors, and member-level reports (financial, health, product performance). | Bearer | https://pprvweb-swagger.vercel.app/themes/membership/openapi.json |
| 3 | Booking API | Bookings and reservations: catalog, services, packages, cart, checkout, blackouts, operational hours, cancel, no-show, change appointment. | Bearer | https://pprvweb-swagger.vercel.app/themes/booking/openapi.json |
| 4 | Venue API | Create, update, list, and delete venues and their menus. | Bearer | https://pprvweb-swagger.vercel.app/themes/venue/openapi.json |
| 5 | Communication API | Send and schedule email and SMS, manage templates, mail/SMS groups, blasts, recurring communications, SMS conversations, and chat messages. | Bearer | https://pprvweb-swagger.vercel.app/themes/communication/openapi.json |
| 6 | Service Requests API | Service tickets — create, edit, assign, list, add notes, and view ticket reports. | Bearer | https://pprvweb-swagger.vercel.app/themes/requests/openapi.json |
| 7 | Survey API | Create surveys and questions, submit answers, and view aggregated survey reports (ratings + comments). | Bearer | https://pprvweb-swagger.vercel.app/themes/survey/openapi.json |
| 8 | Department API | Configure departments: settings, services and sub-services, items, escalation rules, operational hours. | Bearer | https://pprvweb-swagger.vercel.app/themes/department/openapi.json |
| 9 | Tiles API | Create, update, list, and delete dashboard/CMS tile items. | Bearer | https://pprvweb-swagger.vercel.app/themes/tiles/openapi.json |
| 10 | Lists & Guests API | Manage guest lists, list members, and active end-users by property. | Bearer | https://pprvweb-swagger.vercel.app/themes/list/openapi.json |
| 11 | Vehicle API | CRUD for vehicles linked to a membership (license plates, vehicle registration). | Bearer | https://pprvweb-swagger.vercel.app/themes/vehicle/openapi.json |
| 12 | Financials API | Invoices and transactions tied to profiles — create, update, cancel, list by profile. | Bearer | https://pprvweb-swagger.vercel.app/themes/financials/openapi.json |
| 13 | Media & Documents API | Upload, replace, and delete profile documents and media assets. | Bearer | https://pprvweb-swagger.vercel.app/themes/media/openapi.json |
| 14 | Template Renderer API | Manage content blocks and parts, render templates to final HTML for email/SMS. | Bearer | https://pprvweb-swagger.vercel.app/themes/templates/openapi.json |
| 15 | Reports API | Aggregate top-N reports: top services, top requested items, top locations, top room-service locations. | Bearer | https://pprvweb-swagger.vercel.app/themes/reports/openapi.json |
| 16 | Property API | List and update properties, fetch dashboard and CMS views, generate test QR for a property. | Bearer | https://pprvweb-swagger.vercel.app/themes/property/openapi.json |
| 17 | QR Code API | Create tracking QR codes, scan/lookup by token, view QR usage reports. | Bearer | https://pprvweb-swagger.vercel.app/themes/qr/openapi.json |
| 18 | Group Import API | Bulk member import jobs — submit a job, check status, list errors, cancel. | Bearer | https://pprvweb-swagger.vercel.app/themes/group-import/openapi.json |

---

## Auth notes

- The **Authentication API** (#1) is the only one with `Auth: None` — its `/Login` endpoint is how you obtain the JWT in the first place.
- All others use **Bearer**. The token comes from the response of `/Login` and is reused on every subsequent call.
- If VIVI does not auto-share the JWT across integrations, set them all to `None` and rely on the agent's system prompt to attach the header — the schemas declare `Authorization: Bearer` correctly.

## After setup

- **Test order:** start by exercising `Authentication API` + `Membership API` only. Confirm the agent can log in and look up a profile. Then bring the rest online.
- **Schema refresh:** when you change `config/themes.ts` and redeploy, click "Refresh schema" / re-import in VIVI per integration so VIVI picks up the new operations.
- **System prompt refresh:** run `npm run generate:system-prompt` and paste the updated content into the agent's system prompt.
