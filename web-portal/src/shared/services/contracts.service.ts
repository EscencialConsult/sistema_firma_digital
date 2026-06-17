/**
 * Contracts service — Mock implementation.
 * TODO:SUPABASE — Replace with supabase.from('documents'), supabase.from('signature_requests'), etc.
 */

import type { Contract, ContractDetail } from "../types/contract";
import { MOCK_CONTRACTS, MOCK_CONTRACT_DETAIL } from "../mock/data";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

// TODO:SUPABASE — Replace with supabase.from('documents').select('*, signature_requests(*)').eq('owner_id', userId) or by signer email
export async function getMyContracts(): Promise<Contract[]> {
  await delay();
  return MOCK_CONTRACTS;
}

// TODO:SUPABASE — Replace with supabase.from('documents').select('*, document_versions(*), signature_requests(*)').eq('id', id).single()
export async function getContractById(id: string): Promise<ContractDetail | null> {
  await delay();
  if (id === MOCK_CONTRACT_DETAIL.id) return MOCK_CONTRACT_DETAIL;
  const contract = MOCK_CONTRACTS.find((c) => c.id === id);
  if (!contract) return null;
  return { ...contract, pdfUrl: null, signers: [] };
}

// ─── Admin functions ────────────────────────────────────────────────────────

// TODO:SUPABASE — Replace with supabase.from('documents').select('*, users!owner_id(email, full_name)').order('updated_at', { ascending: false })
export async function getAllContracts(): Promise<Contract[]> {
  await delay();
  return MOCK_CONTRACTS;
}
