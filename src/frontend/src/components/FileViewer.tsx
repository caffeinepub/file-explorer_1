import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Code, Eye, FileText, FolderOpen, Loader2, Save } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FileId, FileSystemEntry } from "../backend";
import { loadConfig } from "../config";
import type { FileEntry } from "../hooks/useQueries";
import { useGetTextContent } from "../hooks/useQueries";
import HexViewer from "./HexViewer";
import ZipViewer from "./ZipViewer";

type ViewMode = "editor" | "preview";

function getMimeFromEntry(entry: FileSystemEntry): string {
  if (entry.textContent) {
    try {
      const parsed = JSON.parse(entry.textContent);
      if (parsed.__blobId) return parsed.mimeType || "application/octet-stream";
    } catch {
      // not JSON
    }
  }
  const name = entry.name.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|ico)$/.test(name))
    return `image/${name.split(".").pop()}`;
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (/\.(zip)$/.test(name)) return "application/zip";
  if (/\.(tar\.gz|tgz)$/.test(name)) return "application/x-tar";
  if (/\.(gz)$/.test(name)) return "application/gzip";
  if (/\.(rar)$/.test(name)) return "application/x-rar-compressed";
  if (/\.(7z)$/.test(name)) return "application/x-7z-compressed";
  if (/\.(json)$/.test(name)) return "application/json";
  if (/\.(md|mdx)$/.test(name)) return "text/markdown";
  if (/\.(html?|htm)$/.test(name)) return "text/html";
  if (/\.(css|scss|less)$/.test(name)) return "text/css";
  if (/\.(js|jsx|mjs|cjs)$/.test(name)) return "text/javascript";
  if (/\.(ts|tsx)$/.test(name)) return "text/typescript";
  if (/\.(py)$/.test(name)) return "text/x-python";
  if (/\.(sh|bash|zsh)$/.test(name)) return "text/x-sh";
  if (/\.(txt|log|csv|ini|toml|yaml|yml|env)$/.test(name)) return "text/plain";
  return entry.mimeType || "application/octet-stream";
}

function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("yaml") ||
    mime.includes("toml") ||
    mime.includes("graphql")
  );
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isZipType(name: string, mime: string): boolean {
  return (
    /\.(zip|tar|gz|tar\.gz|tgz|rar|7z|bz2|xz)$/i.test(name) ||
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("x-tar") ||
    mime.includes("gzip")
  );
}

function isPdfType(name: string, mime: string): boolean {
  return name.endsWith(".pdf") || mime === "application/pdf";
}

/** Safe HTML renderer — uses a ref to set innerHTML directly, bypassing React's XSS guard.
 * Content is user-supplied markdown/html that the user themselves uploaded. */
function HtmlPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} className="prose prose-sm max-w-none p-6" />;
}

interface FileViewerProps {
  file: FileEntry | null;
  onSave: (id: FileId, content: string) => void;
  isSaving: boolean;
}

