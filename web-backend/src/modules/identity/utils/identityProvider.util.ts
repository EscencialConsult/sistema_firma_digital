import type { IdentityProvider } from "../identity.types.js";

export class ManualIdentityProvider implements IdentityProvider {
  async startVerification(userId: string) {
    return { providerVerificationId: `manual:${userId}` };
  }

  async verifyDocument() {
    return { status: "IN_REVIEW" as const, metadata: { provider: "manual" } };
  }

  async verifySelfie() {
    return { status: "IN_REVIEW" as const, metadata: { provider: "manual" } };
  }

  async getStatus() {
    return { status: "IN_REVIEW" as const, metadata: { provider: "manual" } };
  }
}

export const identityProvider = new ManualIdentityProvider();
