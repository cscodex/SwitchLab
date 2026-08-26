import { Pause, Play, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { presetLabel } from "@/lib/switch/engine";
import { LESSON } from "@/lib/switch/lesson";
import { PRESETS, useSim } from "@/lib/switch/store";
import { cn } from "@/lib/utils";

export function Controls() {
  const srcId = useSim((s) => s.srcId);
  const dstId = useSim((s) => s.dstId);
  const send = useSim((s) => s.send);
  const playLesson = useSim((s) => s.playLesson);
  const pause = useSim((s) => s.pause);
  const resume = useSim((s) => s.resume);
  const reset = useSim((s) => s.reset);
  const playing = useSim((s) => s.playing);
  const finished = useSim((s) => s.finished);
  const plan = useSim((s) => s.plan);
  const mode = useSim((s) => s.mode);
  const waitHandle = useSim((s) => s.waitHandle);
  const setBroadcast = useSim((s) => s.setBroadcast);
  const speed = useSim((s) => s.speed);
  const setSpeed = useSim((s) => s.setSpeed);
  const lessonIndex = useSim((s) => s.lessonIndex);
  const queue = useSim((s) => s.queue);

  const busy = playing || waitHandle !== null;
  const canSend = Boolean(srcId && dstId && srcId !== dstId) && !busy;
  const canResume =
    !playing && Boolean(plan) && (!finished || (mode === "lesson" && queue.length > 0));
  const lessonActive = mode === "lesson" || waitHandle !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={`${p.src}-${p.dst}`}
            type="button"
            variant="subtle"
            size="sm"
            disabled={busy}
            onClick={() => send(p.src, p.dst)}
            className="shrink-0 font-mono"
          >
            {presetLabel(p.src, p.dst)}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={!canSend}
          onClick={() => send()}
          className="min-h-11"
        >
          <Send className="size-4" aria-hidden="true" />
          Send frame
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={!srcId || busy}
          onClick={setBroadcast}
        >
          Broadcast
        </Button>
        {playing ? (
          <Button type="button" variant="subtle" size="icon" onClick={pause} aria-label="Pause">
            <Pause className="size-4" aria-hidden="true" />
          </Button>
        ) : canResume ? (
          <Button type="button" variant="subtle" size="icon" onClick={resume} aria-label="Resume">
            <Play className="ml-0.5 size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" variant="subtle" onClick={playLesson}>
            <Play className="ml-0.5 size-4" aria-hidden="true" />
            Play lesson
          </Button>
        )}
        {lessonActive ? (
          <Button type="button" variant="ghost" onClick={playLesson}>
            Restart lesson
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Reset table">
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <label className="flex items-center gap-3 text-xs text-muted">
        <span className="w-10 shrink-0">Speed</span>
        <input
          type="range"
          min={0.5}
          max={2.4}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="h-11 w-full max-w-56 cursor-pointer accent-accent"
          aria-valuemin={0.5}
          aria-valuemax={2.4}
          aria-valuenow={speed}
        />
        <span className="w-10 font-mono tabular-nums text-fg">{speed.toFixed(1)}×</span>
      </label>

      {lessonActive ? (
        <p className="font-mono text-xs text-subtle">
          Lesson {Math.min(lessonIndex + 1, LESSON.length)} / {LESSON.length}
        </p>
      ) : null}

      <p className="text-xs text-subtle">
        Selected{" "}
        <span className="font-mono text-muted">
          {srcId ? `PC-${srcId}` : "—"} → {dstId === "broadcast" ? "broadcast" : dstId ? `PC-${dstId}` : "—"}
        </span>
      </p>
    </div>
  );
}

export function Narration() {
  const plan = useSim((s) => s.plan);
  const stepIndex = useSim((s) => s.stepIndex);
  const step = plan?.steps[stepIndex];

  const title = step?.title ?? "Empty table";
  const body =
    step?.body ??
    "A switch starts knowing nothing. Send a frame and watch it learn the source MAC, then flood or unicast based on the destination.";

  const toneClass =
    step?.kind === "decide" && plan?.decision === "flood"
      ? "border-flood/50"
      : step?.kind === "decide" && plan?.decision === "unicast"
        ? "border-unicast/50"
        : step?.kind === "learn"
          ? "border-learn/50"
          : "border-border";

  return (
    <section className={cn("rounded-xl border bg-surface p-4 shadow-border lg:p-5", toneClass)}>
      {plan?.lessonTitle ? (
        <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
          {plan.lessonTitle}
        </p>
      ) : (
        <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">What’s happening</p>
      )}
      <h2 className="text-lg font-medium tracking-tight text-fg">{title}</h2>
      <p className="mt-2 text-sm leading-normal text-muted">{body}</p>
    </section>
  );
}
