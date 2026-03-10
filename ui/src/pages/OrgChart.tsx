import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl, cn, relativeTime } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import {
  Network,
  Wrench as WrenchIcon,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";
import type { Agent, AgentCognitiveData } from "@paperclipai/shared";

// Layout constants
const CARD_W = 220;
const CARD_H = 140;
const GAP_X = 32;
const GAP_Y = 80;
const PADDING = 60;

// ── Tree layout types ───────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  children: LayoutNode[];
}

// ── Layout algorithm ────────────────────────────────────────────────────

function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

function layoutForest(roots: OrgNode[]): LayoutNode[] {
  if (roots.length === 0) return [];

  let x = PADDING;
  const y = PADDING;

  const result: LayoutNode[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, y));
    x += w + GAP_X;
  }

  return result;
}

function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ── Color helpers ────────────────────────────────────────────────────────

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  openclaw: "OpenClaw",
  process: "Process",
  http: "HTTP",
};

const statusDotColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};
const defaultDotColor = "#a3a3a3";

const healthColors: Record<string, string> = {
  healthy: "bg-green-500/20 text-green-400 border-green-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  drifted: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  stale: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
  degraded: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const modelTierColors: Record<string, string> = {
  frontier: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  standard: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  fast: "bg-green-500/20 text-green-400 border-green-500/30",
  mini: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
};

const AGENT_DETAIL_TABS = [
  "overview",
  "identity",
  "skill-chains",
  "tools",
  "delegation",
  "runtime",
  "memory",
  "audit",
  "health",
] as const;

function useCompanyCognitiveData(companyId: string | null, agents: Agent[] | undefined) {
  return useQuery({
    queryKey: ["agents", companyId, "cognitive-company"],
    enabled: Boolean(companyId && agents && agents.length > 0),
    retry: false,
    queryFn: async () => {
      const entries = await Promise.all(
        (agents ?? []).map(async (agent) => {
          try {
            const data = await agentsApi.cognitive(agent.id, companyId ?? undefined);
            return [agent.id, data] as const;
          } catch {
            return [agent.id, null] as const;
          }
        }),
      );
      return new Map<string, AgentCognitiveData>(
        entries.filter((entry): entry is readonly [string, AgentCognitiveData] => Boolean(entry[1])),
      );
    },
  });
}

// ── Main component ──────────────────────────────────────────────────────

export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { data: orgTree, isLoading } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const { data: cognitiveMap } = useCompanyCognitiveData(selectedCompanyId ?? null, agents);

  useEffect(() => {
    setBreadcrumbs([{ label: "Org Chart" }]);
  }, [setBreadcrumbs]);

  // Layout computation
  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);

  // Compute SVG bounds
  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // Selected node data
  const selectedCog = selectedNodeId ? cognitiveMap?.get(selectedNodeId) ?? null : null;
  const selectedAgent = selectedNodeId ? agentMap.get(selectedNodeId) : null;

  // Pan & zoom state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Center the chart on first load
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current) return;
    hasInitialized.current = true;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaleX = (containerW - 40) / bounds.width;
    const scaleY = (containerH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;

    setZoom(fitZoom);
    setPan({
      x: (containerW - chartW) / 2,
      y: (containerH - chartH) / 2,
    });
  }, [allNodes, bounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-org-card]")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);

    const scale = newZoom / zoom;
    setPan({
      x: mouseX - scale * (mouseX - pan.x),
      y: mouseY - scale * (mouseY - pan.y),
    });
    setZoom(newZoom);
  }, [zoom, pan]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="Select a company to view the org chart." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (orgTree && orgTree.length === 0) {
    return <EmptyState icon={Network} message="No organizational hierarchy defined." />;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Chart area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-muted/20 border border-border rounded-lg"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
            onClick={() => {
              const newZoom = Math.min(zoom * 1.2, 2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
            onClick={() => {
              const newZoom = Math.max(zoom * 0.8, 0.2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-[10px] hover:bg-accent transition-colors"
            onClick={() => {
              if (!containerRef.current) return;
              const cW = containerRef.current.clientWidth;
              const cH = containerRef.current.clientHeight;
              const scaleX = (cW - 40) / bounds.width;
              const scaleY = (cH - 40) / bounds.height;
              const fitZoom = Math.min(scaleX, scaleY, 1);
              const chartW = bounds.width * fitZoom;
              const chartH = bounds.height * fitZoom;
              setZoom(fitZoom);
              setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
            }}
            title="Fit to screen"
            aria-label="Fit chart to screen"
          >
            Fit
          </button>
        </div>

        {/* SVG layer for edges */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map(({ parent, child }) => {
              const x1 = parent.x + CARD_W / 2;
              const y1 = parent.y + CARD_H;
              const x2 = child.x + CARD_W / 2;
              const y2 = child.y;
              const midY = (y1 + y2) / 2;

              return (
                <path
                  key={`${parent.id}-${child.id}`}
                  d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        </svg>

        {/* Card layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {allNodes.map((node) => {
            const agent = agentMap.get(node.id);
            const cog = cognitiveMap?.get(node.id) ?? null;
            const dotColor = statusDotColor[node.status] ?? defaultDotColor;
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;

            return (
              <div
                key={node.id}
                data-org-card
                className={cn(
                  "absolute bg-card border rounded-lg shadow-sm hover:shadow-md transition-[box-shadow,border-color] duration-150 cursor-pointer select-none",
                  isSelected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-foreground/20",
                )}
                style={{
                  left: node.x,
                  top: node.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                }}
                onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <div className="flex flex-col px-3 py-2.5 gap-1">
                  {/* Top row: icon + name + title */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        <AgentIcon icon={agent?.icon} className="h-4.5 w-4.5 text-foreground/70" />
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                        style={{ backgroundColor: dotColor }}
                      />
                    </div>
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground leading-tight truncate w-full">
                        {node.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate w-full">
                        {agent?.title ?? roleLabel(node.role)}
                      </span>
                      {cog && (
                        <span className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5 truncate w-full">
                          {cog.profile.specialization}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges row: health + model tier */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {cog && (
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border",
                          healthColors[cog.profile.healthStatus] ??
                            "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
                        )}
                      >
                        {cog.profile.healthStatus}
                      </span>
                    )}
                    {cog && (
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border",
                          modelTierColors[cog.profile.modelTier] ??
                            "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
                        )}
                      >
                        {cog.profile.modelTier}
                      </span>
                    )}
                    {cog && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
                        <WrenchIcon className="h-2.5 w-2.5" />
                        {cog.profile.toolCount}
                      </span>
                    )}
                    {cog && cog.profile.driftStatus > 0.1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Capability tags */}
                  {cog && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {cog.profile.capabilityTags.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[9px] font-medium bg-accent text-accent-foreground rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover tooltip / popover */}
                {isHovered && !isSelected && cog && (
                  <div
                    className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64 pointer-events-none"
                    style={{
                      left: CARD_W + 8,
                      top: 0,
                    }}
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                        {cog.profile.mission}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <div>
                          <span className="text-muted-foreground">Role: </span>
                          <span className="text-foreground">{cog.profile.cognitiveRole}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Delegations: </span>
                          <span className="text-foreground">{cog.delegationPolicies.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Health: </span>
                          <span className="text-foreground">{cog.profile.healthStatus}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Drift: </span>
                          <span className="text-foreground">{(cog.profile.driftStatus * 100).toFixed(0)}%</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Last active: </span>
                          <span className="text-foreground">{relativeTime(cog.profile.lastSyncAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel for selected node */}
      {selectedNodeId && selectedCog && (
        <div className="w-80 shrink-0 border-l border-border bg-background overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <AgentIcon
                      icon={selectedAgent?.icon}
                      className="h-4.5 w-4.5 text-foreground/70"
                    />
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{selectedCog.agentName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedCog.profile.cognitiveRole}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Mission</h3>
              <p className="text-xs text-foreground leading-relaxed">
                {selectedCog.profile.mission}
              </p>
            </div>

            {/* Health + Drift summary */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Health & Drift</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">Alignment</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    selectedCog.cognitiveHealth.alignmentScore >= 0.9 ? "text-green-400" :
                    selectedCog.cognitiveHealth.alignmentScore >= 0.7 ? "text-yellow-400" : "text-red-400",
                  )}>
                    {Math.round(selectedCog.cognitiveHealth.alignmentScore * 100)}%
                  </div>
                </div>
                <div className="bg-muted/50 rounded px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">Drift</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    selectedCog.cognitiveHealth.driftScore < 0.1 ? "text-green-400" :
                    selectedCog.cognitiveHealth.driftScore < 0.25 ? "text-yellow-400" : "text-red-400",
                  )}>
                    {Math.round(selectedCog.cognitiveHealth.driftScore * 100)}%
                  </div>
                </div>
                <div className="bg-muted/50 rounded px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">Completeness</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    selectedCog.cognitiveHealth.completenessScore >= 0.9 ? "text-green-400" :
                    selectedCog.cognitiveHealth.completenessScore >= 0.7 ? "text-yellow-400" : "text-red-400",
                  )}>
                    {Math.round(selectedCog.cognitiveHealth.completenessScore * 100)}%
                  </div>
                </div>
                <div className="bg-muted/50 rounded px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">Tool Coverage</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    selectedCog.cognitiveHealth.toolPolicyCoverage >= 0.9 ? "text-green-400" :
                    selectedCog.cognitiveHealth.toolPolicyCoverage >= 0.7 ? "text-yellow-400" : "text-red-400",
                  )}>
                    {Math.round(selectedCog.cognitiveHealth.toolPolicyCoverage * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Recent activity (mock) */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Recent Activity</h3>
              <div className="space-y-1.5">
                <div className="text-[11px] text-foreground bg-muted/50 rounded px-2 py-1.5">
                  Blueprint synced {relativeTime(selectedCog.profile.lastSyncAt)}
                </div>
                <div className="text-[11px] text-foreground bg-muted/50 rounded px-2 py-1.5">
                  Last audit {relativeTime(selectedCog.auditDriftReport.lastAuditedAt)}
                </div>
                <div className="text-[11px] text-foreground bg-muted/50 rounded px-2 py-1.5">
                  Health assessed {relativeTime(selectedCog.cognitiveHealth.lastAssessed)}
                </div>
              </div>
            </div>

            {/* Quick links to 9 tabs */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Agent Detail Tabs</h3>
              <div className="grid grid-cols-3 gap-1">
                {AGENT_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      if (selectedAgent) {
                        navigate(`${agentUrl(selectedAgent)}/${tab}`);
                      }
                    }}
                    className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/50 hover:bg-accent hover:text-foreground rounded transition-colors text-center capitalize"
                  >
                    {tab.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Open agent page + dev mode */}
            <div className="space-y-2">
              {selectedAgent && (
                <button
                  onClick={() => navigate(agentUrl(selectedAgent))}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Agent Detail
                </button>
              )}
              {selectedAgent && (
                <button
                  onClick={() => navigate(`/developer-mode?agent=${selectedCog.agentId}`)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  Open in Developer Mode
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const roleLabels: Record<string, string> = {
  ceo: "CEO", cto: "CTO", cmo: "CMO", cfo: "CFO",
  engineer: "Engineer", designer: "Designer", pm: "PM",
  qa: "QA", devops: "DevOps", researcher: "Researcher", general: "General",
};

function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}
