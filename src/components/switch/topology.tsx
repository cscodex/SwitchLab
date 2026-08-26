import { useEffect, useRef, useState } from "react";
import { HOSTS, macTail } from "@/lib/switch/hosts";
import { useSim } from "@/lib/switch/store";
import type { Host, Plan, PortId, StepKind } from "@/lib/switch/types";
import { useReducedMotion } from "@/lib/switch/use-reduced-motion";

const PORT_X: Record<PortId, number> = { 1: 128, 2: 256, 3: 384, 4: 512 };
const CABLE_START = 122;
const CABLE_END = 248;
const VIEW_W = 640;
const VIEW_H = 418;

function cableD(port: PortId): string {
  const x = PORT_X[port];
  const sag = port === 1 ? -16 : port === 2 ? -6 : port === 3 ? 6 : 16;
  return `M ${x} ${CABLE_START} C ${x + sag} 168, ${x + sag} 208, ${x} ${CABLE_END}`;
}

function pointOnPath(path: SVGPathElement | null, t: number) {
  if (!path) return null;
  const len = path.getTotalLength();
  const p = path.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
  return { x: p.x, y: p.y };
}

export function Topology() {
  const plan = useSim((s) => s.plan);
  const stepIndex = useSim((s) => s.stepIndex);
  const playing = useSim((s) => s.playing);
  const finished = useSim((s) => s.finished);
  const speed = useSim((s) => s.speed);
  const advance = useSim((s) => s.advance);
  const srcId = useSim((s) => s.srcId);
  const dstId = useSim((s) => s.dstId);
  const selectHost = useSim((s) => s.selectHost);
  const table = useSim((s) => s.table);

  const step = plan?.steps[stepIndex];
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const pathRefs = useRef<Partial<Record<PortId, SVGPathElement | null>>>({});
  const reduced = useReducedMotion();
  const [, bump] = useState(0);

  useEffect(() => {
    bump((n) => n + 1);
  }, []);

  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
  }, [stepIndex, plan?.id]);

  useEffect(() => {
    if (!playing || finished || !step) return;
    let cancelled = false;
    const dur = reduced ? 90 : Math.max(140, step.duration / speed);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (cancelled) return;
      const dt = now - last;
      last = now;
      progressRef.current = Math.min(1, progressRef.current + dt / dur);
      setProgress(progressRef.current);
      if (progressRef.current >= 1) {
        if (!cancelled) advance();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, finished, stepIndex, step, speed, reduced, advance, plan?.id]);

  const kind = step?.kind;
  const inPort = plan?.inPort;
  const outPorts = plan?.outPorts ?? [];
  const tone: "flood" | "unicast" = plan?.decision === "flood" ? "flood" : "unicast";
  const label = plan
    ? `${macTail(plan.src.mac)}→${plan.isBroadcast ? "FF" : macTail(plan.dstMac)}`
    : "";

  const inbound =
    kind === "travel-in" && inPort
      ? pointOnPath(pathRefs.current[inPort] ?? null, 1 - progress)
      : null;

  const outbound =
    kind === "travel-out"
      ? outPorts.map((port) => ({
          port,
          pt: pointOnPath(pathRefs.current[port] ?? null, progress),
        }))
      : [];

  const showCard =
    kind === "inspect" || kind === "learn" || kind === "lookup" || kind === "decide";

  const busyIn = kind === "travel-in" || showCard;
  const busyOut = kind === "travel-out" || kind === "deliver";

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface shadow-border">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Four computers connected to an Ethernet switch"
      >
        <title>Switch topology</title>
        <rect width={VIEW_W} height={VIEW_H} fill="var(--color-bg)" />
        <BenchGrid />

        {HOSTS.map((host) => {
          const learned = table.some((e) => e.mac === host.mac);
          const active =
            (busyIn && inPort === host.port) ||
            (busyOut && outPorts.includes(host.port));
          return (
            <path
              key={`cable-${host.port}`}
              ref={(el) => {
                pathRefs.current[host.port] = el;
              }}
              d={cableD(host.port)}
              fill="none"
              stroke={active ? "var(--color-cable-on)" : "var(--color-cable)"}
              strokeWidth={active ? 6 : 5}
              strokeLinecap="round"
              opacity={learned || active || srcId === host.id || dstId === host.id ? 1 : 0.72}
            />
          );
        })}

        <SwitchChassis
          planIn={inPort}
          outPorts={outPorts}
          busyIn={Boolean(busyIn)}
          busyOut={Boolean(busyOut)}
          kind={kind}
          tablePorts={table.map((e) => e.port)}
        />

        {showCard && plan ? <FrameCard planTone={tone} kind={kind} plan={plan} /> : null}

        {HOSTS.map((host) => (
          <HostNode
            key={host.id}
            host={host}
            selectedSrc={srcId === host.id}
            selectedDst={
              dstId === host.id || (dstId === "broadcast" && srcId !== host.id && Boolean(srcId))
            }
            delivery={deliveryFor(host, plan, kind)}
            learned={table.some((e) => e.mac === host.mac)}
            disabled={playing && !finished}
            onSelect={() => selectHost(host.id)}
          />
        ))}

        {inbound ? <PacketMarker x={inbound.x} y={inbound.y} label={label} tone="unicast" /> : null}
        {outbound.map(({ port, pt }) =>
          pt ? (
            <PacketMarker
              key={`out-${port}`}
              x={pt.x}
              y={pt.y}
              label={label}
              tone={tone}
            />
          ) : null,
        )}

        {kind === "travel-out" && plan ? (
          <DecisionBanner decision={plan.decision} ports={plan.outPorts} />
        ) : null}
      </svg>
    </div>
  );
}

