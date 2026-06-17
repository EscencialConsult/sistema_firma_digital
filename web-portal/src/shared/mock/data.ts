/**
 * Centralized mock data for all frontend features.
 * Each dataset is clearly separated and will be replaced by Supabase queries.
 *
 * TODO:SUPABASE — This entire file will be removed once all services connect to Supabase.
 */

import type { AuthUser } from "../types/user";
import type { KycVerification } from "../types/kyc";
import type { Contract, ContractDetail } from "../types/contract";
import type { SigningRequest, AuditEvent } from "../types/signing";

// ─── Mock Users ──────────────────────────────────────────────────────────────

export const MOCK_USERS: Record<string, AuthUser & { password: string }> = {
  admin: {
    id: "u-admin-001",
    email: "admin@escencial.com",
    fullName: "Santiago Admin",
    role: "ADMIN",
    verificationStatus: "VERIFIED",
    certificateStatus: "ACTIVE",
    password: "Admin123456",
  },
  verified: {
    id: "u-alumno-001",
    email: "alumno@gmail.com",
    fullName: "María González",
    role: "USER",
    verificationStatus: "VERIFIED",
    certificateStatus: "ACTIVE",
    password: "Alumno123",
  },
  pending: {
    id: "u-alumno-002",
    email: "nuevo@gmail.com",
    fullName: "Juan Pérez",
    role: "USER",
    verificationStatus: "PENDING",
    certificateStatus: "NONE",
    password: "Nuevo123",
  },
  inReview: {
    id: "u-alumno-003",
    email: "revision@gmail.com",
    fullName: "Lucas Rodríguez",
    role: "USER",
    verificationStatus: "IN_REVIEW",
    certificateStatus: "NONE",
    password: "Review123",
  },
  rejected: {
    id: "u-alumno-004",
    email: "rechazado@gmail.com",
    fullName: "Ana Martínez",
    role: "USER",
    verificationStatus: "REJECTED",
    certificateStatus: "NONE",
    password: "Rejected123",
  },
};

// ─── Mock KYC Verifications ─────────────────────────────────────────────────

export const MOCK_KYC_VERIFICATIONS: KycVerification[] = [
  {
    id: "kyc-001",
    userId: "u-alumno-003",
    status: "IN_REVIEW",
    personalData: {
      fullName: "Lucas Rodríguez",
      documentType: "DNI",
      documentNumber: "40123456",
      cuilCuit: "20-40123456-7",
      birthDate: "1998-03-15",
      phone: "+54 381 555 1234",
      address: "Av. Mate de Luna 2500",
      city: "San Miguel de Tucumán",
      province: "Tucumán",
      country: "Argentina",
    },
    documents: [
      { id: "doc-f", type: "DOCUMENT_FRONT", fileName: "dni_frente.jpg", mimeType: "image/jpeg", fileSize: 245000, uploadedAt: "2026-06-15T10:00:00Z" },
      { id: "doc-b", type: "DOCUMENT_BACK", fileName: "dni_dorso.jpg", mimeType: "image/jpeg", fileSize: 230000, uploadedAt: "2026-06-15T10:01:00Z" },
      { id: "doc-s", type: "SELFIE", fileName: "selfie.jpg", mimeType: "image/jpeg", fileSize: 320000, uploadedAt: "2026-06-15T10:02:00Z" },
    ],
    submittedAt: "2026-06-15T10:05:00Z",
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    createdAt: "2026-06-15T09:50:00Z",
  },
  {
    id: "kyc-002",
    userId: "u-alumno-004",
    status: "REJECTED",
    personalData: {
      fullName: "Ana Martínez",
      documentType: "DNI",
      documentNumber: "38765432",
      cuilCuit: "27-38765432-1",
      birthDate: "1995-11-20",
      phone: "+54 381 555 5678",
      address: "Calle Lamadrid 800",
      city: "San Miguel de Tucumán",
      province: "Tucumán",
      country: "Argentina",
    },
    documents: [
      { id: "doc-f2", type: "DOCUMENT_FRONT", fileName: "dni_frente.jpg", mimeType: "image/jpeg", fileSize: 210000, uploadedAt: "2026-06-14T14:00:00Z" },
      { id: "doc-b2", type: "DOCUMENT_BACK", fileName: "dni_dorso.jpg", mimeType: "image/jpeg", fileSize: 198000, uploadedAt: "2026-06-14T14:01:00Z" },
      { id: "doc-s2", type: "SELFIE", fileName: "selfie.jpg", mimeType: "image/jpeg", fileSize: 280000, uploadedAt: "2026-06-14T14:02:00Z" },
    ],
    submittedAt: "2026-06-14T14:05:00Z",
    reviewedAt: "2026-06-14T16:30:00Z",
    reviewedBy: "u-admin-001",
    rejectionReason: "La selfie no coincide con la foto del DNI. Por favor, tomá una nueva foto.",
    createdAt: "2026-06-14T13:45:00Z",
  },
];

