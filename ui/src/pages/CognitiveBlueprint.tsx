import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi, type OrgNode } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl, cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import {
  Brain,
  ArrowRightLeft,
  Layers,
  Wrench as WrenchIcon,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";
import {
  mockAgentCognitiveData,
  getAgentCognitiveData,
} from "@/lib/mockCognitiveData";
import type { Agent } from "@paperclipai/shared";
import type { AgentCognitiveData, CapabilityTag, DelegationPolicy } from "@paperclipai/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_W = 180;
const NODE_H = 120;
const GAP_X = 40;
const GAP_Y = 100;
const PADDING = 80;

type ViewMode = "delegation" | "capabilities" | "tools" | "escalation";

const VIEW_MODES: { key: ViewMode; label: string; icon: typeof Brain }[] = [
  { key: "delegation", label: "Delegation", icon: ArrowRightLeft },
  { key: "capabilities", label: "Capabilities", icon: Layers },
  { key: "tools", label: "Tools", icon: WrenchIcon },
  { key: "escalation", label: "Escalation", icon: AlertTriangle },
];

// ---------------------------------------------------------------------------
// Health & model tier color helpers
// ---------------------------------------------------------------------------

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

const statusDotColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};

// ---------------------------------------------------------------------------
// Layout for tree
// ---------------------------------------------------------------------------

interface BlueprintNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  children: BlueprintNode[];
}

function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return NODE_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(NODE_W, childrenW + gaps);
}

function layoutTree(node: OrgNode, x: number, y: number): BlueprintNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: BlueprintNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + NODE_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - NODE_W) / 2,
    y,
    children: layoutChildren,
  };
}

function layoutForest(roots: OrgNode[]): BlueprintNode[] {
  let x = PADDING;
  const y = PADDING;
  const result: BlueprintNode[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, y));
    x += w + GAP_X;
  }
  return result;
}

