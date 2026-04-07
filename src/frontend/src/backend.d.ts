import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface FileSystemEntry {
    id: FileId;
    owner: Principal;
    name: string;
    size: bigint;
    isFolder: boolean;
    mimeType: string;
    parentFolderId?: FileId;
    blobId?: string;
    uploadDate: Time;
    textContent?: string;
    isLocked: boolean;
}
export type FileId = string;
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createFolder(name: string, parentFolderId: FileId | null): Promise<FileId>;
    deleteFile(id: FileId): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getFileById(id: FileId): Promise<FileSystemEntry>;
    getTextFileContent(id: FileId): Promise<string>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listFilesByFolder(folderId: FileId | null): Promise<Array<FileSystemEntry>>;
    renameFile(id: FileId, newName: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    storeTextFileContent(name: string, content: string, parentFolderId: FileId | null): Promise<FileId>;
    updateTextContent(id: FileId, newContent: string): Promise<void>;
    setFilePassword(id: FileId, passwordHash: string): Promise<void>;
    removeFilePassword(id: FileId, currentPasswordHash: string): Promise<void>;
    verifyFilePassword(id: FileId, passwordHash: string): Promise<boolean>;
    isFileLocked(id: FileId): Promise<boolean>;
}
