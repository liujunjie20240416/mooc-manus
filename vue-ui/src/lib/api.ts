import type {
  A2AServerItem,
  AgentConfig,
  ApiResponse,
  LLMConfig,
  MCPServerItem,
  SessionDetail,
  SessionFile,
  SessionListData,
  SessionSummary,
  SSEEventData,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export class ApiError extends Error {
  code: number
  data: unknown

  constructor(code: number, message: string, data: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>
  if (!response.ok || (payload.code !== 0 && payload.code !== 200)) {
    throw new ApiError(payload.code || response.status, payload.msg || '请求失败', payload.data)
  }
  return payload.data as T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  return parseApiResponse<T>(response)
}

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export function buildFileDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${fileId}/download`
}

export function buildFilePreviewUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${fileId}/download?inline=true`
}

export async function deleteSessionFile(sessionId: string, fileId: string): Promise<void> {
  await request<void>(`/sessions/${sessionId}/files/${fileId}`, {
    method: 'DELETE',
  })
}

export function buildVncWebsocketUrl(sessionId: string): string {
  const apiBase = API_BASE_URL.startsWith('http')
    ? API_BASE_URL
    : `${window.location.origin}${API_BASE_URL}`
  const url = new URL(`${apiBase}/sessions/${sessionId}/vnc`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export async function getSessions(): Promise<SessionSummary[]> {
  const data = await request<SessionListData>('/sessions', { method: 'GET' })
  return data.sessions || []
}

export async function createSession(): Promise<{ session_id: string }> {
  return request<{ session_id: string }>('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/sessions/${sessionId}`, { method: 'GET' })
}

export async function getSessionFiles(sessionId: string): Promise<SessionFile[]> {
  const data = await request<{ files: SessionFile[] }>(`/sessions/${sessionId}/files`, { method: 'GET' })
  return data.files || []
}

export async function readSessionFile(sessionId: string, filepath: string): Promise<{ filepath: string; content: string }> {
  return request<{ filepath: string; content: string }>(`/sessions/${sessionId}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filepath }),
  })
}

export async function readShellOutput(
  sessionId: string,
  shellSessionId: string,
): Promise<{ session_id: string; output: string }> {
  return request<{ session_id: string; output: string }>(`/sessions/${sessionId}/shell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: shellSessionId }),
  })
}

export async function stopSession(sessionId: string): Promise<void> {
  await request<void>(`/sessions/${sessionId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<void>(`/sessions/${sessionId}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function uploadFile(file: File): Promise<SessionFile> {
  const form = new FormData()
  form.append('file', file)
  return request<SessionFile>('/files', {
    method: 'POST',
    body: form,
  })
}

export async function getLLMConfig(): Promise<LLMConfig> {
  return request<LLMConfig>('/app-config/llm', { method: 'GET' })
}

export async function updateLLMConfig(config: LLMConfig): Promise<LLMConfig> {
  return request<LLMConfig>('/app-config/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function getAgentConfig(): Promise<AgentConfig> {
  return request<AgentConfig>('/app-config/agent', { method: 'GET' })
}

export async function updateAgentConfig(config: AgentConfig): Promise<AgentConfig> {
  return request<AgentConfig>('/app-config/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function getMcpServers(): Promise<MCPServerItem[]> {
  const data = await request<{ mcp_servers: MCPServerItem[] }>('/app-config/mcp-servers', { method: 'GET' })
  return data.mcp_servers || []
}

export async function setMcpServerEnabled(serverName: string, enabled: boolean): Promise<void> {
  await request<void>(`/app-config/mcp-servers/${serverName}/enabled`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

export async function getA2aServers(): Promise<A2AServerItem[]> {
  const data = await request<{ a2a_servers: A2AServerItem[] }>('/app-config/a2a-servers', { method: 'GET' })
  return data.a2a_servers || []
}

export async function setA2aServerEnabled(id: string, enabled: boolean): Promise<void> {
  await request<void>(`/app-config/a2a-servers/${id}/enabled`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

type SSEPayload = {
  event?: string
  data?: string
}

function parseChunk(buffer: string): { events: SSEPayload[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() || ''
  const events = parts.map((block) => {
    const payload: SSEPayload = {}
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) payload.event = line.slice(6).trim()
      if (line.startsWith('data:')) payload.data = (payload.data || '') + line.slice(5).trim()
    }
    return payload
  })
  return { events, rest }
}

export async function openChatStream(
  sessionId: string,
  payload: Record<string, unknown>,
  onEvent: (event: SSEEventData) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, '无法建立 SSE 连接')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()
    if (result.done) break
    buffer += decoder.decode(result.value, { stream: true })
    const parsed = parseChunk(buffer)
    buffer = parsed.rest
    for (const event of parsed.events) {
      if (!event.data) continue
      onEvent({
        type: (event.event || 'message') as SSEEventData['type'],
        data: JSON.parse(event.data),
      })
    }
  }
}

export async function openSessionsStream(
  onSessions: (sessions: SessionSummary[]) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/stream`, {
    method: 'POST',
    signal,
  })

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, '无法建立会话列表流')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()
    if (result.done) break
    buffer += decoder.decode(result.value, { stream: true })
    const parsed = parseChunk(buffer)
    buffer = parsed.rest
    for (const event of parsed.events) {
      if (!event.data) continue
      const payload = JSON.parse(event.data) as SessionListData
      if (Array.isArray(payload.sessions)) {
        onSessions(payload.sessions)
      }
    }
  }
}
