import { Cable } from "lucide-react";
import { Controls, Narration } from "@/components/switch/controls";
import { MacTable } from "@/components/switch/mac-table";
import { Topology, TopologyHint } from "@/components/switch/topology";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/switch/store";

export function SwitchLab() {
  const playLesson = useSim((s) => s.playLesson);
  const playing = useSim((s) => s.playing);
  const mode = useSim((s) => s.mode);
  const table = useSim((s) => s.table);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-elevated shadow-border">
              <Cable className="size-5 text-accent" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Layer 2 lab</p>
              <h1 className="text-xl font-medium tracking-tight text-fg">Switch Lab</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode !== "lesson" && !playing ? (
              <Button type="button" variant="primary" onClick={playLesson}>
                Play lesson
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
        <section className="order-1 flex flex-col gap-3 lg:col-span-2 lg:row-start-1">
          <Topology />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TopologyHint />
            <Legend />
          </div>
        </section>
        <div className="order-2 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <MacTable />
        </div>
        <section className="order-3 flex flex-col gap-3 lg:col-span-2 lg:row-start-2">
          <Narration />
          <Controls />
        </section>
      </main>

      {table.length === 0 && !playing ? (
        <p className="sr-only">MAC table is empty. Play the lesson or send a frame.</p>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-unicast" />
        Unicast
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-flood" />
        Flood
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-learn" />
        Learn
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-drop" />
        Drop
      </li>
    </ul>
  );
}
