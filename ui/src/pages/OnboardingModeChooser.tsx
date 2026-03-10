import { Link } from "@/lib/router";
import { Plug, Rocket } from "lucide-react";
import { cn } from "../lib/utils";

function ModeCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Plug;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8",
        "text-center transition-all duration-150",
        "hover:border-ring hover:shadow-md hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

export default function OnboardingModeChooser() {
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">How would you like to get started?</h1>
        <p className="text-sm text-muted-foreground">
          You can always add more teams later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModeCard
          to="/attach"
          icon={Plug}
          title="Attach Existing OpenClaw"
          description="I already have an OpenClaw environment running. Connect Paperclip to manage it."
        />
        <ModeCard
          to="/bootstrap"
          icon={Rocket}
          title="Create New Team"
          description="Start fresh. Paperclip will register a new company and generate agent configurations for your runtime."
        />
      </div>
    </div>
  );
}
