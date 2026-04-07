import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileId, FileSystemEntry } from "../backend";
import { useActor } from "./useActor";

// Extended actor type that includes password methods added to the backend
type ExtendedActor = {
  listFilesByFolder(
    folderId: FileId | null,
  ): Promise<Array<FileSystemEntry & { isLocked?: boolean }>>;
  getFileById(id: FileId): Promise<FileSystemEntry & { isLocked?: boolean }>;
  getTextFileContent(id: FileId): Promise<string>;
  createFolder(name: string, parentFolderId: FileId | null): Promise<FileId>;
  storeTextFileContent(
    name: string,
    content: string,
    parentFolderId: FileId | null,
  ): Promise<FileId>;
  updateTextContent(id: FileId, newContent: string): Promise<void>;
  renameFile(id: FileId, newName: string): Promise<void>;
  deleteFile(id: FileId): Promise<void>;
  setFilePassword(id: FileId, passwordHash: string): Promise<void>;
  removeFilePassword(id: FileId, currentPasswordHash: string): Promise<void>;
  verifyFilePassword(id: FileId, passwordHash: string): Promise<boolean>;
  isFileLocked(id: FileId): Promise<boolean>;
};

// Extended FileSystemEntry with isLocked
export type FileEntry = FileSystemEntry & { isLocked: boolean };

export function useListFiles(folderId: FileId | null) {
  const { actor, isFetching } = useActor();
  return useQuery<FileEntry[]>({
    queryKey: ["files", folderId],
    queryFn: async () => {
      if (!actor) return [];
      const ext = actor as unknown as ExtendedActor;
      const result = await ext.listFilesByFolder(folderId);
      return result.map((f) => ({ ...f, isLocked: f.isLocked ?? false }));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetFile(id: FileId | null) {
  const { actor, isFetching } = useActor();
  return useQuery<FileEntry | null>({
    queryKey: ["file", id],
    queryFn: async () => {
      if (!actor || !id) return null;
      const ext = actor as unknown as ExtendedActor;
      const result = await ext.getFileById(id);
      return { ...result, isLocked: result.isLocked ?? false };
    },
    enabled: !!actor && !isFetching && !!id,
  });
}

export function useGetTextContent(id: FileId | null) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["textContent", id],
    queryFn: async () => {
      if (!actor || !id) return "";
      return actor.getTextFileContent(id);
    },
    enabled: !!actor && !isFetching && !!id,
  });
}

export function useCreateFolder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      parentFolderId,
    }: {
      name: string;
      parentFolderId: FileId | null;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.createFolder(name, parentFolderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useStoreTextFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      content,
      parentFolderId,
    }: {
      name: string;
      content: string;
      parentFolderId: FileId | null;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.storeTextFileContent(name, content, parentFolderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useUpdateTextContent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      content,
    }: {
      id: FileId;
      content: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateTextContent(id, content);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["textContent", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["file", vars.id] });
    },
  });
}

export function useRenameFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newName }: { id: FileId; newName: string }) => {
      if (!actor) throw new Error("Not connected");
      return actor.renameFile(id, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["file"] });
    },
  });
}

export function useDeleteFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: FileId) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteFile(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useStoreUploadedFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      mimeType,
      size,
      blobId,
      parentFolderId,
      textContent,
    }: {
      name: string;
      mimeType: string;
      size: number;
      blobId: string;
      parentFolderId: FileId | null;
      textContent?: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      if (textContent !== undefined) {
        return actor.storeTextFileContent(name, textContent, parentFolderId);
      }
      return actor.storeTextFileContent(
        name,
        JSON.stringify({ __blobId: blobId, mimeType, size }),
        parentFolderId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useSetFilePassword() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      passwordHash,
    }: {
      id: FileId;
      passwordHash: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      const ext = actor as unknown as ExtendedActor;
      return ext.setFilePassword(id, passwordHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useRemoveFilePassword() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      currentPasswordHash,
    }: {
      id: FileId;
      currentPasswordHash: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      const ext = actor as unknown as ExtendedActor;
      return ext.removeFilePassword(id, currentPasswordHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useVerifyFilePassword() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      id,
      passwordHash,
    }: {
      id: FileId;
      passwordHash: string;
    }): Promise<boolean> => {
      if (!actor) throw new Error("Not connected");
      const ext = actor as unknown as ExtendedActor;
      return ext.verifyFilePassword(id, passwordHash);
    },
  });
}
