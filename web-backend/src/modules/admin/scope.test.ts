import assert from "node:assert/strict";
import test from "node:test";
import { scopedUserWhere } from "./scope.js";

test("does not scope global admins", () => {
  const params: unknown[] = [];
  const clause = scopedUserWhere({ id: "admin", email: "admin@example.com", role: "ADMIN" }, "u", params);
  assert.equal(clause, "");
  assert.deepEqual(params, []);
});

test("scopes organization admins to their organization", () => {
  const params: unknown[] = [];
  const clause = scopedUserWhere({
    id: "org-admin",
    email: "org@example.com",
    role: "ORGANIZATION_ADMIN",
    organizationId: "11111111-1111-1111-1111-111111111111"
  }, "u", params);
  assert.equal(clause, " AND u.organization_id = $1");
  assert.deepEqual(params, ["11111111-1111-1111-1111-111111111111"]);
});

test("organization admins without organization do not receive global access", () => {
  const params: unknown[] = [];
  const clause = scopedUserWhere({ id: "org-admin", email: "org@example.com", role: "ORGANIZATION_ADMIN" }, "u", params);
  assert.equal(clause, " AND u.organization_id::text = $1");
  assert.deepEqual(params, ["__no_organization__"]);
});
