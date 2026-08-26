import type { Host, HostId, PortId } from "./types";

export const BROADCAST_MAC = "FF:FF:FF:FF:FF:FF";

export const HOSTS: readonly Host[] = [
  { id: "A", name: "PC-A", mac: "00:1A:2B:3C:4D:A1", port: 1 },
  { id: "B", name: "PC-B", mac: "00:1A:2B:3C:4D:B2", port: 2 },
  { id: "C", name: "PC-C", mac: "00:1A:2B:3C:4D:C3", port: 3 },
  { id: "D", name: "PC-D", mac: "00:1A:2B:3C:4D:D4", port: 4 },
] as const;

export const PORTS: PortId[] = [1, 2, 3, 4];

export function hostById(id: HostId): Host {
  const host = HOSTS.find((h) => h.id === id);
  if (!host) throw new Error(`Unknown host ${id}`);
  return host;
}

export function hostByPort(port: PortId): Host {
  const host = HOSTS.find((h) => h.port === port);
  if (!host) throw new Error(`Unknown port ${port}`);
  return host;
}

export function macTail(mac: string): string {
  const parts = mac.split(":");
  return parts[parts.length - 1] ?? mac;
}
