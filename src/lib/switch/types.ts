export type PortId = 1 | 2 | 3 | 4;
export type HostId = "A" | "B" | "C" | "D";
export type DestId = HostId | "broadcast";

export interface Host {
  id: HostId;
  name: string;
  mac: string;
  port: PortId;
}

export type StepKind =
  | "travel-in"
  | "inspect"
  | "learn"
  | "lookup"
  | "decide"
  | "travel-out"
  | "deliver";

export interface Delivery {
  hostId: HostId;
  port: PortId;
  action: "accept" | "drop";
}

export interface AnimStep {
  kind: StepKind;
  duration: number;
  title: string;
  body: string;
}

export interface LearnOp {
  mac: string;
  port: PortId;
  hostId: HostId;
  isNew: boolean;
}

export interface Plan {
  id: string;
  src: Host;
  dst: Host | null;
  dstMac: string;
  isBroadcast: boolean;
  inPort: PortId;
  outPorts: PortId[];
  decision: "flood" | "unicast";
  lookupHit: boolean;
  learn: LearnOp;
  steps: AnimStep[];
  lessonTitle?: string;
}

export interface MacEntry {
  mac: string;
  port: PortId;
  hostId: HostId;
  type: "DYNAMIC";
  flash: "learn" | "hit" | "update" | null;
}

export interface LogLine {
  id: string;
  text: string;
  tone: "learn" | "flood" | "unicast" | "drop" | "info";
}

export interface LessonBeat {
  title: string;
  src: HostId;
  dst: DestId;
}
