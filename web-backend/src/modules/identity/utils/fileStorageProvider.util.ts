import fs from "node:fs/promises";
import path from "node:path";

export type FileUploadResult = {
  path: string;
};

export interface FileStorageProvider {
  upload(file: Buffer, path: string): Promise<FileUploadResult>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string): Promise<string>;
}

export class LocalPrivateFileStorageProvider implements FileStorageProvider {
  async upload(file: Buffer, targetPath: string): Promise<FileUploadResult> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file);
    return { path: targetPath };
  }

  async delete(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { force: true });
  }

  async getSignedUrl(_targetPath: string): Promise<string> {
    throw new Error("Signed URLs are not available for local private storage.");
  }
}

export const localFileStorageProvider = new LocalPrivateFileStorageProvider();
