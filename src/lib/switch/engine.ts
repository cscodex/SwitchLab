import { BROADCAST_MAC, HOSTS, PORTS, hostById, hostByPort, macTail } from "./hosts";
import type { AnimStep, DestId, HostId, LearnOp, MacEntry, Plan, PortId } from "./types";

let planSeq = 0;

export function buildPlan(
  srcId: HostId,
  dstId: DestId,
  table: MacEntry[],
  lessonTitle?: string,
): Plan {
  const src = hostById(srcId);
  const isBroadcast = dstId === "broadcast";
  const dst = isBroadcast ? null : hostById(dstId);
  const dstMac = isBroadcast ? BROADCAST_MAC : dst!.mac;
  const inPort = src.port;

  const existing = table.find((e) => e.mac === src.mac);
  const learn: LearnOp = {
    mac: src.mac,
    port: inPort,
    hostId: src.id,
    isNew: !existing,
  };

  const found = !isBroadcast ? table.find((e) => e.mac === dstMac) : undefined;
  const lookupHit = Boolean(found);
  const decision: Plan["decision"] = isBroadcast || !found ? "flood" : "unicast";
  const outPorts: PortId[] =
    decision === "flood" ? PORTS.filter((p) => p !== inPort) : [found!.port];

  const dstLabel = isBroadcast ? "broadcast" : dst!.name;
  const dstMacShown = isBroadcast ? BROADCAST_MAC : dst!.mac;

  const learnBody = learn.isNew
    ? `Source ${src.mac} is not in the table. The switch records it on Port ${inPort}. Next time a frame is destined for ${src.name}, it will know exactly where to send it.`
    : `Source ${src.mac} is already mapped to Port ${inPort}. The switch refreshes the entry — this is how aging stays current.`;

  const lookupBody = isBroadcast
    ? `Destination is ${BROADCAST_MAC}. Broadcasts are never looked up as a unicast — every other port must receive a copy.`
    : found
      ? `Destination ${dstMacShown} maps to Port ${found.port} (${hostByPort(found.port).name}). A hit means the switch can forward to one port only.`
      : `Destination ${dstMacShown} is not in the table. ${dst!.name} has never sent a frame, so the switch has never learned that MAC.`;

  const decideBody =
    decision === "flood"
      ? isBroadcast
        ? `Flood: copy the frame out Ports ${outPorts.join(", ")} — every port except the one it came in on.`
        : `Flood: copy the frame out Ports ${outPorts.join(", ")}. Flooding is how unknown unicast is delivered — and why a populated table matters.`
      : `Unicast: forward only to Port ${outPorts[0]} (${hostByPort(outPorts[0]!).name}). Ports ${PORTS.filter((p) => p !== inPort && p !== outPorts[0]).join(" and ")} stay quiet.`;

  const deliveries = outPorts.map((port) => {
    const host = hostByPort(port);
    const action: "accept" | "drop" =
      isBroadcast || (dst && host.id === dst.id) ? "accept" : "drop";
    return { hostId: host.id, port, action };
  });

  const acceptHosts = deliveries.filter((d) => d.action === "accept").map((d) => hostById(d.hostId).name);
  const dropHosts = deliveries.filter((d) => d.action === "drop").map((d) => hostById(d.hostId).name);

  let deliverBody: string;
  if (isBroadcast) {
    deliverBody = `${acceptHosts.join(", ")} accept the broadcast. The sender never gets its own frame back — the switch filters the incoming port.`;
  } else if (dropHosts.length === 0) {
    deliverBody = `Only ${acceptHosts.join(", ")} receives the frame. The other computers never see it on the wire.`;
  } else {
    deliverBody = `${acceptHosts.join(", ")} matches the destination MAC and accepts. ${dropHosts.join(" and ")} receive a flooded copy, see a foreign destination, and silently drop it.`;
  }

  const steps: AnimStep[] = [
    {
      kind: "travel-in",
      duration: 920,
      title: `Frame leaves ${src.name}`,
      body: `${src.name} transmits an Ethernet frame toward the switch: source ${macTail(src.mac)}, destination ${isBroadcast ? "FF:FF" : macTail(dstMac)}.`,
    },
    {
      kind: "inspect",
      duration: 780,
      title: `Arrives on Port ${inPort}`,
      body: `The switch reads the header on Port ${inPort}. Source ${src.mac}. Destination ${dstMacShown}.`,
    },
    {
      kind: "learn",
      duration: 980,
      title: learn.isNew ? "Source MAC is learned" : "Source MAC is refreshed",
      body: learnBody,
    },
    {
      kind: "lookup",
      duration: 880,
      title: isBroadcast ? "Destination is broadcast" : lookupHit ? "Destination is known" : "Destination is unknown",
      body: lookupBody,
    },
    {
      kind: "decide",
      duration: 820,
      title: decision === "flood" ? "Flood" : "Unicast forward",
      body: decideBody,
    },
    {
      kind: "travel-out",
      duration: 920,
      title: decision === "flood" ? "Copies leave the switch" : `Out Port ${outPorts[0]} only`,
      body:
        decision === "flood"
          ? `Identical copies travel the cables on Ports ${outPorts.join(", ")}.`
          : `A single copy travels the cable to ${hostByPort(outPorts[0]!).name}.`,
    },
    {
      kind: "deliver",
      duration: 1100,
      title: "Delivery",
      body: deliverBody,
    },
  ];

  return {
    id: `plan-${++planSeq}`,
    src,
    dst,
    dstMac,
    isBroadcast,
    inPort,
    outPorts,
    decision,
    lookupHit,
    learn,
    steps,
    lessonTitle,
  };
}

export function applyLearn(table: MacEntry[], learn: LearnOp): MacEntry[] {
  const next: MacEntry[] = table.map((e) => ({ ...e, flash: null }));
  const idx = next.findIndex((e) => e.mac === learn.mac);
  if (idx === -1) {
    next.push({
      mac: learn.mac,
      port: learn.port,
      hostId: learn.hostId,
      type: "DYNAMIC",
      flash: "learn",
    });
    return next.sort((a, b) => a.port - b.port);
  }
  const current = next[idx]!;
  next[idx] = {
    ...current,
    port: learn.port,
    hostId: learn.hostId,
    flash: current.port === learn.port ? "update" : "learn",
  };
  return next.sort((a, b) => a.port - b.port);
}

export function flashLookup(table: MacEntry[], dstMac: string, hit: boolean): MacEntry[] {
  if (!hit) return table.map((e) => ({ ...e, flash: null as MacEntry["flash"] }));
  return table.map((e) => ({
    ...e,
    flash: e.mac === dstMac ? ("hit" as const) : null,
  }));
}

export function clearFlash(table: MacEntry[]): MacEntry[] {
  return table.map((e) => ({ ...e, flash: null }));
}

export function presetLabel(src: HostId, dst: DestId): string {
  const from = HOSTS.find((h) => h.id === src)?.name ?? src;
  if (dst === "broadcast") return `${from} · broadcast`;
  const to = HOSTS.find((h) => h.id === dst)?.name ?? dst;
  return `${from} → ${to}`;
}
