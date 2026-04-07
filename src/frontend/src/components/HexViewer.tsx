import { ScrollArea } from "@/components/ui/scroll-area";

interface HexViewerProps {
  bytes: Uint8Array | null;
}

const BYTES_PER_ROW = 16;
const MAX_ROWS = 16;

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

function toAscii(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
}

interface HexRow {
  offset: number;
  cells: { byteOffset: number; value: number }[];
}

export default function HexViewer({ bytes }: HexViewerProps) {
  if (!bytes) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-8 text-center"
        data-ocid="hex.loading_state"
      >
        <p className="text-sm text-muted-foreground">Loading binary data...</p>
      </div>
    );
  }

  const totalBytes = bytes.length;
  const limit = Math.min(totalBytes, BYTES_PER_ROW * MAX_ROWS);
  const rows: HexRow[] = [];

  for (let offset = 0; offset < limit; offset += BYTES_PER_ROW) {
    const cells: HexRow["cells"] = [];
    for (let col = 0; col < BYTES_PER_ROW && offset + col < limit; col++) {
      cells.push({ byteOffset: offset + col, value: bytes[offset + col] });
    }
    rows.push({ offset, cells });
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4" data-ocid="hex.panel">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Hex Dump — first {limit} of {totalBytes} bytes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="font-mono text-xs border-collapse">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pr-4 pb-2 text-left font-normal w-20">Offset</th>
                <th className="pr-4 pb-2 text-left font-normal">Hex</th>
                <th className="pb-2 text-left font-normal">ASCII</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.offset} className="hover:bg-accent/40">
                  <td className="pr-4 py-0.5 text-muted-foreground">
                    {row.offset.toString(16).padStart(8, "0").toUpperCase()}
                  </td>
                  <td className="pr-4 py-0.5">
                    <span className="flex gap-1 flex-wrap">
                      {row.cells.map((cell) => (
                        <span
                          key={cell.byteOffset}
                          className="text-primary"
                          style={{ minWidth: "1.5rem" }}
                        >
                          {toHex(cell.value)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-0.5">
                    <span className="text-foreground tracking-wider">
                      {row.cells.map((cell) => (
                        <span
                          key={cell.byteOffset}
                          className={
                            cell.value >= 32 && cell.value <= 126
                              ? "text-green-600"
                              : "text-muted-foreground/50"
                          }
                        >
                          {toAscii(cell.value)}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalBytes > limit && (
          <p className="mt-3 text-xs text-muted-foreground">
            ... and {totalBytes - limit} more bytes
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
