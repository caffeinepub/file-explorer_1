import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Archive,
  ChevronRight,
  File,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Home,
  KeyRound,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { FileId } from "../backend";
import type { FileEntry } from "../hooks/useQueries";

function getFileIcon(entry: FileEntry, isOpen?: boolean) {
  if (entry.isFolder) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-yellow-500" />
    ) : (
      <Folder className="h-4 w-4 text-yellow-500" />
    );
  }
  const name = entry.name.toLowerCase();
  const mime = entry.mimeType?.toLowerCase() || "";

  if (
    mime.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/.test(name)
  ) {
    return <FileImage className="h-4 w-4 text-purple-500" />;
  }
  if (
    /\.(zip|tar|gz|rar|7z|bz2|xz|tar\.gz|tar\.bz2)$/.test(name) ||
    mime.includes("zip") ||
    mime.includes("compressed")
  ) {
    return <Archive className="h-4 w-4 text-orange-500" />;
  }
  if (
    /\.(js|ts|jsx|tsx|py|java|cpp|c|h|rs|go|rb|php|swift|kt|dart|sh|bash|zsh|ps1|vue|svelte|json|xml|yaml|yml|toml|ini|env|sql|graphql|css|scss|less|html|htm|md|mdx)$/.test(
      name,
    )
  ) {
    return <FileCode className="h-4 w-4 text-blue-500" />;
  }
  if (mime.startsWith("text/") || /\.(txt|log|csv)$/.test(name)) {
    return <FileText className="h-4 w-4 text-green-600" />;
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatSize(size: bigint): string {
  const n = Number(size);
  if (n === 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface SidebarProps {
  files: FileEntry[];
  isLoading: boolean;
  folderPath: { id: FileId | null; name: string }[];
  selectedFile: FileEntry | null;
  onSelectFile: (file: FileEntry) => void;
  onNavigateFolder: (folder: FileEntry) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onUpload: () => void;
  unlockedFileIds: Set<string>;
  onRequestUnlock: (file: FileEntry) => void;
  onSetPassword: (file: FileEntry) => void;
  onRemovePassword: (file: FileEntry) => void;
}

export default function SidebarPanel({
  files,
  isLoading,
  folderPath,
  selectedFile,
  onSelectFile,
  onNavigateFolder,
  onNavigateBreadcrumb,
  onRename,
  onDelete,
  onUpload,
  unlockedFileIds,
  onRequestUnlock,
  onSetPassword,
  onRemovePassword,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const folders = files.filter((f) => f.isFolder);
  const fileItems = files.filter((f) => !f.isFolder);
  const sorted = [...folders, ...fileItems];

  const handleFileClick = (entry: FileEntry) => {
    if (entry.isFolder) {
      onNavigateFolder(entry);
      return;
    }
    if (entry.isLocked && !unlockedFileIds.has(entry.id)) {
      onRequestUnlock(entry);
    } else {
      onSelectFile(entry);
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2 overflow-x-auto">
        {folderPath.map((crumb, i) => (
          <div key={crumb.name} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <button
              type="button"
              onClick={() => onNavigateBreadcrumb(i)}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                i === folderPath.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              data-ocid={`breadcrumb.link.${i + 1}`}
            >
              {i === 0 && <Home className="h-3 w-3" />}
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {isLoading ? (
            <div
              className="flex flex-col gap-1 p-2"
              data-ocid="sidebar.loading_state"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3.5 flex-1 rounded" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 p-6 text-center"
              data-ocid="sidebar.empty_state"
            >
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No files yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={onUpload}
                className="gap-1.5 text-xs"
                data-ocid="sidebar.upload_button"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload a file
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence>
              {sorted.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ delay: index * 0.03 }}
                  data-ocid={`sidebar.item.${index + 1}`}
                >
                  <button
                    type="button"
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors select-none text-left",
                      selectedFile?.id === entry.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-foreground",
                    )}
                    onClick={() => handleFileClick(entry)}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {getFileIcon(
                      entry,
                      selectedFile?.id === entry.id && entry.isFolder,
                    )}
                    <span className="flex-1 truncate text-sm flex items-center gap-1.5">
                      {entry.name}
                      {!entry.isFolder && entry.isLocked && (
                        <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {entry.isFolder ? "" : formatSize(entry.size)}
                    </span>

                    {/* Actions menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-5 w-5 shrink-0 transition-opacity",
                            hoveredId === entry.id ||
                              selectedFile?.id === entry.id
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                          onClick={(e) => e.stopPropagation()}
                          data-ocid={`sidebar.item_menu.${index + 1}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onRename(entry);
                          }}
                          data-ocid={`sidebar.rename_button.${index + 1}`}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Rename
                        </DropdownMenuItem>

                        {!entry.isFolder && (
                          <>
                            <DropdownMenuSeparator />
                            {!entry.isLocked ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetPassword(entry);
                                }}
                                data-ocid={`sidebar.set_password_button.${index + 1}`}
                              >
                                <KeyRound className="mr-2 h-3.5 w-3.5" />
                                Set Password
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetPassword(entry);
                                  }}
                                  data-ocid={`sidebar.change_password_button.${index + 1}`}
                                >
                                  <KeyRound className="mr-2 h-3.5 w-3.5" />
                                  Change Password
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemovePassword(entry);
                                  }}
                                  data-ocid={`sidebar.remove_password_button.${index + 1}`}
                                >
                                  <LockOpen className="mr-2 h-3.5 w-3.5" />
                                  Remove Password
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(entry);
                          }}
                          className="text-destructive focus:text-destructive"
                          data-ocid={`sidebar.delete_button.${index + 1}`}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
