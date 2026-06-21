export type ApiResponse<T = unknown> = {
  code: number
  msg: string
  data: T | null
}

export type SessionStatus = 'pending' | 'running' | 'waiting' | 'completed'
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ToolEventStatus = 'calling' | 'called'
export type SSEEventType =
  | 'message'
  | 'title'
  | 'plan'
  | 'step'
  | 'tool'
  | 'wait'
  | 'done'
  | 'error'

export type SessionSummary = {
  session_id: string
  title: string
  latest_message: string
  latest_message_at: string
  status: SessionStatus
  unread_message_count: number
}

export type SessionListData = {
  sessions: SessionSummary[]
}

export type SessionFile = {
  id: string
  filename: string
  filepath: string
  extension: string
  size: number
  content_type?: string
  mime_type?: string
}

export type ChatAttachment = {
  file_id?: string
  id?: string
  filename: string
  size?: number
}

export type ChatMessageEvent = {
  role: 'user' | 'assistant' | 'system'
  message: string
  attachments?: ChatAttachment[]
}

export type StepEvent = {
  id: string
  status: ExecutionStatus
  description: string
}

export type ToolEvent = {
  name: string
  function: string
  args: Record<string, unknown>
  content?: unknown
  status?: ToolEventStatus
  tool_call_id?: string
  timestamp?: number
}

export type PlanStep = {
  id: string
  description: string
  status: ExecutionStatus
}

export type PlanEvent = {
  steps: PlanStep[]
}

export type TitleEvent = {
  title: string
}

export type WaitEvent = {
  reason?: string
}

export type DoneEvent = {
  message?: string
}

export type ErrorEvent = {
  error: string
}

export type SSEEventData = {
  type: SSEEventType
  data:
    | ChatMessageEvent
    | StepEvent
    | ToolEvent
    | PlanEvent
    | TitleEvent
    | WaitEvent
    | DoneEvent
    | ErrorEvent
    | Record<string, unknown>
}

export type SessionDetail = {
  session_id: string
  title: string
  status: SessionStatus
  events: SSEEventData[]
}

export type LLMConfig = {
  base_url?: string
  api_key?: string
  model_name?: string
  temperature?: number
  max_tokens?: number
}

export type AgentConfig = {
  max_iterations?: number
  max_retries?: number
  max_search_results?: number
}

export type MCPTransport = 'stdio' | 'sse' | 'streamable_http'

export type MCPServerItem = {
  server_name: string
  enabled: boolean
  transport: MCPTransport
  tools: string[]
}

export type A2AServerItem = {
  id: string
  name: string
  description: string
  input_modes: string[]
  output_modes: string[]
  streaming: boolean
  push_notifications: boolean
  enabled: boolean
}

export type TimelineItem =
  | {
      kind: 'message'
      role: 'user' | 'assistant' | 'system'
      id: string
      message: string
      attachments: ChatAttachment[]
    }
  | {
      kind: 'step'
      id: string
      step: StepEvent
    }
  | {
      kind: 'tool'
      id: string
      tool: ToolEvent
    }
  | {
      kind: 'plan'
      id: string
      plan: PlanStep[]
    }
  | {
      kind: 'wait'
      id: string
      reason: string
    }
  | {
      kind: 'done'
      id: string
      message: string
    }
  | {
      kind: 'error'
      id: string
      error: string
    }
