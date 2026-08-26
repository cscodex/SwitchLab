import { HOSTS } from "@/lib/switch/hosts";
import { useSim } from "@/lib/switch/store";
import type { LogLine, MacEntry } from "@/lib/switch/types";
import { cn } from "@/lib/utils";

export function MacTable() {
  const table = useSim((s) => s.table);
  const log = useSim((s) => s.log);
  const plan = useSim((s) => s.plan);
  const stepIndex = useSim((s) => s.stepIndex);
  const kind = plan?.steps[stepIndex]?.kind;

  return (
    <aside className="flex h-full flex-col gap-3 rounded-xl bg-surface p-4 shadow-border lg:p-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            MAC address table
          </p>
          <h2 className="text-lg font-medium tracking-tight text-fg">CAM / forwarding</h2>
        </div>
        <p className="font-mono text-xs tabular-nums text-subtle">
          {table.length} {table.length === 1 ? "entry" : "entries"}
        </p>
      </header>

      <div className="overflow-hidden rounded-lg bg-bg shadow-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-subtle uppercase">
              <th className="px-3 py-2 font-medium">Port</th>
              <th className="px-3 py-2 font-medium">MAC address</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Host</th>
              <th className="px-3 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {table.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted">
                  Empty. The switch has not seen a source MAC yet.
                </td>
              </tr>
            ) : (
              table.map((row) => (
                <MacRow
                  key={row.mac}
                  row={row}
                  looking={kind === "lookup" && plan?.dstMac === row.mac}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {kind === "lookup" && plan && !plan.lookupHit && !plan.isBroadcast ? (
        <p className="rounded-md bg-bg px-3 py-2 font-mono text-xs text-flood shadow-border">
          miss  {plan.dstMac}  — not in table
        </p>
      ) : null}

      <LogList log={log} />
    </aside>
  );
}

function MacRow({ row, looking }: { row: MacEntry; looking: boolean }) {
  const host = HOSTS.find((h) => h.id === row.hostId);
  return (
    <tr
      className={cn(
        "mac-row-in border-b border-border last:border-b-0",
        row.flash === "learn" && "mac-flash-learn",
        row.flash === "hit" && "mac-flash-hit",
        row.flash === "update" && "mac-flash-update",
        looking && "bg-elevated",
      )}
    >
      <td className="px-3 py-2.5 font-mono tabular-nums text-fg">
        <span className="inline-flex size-6 items-center justify-center rounded-sm bg-elevated text-xs">
          {row.port}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-fg sm:text-sm">{row.mac}</td>
      <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{host?.name}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs text-subtle">DYNAMIC</span>
          {row.flash === "learn" ? (
            <span className="font-mono text-xs text-learn">new</span>
          ) : null}
          {row.flash === "hit" ? (
            <span className="font-mono text-xs text-unicast">hit</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

function LogList({ log }: { log: LogLine[] }) {
  return (
    <div className="flex min-h-24 flex-col gap-1 rounded-lg bg-bg px-3 py-2.5 shadow-border">
      <p className="text-xs tracking-wide text-subtle uppercase">Switch log</p>
      {log.length === 0 ? (
        <p className="font-mono text-xs text-subtle">waiting for frames</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {log.slice(0, 6).map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "font-mono text-xs leading-snug",
                entry.tone === "learn" && "text-learn",
                entry.tone === "flood" && "text-flood",
                entry.tone === "unicast" && "text-unicast",
                entry.tone === "drop" && "text-drop",
                entry.tone === "info" && "text-muted",
              )}
            >
              {entry.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