function flattenNodes(nodes: BlueprintNode[]): BlueprintNode[] {
  const result: BlueprintNode[] = [];
  function walk(n: BlueprintNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function collectEdges(
  nodes: BlueprintNode[],
): Array<{ parent: BlueprintNode; child: BlueprintNode }> {
  const edges: Array<{ parent: BlueprintNode; child: BlueprintNode }> = [];
  function walk(n: BlueprintNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ---------------------------------------------------------------------------
// Relationship edge computation
// ---------------------------------------------------------------------------

interface RelEdge {
  fromId: string;
  toId: string;
  color: string;
  label?: string;
}

function computeRelEdges(
  viewMode: ViewMode,
  cogData: AgentCognitiveData[],
): RelEdge[] {
  const edges: RelEdge[] = [];

  if (viewMode === "delegation") {
    for (const agent of cogData) {
      for (const dp of agent.delegationPolicies) {
        if (dp.delegateTo) {
          edges.push({
            fromId: agent.agentId,
            toId: dp.delegateTo,
            color: "#60a5fa",
            label: dp.taskClass,
          });
        }
      }
    }
  } else if (viewMode === "escalation") {
    for (const agent of cogData) {
      for (const dp of agent.delegationPolicies) {
        if (dp.escalateTo && dp.escalateTo !== "human-operator") {
          edges.push({
            fromId: agent.agentId,
            toId: dp.escalateTo,
            color: "#f87171",
            label: dp.taskClass,
          });
        }
      }
    }
  } else if (viewMode === "capabilities") {
    // Connect agents sharing capability tags
    for (let i = 0; i < cogData.length; i++) {
      for (let j = i + 1; j < cogData.length; j++) {
        const shared = cogData[i]!.profile.capabilityTags.filter((t: CapabilityTag) =>
          cogData[j]!.profile.capabilityTags.includes(t),
        );
        if (shared.length > 0) {
          edges.push({
            fromId: cogData[i]!.agentId,
            toId: cogData[j]!.agentId,
            color: "#a78bfa",
            label: shared.join(", "),
          });
        }
      }
    }
  } else if (viewMode === "tools") {
    // Connect agents sharing tools
    for (let i = 0; i < cogData.length; i++) {
      for (let j = i + 1; j < cogData.length; j++) {
        const toolsA = cogData[i]!.toolPolicies.map((t: { toolName: string }) => t.toolName);
        const toolsB = cogData[j]!.toolPolicies.map((t: { toolName: string }) => t.toolName);
        const shared = toolsA.filter((t: string) => toolsB.includes(t));
        if (shared.length > 0) {
          edges.push({
            fromId: cogData[i]!.agentId,
            toId: cogData[j]!.agentId,
            color: "#34d399",
            label: `${shared.length} shared`,
          });
        }
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Agent detail tabs (for links)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CognitiveBlueprint() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>("delegation");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  useEffect(() => {
    setBreadcrumbs([{ label: "Cognitive Blueprint" }]);
  }, [setBreadcrumbs]);

  // Layout
  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const allNodes = useMemo(() => flattenNodes(layout), [layout]);
  const parentEdges = useMemo(() => collectEdges(layout), [layout]);

  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0;
    let maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // Relationship edges
  const relEdges = useMemo(
    () => computeRelEdges(viewMode, mockAgentCognitiveData),
    [viewMode],
  );

  // Resolve rel edge coordinates
  const nodePositionMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of allNodes) m.set(n.id, { x: n.x, y: n.y });
    return m;
  }, [allNodes]);

  // Selected cognitive data
  const selectedCog = selectedNodeId
    ? getAgentCognitiveData(selectedNodeId)
    : null;
  const selectedAgent = selectedNodeId ? agentMap.get(selectedNodeId) : null;

  // Pan & zoom
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current)
      return;
    hasInitialized.current = true;

    const container = containerRef.current;
    // Account for sidebar panel width
    const sidebarW = selectedNodeId ? 320 : 0;
    const containerW = container.clientWidth - sidebarW;
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
  }, [allNodes, bounds, selectedNodeId]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-bp-card]")) return;
      setDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({
        x: dragStart.current.panX + dx,
        y: dragStart.current.panY + dy,
      });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
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
    },
    [zoom, pan],
  );

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Brain}
        message="Select a company to view the cognitive blueprint."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (orgTree && orgTree.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        message="No organizational hierarchy defined."
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            Cognitive Blueprint
          </h1>
        </div>
        {/* View mode toggles */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors",
                  viewMode === mode.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-muted/20 border-r border-border"
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
                  setPan({
                    x: cx - scale * (cx - pan.x),
                    y: cy - scale * (cy - pan.y),
                  });
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
                  setPan({
                    x: cx - scale * (cx - pan.x),
                    y: cy - scale * (cy - pan.y),
                  });
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

          {/* SVG edges layer */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%" }}
          >
            <defs>
              <marker
                id="arrowhead-blue"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
              </marker>
              <marker
                id="arrowhead-red"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#f87171" />
              </marker>
            </defs>
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            >
              {/* Parent-child hierarchy lines */}
              {parentEdges.map(({ parent, child }) => {
                const x1 = parent.x + NODE_W / 2;
                const y1 = parent.y + NODE_H;
                const x2 = child.x + NODE_W / 2;
                const y2 = child.y;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={`h-${parent.id}-${child.id}`}
                    d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1.5}
                    opacity={0.5}
                  />
                );
              })}

              {/* Relationship edges */}
              {relEdges.map((edge, i) => {
                const from = nodePositionMap.get(edge.fromId);
                const to = nodePositionMap.get(edge.toId);
                if (!from || !to) return null;

                const x1 = from.x + NODE_W / 2;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x + NODE_W / 2;
                const y2 = to.y + NODE_H / 2;

                // Curve offset
                const dx = x2 - x1;
                const dy = y2 - y1;
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const offset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3 + 20;
                const cx = mx + (dy > 0 ? -offset : offset) * 0.5;
                const cy = my + (dx > 0 ? offset : -offset) * 0.5;

                const markerId =
                  viewMode === "escalation"
                    ? "url(#arrowhead-red)"
                    : viewMode === "delegation"
                      ? "url(#arrowhead-blue)"
                      : undefined;

                return (
                  <path
                    key={`r-${i}`}
                    d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={1.5}
                    strokeDasharray={
                      viewMode === "capabilities" || viewMode === "tools"
                        ? "4 3"
                        : undefined
                    }
                    opacity={0.6}
                    markerEnd={markerId}
                  />
                );
              })}
            </g>
          </svg>

          {/* Node cards */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {allNodes.map((node) => {
              const agent = agentMap.get(node.id);
              const cog = getAgentCognitiveData(node.id);
              const dotColor =
                statusDotColor[node.status] ?? "#a3a3a3";
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  data-bp-card
                  className={cn(
                    "absolute bg-card border rounded-lg shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer select-none",
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-foreground/20",
                  )}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_W,
                    minHeight: NODE_H,
                  }}
                  onClick={() =>
                    setSelectedNodeId(
                      isSelected ? null : node.id,
                    )
                  }
                >
                  <div className="flex flex-col px-3 py-2.5 gap-1.5">
                    {/* Top row: icon + status + name */}
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <AgentIcon
                            icon={agent?.icon}
                            className="h-3.5 w-3.5 text-foreground/70"
                          />
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card"
                          style={{ backgroundColor: dotColor }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground leading-tight truncate">
                          {node.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight truncate">
                          {cog?.profile.cognitiveRole ?? node.role}
                        </span>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* Health badge */}
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
                      {/* Model tier */}
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
                    </div>

                    {/* Tool count + drift */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {cog && (
                        <span className="flex items-center gap-0.5">
                          <WrenchIcon className="h-2.5 w-2.5" />
                          {cog.profile.toolCount}
                        </span>
                      )}
                      {cog && cog.profile.driftStatus > 0.1 && (
                        <span className="flex items-center gap-0.5 text-orange-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {(cog.profile.driftStatus * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar detail panel */}
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
                    <h2 className="text-sm font-semibold">
                      {selectedCog.agentName}
                    </h2>
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

              {/* Mission */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1">
                  Mission
                </h3>
                <p className="text-xs text-foreground leading-relaxed">
                  {selectedCog.profile.mission}
                </p>
              </div>

              {/* Health scores */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">
                  Cognitive Health
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <HealthMetric
                    label="Alignment"
                    value={selectedCog.cognitiveHealth.alignmentScore}
                  />
                  <HealthMetric
                    label="Drift"
                    value={selectedCog.cognitiveHealth.driftScore}
                    invert
                  />
                  <HealthMetric
                    label="Completeness"
                    value={selectedCog.cognitiveHealth.completenessScore}
                  />
                  <HealthMetric
                    label="Tool Coverage"
                    value={selectedCog.cognitiveHealth.toolPolicyCoverage}
                  />
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Capabilities
                </h3>
                <div className="flex flex-wrap gap-1">
                  {selectedCog.profile.capabilityTags.map((tag: CapabilityTag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] font-medium bg-accent text-accent-foreground rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Delegation targets */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Delegation Targets
                </h3>
                <div className="space-y-1">
                  {selectedCog.delegationPolicies
                    .filter((dp: DelegationPolicy) => dp.delegateTo)
                    .map((dp: DelegationPolicy) => {
                      const target = mockAgentCognitiveData.find(
                        (a) => a.agentId === dp.delegateTo,
                      );
                      return (
                        <div
                          key={dp.id}
                          className="flex items-center justify-between text-xs py-1 px-2 bg-muted/50 rounded"
                        >
                          <span className="text-foreground">
                            {target?.agentName ?? dp.delegateTo}
                          </span>
                          <span className="text-muted-foreground">
                            {dp.taskClass}
                          </span>
                        </div>
                      );
                    })}
                  {selectedCog.delegationPolicies.filter((dp: DelegationPolicy) => dp.delegateTo)
                    .length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No delegation targets
                    </p>
                  )}
                </div>
              </div>

              {/* Escalation targets */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Escalation Targets
                </h3>
                <div className="space-y-1">
                  {selectedCog.delegationPolicies
                    .filter((dp: DelegationPolicy) => dp.escalateTo)
                    .map((dp: DelegationPolicy) => {
                      const target = mockAgentCognitiveData.find(
                        (a) => a.agentId === dp.escalateTo,
                      );
                      return (
                        <div
                          key={dp.id}
                          className="flex items-center justify-between text-xs py-1 px-2 bg-muted/50 rounded"
                        >
                          <span className="text-foreground">
                            {target?.agentName ?? dp.escalateTo}
                          </span>
                          <span className="text-muted-foreground">
                            {dp.taskClass}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Agent detail tabs */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Agent Detail Tabs
                </h3>
                <div className="grid grid-cols-3 gap-1">
                  {AGENT_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        if (selectedAgent) {
                          navigate(
                            `${agentUrl(selectedAgent)}/${tab}`,
                          );
                        }
                      }}
                      className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/50 hover:bg-accent hover:text-foreground rounded transition-colors text-center capitalize"
                    >
                      {tab.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Open agent page */}
              {selectedAgent && (
                <button
                  onClick={() => navigate(agentUrl(selectedAgent))}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Agent Detail
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health metric mini card
// ---------------------------------------------------------------------------

function HealthMetric({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const pct = Math.round(value * 100);
  const isGood = invert ? pct < 10 : pct >= 90;
  const isWarn = invert ? pct >= 10 && pct < 25 : pct >= 70 && pct < 90;

  return (
    <div className="bg-muted/50 rounded px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold",
          isGood
            ? "text-green-400"
            : isWarn
              ? "text-yellow-400"
              : "text-red-400",
        )}
      >
        {pct}%
      </div>
    </div>
  );
}
