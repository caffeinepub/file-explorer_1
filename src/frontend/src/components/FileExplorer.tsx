import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import {
  FilePlus,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { FileId } from "../backend";
import { loadConfig } from "../config";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useCreateFolder,
  useDeleteFile,
  useListFiles,
  useRemoveFilePassword,
  useRenameFile,
  useSetFilePassword,
  useStoreTextFile,
  useUpdateTextContent,
  useVerifyFilePassword,
} from "../hooks/useQueries";
import type { FileEntry } from "../hooks/useQueries";
import { StorageClient } from "../utils/StorageClient";
import { hashPassword } from "../utils/hashPassword";
import FileViewer from "./FileViewer";
import SidebarPanel from "./Sidebar";

type UploadState = {
  uploading: boolean;
  progress: number;
  fileName: string;
};

export default function FileExplorer() {
  const { clear, identity } = useInternetIdentity();
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [currentFolderId, setCurrentFolderId] = useState<FileId | null>(null);
  const [folderPath, setFolderPath] = useState<
    { id: FileId | null; name: string }[]
  >([{ id: null, name: "Home" }]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  // Session unlock cache
  const [unlockedFileIds, setUnlockedFileIds] = useState<Set<string>>(
    new Set(),
  );

  // Dialogs
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState("");

  // Set/Change password dialog
  const [passwordTarget, setPasswordTarget] = useState<FileEntry | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Remove password dialog
  const [removePasswordTarget, setRemovePasswordTarget] =
    useState<FileEntry | null>(null);
  const [removePasswordOpen, setRemovePasswordOpen] = useState(false);
  const [removePasswordInput, setRemovePasswordInput] = useState("");
  const [removePasswordError, setRemovePasswordError] = useState("");
  const [isRemovingPassword, setIsRemovingPassword] = useState(false);

  // Unlock file dialog
  const [unlockTarget, setUnlockTarget] = useState<FileEntry | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);

  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    fileName: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading: filesLoading } =
    useListFiles(currentFolderId);
  const createFolder = useCreateFolder();
  const storeTextFile = useStoreTextFile();
  const updateText = useUpdateTextContent();
  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const setFilePassword = useSetFilePassword();
  const removeFilePasswordMutation = useRemoveFilePassword();
  const verifyFilePassword = useVerifyFilePassword();

  // Navigate into folder
  const navigateToFolder = useCallback((folder: FileEntry) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
  }, []);

  // Navigate via breadcrumb
  const navigateBreadcrumb = useCallback(
    (index: number) => {
      const crumb = folderPath[index];
      setCurrentFolderId(crumb.id);
      setFolderPath((prev) => prev.slice(0, index + 1));
      setSelectedFile(null);
    },
    [folderPath],
  );

  // Create new folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
      });
      toast.success(`Folder "${newFolderName.trim()}" created`);
      setNewFolderOpen(false);
      setNewFolderName("");
    } catch (e) {
      toast.error(`Failed to create folder: ${e}`);
    }
  }, [newFolderName, currentFolderId, createFolder]);

  // Create new text file
  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) return;
    try {
      await storeTextFile.mutateAsync({
        name: newFileName.trim(),
        content: newFileContent,
        parentFolderId: currentFolderId,
      });
      toast.success(`File "${newFileName.trim()}" created`);
      setNewFileOpen(false);
      setNewFileName("");
      setNewFileContent("");
    } catch (e) {
      toast.error(`Failed to create file: ${e}`);
    }
  }, [newFileName, newFileContent, currentFolderId, storeTextFile]);

  // Upload file via blob storage
  const handleUpload = useCallback(
    async (file: File) => {
      if (!actor || !identity) {
        toast.error("Not authenticated");
        return;
      }

      setUploadState({ uploading: true, progress: 0, fileName: file.name });

      try {
        const config = await loadConfig();
        const { HttpAgent } = await import("@icp-sdk/core/agent");
        const agent = new HttpAgent({
          identity,
          host: config.backend_host,
        });
        if (config.backend_host?.includes("localhost")) {
          await agent.fetchRootKey().catch(() => {});
        }

        const storageClient = new StorageClient(
          config.bucket_name,
          config.storage_gateway_url,
          config.backend_canister_id,
          config.project_id,
          agent,
        );

        const bytes = new Uint8Array(await file.arrayBuffer());
        const { hash } = await storageClient.putFile(bytes, (pct) => {
          setUploadState((prev) => ({ ...prev, progress: pct }));
        });

        const mimeType = file.type || "application/octet-stream";
        const isTextFile =
          file.size < 500 * 1024 &&
          (mimeType.startsWith("text/") ||
            /\.(txt|md|log|csv|json|xml|html|js|ts|py|css|sh|yaml|yml|ini|toml|env|jsx|tsx|mjs|cjs|rs|go|java|cpp|c|h|php|rb|swift|kt|dart|sql|graphql|vue|svelte)$/i.test(
              file.name,
            ));

        if (isTextFile) {
          const text = new TextDecoder().decode(bytes);
          await actor.storeTextFileContent(file.name, text, currentFolderId);
        } else {
          await actor.storeTextFileContent(
            file.name,
            JSON.stringify({ __blobId: hash, mimeType, size: file.size }),
            currentFolderId,
          );
        }

        queryClient.invalidateQueries({ queryKey: ["files"] });
        toast.success(`"${file.name}" uploaded successfully`);
      } catch (err) {
        console.error(err);
        toast.error(`Upload failed: ${err}`);
      } finally {
        setUploadState({ uploading: false, progress: 0, fileName: "" });
      }
    },
    [actor, identity, currentFolderId, queryClient],
  );

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload],
  );

  // Handle drag & drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  // Save text file
  const handleSave = useCallback(
    async (id: FileId, content: string) => {
      try {
        await updateText.mutateAsync({ id, content });
        toast.success("File saved");
      } catch (e) {
        toast.error(`Save failed: ${e}`);
      }
    },
    [updateText],
  );

  // Rename
  const openRename = useCallback((file: FileEntry) => {
    setRenameTarget(file);
    setRenameName(file.name);
    setRenameOpen(true);
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await renameFile.mutateAsync({
        id: renameTarget.id,
        newName: renameName.trim(),
      });
      toast.success("Renamed successfully");
      setRenameOpen(false);
      if (selectedFile?.id === renameTarget.id) {
        setSelectedFile((prev) =>
          prev ? { ...prev, name: renameName.trim() } : null,
        );
      }
    } catch (e) {
      toast.error(`Rename failed: ${e}`);
    }
  }, [renameTarget, renameName, renameFile, selectedFile]);

  // Delete
  const handleDelete = useCallback(
    async (file: FileEntry) => {
      try {
        await deleteFile.mutateAsync(file.id);
        toast.success(`"${file.name}" deleted`);
        if (selectedFile?.id === file.id) setSelectedFile(null);
      } catch (e) {
        toast.error(`Delete failed: ${e}`);
      }
    },
    [deleteFile, selectedFile],
  );

  // Password: open set/change dialog
  const handleOpenSetPassword = useCallback((file: FileEntry) => {
    setPasswordTarget(file);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordDialogOpen(true);
  }, []);

  // Password: submit set/change
  const handleSetPassword = useCallback(async () => {
    if (!passwordTarget) return;
    if (!newPassword.trim()) {
      setPasswordError("Password cannot be empty");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setPasswordError("");
    setIsSettingPassword(true);
    try {
      const hash = await hashPassword(newPassword);
      await setFilePassword.mutateAsync({
        id: passwordTarget.id,
        passwordHash: hash,
      });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Password set");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(`Failed to set password: ${e}`);
    } finally {
      setIsSettingPassword(false);
    }
  }, [
    passwordTarget,
    newPassword,
    confirmPassword,
    setFilePassword,
    queryClient,
  ]);

  // Password: open remove dialog
  const handleOpenRemovePassword = useCallback((file: FileEntry) => {
    setRemovePasswordTarget(file);
    setRemovePasswordInput("");
    setRemovePasswordError("");
    setRemovePasswordOpen(true);
  }, []);

  // Password: submit remove
  const handleRemovePassword = useCallback(async () => {
    if (!removePasswordTarget) return;
    if (!removePasswordInput.trim()) {
      setRemovePasswordError("Please enter your current password");
      return;
    }
    setRemovePasswordError("");
    setIsRemovingPassword(true);
    try {
      const hash = await hashPassword(removePasswordInput);
      await removeFilePasswordMutation.mutateAsync({
        id: removePasswordTarget.id,
        currentPasswordHash: hash,
      });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Password removed");
      setRemovePasswordOpen(false);
      setRemovePasswordInput("");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Incorrect password")) {
        setRemovePasswordError("Incorrect password");
      } else {
        toast.error(`Failed to remove password: ${e}`);
      }
    } finally {
      setIsRemovingPassword(false);
    }
  }, [
    removePasswordTarget,
    removePasswordInput,
    removeFilePasswordMutation,
    queryClient,
  ]);

  // Unlock: open unlock dialog
  const handleRequestUnlock = useCallback((file: FileEntry) => {
    setUnlockTarget(file);
    setUnlockInput("");
    setUnlockError("");
    setUnlockOpen(true);
  }, []);

  // Unlock: submit password
  const handleUnlock = useCallback(async () => {
    if (!unlockTarget) return;
    if (!unlockInput.trim()) {
      setUnlockError("Please enter the password");
      return;
    }
    setIsUnlocking(true);
    setUnlockError("");
    try {
      const hash = await hashPassword(unlockInput);
      const isValid = await verifyFilePassword.mutateAsync({
        id: unlockTarget.id,
        passwordHash: hash,
      });
      if (isValid) {
        setUnlockedFileIds((prev) => {
          const next = new Set(prev);
          next.add(unlockTarget.id);
          return next;
        });
        setUnlockOpen(false);
        setUnlockInput("");
        setSelectedFile(unlockTarget);
      } else {
        setUnlockError("Incorrect password");
        setUnlockInput("");
        setShakeTrigger((n) => n + 1);
      }
    } catch (e) {
      setUnlockError(`Error: ${e}`);
    } finally {
      setIsUnlocking(false);
    }
  }, [unlockTarget, unlockInput, verifyFilePassword]);

  return (
    <div
      className="flex h-screen flex-col bg-background overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-xs z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <FolderOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-foreground tracking-tight">
            File Explorer
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFileOpen(true)}
            className="gap-1.5 text-xs"
            data-ocid="header.new_file_button"
          >
            <FilePlus className="h-3.5 w-3.5" />
            New File
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFolderOpen(true)}
            className="gap-1.5 text-xs"
            data-ocid="header.new_folder_button"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs"
            disabled={uploadState.uploading}
            data-ocid="header.upload_button"
          >
            {uploadState.uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload File
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clear}
            className="h-8 w-8 ml-1"
            title="Sign out"
            data-ocid="header.logout_button"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Upload progress bar */}
      <AnimatePresence>
        {uploadState.uploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border bg-accent/50 overflow-hidden"
          >
            <div className="px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-muted-foreground truncate max-w-xs">
                Uploading {uploadState.fileName}...
              </span>
              <Progress
                value={uploadState.progress}
                className="flex-1 h-1.5"
                data-ocid="upload.loading_state"
              />
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                {uploadState.progress}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarPanel
          files={files}
          isLoading={filesLoading}
          folderPath={folderPath}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onNavigateFolder={navigateToFolder}
          onNavigateBreadcrumb={navigateBreadcrumb}
          onRename={openRename}
          onDelete={handleDelete}
          onUpload={() => fileInputRef.current?.click()}
          unlockedFileIds={unlockedFileIds}
          onRequestUnlock={handleRequestUnlock}
          onSetPassword={handleOpenSetPassword}
          onRemovePassword={handleOpenRemovePassword}
        />

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <FileViewer
            file={selectedFile}
            onSave={handleSave}
            isSaving={updateText.isPending}
          />
        </main>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInput}
        data-ocid="upload.dropzone"
      />

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent data-ocid="new_file.dialog">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-file-name">File name</Label>
              <Input
                id="new-file-name"
                placeholder="e.g. notes.txt"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
                data-ocid="new_file.input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-file-content">Content (optional)</Label>
              <Textarea
                id="new-file-content"
                placeholder="File content..."
                className="font-mono text-sm min-h-[140px] resize-none"
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                data-ocid="new_file.textarea"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFileOpen(false)}
              data-ocid="new_file.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFile}
              disabled={!newFileName.trim() || storeTextFile.isPending}
              data-ocid="new_file.submit_button"
            >
              {storeTextFile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent data-ocid="new_folder.dialog">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-folder-name">Folder name</Label>
            <Input
              id="new-folder-name"
              placeholder="e.g. Documents"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              data-ocid="new_folder.input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderOpen(false)}
              data-ocid="new_folder.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
              data-ocid="new_folder.submit_button"
            >
              {createFolder.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent data-ocid="rename.dialog">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-input">New name</Label>
            <Input
              id="rename-input"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              data-ocid="rename.input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              data-ocid="rename.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || renameFile.isPending}
              data-ocid="rename.confirm_button"
            >
              {renameFile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set / Change Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setNewPassword("");
            setConfirmPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent data-ocid="set_password.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {passwordTarget?.isLocked ? "Change Password" : "Set Password"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {passwordTarget && (
              <p className="text-sm text-muted-foreground">
                Protect{" "}
                <span className="font-semibold text-foreground">
                  {passwordTarget.name}
                </span>{" "}
                with a password
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
                data-ocid="set_password.input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
                data-ocid="set_password.confirm_input"
              />
            </div>
            {passwordError && (
              <p
                className="text-sm text-destructive"
                data-ocid="set_password.error_state"
              >
                {passwordError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              data-ocid="set_password.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPassword}
              disabled={
                !newPassword.trim() ||
                !confirmPassword.trim() ||
                isSettingPassword
              }
              data-ocid="set_password.submit_button"
            >
              {isSettingPassword && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {passwordTarget?.isLocked ? "Update Password" : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Password Dialog */}
      <Dialog
        open={removePasswordOpen}
        onOpenChange={(open) => {
          setRemovePasswordOpen(open);
          if (!open) {
            setRemovePasswordInput("");
            setRemovePasswordError("");
          }
        }}
      >
        <DialogContent data-ocid="remove_password.dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Remove Password
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {removePasswordTarget && (
              <p className="text-sm text-muted-foreground">
                Enter the current password for{" "}
                <span className="font-semibold text-foreground">
                  {removePasswordTarget.name}
                </span>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="remove-password-input">Current Password</Label>
              <Input
                id="remove-password-input"
                type="password"
                placeholder="Enter current password"
                value={removePasswordInput}
                onChange={(e) => {
                  setRemovePasswordInput(e.target.value);
                  setRemovePasswordError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleRemovePassword()}
                data-ocid="remove_password.input"
              />
            </div>
            {removePasswordError && (
              <p
                className="text-sm text-destructive"
                data-ocid="remove_password.error_state"
              >
                {removePasswordError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemovePasswordOpen(false)}
              data-ocid="remove_password.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemovePassword}
              disabled={!removePasswordInput.trim() || isRemovingPassword}
              data-ocid="remove_password.confirm_button"
            >
              {isRemovingPassword && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock File Dialog */}
      <Dialog
        open={unlockOpen}
        onOpenChange={(open) => {
          setUnlockOpen(open);
          if (!open) {
            setUnlockInput("");
            setUnlockError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm" data-ocid="unlock_file.dialog">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3 text-center pt-2">
              <motion.div
                key={shakeTrigger}
                animate={
                  shakeTrigger > 0 ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }
                }
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
              >
                <ShieldAlert className="h-7 w-7 text-amber-500" />
              </motion.div>
              <span>This file is protected</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pb-2">
            {unlockTarget && (
              <p className="text-center text-sm text-muted-foreground">
                Enter the password for{" "}
                <span className="font-semibold text-foreground">
                  {unlockTarget.name}
                </span>
              </p>
            )}
            <motion.div
              key={`input-${shakeTrigger}`}
              animate={
                shakeTrigger > 0 ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="flex flex-col gap-1.5"
            >
              <Input
                type="password"
                placeholder="Password"
                value={unlockInput}
                onChange={(e) => {
                  setUnlockInput(e.target.value);
                  setUnlockError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                autoFocus
                data-ocid="unlock_file.input"
              />
              {unlockError && (
                <p
                  className="text-sm text-destructive"
                  data-ocid="unlock_file.error_state"
                >
                  {unlockError}
                </p>
              )}
            </motion.div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleUnlock}
              disabled={!unlockInput.trim() || isUnlocking}
              className="w-full"
              data-ocid="unlock_file.submit_button"
            >
              {isUnlocking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Unlock
            </Button>
            <Button
              variant="ghost"
              onClick={() => setUnlockOpen(false)}
              className="w-full"
              data-ocid="unlock_file.cancel_button"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
