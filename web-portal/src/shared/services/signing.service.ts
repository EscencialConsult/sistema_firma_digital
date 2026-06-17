/**
 * Signing flow service — Mock implementation.
 * Handles conformity acceptance, OTP validation, and signature execution.
 * TODO:SUPABASE — Replace with supabase.functions.invoke(), supabase.from('signature_requests'), etc.
 */

import type { SigningRequest, OtpChallenge, SignatureResult } from "../types/signing";
import { MOCK_SIGNING_REQUESTS, MOCK_VALID_OTP } from "../mock/data";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}

// TODO:SUPABASE — Replace with supabase.from('signature_requests').select('*, documents(*, document_versions(*))').eq('signer_email', email)
export async function getMySigningRequests(email: string): Promise<SigningRequest[]> {
  await delay();
  return MOCK_SIGNING_REQUESTS.filter(
    (r) => r.signerEmail.toLowerCase() === email.toLowerCase()
  );
}

// TODO:SUPABASE — Replace with supabase.from('signature_requests').select('*, documents(*, document_versions(*))').eq('id', id).single()
export async function getSigningRequest(id: string): Promise<SigningRequest | null> {
  await delay();
  return MOCK_SIGNING_REQUESTS.find((r) => r.id === id) ?? null;
}

// TODO:SUPABASE — Replace with supabase.from('conformity_acceptances').insert({...})
export async function acceptConformity(requestId: string, acceptanceText: string): Promise<void> {
  await delay();
  const request = MOCK_SIGNING_REQUESTS.find((r) => r.id === requestId);
  if (request) {
    request.acceptedConformity = true;
    request.status = "CONFORMITY_ACCEPTED";
  }
}

// TODO:SUPABASE — Replace with supabase.functions.invoke('send-otp', { body: { requestId } })
export async function requestOtp(requestId: string, email: string): Promise<OtpChallenge> {
  await delay(600);
  console.log(`[MOCK] OTP enviado para request ${requestId}. Código válido: ${MOCK_VALID_OTP}`);
  return {
    maskedEmail: maskEmail(email),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

// TODO:SUPABASE — Replace with supabase.functions.invoke('verify-otp', { body: { requestId, code } })
export async function verifyOtp(_requestId: string, code: string): Promise<boolean> {
  await delay(300);
  return code === MOCK_VALID_OTP;
}

// TODO:SUPABASE — Replace with supabase.functions.invoke('execute-signature', { body: { requestId, metadata } })
export async function executeSignature(
  requestId: string,
  _metadata: Record<string, unknown>
): Promise<SignatureResult> {
  await delay(1200);
  const request = MOCK_SIGNING_REQUESTS.find((r) => r.id === requestId);
  if (request) {
    request.status = "SIGNED";
  }
  return {
    signatureId: `sig-${Date.now()}`,
    documentHash: "f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba98",
    signedAt: new Date().toISOString(),
    signerEmail: request?.signerEmail ?? "desconocido",
    signerName: request?.signerName ?? "Desconocido",
    ipAddress: "190.120.45.67",
  };
}

// TODO:SUPABASE — Replace with supabase.from('signature_requests').update({ status: 'REJECTED' }).eq('id', requestId)
export async function rejectSigning(requestId: string, _reason?: string): Promise<void> {
  await delay();
  const request = MOCK_SIGNING_REQUESTS.find((r) => r.id === requestId);
  if (request) {
    request.status = "REJECTED";
  }
}
