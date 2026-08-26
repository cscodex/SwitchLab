import { createFileRoute } from "@tanstack/react-router";
import { SwitchLab } from "@/components/switch/switch-lab";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SwitchLab />;
}
