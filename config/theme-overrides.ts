/**
 * config/theme-overrides.ts
 * --------------------------------------------------------------------------
 * THIS FILE IS OPTIONAL.
 *
 * By default, every tag in the source swagger automatically becomes its own
 * theme — title is the tag name, description is auto-generated from operation
 * summaries, key is the slugified tag.
 *
 * You only edit this file when you want to:
 *   1. Rename a theme key (e.g., "AppUser" → "auth", "BookingCatalog" → "booking")
 *   2. Group multiple tags into one theme (e.g., "Communication" + "Chat")
 *   3. Hide a tag from VIVI entirely (e.g., internal "MiddleWare")
 *   4. Replace the auto-generated description with a hand-written one
 *   5. Restrict the HTTP methods exposed for a theme
 *   6. Provide example trigger phrases for the agent
 *
 * Anything NOT listed here just uses defaults. New backend tags appear
 * automatically after the next refresh — no code change required.
 *
 * IMPORTANT: changing a theme `key` here changes its public URL
 *   (https://<domain>/themes/<key>/openapi.json). You'll need to re-import
 *   that integration in VIVI. Stable keys = no churn.
 * --------------------------------------------------------------------------
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ThemeOverride {
  /** Public theme key. If omitted, the tag name is slugified. */
  key?: string;
  /** Human-readable title. If omitted, "<tag> API" is used. */
  title?: string;
  /** Description for the VIVI agent. If omitted, auto-generated from op summaries. */
  description?: string;
  /** Additional tags to merge into this theme (their endpoints are bundled in). */
  mergeTags?: string[];
  /** If true, this tag is dropped from the themes listing entirely. */
  hidden?: boolean;
  /** HTTP methods allowed; if omitted, all methods present in the source are kept. */
  allowedMethods?: HttpMethod[];
  /** Example user phrases — used by the system prompt generator. */
  triggers?: string[];
}

/**
 * Map of source-tag → override. Tags not listed here use auto-defaults.
 * The key is the EXACT tag string from the source swagger.
 */
export const TAG_OVERRIDES: Record<string, ThemeOverride> = {
  AppUser: {
    key: "auth",
    title: "Authentication API",
    description:
      "Log a user in and look up or update their profile. Call BEFORE any action that requires an authenticated user — returns the JWT used by the other APIs.",
    triggers: ["log me in", "sign in", "what's my profile", "update my profile"],
  },

  BookingCatalog: {
    key: "booking",
    title: "Booking API",
    description:
      "Bookings and reservations: catalog (services, packages, items), shopping cart, checkout, confirmation, blackouts, operational hours, cancel, no-show, change appointment.",
    triggers: [
      "book me an appointment",
      "add this to my cart",
      "checkout my booking",
      "cancel my reservation",
    ],
  },

  Communication: {
    key: "communication",
    title: "Communication API",
    mergeTags: ["Chat"],
    description:
      "Send and schedule email and SMS, manage templates, mail/SMS groups, blasts, recurring communications, SMS conversations, and chat messages.",
    triggers: [
      "send an email blast",
      "create an SMS template",
      "schedule a recurring communication",
      "reply to this SMS conversation",
    ],
  },
  Chat: { hidden: true }, // merged into communication

  Invoice: {
    key: "financials",
    title: "Financials API",
    mergeTags: ["Transactions"],
    description:
      "Invoices and transactions tied to profiles — create, update, cancel, list by profile.",
    triggers: ["create an invoice", "list transactions for profile X", "cancel invoice 123"],
  },
  Transactions: { hidden: true }, // merged into financials

  Document: {
    key: "media",
    title: "Media & Documents API",
    mergeTags: ["Media"],
    description:
      "Profile documents and media assets — upload, replace, delete, and list.",
    triggers: ["upload a document", "delete this media", "list documents for profile X"],
  },
  Media: { hidden: true }, // merged into media

  Request: {
    key: "requests",
    title: "Service Requests API",
    description:
      "Service tickets — create, edit, assign, list, add notes, view ticket reports.",
    triggers: [
      "create a service request",
      "show open tickets",
      "add a note to ticket 123",
    ],
  },

  TemplateRenderer: {
    key: "templates",
    title: "Template Renderer API",
    description:
      "Manage content blocks and parts; render templates to final HTML for email/SMS.",
    triggers: ["render this template", "create a content block"],
  },

  GroupImport: {
    key: "group-import",
    title: "Group Import API",
    description:
      "Bulk member import jobs — submit a job, check status, list errors, cancel.",
    triggers: ["import members in bulk", "check import job status"],
  },

  QrCode: {
    key: "qr",
    title: "QR Code API",
    description:
      "QR code creation, tracking, and reporting (separate from property test QR).",
    triggers: ["create a tracking QR", "show QR usage report"],
  },

  Membership: {
    description:
      "Members, member types, authorized visitors, member dashboards and member-level reports (financial, health, product performance).",
    triggers: [
      "create a member",
      "deactivate this member",
      "list member types",
      "show membership financial report",
    ],
  },

  Venue: {
    description: "Venues and venue menus — create, update, delete, list.",
    triggers: ["list venues at property X", "update menu for venue Y"],
  },

  Survey: {
    description:
      "Surveys, survey questions, survey answers, and aggregated survey reports (ratings + comments).",
    triggers: ["create a survey", "submit survey answers", "show survey results"],
  },

  Department: {
    description:
      "Department configuration: settings, services, sub-services, items, escalation rules, operational hours.",
    triggers: ["list departments at property X", "set department operational hours"],
  },

  Tiles: {
    description: "UI tile items shown in the dashboard/CMS — create, update, delete, list.",
    triggers: ["create a tile", "list tiles for property Y"],
  },

  List: {
    title: "Lists & Guests API",
    description:
      "Guest lists and active end-users by property — create/update/delete lists and guests.",
    triggers: ["create a guest list", "add a guest", "show active users at property X"],
  },

  Vehicle: {
    description: "Vehicles linked to a membership — create, update, delete, get, list by membership.",
    triggers: ["register my vehicle", "list vehicles for this member"],
  },

  Report: {
    key: "reports",
    title: "Reports API",
    description:
      "Aggregate top-N reports: top services, top requested items, top locations, top room-service.",
    triggers: ["top requested items", "top services", "top locations"],
  },

  Property: {
    description:
      "Properties: list, dashboard view, CMS view, update property profile, generate test QR.",
    triggers: ["list all properties", "show property dashboard", "update property X"],
  },

  // Internal — never exposed to VIVI
  MiddleWare: { hidden: true },
};