function deliveryFor(
  host: Host,
  plan: Plan | null,
  kind: StepKind | undefined,
): "accept" | "drop" | "send" | null {
  if (!plan || !kind) return null;
  if (kind === "deliver") {
    if (plan.outPorts.includes(host.port)) {
      return plan.isBroadcast || plan.dst?.id === host.id ? "accept" : "drop";
    }
    return null;
  }
  if (host.id === plan.src.id && kind === "travel-in") return "send";
  return null;
}

function BenchGrid() {
  const dots = [];
  for (let x = 24; x < VIEW_W; x += 24) {
    for (let y = 24; y < VIEW_H; y += 24) {
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={0.7}
          fill="var(--color-fg)"
          opacity={0.09}
        />,
      );
    }
  }
  return <g aria-hidden="true">{dots}</g>;
}

function SwitchChassis({
  planIn,
  outPorts,
  busyIn,
  busyOut,
  kind,
  tablePorts,
}: {
  planIn?: PortId;
  outPorts: PortId[];
  busyIn: boolean;
  busyOut: boolean;
  kind?: StepKind;
  tablePorts: PortId[];
}) {
  return (
    <g>
      <rect
        x={48}
        y={12}
        width={544}
        height={108}
        rx={14}
        fill="var(--color-elevated)"
        stroke="var(--color-border)"
      />
      <rect
        x={60}
        y={24}
        width={520}
        height={84}
        rx={8}
        fill="var(--color-surface)"
      />
      <text
        x={76}
        y={46}
        fill="var(--color-fg)"
        fontSize={13}
        fontWeight={600}
        fontFamily="var(--font-sans)"
        letterSpacing="0.04em"
      >
        SW1
      </text>
      <text
        x={76}
        y={62}
        fill="var(--color-muted)"
        fontSize={10}
        fontFamily="var(--font-sans)"
      >
        4-port learning bridge
      </text>
      <g>
        <circle cx={548} cy={40} r={4} fill="var(--color-link)" />
        <text
          x={538}
          y={44}
          textAnchor="end"
          fill="var(--color-subtle)"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          PWR
        </text>
      </g>
      {([1, 2, 3, 4] as PortId[]).map((port) => {
        const x = PORT_X[port];
        const isIn = busyIn && planIn === port;
        const isOut = busyOut && outPorts.includes(port);
        const known = tablePorts.includes(port);
        const led = isIn || isOut ? "var(--color-unicast)" : known ? "var(--color-link)" : "var(--color-subtle)";
        return (
          <g key={port}>
            <circle
              cx={x}
              cy={74}
              r={3.2}
              fill={isOut && kind === "travel-out" ? "var(--color-flood)" : led}
              className={isIn || isOut ? "led-busy" : undefined}
            />
            <path
              d={`M ${x - 16} 84 h 32 v 14 h -7 l -4 7 h -10 l -4 -7 h -7 z`}
              fill="var(--color-elevated)"
              stroke="var(--color-border)"
            />
            <text
              x={x}
              y={116}
              textAnchor="middle"
              fill="var(--color-subtle)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {port}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function FrameCard({
  plan,
  kind,
  planTone,
}: {
  plan: Plan;
  kind?: StepKind;
  planTone: "flood" | "unicast";
}) {
  let status = "FRAME";
  let statusColor = "var(--color-muted)";
  if (kind === "learn") {
    status = plan.learn.isNew ? `LEARN · PORT ${plan.inPort}` : `REFRESH · PORT ${plan.inPort}`;
    statusColor = "var(--color-learn)";
  } else if (kind === "lookup") {
    status = plan.isBroadcast ? "BROADCAST" : plan.lookupHit ? "LOOKUP HIT" : "LOOKUP MISS";
    statusColor = plan.lookupHit ? "var(--color-unicast)" : "var(--color-flood)";
  } else if (kind === "decide") {
    status = plan.decision === "flood" ? "FLOOD" : "UNICAST";
    statusColor = planTone === "flood" ? "var(--color-flood)" : "var(--color-unicast)";
  } else if (kind === "inspect") {
    status = `IN PORT ${plan.inPort}`;
    statusColor = "var(--color-accent)";
  }

  return (
    <g>
      <rect
        x={220}
        y={28}
        width={200}
        height={52}
        rx={8}
        fill="var(--color-elevated)"
        stroke="var(--color-border)"
      />
      <text
        x={320}
        y={42}
        textAnchor="middle"
        fill={statusColor}
        fontSize={9}
        fontWeight={600}
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em"
      >
        {status}
      </text>
      <text
        x={320}
        y={58}
        textAnchor="middle"
        fill="var(--color-fg)"
        fontSize={10}
        fontFamily="var(--font-mono)"
      >
        {`src ${plan.src.mac}`}
      </text>
      <text
        x={320}
        y={72}
        textAnchor="middle"
        fill="var(--color-muted)"
        fontSize={10}
        fontFamily="var(--font-mono)"
      >
        {`dst ${plan.dstMac}`}
      </text>
    </g>
  );
}

function DecisionBanner({
  decision,
  ports,
}: {
  decision: "flood" | "unicast";
  ports: PortId[];
}) {
  const label =
    decision === "flood"
      ? `FLOOD · ports ${ports.join("  ")}`
      : `UNICAST · port ${ports[0]}`;
  return (
    <g>
      <rect
        x={200}
        y={128}
        width={240}
        height={22}
        rx={11}
        fill="var(--color-bg)"
        stroke="var(--color-border)"
      />
      <text
        x={320}
        y={143}
        textAnchor="middle"
        fill={decision === "flood" ? "var(--color-flood)" : "var(--color-unicast)"}
        fontSize={10}
        fontWeight={600}
        fontFamily="var(--font-mono)"
        letterSpacing="0.06em"
      >
        {label}
      </text>
    </g>
  );
}

function PacketMarker({
  x,
  y,
  label,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  tone: "unicast" | "flood";
}) {
  const fill = tone === "flood" ? "var(--color-flood)" : "var(--color-unicast)";
  return (
    <g transform={`translate(${x} ${y})`} className="packet-glow">
      <rect x={-30} y={-12} width={60} height={24} rx={12} fill={fill} />
      <text
        textAnchor="middle"
        y={4}
        fill="var(--color-accent-fg)"
        fontSize={10}
        fontWeight={600}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  );
}

function HostNode({
  host,
  selectedSrc,
  selectedDst,
  delivery,
  learned,
  disabled,
  onSelect,
}: {
  host: Host;
  selectedSrc: boolean;
  selectedDst: boolean;
  delivery: "accept" | "drop" | "send" | null;
  learned: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const x = PORT_X[host.port];
  const top = 252;
  const ring = selectedSrc
    ? "var(--color-unicast)"
    : selectedDst
      ? "var(--color-flood)"
      : "transparent";
  const screen =
    delivery === "accept"
      ? "var(--color-unicast)"
      : delivery === "drop"
        ? "var(--color-drop)"
        : delivery === "send"
          ? "var(--color-accent)"
          : "var(--color-elevated)";
  const screenFg =
    delivery === "accept" || delivery === "drop" || delivery === "send"
      ? "var(--color-accent-fg)"
      : "var(--color-fg)";

  return (
    <g
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${host.name}, MAC ${host.mac}, Port ${host.port}${selectedSrc ? ", source" : ""}${selectedDst ? ", destination" : ""}`}
      aria-pressed={selectedSrc || selectedDst}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="outline-none"
      style={{ cursor: disabled ? "default" : "pointer" }}
    >
      <rect
        x={x - 50}
        y={top - 6}
        width={100}
        height={158}
        rx={14}
        fill="transparent"
        stroke={ring}
        strokeWidth={selectedSrc || selectedDst ? 1.5 : 0}
        strokeDasharray={selectedDst && !selectedSrc ? "4 3" : undefined}
      />
      <rect
        x={x - 42}
        y={top}
        width={84}
        height={56}
        rx={8}
        fill="var(--color-elevated)"
        stroke="var(--color-border)"
      />
      <rect x={x - 34} y={top + 8} width={68} height={36} rx={4} fill={screen} />
      <text
        x={x}
        y={top + 33}
        textAnchor="middle"
        fill={screenFg}
        fontSize={18}
        fontWeight={600}
        fontFamily="var(--font-sans)"
      >
        {host.id}
      </text>
      <rect x={x - 7} y={top + 56} width={14} height={8} fill="var(--color-elevated)" />
      <rect x={x - 20} y={top + 64} width={40} height={4} rx={1} fill="var(--color-border)" />
      <text
        x={x}
        y={top + 88}
        textAnchor="middle"
        fill="var(--color-fg)"
        fontSize={12}
        fontWeight={500}
        fontFamily="var(--font-sans)"
      >
        {host.name}
      </text>
      <text
        x={x}
        y={top + 104}
        textAnchor="middle"
        fill="var(--color-muted)"
        fontSize={9}
        fontFamily="var(--font-mono)"
      >
        {host.mac}
      </text>
      <text
        x={x}
        y={top + 118}
        textAnchor="middle"
        fill="var(--color-subtle)"
        fontSize={9}
        fontFamily="var(--font-mono)"
      >
        {`Port ${host.port}`}
        {learned ? " · in table" : ""}
      </text>
      {delivery === "accept" ? (
        <StatusChip x={x} y={top - 18} text="ACCEPT" color="var(--color-unicast)" />
      ) : null}
      {delivery === "drop" ? (
        <StatusChip x={x} y={top - 18} text="DROP" color="var(--color-drop)" />
      ) : null}
      {selectedSrc && !delivery ? (
        <StatusChip x={x} y={top - 18} text="SRC" color="var(--color-unicast)" />
      ) : null}
      {selectedDst && !selectedSrc && !delivery ? (
        <StatusChip x={x} y={top - 18} text="DST" color="var(--color-flood)" />
      ) : null}
    </g>
  );
}

function StatusChip({
  x,
  y,
  text,
  color,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
}) {
  const w = text.length * 6.2 + 16;
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={16} rx={8} fill="var(--color-bg)" stroke={color} />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontWeight={600}
        fontFamily="var(--font-mono)"
        letterSpacing="0.06em"
      >
        {text}
      </text>
    </g>
  );
}

export function TopologyHint() {
  return (
    <p className="text-xs text-muted">
      Click a computer for the source, then a destination — or send a preset below.
    </p>
  );
}
