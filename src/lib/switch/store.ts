import { create } from "zustand";
import { applyLearn, buildPlan, clearFlash, flashLookup } from "./engine";
import { LESSON } from "./lesson";
import type { DestId, HostId, LogLine, MacEntry, Plan } from "./types";

export const PRESETS: { src: HostId; dst: DestId; hint: string }[] = [
  { src: "A", dst: "B", hint: "First flood" },
  { src: "B", dst: "A", hint: "Reply unicast" },
  { src: "A", dst: "C", hint: "Silent host" },
  { src: "D", dst: "broadcast", hint: "Always floods" },
];

interface SimState {
  table: MacEntry[];
  log: LogLine[];
  plan: Plan | null;
  stepIndex: number;
  playing: boolean;
  speed: number;
  srcId: HostId | null;
  dstId: DestId | null;
  mode: "free" | "lesson";
  lessonIndex: number;
  queue: { src: HostId; dst: DestId; title: string }[];
  waitHandle: number | null;
  finished: boolean;

  setSpeed: (n: number) => void;
  selectHost: (id: HostId) => void;
  setBroadcast: () => void;
  clearSelection: () => void;
  send: (src?: HostId, dst?: DestId, lessonTitle?: string) => void;
  playLesson: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  advance: () => void;
}

let logSeq = 0;

function line(text: string, tone: LogLine["tone"]): LogLine {
  return { id: `log-${++logSeq}`, text, tone };
}

function clearWait(handle: number | null) {
  if (handle !== null && typeof window !== "undefined") {
    window.clearTimeout(handle);
  }
}

