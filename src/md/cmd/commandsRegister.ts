import type { WebSocket } from "ws";

class Commands {
  private commandList = {} as Record<
    string,
    (data?: commandInputData) => Promise<void | unknown>
  >;
  private eventHandlers: Record<string, (payload: any) => void> = {};
  private sendCallback?: (event: string, payload: any) => void;

  /**
   * Register a middleware to call each time before an event handler is called
   */
  public beforeNext = async () => {
    return true;
  };

  /**
   * Set the callback function for sending messages to clients
   */
  public onSendMessage(callback: (event: string, payload: any) => void) {
    this.sendCallback = callback;
  }

  public sendMessage(event: string, payload: any) {
    if (!this.sendCallback) {
      console.warn("No send callback registered for Commands");
      return;
    }
    this.sendCallback(event, payload);
  }

  /**
   * Registers a handler for a specific event
   */
  public registerHandler(
    event: string,
    callback: (payload: any) => Promise<void> | void,
  ) {
    this.eventHandlers[event] = callback;
  }

  /**
   * Triggers an event handler
   */
  public async handleEvent(event: string, data: any) {
    const callback = this.eventHandlers[event];
    if (callback) {
      const ok = await this.beforeNext();
      if (ok) {
        await callback(data);
      }
    } else {
      this.sendMessage("error", `${event} was not found 404`);
    }
  }

  // Legacy support for runSocketEvents
  public runSocketEvents(
    event: string,
    callback: (payload: any) => Promise<void> | void,
  ) {
    this.registerHandler(event, callback);
  }
}

export function useCommand() {
  return new Commands();
}

export type CommandData = {
  cmd: (data?: commandInputData) => Promise<void | unknown>;
  description?: string;
};
export const commandList = {} as Record<
  string,
  (data?: commandInputData) => Promise<void | unknown>
>;
type commandInputData = Record<string, unknown> | null | undefined;
export function registerCommand(
  command: string,
  callBack: (data: commandInputData) => Promise<void | unknown>,
) {
  commandList[command] = callBack;
}

export async function runCommand({
  callback,
  command,
  input,
}: {
  command: string;
  input?: commandInputData;
  callback: <T>(commandResp: T) => void;
}) {
  const cmd = commandList[command];
  if (cmd == undefined) {
    return {
      error: true,
      details: "command not found in the register",
    };
  }

  try {
    const output = await cmd(input);
    callback(output);
    return {
      error: false,
      details: "command ok",
      data: output,
    };
  } catch (error) {
    return {
      error: true,
      details: `error running command  ${command} ==> ${error} `,
    };
  }
}
