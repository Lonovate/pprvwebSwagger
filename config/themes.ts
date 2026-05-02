/**
 * config/themes.ts
 * --------------------------------------------------------------------------
 * Single source of truth for which swagger tags get sliced into which VIVI
 * Custom API integrations.
 *
 * 19 themes cover all 182 endpoints in https://pprvmw.com/swagger/v1/swagger.json.
 *
 * Each theme produces a schema served at:
 *   GET /themes/<key>/openapi.json
 *
 * `description` is what the VIVI agent's system prompt uses to decide which
 * integration to call for a given user request. Write it for the AGENT, not
 * for humans — be intent-oriented.
 *
 * `tags` are matched (case-sensitive) against `paths.*.<method>.tags` in the
 * source swagger.
 *
 * `allowedMethods` filters within those tagged paths. The source API is
 * overwhelmingly POST-based (173/182), so we allow GET+POST broadly.
 *
 * `triggers` are example user phrases — used by us as documentation and by
 * the system-prompt generator to seed routing examples.
 * --------------------------------------------------------------------------
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ThemeConfig {
  /** Public-facing title written into the sliced openapi info.title */
  title: string;
  /** Description for the VIVI agent — written to optimize routing accuracy */
  description: string;
  /** Source swagger tags this theme includes */
  tags: readonly string[];
  /** HTTP methods to keep when filtering tagged operations */
  allowedMethods: readonly HttpMethod[];
  /** Example user phrases that should route to this theme */
  triggers: readonly string[];
  /** True if this theme is intended for VIVI; false = built but excluded */
  exposeToVivi: boolean;
}