export const useSim = create<SimState>((set, get) => ({
  table: [],
  log: [],
  plan: null,
  stepIndex: 0,
  playing: false,
  speed: 1,
  srcId: null,
  dstId: null,
  mode: "free",
  lessonIndex: -1,
  queue: [],
  waitHandle: null,
  finished: false,

  setSpeed: (n) => set({ speed: Math.min(2.4, Math.max(0.5, n)) }),

  selectHost: (id) => {
    const { srcId, dstId, playing } = get();
    if (playing) return;
    if (srcId === id) {
      set({ srcId: null, dstId: null });
      return;
    }
    if (!srcId || dstId) {
      set({ srcId: id, dstId: null });
      return;
    }
    set({ dstId: id });
  },

  setBroadcast: () => {
    if (get().playing) return;
    if (!get().srcId) set({ srcId: "A", dstId: "broadcast" });
    else set({ dstId: "broadcast" });
  },

  clearSelection: () => set({ srcId: null, dstId: null }),

  send: (srcArg, dstArg, lessonTitle) => {
    const state = get();
    if (state.playing && state.mode === "free") return;
    const src = srcArg ?? state.srcId;
    const dst = dstArg ?? state.dstId;
    if (!src || !dst || src === dst) return;
    clearWait(state.waitHandle);
    const keepLesson = state.mode === "lesson" && Boolean(lessonTitle);
    const plan = buildPlan(src, dst, state.table, lessonTitle);
    set({
      plan,
      stepIndex: 0,
      playing: true,
      finished: false,
      waitHandle: null,
      srcId: src,
      dstId: dst,
      mode: keepLesson ? "lesson" : lessonTitle ? "lesson" : "free",
      log: [
        line(
          `frame  src ${plan.src.mac}  dst ${plan.dstMac}  in Port ${plan.inPort}`,
          "info",
        ),
        ...state.log,
      ].slice(0, 12),
    });
  },

  playLesson: () => {
    const { waitHandle } = get();
    clearWait(waitHandle);
    const [first, ...rest] = LESSON;
    if (!first) return;
    const plan = buildPlan(first.src, first.dst, [], first.title);
    set({
      table: [],
      log: [line("lesson start — CAM table cleared", "info")],
      plan,
      stepIndex: 0,
      playing: true,
      finished: false,
      mode: "lesson",
      lessonIndex: 0,
      queue: rest.map((b) => ({ src: b.src, dst: b.dst, title: b.title })),
      waitHandle: null,
      srcId: first.src,
      dstId: first.dst,
    });
  },

  pause: () => {
    const { waitHandle } = get();
    clearWait(waitHandle);
    set({ playing: false, waitHandle: null });
  },

  resume: () => {
    const { plan, finished, queue, mode, playing } = get();
    if (playing) return;
    if (finished && mode === "lesson" && queue.length > 0) {
      const [next, ...rest] = queue;
      if (!next) return;
      set({ queue: rest, lessonIndex: get().lessonIndex + 1, mode: "lesson" });
      get().send(next.src, next.dst, next.title);
      return;
    }
    if (plan && !finished) set({ playing: true });
  },

  reset: () => {
    const { waitHandle } = get();
    clearWait(waitHandle);
    set({
      table: [],
      log: [line("table cleared", "info")],
      plan: null,
      stepIndex: 0,
      playing: false,
      finished: false,
      mode: "free",
      lessonIndex: -1,
      queue: [],
      waitHandle: null,
      srcId: null,
      dstId: null,
    });
  },

  advance: () => {
    const { plan, stepIndex, table, log, speed, mode, queue, lessonIndex } = get();
    if (!plan) return;
    const next = stepIndex + 1;
    if (next >= plan.steps.length) {
      if (mode === "lesson" && queue.length > 0) {
        const waitMs = Math.max(700, 1400 / speed);
        const handle = window.setTimeout(() => {
          if (get().waitHandle !== handle) return;
          const current = get();
          const [beat, ...rest] = current.queue;
          if (!beat) {
            set({
              playing: false,
              finished: true,
              mode: "free",
              waitHandle: null,
              log: [
                line("lesson complete — every host that spoke is in the table", "info"),
                ...current.log,
              ].slice(0, 12),
            });
            return;
          }
          const nextPlan = buildPlan(beat.src, beat.dst, current.table, beat.title);
          set({
            plan: nextPlan,
            stepIndex: 0,
            playing: true,
            finished: false,
            queue: rest,
            lessonIndex: current.lessonIndex + 1,
            waitHandle: null,
            srcId: beat.src,
            dstId: beat.dst,
            mode: "lesson",
            log: [
              line(
                `frame  src ${nextPlan.src.mac}  dst ${nextPlan.dstMac}  in Port ${nextPlan.inPort}`,
                "info",
              ),
              ...current.log,
            ].slice(0, 12),
          });
        }, waitMs);
        set({
          playing: false,
          finished: true,
          waitHandle: handle,
        });
        return;
      }
      set({
        playing: false,
        finished: true,
        mode: "free",
        lessonIndex: mode === "lesson" ? lessonIndex : -1,
        log:
          mode === "lesson"
            ? [
                line("lesson complete — every host that spoke is in the table", "info"),
                ...log,
              ].slice(0, 12)
            : log,
      });
      return;
    }

    const step = plan.steps[next]!;
    let nextTable = table;
    let nextLog = log;

    if (step.kind === "learn") {
      nextTable = applyLearn(table, plan.learn);
      nextLog = [
        line(
          plan.learn.isNew
            ? `learn   ${plan.learn.mac}  →  Port ${plan.learn.port}`
            : `refresh ${plan.learn.mac}  on Port ${plan.learn.port}`,
          "learn",
        ),
        ...log,
      ].slice(0, 12);
    }

    if (step.kind === "lookup") {
      nextTable = flashLookup(nextTable, plan.dstMac, plan.lookupHit);
      nextLog = [
        line(
          plan.isBroadcast
            ? "lookup  broadcast — flood"
            : plan.lookupHit
              ? `lookup  ${plan.dstMac}  HIT  Port ${plan.outPorts[0]}`
              : `lookup  ${plan.dstMac}  MISS — flood`,
          plan.decision === "flood" ? "flood" : "unicast",
        ),
        ...nextLog,
      ].slice(0, 12);
    }

    if (step.kind === "decide") {
      nextLog = [
        line(
          plan.decision === "flood"
            ? `flood   out Ports ${plan.outPorts.join(",")}`
            : `unicast out Port ${plan.outPorts[0]}`,
          plan.decision,
        ),
        ...nextLog,
      ].slice(0, 12);
    }

    if (step.kind === "deliver") {
      nextTable = clearFlash(nextTable);
    }

    set({
      stepIndex: next,
      table: nextTable,
      log: nextLog,
    });
  },
}));
