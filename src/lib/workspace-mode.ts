import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkspaceMode } from "../components/chat/WorkspaceModeStrip";

const PREFIX = "workspace-mode:";
const VALID: WorkspaceMode[] = ["chat", "files", "terminal", "diff"];

function key(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

export async function loadWorkspaceMode(
  sessionId: string,
): Promise<WorkspaceMode | null> {
  const raw = await AsyncStorage.getItem(key(sessionId));
  if (!raw) return null;
  if ((VALID as string[]).includes(raw)) return raw as WorkspaceMode;
  return null;
}

export async function saveWorkspaceMode(
  sessionId: string,
  mode: WorkspaceMode,
): Promise<void> {
  await AsyncStorage.setItem(key(sessionId), mode);
}