export const THEMES = {
  auth: {
    title: "Authentication API",
    description:
      "User login and profile lookup. Call BEFORE any write operation that requires an authenticated user. Returns a Bearer token (or sets one) used by other themed APIs. Use when the user wants to log in, sign in, fetch their profile, or update profile info.",
    tags: ["AppUser"],
    allowedMethods: ["GET", "POST"],
    triggers: ["log me in", "sign in", "what's my profile", "update my profile"],
    exposeToVivi: true,
  },

  membership: {
    title: "Membership API",
    description:
      "Members, member types, authorized visitors, member dashboards and member-level reports (financial, health, product performance). Use when the user asks about creating, deactivating, editing, or looking up members; managing membership types; or viewing member-related reports.",
    tags: ["Membership"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "create a member",
      "deactivate this member",
      "list member types",
      "show membership financial report",
      "find member by email",
    ],
    exposeToVivi: true,
  },

  booking: {
    title: "Booking API",
    description:
      "Bookings and reservations: catalog (services, packages, items), shopping cart, checkout, confirmation, blackouts, operational hours, cancel, no-show, change appointment. Use when the user asks anything about reservations, scheduling appointments, building a booking cart, or managing the booking catalog.",
    tags: ["BookingCatalog"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "book me an appointment",
      "add this to my cart",
      "checkout my booking",
      "cancel my reservation",
      "what services are available at property X",
    ],
    exposeToVivi: true,
  },

  venue: {
    title: "Venue API",
    description:
      "Venues and venue menus — create, update, delete, list. Use when the user asks about venues, dining venues, restaurants on a property, or venue menus.",
    tags: ["Venue"],
    allowedMethods: ["GET", "POST"],
    triggers: ["list venues at property X", "update menu for venue Y", "delete venue"],
    exposeToVivi: true,
  },

  communication: {
    title: "Communication API",
    description:
      "Email and SMS communications: templates, senders, mail/SMS groups, blasts, scheduled and recurring communications, SMS conversations (list/get/reply/send), and chat messages. Use when the user wants to send an email or SMS, manage templates, schedule a blast, or work with SMS conversations.",
    tags: ["Communication", "Chat"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "send an email blast",
      "create an SMS template",
      "schedule a recurring communication",
      "reply to this SMS conversation",
      "post a chat message",
    ],
    exposeToVivi: true,
  },

  requests: {
    title: "Service Requests API",
    description:
      "Service tickets / service requests — create, edit, assign, list, notes, reports, ticket details (front-end and back-end views), Bahia folio requests, user validation. Requires authentication for write operations. Use when the user asks about tickets, service requests, support issues, or ticket reports.",
    tags: ["Request"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "create a service request",
      "show open tickets",
      "add a note to ticket 123",
      "assign this ticket to user X",
      "show ticket reports",
    ],
    exposeToVivi: true,
  },

  survey: {
    title: "Survey API",
    description:
      "Surveys, survey questions, survey answers, and aggregated survey reports (ratings + comments). Use when the user asks about creating or publishing a survey, adding questions, submitting responses, or viewing survey results.",
    tags: ["Survey"],
    allowedMethods: ["GET", "POST"],
    triggers: ["create a survey", "submit survey answers", "show survey results"],
    exposeToVivi: true,
  },

  department: {
    title: "Department API",
    description:
      "Department configuration: settings, services, sub-services, items, escalation rules, and operational hours. Use when the user asks about departments, configuring department services, or managing escalation/hours for a department.",
    tags: ["Department"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "list departments at property X",
      "update department services",
      "set department operational hours",
    ],
    exposeToVivi: true,
  },

  tiles: {
    title: "Tiles API",
    description:
      "UI tile items shown in the dashboard/CMS — create, update, delete, list. Use when the user asks about tiles, dashboard tiles, or homepage tiles.",
    tags: ["Tiles"],
    allowedMethods: ["GET", "POST"],
    triggers: ["create a tile", "update tile X", "list tiles for property Y"],
    exposeToVivi: true,
  },

  list: {
    title: "Lists & Guests API",
    description:
      "Guest lists and active end-users by property — create/update/delete lists and guests, fetch a list with its guests. Use when the user asks about guest lists, list management, or active end-users at a property.",
    tags: ["List"],
    allowedMethods: ["GET", "POST"],
    triggers: ["create a guest list", "add a guest", "show active users at property X"],
    exposeToVivi: true,
  },

  vehicle: {
    title: "Vehicle API",
    description:
      "Vehicles linked to a membership — create, update, delete, get by ID, list by membership. Use when the user asks about vehicles, member vehicles, license plates, or vehicle registration.",
    tags: ["Vehicle"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "register my vehicle",
      "list vehicles for this member",
      "delete vehicle X",
    ],
    exposeToVivi: true,
  },

  financials: {
    title: "Financials API",
    description:
      "Invoices and transactions tied to profiles — create, update, cancel, delete, get by ID or by profile. Use when the user asks about invoices, billing, transactions, payments, or financial history for a profile.",
    tags: ["Invoice", "Transactions"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "create an invoice",
      "list transactions for profile X",
      "cancel invoice 123",
    ],
    exposeToVivi: true,
  },

  media: {
    title: "Media & Documents API",
    description:
      "Profile documents (upload, replace, delete, list for profile) and general media assets (add/edit/delete). Use when the user asks about uploading documents, attaching files to a profile, or managing media.",
    tags: ["Document", "Media"],
    allowedMethods: ["GET", "POST"],
    triggers: ["upload a document", "delete this media", "list documents for profile X"],
    exposeToVivi: true,
  },

  templates: {
    title: "Template Renderer API",
    description:
      "Content blocks, content parts, template details, render-to-HTML. Powers email/SMS template assembly. Use when the user asks about rendering templates, managing content blocks/parts, or generating final HTML from a template.",
    tags: ["TemplateRenderer"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "render this template",
      "create a content block",
      "list content parts for property X",
    ],
    exposeToVivi: true,
  },

  reports: {
    title: "Reports API",
    description:
      "Aggregate reports: top services, top requested items, top locations by items, top room-service locations. Use when the user asks for top-N reports, trending items/services, or location-level reporting.",
    tags: ["Report"],
    allowedMethods: ["GET", "POST"],
    triggers: ["top requested items", "top services this month", "top locations"],
    exposeToVivi: true,
  },

  property: {
    title: "Property API",
    description:
      "Properties: list properties (with branding/media), dashboard view, CMS view, property update, generate test QR. Use when the user asks about property-level info, the property dashboard, or property branding/CMS.",
    tags: ["Property"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "list all properties",
      "show property dashboard",
      "update property X",
      "generate test QR for property Y",
    ],
    exposeToVivi: true,
  },

  qr: {
    title: "QR Code API",
    description:
      "QR code creation, tracking, and reporting (separate from property test QR). Use when the user asks about creating/tracking QR codes or QR usage reports.",
    tags: ["QrCode"],
    allowedMethods: ["GET", "POST"],
    triggers: ["create a tracking QR", "show QR usage report", "scan QR for token X"],
    exposeToVivi: true,
  },

  "group-import": {
    title: "Group Import API",
    description:
      "Bulk member import jobs — submit a job, check status, list errors, cancel. Use when the user asks about importing members in bulk, checking import job status, or seeing import errors.",
    tags: ["GroupImport"],
    allowedMethods: ["GET", "POST"],
    triggers: [
      "import members in bulk",
      "check import job status",
      "show import errors",
      "cancel my import",
    ],
    exposeToVivi: true,
  },

  system: {
    title: "System / Internal API",
    description:
      "Root, /healthz, and ACS SMS inbound webhook. INTERNAL — not intended for VIVI agent usage. Set exposeToVivi=false to keep this out of the agent's tool list.",
    tags: ["MiddleWare"],
    allowedMethods: ["GET", "POST"],
    triggers: [],
    exposeToVivi: false,
  },
} as const satisfies Record<string, ThemeConfig>;

export type ThemeKey = keyof typeof THEMES;

/** All theme keys that should be importable into VIVI */
export const VIVI_THEME_KEYS: readonly ThemeKey[] = (
  Object.entries(THEMES) as [ThemeKey, ThemeConfig][]
)
  .filter(([, cfg]) => cfg.exposeToVivi)
  .map(([k]) => k);
