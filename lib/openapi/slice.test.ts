/**
 * lib/openapi/slice.test.ts
 * Run with:  npx tsx --test lib/openapi/slice.test.ts
 *
 * Uses node:test (built-in, no extra dep). Verifies the slicer against a
 * fake swagger covering: filtering, op-id generation, recursive ref walking,
 * circular refs, securitySchemes preservation, and unknown-theme errors.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildThemedSchema,
  makeOperationId,
  parseRef,
  pickReferencedComponents,
} from "./slice";
import type { SourceSwagger } from "../catalog/types";
import type { ThemeConfig } from "@/config/themes";

const FAKE_THEMES: Record<string, ThemeConfig> = {
  members: {
    title: "Members",
    description: "members",
    tags: ["Members"],
    allowedMethods: ["GET", "POST"],
    triggers: [],
    exposeToVivi: true,
  },
  authOnly: {
    title: "Auth",
    description: "auth",
    tags: ["Auth"],
    allowedMethods: ["POST"],
    triggers: [],
    exposeToVivi: true,
  },
};

function fakeSwagger(): SourceSwagger {
  return {
    openapi: "3.0.4",
    info: { title: "Fake", version: "1" },
    paths: {
      "/api/Members/get": {
        post: {
          tags: ["Members"],
          summary: "Get member",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MemberQuery" },
              },
            },
          },
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Member" },
                },
              },
            },
          },
        },
        get: {
          tags: ["Members"],
          summary: "List members",
          responses: { "200": { description: "ok" } },
        },
      },
      "/api/Auth/Login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Credentials" },
              },
            },
          },
          responses: { "200": { description: "ok" } },
        },
      },
      "/api/Members/dangerous": {
        delete: {
          tags: ["Members"],
          summary: "Delete member",
          responses: { "200": { description: "ok" } },
        },
      },
      "/api/Untagged": {
        post: {
          summary: "Untagged",
          responses: { "200": { description: "ok" } },
        },
      },
    },
    components: {
      schemas: {
        Member: {
          type: "object",
          properties: {
            id: { type: "string" },
            address: { $ref: "#/components/schemas/Address" },
            // self-reference (circular)
            spouse: { $ref: "#/components/schemas/Member" },
          },
        },
        Address: {
          type: "object",
          properties: {
            country: { $ref: "#/components/schemas/Country" },
          },
        },
        Country: {
          type: "object",
          properties: { code: { type: "string" } },
        },
        MemberQuery: {
          type: "object",
          properties: { id: { type: "string" } },
        },
        Credentials: {
          type: "object",
          properties: {
            username: { type: "string" },
            password: { type: "string" },
          },
        },
        // Should NOT appear in members slice (no path refs it)
        Unrelated: { type: "object" },
      },
      securitySchemes: {
        Bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  };
}

test("makeOperationId generates expected format", () => {
  assert.equal(
    makeOperationId("Request", "POST", "/api/Request/CreateRequest"),
    "Request_POST_api_Request_CreateRequest",
  );
  assert.equal(
    makeOperationId("AppUser", "POST", "/Login"),
    "AppUser_POST_Login",
  );
  assert.equal(
    makeOperationId("Membership", "GET", "/api/Membership/members/get-by-id"),
    "Membership_GET_api_Membership_members_get_by_id",
  );
});

test("parseRef parses #/components/<section>/<name>", () => {
  assert.deepEqual(parseRef("#/components/schemas/Foo"), {
    section: "schemas",
    name: "Foo",
  });
  assert.equal(parseRef("not-a-ref"), null);
  assert.equal(parseRef("#/paths/foo"), null);
});

test("buildThemedSchema filters by tag and method", () => {
  const themed = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  // /api/Members/get -> both GET + POST kept
  assert.ok(themed.paths["/api/Members/get"]?.post);
  assert.ok(themed.paths["/api/Members/get"]?.get);
  // /api/Members/dangerous DELETE is filtered out (allowedMethods is GET+POST)
  assert.ok(!themed.paths["/api/Members/dangerous"]);
  // /api/Auth/Login filtered out (different tag)
  assert.ok(!themed.paths["/api/Auth/Login"]);
  // /api/Untagged filtered out (no tag match)
  assert.ok(!themed.paths["/api/Untagged"]);
});

test("buildThemedSchema injects deterministic operationId", () => {
  const themed = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  assert.equal(
    themed.paths["/api/Members/get"].post.operationId,
    "Members_POST_api_Members_get",
  );
  assert.equal(
    themed.paths["/api/Members/get"].get.operationId,
    "Members_GET_api_Members_get",
  );
});

test("buildThemedSchema injects servers", () => {
  const themed = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  assert.deepEqual(themed.servers, [{ url: "https://pprvmw.com" }]);

  const overridden = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
    serverUrl: "https://example.test",
  });
  assert.deepEqual(overridden.servers, [{ url: "https://example.test" }]);
});

test("buildThemedSchema walks $ref graph recursively (transitive + circular)", () => {
  const themed = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  const schemas = themed.components.schemas as Record<string, unknown>;
  // Direct refs
  assert.ok(schemas.Member, "Member should be included (direct ref)");
  assert.ok(schemas.MemberQuery, "MemberQuery should be included (direct ref)");
  // Transitive refs
  assert.ok(schemas.Address, "Address should be included (Member -> Address)");
  assert.ok(
    schemas.Country,
    "Country should be included (Member -> Address -> Country)",
  );
  // Unrelated should NOT be included
  assert.ok(!schemas.Unrelated, "Unrelated must not leak in");
});

test("buildThemedSchema preserves securitySchemes always", () => {
  const themed = buildThemedSchema("members", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  const sec = themed.components.securitySchemes as Record<string, unknown>;
  assert.ok(sec?.Bearer, "Bearer scheme should always be preserved");
});

test("buildThemedSchema isolates themes (auth slice excludes member schemas)", () => {
  const themed = buildThemedSchema("authOnly", fakeSwagger(), {
    themesOverride: FAKE_THEMES,
  });
  assert.ok(themed.paths["/api/Auth/Login"]?.post);
  assert.ok(!themed.paths["/api/Members/get"]);

  const schemas = themed.components.schemas as Record<string, unknown>;
  assert.ok(schemas?.Credentials, "Credentials should be included");
  assert.ok(!schemas?.Member, "Member must not leak into auth theme");
  assert.ok(!schemas?.Address, "Address must not leak into auth theme");
});

test("buildThemedSchema throws on unknown theme", () => {
  assert.throws(
    () =>
      buildThemedSchema("does-not-exist", fakeSwagger(), {
        themesOverride: FAKE_THEMES,
      }),
    /Unknown theme/,
  );
});

test("pickReferencedComponents returns empty when components missing", () => {
  const out = pickReferencedComponents(undefined, [{ $ref: "#/components/schemas/X" }]);
  assert.deepEqual(out, {});
});
