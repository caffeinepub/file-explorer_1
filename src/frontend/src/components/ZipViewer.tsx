import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import JSZip, { type JSZipObject } from "jszip";
import {
  Archive,
  ChevronRight,
  File,
  FileText,
  FolderOpen,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ZipEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  content?: string;
}

function buildTree(entries: ZipEntry[]): Record<string, ZipEntry[]> {
  const tree: Record<string, ZipEntry[]> = { "/": [] };
  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    const parentKey =
      parts.length <= 1 ? "/" : `/${parts.slice(0, -1).join("/")}/`;
    if (!tree[parentKey]) tree[parentKey] = [];
    tree[parentKey].push(entry);
  }
  return tree;
}

interface ZipViewerProps {
  bytes: Uint8Array | null;
  textContent: string | null;
}

export default function ZipViewer({ bytes, textContent }: ZipViewerProps) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ZipEntry | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["/"]));

  useEffect(() => {
    if (!bytes && !textContent) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    const parse = async () => {
      try {
        let zipBytes: Uint8Array;
        if (bytes) {
          zipBytes = bytes;
        } else if (textContent) {
          zipBytes = new TextEncoder().encode(textContent);
        } else {
          return;
        }

        const zip = await JSZip.loadAsync(zipBytes);
        const result: ZipEntry[] = [];

        await Promise.all(
          Object.entries(zip.files).map(
            async ([path, zipFile]: [string, JSZipObject]) => {
              const isDir = zipFile.dir;
              let content: string | undefined;

              if (
                !isDir &&
                zipFile.name.match(
                  /\.(txt|md|json|xml|csv|log|js|ts|jsx|tsx|py|css|html?|sh|yaml|yml|env|ini|toml|sql|graphql|rs|go|java|cpp|c|h|rb|php|swift|kt|dart)$/i,
                )
              ) {
                try {
                  content = await zipFile.async("text");
                } catch {
                  // binary file
                }
              }

              result.push({
                name: path.split("/").filter(Boolean).pop() || path,
                path: `/${path}`,
                isDir,
                size: isDir ? 0 : (zipFile as any)._data?.uncompressedSize || 0,
                content,
              });
            },
          ),
        );

        result.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.path.localeCompare(b.path);
        });

        setEntries(result);
      } catch (err) {
        setError(`Failed to parse archive: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    parse();
  }, [bytes, textContent]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-6" data-ocid="zip.loading_state">
        <div className="flex items-center gap-2 mb-2">
          <Archive className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-muted-foreground">
            Extracting archive...
          </span>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${60 + i * 8}%` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-8 text-center"
        data-ocid="zip.error_state"
      >
        <Archive className="h-10 w-10 text-destructive/60" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!bytes && !textContent) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-8 text-center"
        data-ocid="zip.loading_state"
      >
        <Archive className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Loading archive...</p>
      </div>
    );
  }

  const tree = buildTree(entries);

  function renderEntries(parentKey: string, depth: number): React.ReactNode {
    const children = tree[parentKey] || [];
    return children.map((entry) => {
      const isExpanded = expandedDirs.has(`${entry.path}/`);
      const childKey = entry.isDir ? `${entry.path}/` : entry.path;

      return (
        <div key={entry.path}>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors text-left",
              selectedEntry?.path === entry.path
                ? "bg-primary/10 text-primary"
                : "hover:bg-accent text-foreground",
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={() => {
              if (entry.isDir) {
                setExpandedDirs((prev) => {
                  const next = new Set(prev);
                  if (next.has(childKey)) next.delete(childKey);
                  else next.add(childKey);
                  return next;
                });
              } else {
                setSelectedEntry(entry);
              }
            }}
            data-ocid={`zip.item.${entries.indexOf(entry) + 1}`}
          >
            {entry.isDir ? (
              <>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-90",
                  )}
                />
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
              </>
            ) : (
              <>
                <span className="w-3.5" />
                {entry.content !== undefined ? (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                ) : (
                  <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </>
            )}
            <span className="flex-1 truncate text-sm">{entry.name}</span>
            {!entry.isDir && entry.size > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {entry.size < 1024
                  ? `${entry.size} B`
                  : `${(entry.size / 1024).toFixed(1)} KB`}
              </span>
            )}
          </button>
          {entry.isDir && isExpanded && renderEntries(childKey, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-72 shrink-0 border-r border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Archive className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-semibold text-muted-foreground">
            {entries.length} entries
          </span>
        </div>
        <ScrollArea className="h-[calc(100%-37px)]">
          <div className="p-1">{renderEntries("/", 0)}</div>
        </ScrollArea>
      </div>

      {/* File preview */}
      <div className="flex-1 overflow-hidden">
        {selectedEntry ? (
          selectedEntry.content !== undefined ? (
            <ScrollArea className="h-full">
              <pre className="p-4 font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap break-all">
                {selectedEntry.content}
              </pre>
            </ScrollArea>
          ) : (
            <div
              className="flex flex-col items-center gap-3 p-8 text-center"
              data-ocid="zip.file_panel"
            >
              <File className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {selectedEntry.name}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Binary file — preview not available
              </p>
            </div>
          )
        ) : (
          <div
            className="flex flex-col items-center gap-3 p-8 text-center"
            data-ocid="zip.empty_state"
          >
            <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Select a file to preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
