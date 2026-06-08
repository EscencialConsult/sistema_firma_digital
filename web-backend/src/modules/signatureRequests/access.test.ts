import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/AppError.js";
import { assertCanReadDocumentAudit, canReadDocumentAudit } from "./access.js";

const owner = { id: "user-1", email: "owner@example.com", role: "USER" };
const signer = { id: "user-2", email: "signer@example.com", role: "USER" };
const outsider = { id: "user-3", email: "outsider@example.com", role: "USER" };
const admin = { id: "admin-1", email: "admin@example.com", role: "ADMIN" };
const orgAdmin = { id: "org-admin-1", email: "org-admin@example.com", role: "ORGANIZATION_ADMIN" };
const document = { owner_id: owner.id };

test("allows the document owner to read document audit", () => {
  assert.equal(canReadDocumentAudit(owner, document, false), true);
});

test("allows admins to read document audit", () => {
  assert.equal(canReadDocumentAudit(admin, document, false), true);
  assert.equal(canReadDocumentAudit(orgAdmin, document, false), true);
});

test("allows a signer to read document audit", () => {
  assert.equal(canReadDocumentAudit(signer, document, true), true);
});

test("blocks an authenticated outsider from reading document audit", () => {
  assert.throws(
    () => assertCanReadDocumentAudit(outsider, document, false),
    (error) => error instanceof AppError && error.statusCode === 403 && error.code === "FORBIDDEN"
  );
});
