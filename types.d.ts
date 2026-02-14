export type OpenedTabs = {
  index: number;
  id: number | undefined;
  windowId: number;
  url: string;
  title: string | undefined;
};

export type MessagePayload = {
  message: string;
  modes: null | "agent" | "assistant";
  timestamp: string;
  user: boolean;
  from: string;
  icon: string;
  tabId: string;
};

export interface QwenResponseChunk {
  choices: Choice[];
  response_id: string;
  usage: Usage;
}

export interface Choice {
  delta: Delta;
}

export interface Delta {
  role: string;
  content: string;
  phase: string;
  status: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export type Skills = Record<
  string,
  {
    name: string;
    description: string;
    parameters: Record<string, string>;
    action: (params: Record<string, string>) =>
      | Promise<{
          ok: boolean;
          data: any;
        }>
      | {
          ok: boolean;
          data: any;
        };
  }
>;

// Root task structure
export type TaskDefinition = {
  taskId: string; // unique task id
  userMessage: string; // message the AI wants to communicate to the user
  procedure: ProcedureStep[];
};

// Individual procedure step
export type ProcedureStep = {
  stepId: string; // unique step id
  skillName: string; // local skill name
  input: Record<string, StepInputValue>; // dynamic params
  returnResultsToModel: boolean; // true ONLY for final step
};

// Input value can be literal or reference to previous step
export type StepInputValue =
  | string
  | {
      fromStep: string; // references a previous stepId
    };
