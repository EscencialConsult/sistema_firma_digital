/**
 * KYC (Identity Verification) service — Mock implementation.
 * TODO:SUPABASE — Replace with supabase.from('identity_verifications'), supabase.storage, etc.
 */

import type { KycVerification, KycPersonalData, KycDocument, KycDocumentType } from "../types/kyc";
import { MOCK_KYC_VERIFICATIONS } from "../mock/data";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single()
export async function getMyVerification(userId: string): Promise<KycVerification | null> {
  await delay();
  return MOCK_KYC_VERIFICATIONS.find((v) => v.userId === userId) ?? null;
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').insert({ user_id: userId, status: 'PENDING' }).select().single()
export async function startVerification(userId: string): Promise<KycVerification> {
  await delay();
  return {
    id: `kyc-new-${Date.now()}`,
    userId,
    status: "PENDING",
    personalData: null,
    documents: [],
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  };
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').update(data).eq('id', verificationId)
export async function savePersonalData(
  _verificationId: string,
  data: KycPersonalData
): Promise<KycPersonalData> {
  await delay();
  return data;
}

// TODO:SUPABASE — Replace with supabase.storage.from('identity-documents').upload(path, file)
export async function uploadDocument(
  _verificationId: string,
  type: KycDocumentType,
  file: File
): Promise<KycDocument> {
  await delay(800);
  return {
    id: `doc-${Date.now()}`,
    type,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    previewUrl: URL.createObjectURL(file),
  };
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').update({ status: 'IN_REVIEW', submitted_at: now() }).eq('id', verificationId)
export async function submitVerification(_verificationId: string): Promise<void> {
  await delay();
}

// ─── Admin functions ────────────────────────────────────────────────────────

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').select('*, users(*)').order('created_at', { ascending: false })
export async function listAllVerifications(statusFilter?: string): Promise<KycVerification[]> {
  await delay();
  if (statusFilter) {
    return MOCK_KYC_VERIFICATIONS.filter((v) => v.status === statusFilter);
  }
  return MOCK_KYC_VERIFICATIONS;
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').select('*').eq('id', id).single()
export async function getVerificationById(id: string): Promise<KycVerification | null> {
  await delay();
  return MOCK_KYC_VERIFICATIONS.find((v) => v.id === id) ?? null;
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').update({ status: 'VERIFIED', reviewed_at: now(), reviewed_by: adminId }).eq('id', id)
export async function approveVerification(_id: string, _adminId: string): Promise<void> {
  await delay();
}

// TODO:SUPABASE — Replace with supabase.from('identity_verifications').update({ status: 'REJECTED', rejection_reason: reason, reviewed_at: now(), reviewed_by: adminId }).eq('id', id)
export async function rejectVerification(
  _id: string,
  _adminId: string,
  _reason: string
): Promise<void> {
  await delay();
}
