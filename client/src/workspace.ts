import { api } from "./api";

export type WorkspaceSettings = {
  companyName: string;
  idleMinutes: number;
  clipboardClearSeconds: number;
};

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  companyName: "BIS Consultants",
  idleMinutes: 15,
  clipboardClearSeconds: 30
};

let current: WorkspaceSettings = { ...DEFAULT_WORKSPACE };
const listeners = new Set<(s: WorkspaceSettings) => void>();

export function workspace() {
  return current;
}

export function applyWorkspace(next: Partial<WorkspaceSettings>) {
  const idle = Number(next.idleMinutes);
  const clearSec = Number(next.clipboardClearSeconds);
  current = {
    companyName: (next.companyName || "").trim() || DEFAULT_WORKSPACE.companyName,
    idleMinutes: idle >= 1 ? idle : DEFAULT_WORKSPACE.idleMinutes,
    clipboardClearSeconds: clearSec >= 5 ? clearSec : DEFAULT_WORKSPACE.clipboardClearSeconds
  };
  listeners.forEach(fn => fn(current));
  return current;
}

export function onWorkspace(fn: (s: WorkspaceSettings) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function loadWorkspace() {
  const s = await api<WorkspaceSettings>("/api/settings");
  return applyWorkspace(s);
}

export function resetWorkspace() {
  return applyWorkspace(DEFAULT_WORKSPACE);
}