export default function FileViewer({
  file,
  onSave,
  isSaving,
}: FileViewerProps) {
  const [editedContent, setEditedContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobBytes, setBlobBytes] = useState<Uint8Array | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);

  const mime = file ? getMimeFromEntry(file) : "";
  const isBlobRef =
    !!file?.textContent &&
    (() => {
      try {
        const p = JSON.parse(file.textContent!);
        return !!p.__blobId;
      } catch {
        return false;
      }
    })();

  const blobId = isBlobRef
    ? (() => {
        try {
          return JSON.parse(file!.textContent!).__blobId as string;
        } catch {
          return null;
        }
      })()
    : null;

  const shouldFetchText =
    file && !file.textContent && !file.isFolder && !isBlobRef;
  const textQuery = useGetTextContent(shouldFetchText ? file.id : null);

  const textContent =
    file?.textContent && !isBlobRef ? file.textContent : (textQuery.data ?? "");

  useEffect(() => {
    let revoked = false;
    if (!file || !isBlobRef || !blobId) {
      setBlobUrl(null);
      setBlobBytes(null);
      return;
    }

    setLoadingBlob(true);
    loadConfig().then(async (config) => {
      try {
        const { StorageClient } = await import("../utils/StorageClient");
        const { HttpAgent } = await import("@icp-sdk/core/agent");
        const agent = new HttpAgent({ host: config.backend_host });
        if (config.backend_host?.includes("localhost")) {
          await agent.fetchRootKey().catch(() => {});
        }
        const client = new StorageClient(
          config.bucket_name,
          config.storage_gateway_url,
          config.backend_canister_id,
          config.project_id,
          agent,
        );
        const url = await client.getDirectURL(blobId);
        if (!revoked) {
          setBlobUrl(url);
          const fileMime = getMimeFromEntry(file);
          if (isZipType(file.name, fileMime) || !isImageMime(fileMime)) {
            const resp = await fetch(url);
            const ab = await resp.arrayBuffer();
            if (!revoked) setBlobBytes(new Uint8Array(ab));
          }
        }
      } catch (e) {
        console.error("Error loading blob:", e);
      } finally {
        if (!revoked) setLoadingBlob(false);
      }
    });

    return () => {
      revoked = true;
    };
  }, [file, isBlobRef, blobId]);

  useEffect(() => {
    if (textContent !== undefined) {
      setEditedContent(textContent);
      setIsDirty(false);
    }
  }, [textContent]);

  const handleSave = useCallback(() => {
    if (!file) return;
    onSave(file.id, editedContent);
    setIsDirty(false);
  }, [file, editedContent, onSave]);

  if (!file) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
        data-ocid="viewer.empty_state"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="rounded-2xl bg-accent/60 p-6">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Select a file to view its contents
          </p>
          <p className="text-xs text-muted-foreground/70">
            Supports text, images, ZIP archives, PDFs, and more
          </p>
        </motion.div>
      </div>
    );
  }

  const isLoading = (shouldFetchText && textQuery.isLoading) || loadingBlob;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={file.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex flex-1 flex-col h-full overflow-hidden"
        data-ocid="viewer.panel"
      >
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground truncate max-w-xs">
              {file.name}
            </span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {mime.split("/").pop()}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {(mime === "text/markdown" || mime === "text/html") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewMode((m) => (m === "editor" ? "preview" : "editor"))
                }
                className="gap-1.5 text-xs"
                data-ocid="viewer.toggle"
              >
                {viewMode === "editor" ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <Code className="h-3.5 w-3.5" />
                )}
                {viewMode === "editor" ? "Preview" : "Source"}
              </Button>
            )}

            {isTextMime(mime) && !isBlobRef && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="gap-1.5 text-xs"
                data-ocid="viewer.save_button"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div
              className="p-6 flex flex-col gap-3"
              data-ocid="viewer.loading_state"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : isZipType(file.name, mime) ? (
            <ZipViewer
              bytes={blobBytes}
              textContent={!isBlobRef ? textContent : null}
            />
          ) : isBlobRef && isImageMime(mime) ? (
            <div className="flex items-center justify-center p-8 h-full">
              <img
                src={blobUrl || ""}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-card"
                data-ocid="viewer.canvas_target"
              />
            </div>
          ) : isBlobRef && isPdfType(file.name, mime) ? (
            <iframe
              src={blobUrl || ""}
              className="w-full h-full border-0"
              title={file.name}
              data-ocid="viewer.canvas_target"
            />
          ) : isBlobRef ? (
            <HexViewer bytes={blobBytes} />
          ) : isTextMime(mime) ? (
            viewMode === "preview" &&
            (mime === "text/markdown" || mime === "text/html") ? (
              <ScrollArea className="h-full">
                <HtmlPreview html={editedContent} />
              </ScrollArea>
            ) : (
              <textarea
                className="h-full w-full resize-none bg-background p-4 font-mono text-sm text-foreground outline-none leading-relaxed"
                value={editedContent}
                onChange={(e) => {
                  setEditedContent(e.target.value);
                  setIsDirty(true);
                }}
                spellCheck={false}
                data-ocid="viewer.editor"
              />
            )
          ) : (
            <HexViewer bytes={blobBytes} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
