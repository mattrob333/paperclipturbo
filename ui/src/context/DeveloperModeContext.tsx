import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface DeveloperModeState {
  openFiles: string[];
  activeFile: string | null;
  selectedAgent: string | null;
  viewMode: "edit" | "diff";
  inspectorTab: "validation" | "runtime" | "context";
  claudeDockOpen: boolean;
  claudeDockHeight: number;
  fileTreeFilter: "agent" | "team" | "blueprint" | "generated" | "all";
  workspaceRoot: string | null;
  workspaceError: string | null;
}

interface DeveloperModeActions {
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setSelectedAgent: (agentId: string | null) => void;
  setViewMode: (mode: "edit" | "diff") => void;
  setInspectorTab: (tab: "validation" | "runtime" | "context") => void;
  toggleClaudeDock: () => void;
  setClaudeDockHeight: (height: number) => void;
  setFileTreeFilter: (filter: DeveloperModeState["fileTreeFilter"]) => void;
  setWorkspaceRoot: (root: string | null) => void;
  setWorkspaceError: (error: string | null) => void;
}

type DeveloperModeContextValue = DeveloperModeState & DeveloperModeActions;

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(null);

export function DeveloperModeProvider({ children, initialAgent }: { children: ReactNode; initialAgent?: string | null }) {
  const [state, setState] = useState<DeveloperModeState>({
    openFiles: [],
    activeFile: null,
    selectedAgent: initialAgent ?? null,
    viewMode: "edit",
    inspectorTab: "validation",
    claudeDockOpen: false,
    claudeDockHeight: 220,
    fileTreeFilter: "all",
    workspaceRoot: null,
    workspaceError: null,
  });

  const openFile = useCallback((path: string) => {
    setState((prev) => {
      const alreadyOpen = prev.openFiles.includes(path);
      return {
        ...prev,
        openFiles: alreadyOpen ? prev.openFiles : [...prev.openFiles, path],
        activeFile: path,
      };
    });
  }, []);

  const closeFile = useCallback((path: string) => {
    setState((prev) => {
      const newOpen = prev.openFiles.filter((f) => f !== path);
      let newActive = prev.activeFile;
      if (prev.activeFile === path) {
        const idx = prev.openFiles.indexOf(path);
        newActive = newOpen[Math.min(idx, newOpen.length - 1)] ?? null;
      }
      return { ...prev, openFiles: newOpen, activeFile: newActive };
    });
  }, []);

  const setActiveFile = useCallback((path: string | null) => {
    setState((prev) => ({ ...prev, activeFile: path }));
  }, []);

  const setSelectedAgent = useCallback((agentId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedAgent: agentId,
      openFiles: [],
      activeFile: null,
      workspaceRoot: null,
      workspaceError: null,
    }));
  }, []);

  const setViewMode = useCallback((mode: "edit" | "diff") => {
    setState((prev) => ({ ...prev, viewMode: mode }));
  }, []);

  const setInspectorTab = useCallback((tab: "validation" | "runtime" | "context") => {
    setState((prev) => ({ ...prev, inspectorTab: tab }));
  }, []);

  const toggleClaudeDock = useCallback(() => {
    setState((prev) => ({ ...prev, claudeDockOpen: !prev.claudeDockOpen }));
  }, []);

  const setClaudeDockHeight = useCallback((height: number) => {
    setState((prev) => ({ ...prev, claudeDockHeight: height }));
  }, []);

  const setFileTreeFilter = useCallback((filter: DeveloperModeState["fileTreeFilter"]) => {
    setState((prev) => ({ ...prev, fileTreeFilter: filter }));
  }, []);

  const setWorkspaceRoot = useCallback((root: string | null) => {
    setState((prev) => ({ ...prev, workspaceRoot: root }));
  }, []);

  const setWorkspaceError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, workspaceError: error }));
  }, []);

  const value = useMemo<DeveloperModeContextValue>(
    () => ({
      ...state,
      openFile,
      closeFile,
      setActiveFile,
      setSelectedAgent,
      setViewMode,
      setInspectorTab,
      toggleClaudeDock,
      setClaudeDockHeight,
      setFileTreeFilter,
      setWorkspaceRoot,
      setWorkspaceError,
    }),
    [state, openFile, closeFile, setActiveFile, setSelectedAgent, setViewMode, setInspectorTab, toggleClaudeDock, setClaudeDockHeight, setFileTreeFilter, setWorkspaceRoot, setWorkspaceError],
  );

  return <DeveloperModeContext.Provider value={value}>{children}</DeveloperModeContext.Provider>;
}

export function useDeveloperMode() {
  const ctx = useContext(DeveloperModeContext);
  if (!ctx) throw new Error("useDeveloperMode must be used within DeveloperModeProvider");
  return ctx;
}
