import { apiClient } from "../../../shared/services/apiClient";
import type { IdentityVerification, PersonalData } from "../types/identity.types";

type ApiResponse<T> = { data: T };

export const identityApi = {
  me() {
    return apiClient.get<ApiResponse<IdentityVerification | null>>("/identity/me");
  },
  start() {
    return apiClient.post<ApiResponse<IdentityVerification>>("/identity/start");
  },
  updatePersonalData(data: PersonalData) {
    return apiClient.patch<ApiResponse<IdentityVerification>>("/identity/personal-data", data);
  },
  submit(payload: { declarationAccepted: true; declarationText: string; declarationVersion: string }) {
    return apiClient.post<ApiResponse<IdentityVerification>>("/identity/submit", payload);
  },
  uploadDocumentFront(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<ApiResponse<any>>("/identity/upload-document-front", formData);
  },
  uploadDocumentBack(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<ApiResponse<any>>("/identity/upload-document-back", formData);
  },
  uploadSelfie(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<ApiResponse<any>>("/identity/upload-selfie", formData);
  }
};
