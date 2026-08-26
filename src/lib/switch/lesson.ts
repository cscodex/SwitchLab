import type { LessonBeat } from "./types";

export const LESSON: LessonBeat[] = [
  {
    title: "Unknown destination — the first flood",
    src: "A",
    dst: "B",
  },
  {
    title: "The reply — destination is now known",
    src: "B",
    dst: "A",
  },
  {
    title: "Known unicast — no flooding",
    src: "A",
    dst: "B",
  },
  {
    title: "A silent host is still unknown",
    src: "A",
    dst: "C",
  },
  {
    title: "Broadcast always floods",
    src: "D",
    dst: "broadcast",
  },
];
