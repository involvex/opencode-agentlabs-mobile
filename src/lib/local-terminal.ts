import { NativeModules } from "react-native";

interface LocalTerminalResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface LocalTerminalModule {
  executeCommand(command: string): Promise<LocalTerminalResult>;
  executeCommandWithCwd(
    command: string,
    cwd: string,
  ): Promise<LocalTerminalResult>;
}

const { LocalTerminal } = NativeModules as {
  LocalTerminal?: LocalTerminalModule;
};

export async function executeLocalCommand(
  command: string,
  cwd?: string,
): Promise<LocalTerminalResult> {
  if (!LocalTerminal) {
    throw new Error("LocalTerminal native module not linked. Rebuild the app.");
  }

  if (cwd && LocalTerminal.executeCommandWithCwd) {
    return LocalTerminal.executeCommandWithCwd(command, cwd);
  }

  if (LocalTerminal.executeCommand) {
    return LocalTerminal.executeCommand(command);
  }

  throw new Error("LocalTerminal module methods not available");
}

export function isLocalTerminalAvailable(): boolean {
  return !!LocalTerminal;
}