// ─── Mock Contracts ─────────────────────────────────────────────────────────

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: "c-001",
    title: "Reconocimiento de Deuda — Curso Desarrollo Web Full Stack",
    description: "Contrato de capacitación y reconocimiento incondicional de deuda por el curso de Desarrollo Web Full Stack, cohorte Julio 2026.",
    status: "SENT",
    ownerEmail: "admin@escencial.com",
    sha256Hash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    versionNumber: 1,
    fileName: "contrato_webdev_maria_gonzalez.pdf",
    totalSigners: 1,
    completedSigners: 0,
    createdAt: "2026-06-10T09:00:00Z",
    updatedAt: "2026-06-10T09:30:00Z",
  },
  {
    id: "c-002",
    title: "Reconocimiento de Deuda — Curso UX/UI Design",
    description: "Contrato de capacitación y reconocimiento incondicional de deuda por el curso de UX/UI Design, cohorte Agosto 2026.",
    status: "SIGNED",
    ownerEmail: "admin@escencial.com",
    sha256Hash: "f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba98",
    versionNumber: 2,
    fileName: "contrato_uxui_maria_gonzalez_firmado.pdf",
    totalSigners: 1,
    completedSigners: 1,
    createdAt: "2026-05-20T11:00:00Z",
    updatedAt: "2026-05-22T15:45:00Z",
  },
  {
    id: "c-003",
    title: "Reconocimiento de Deuda — Curso Marketing Digital",
    description: "Contrato de capacitación y reconocimiento incondicional de deuda por el curso de Marketing Digital.",
    status: "EXPIRED",
    ownerEmail: "admin@escencial.com",
    sha256Hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    versionNumber: 1,
    fileName: "contrato_marketing_maria_gonzalez.pdf",
    totalSigners: 1,
    completedSigners: 0,
    createdAt: "2026-04-01T08:00:00Z",
    updatedAt: "2026-04-01T08:00:00Z",
  },
];

export const MOCK_CONTRACT_DETAIL: ContractDetail = {
  ...MOCK_CONTRACTS[0],
  pdfUrl: null,
  signers: [
    {
      id: "sr-001",
      email: "alumno@gmail.com",
      name: "María González",
      status: "PENDING",
      sentAt: "2026-06-10T09:30:00Z",
      viewedAt: null,
      signedAt: null,
    },
  ],
};

// ─── Mock Signing Requests ──────────────────────────────────────────────────

export const MOCK_SIGNING_REQUESTS: SigningRequest[] = [
  {
    id: "sr-001",
    documentId: "c-001",
    documentTitle: "Reconocimiento de Deuda — Curso Desarrollo Web Full Stack",
    signerEmail: "alumno@gmail.com",
    signerName: "María González",
    status: "PENDING",
    acceptedConformity: false,
    sha256Hash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    fileName: "contrato_webdev_maria_gonzalez.pdf",
    pdfUrl: null,
    sentAt: "2026-06-10T09:30:00Z",
    expiresAt: "2026-07-10T09:30:00Z",
  },
];

// ─── Mock Audit Events ──────────────────────────────────────────────────────

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "ae-001",
    action: "USER_REGISTERED",
    entityType: "user",
    entityId: "u-alumno-001",
    documentHash: null,
    ipAddress: "190.120.45.67",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    metadata: {},
    createdAt: "2026-05-15T10:00:00Z",
  },
  {
    id: "ae-002",
    action: "IDENTITY_VERIFIED",
    entityType: "identity_verification",
    entityId: "kyc-v-001",
    documentHash: null,
    ipAddress: "190.120.45.67",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    metadata: { reviewedBy: "u-admin-001" },
    createdAt: "2026-05-16T14:30:00Z",
  },
  {
    id: "ae-003",
    action: "DOCUMENT_SENT",
    entityType: "document",
    entityId: "c-002",
    documentHash: "f6e5d4c3b2a1...",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    metadata: { signers: 1 },
    createdAt: "2026-05-20T11:15:00Z",
  },
  {
    id: "ae-004",
    action: "DOCUMENT_ACCEPTED",
    entityType: "signature_request",
    entityId: "sr-old-001",
    documentHash: "f6e5d4c3b2a1...",
    ipAddress: "190.120.45.67",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    metadata: { email: "alumno@gmail.com" },
    createdAt: "2026-05-22T15:40:00Z",
  },
  {
    id: "ae-005",
    action: "DOCUMENT_SIGNED",
    entityType: "signature_request",
    entityId: "sr-old-001",
    documentHash: "f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba98",
    ipAddress: "190.120.45.67",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    metadata: { signatureType: "DIGITAL_CERTIFICATE", otpValidated: true },
    createdAt: "2026-05-22T15:45:00Z",
  },
  {
    id: "ae-006",
    action: "DOCUMENT_COMPLETED",
    entityType: "document",
    entityId: "c-002",
    documentHash: "f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba98",
    ipAddress: "190.120.45.67",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    metadata: {},
    createdAt: "2026-05-22T15:45:01Z",
  },
];

// ─── Mock Admin Stats ───────────────────────────────────────────────────────

export const MOCK_ADMIN_STATS = {
  totalUsers: 47,
  verifiedUsers: 38,
  pendingKyc: 3,
  totalContracts: 124,
  signedContracts: 98,
  pendingContracts: 18,
  rejectedContracts: 8,
};

// ─── Mock OTP ───────────────────────────────────────────────────────────────

/** The mock OTP code that always validates. Marked for replacement. */
export const MOCK_VALID_OTP = "123456";
