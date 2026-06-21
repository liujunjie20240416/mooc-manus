import type {
  ChatAttachment,
  ChatMessageEvent,
  PlanStep,
  SSEEventData,
  SessionFile,
  StepEvent,
  TimelineItem,
  ToolEvent,
} from '../types'

export function normalizeEvents(events: unknown): SSEEventData[] {
  if (!Array.isArray(events)) return []
  return events
    .map((event) => {
      if (!event || typeof event !== 'object') return null
      const raw = event as { type?: string; event?: string; data?: unknown }
      const type = raw.type || raw.event
      if (!type || raw.data === undefined) return null
      return { type, data: raw.data } as SSEEventData
    })
    .filter(Boolean) as SSEEventData[]
}

export function dedupeSessionFiles(files: ChatAttachment[]): ChatAttachment[]
export function dedupeSessionFiles(files: import('../types').SessionFile[]): import('../types').SessionFile[]
export function dedupeSessionFiles(files: Array<ChatAttachment | import('../types').SessionFile>) {
  const seen = new Set<string>()
  return files.filter((file) => {
    const key = file.id || ('file_id' in file ? file.file_id : '') || ('filepath' in file ? file.filepath : '') || file.filename
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function eventsToTimeline(events: SSEEventData[]): TimelineItem[] {
  // Pre-merge tool calling→called pairs: keep the last status for each tool_call_id
  const latestToolByCallId = new Map<string, ToolEvent>()
  for (const event of events) {
    if (event.type === 'tool') {
      const tool = event.data as ToolEvent
      const key = tool.tool_call_id || ''
      if (key) {
        const existing = latestToolByCallId.get(key)
        // "called" overwrites "calling"
        if (!existing || tool.status === 'called') {
          latestToolByCallId.set(key, tool)
        }
      }
    }
  }

  const emittedToolCalls = new Set<string>()

  return events.flatMap((event, index) => {
    if (event.type === 'message') {
      const message = event.data as ChatMessageEvent
      return {
        kind: 'message',
        id: `message-${index}`,
        role: message.role,
        message: message.message,
        attachments: dedupeSessionFiles(message.attachments || []),
      }
    }

    if (event.type === 'step') {
      return {
        kind: 'step',
        id: `step-${index}`,
        step: event.data as StepEvent,
      }
    }

    if (event.type === 'tool') {
      const tool = event.data as ToolEvent
      const key = tool.tool_call_id || ''

      // Merge calling→called: only emit one card per tool_call_id
      if (key && emittedToolCalls.has(key)) return []
      if (key) emittedToolCalls.add(key)

      // Use the latest status (called > calling)
      const finalTool = key ? (latestToolByCallId.get(key) || tool) : tool

      return {
        kind: 'tool',
        id: key ? `tool-${key}` : `tool-${index}`,
        tool: finalTool,
      }
    }

    if (event.type === 'plan') {
      const steps = ((event.data as { steps?: PlanStep[] }).steps || []) as PlanStep[]
      return {
        kind: 'plan',
        id: `plan-${index}`,
        plan: steps,
      }
    }

    if (event.type === 'wait') {
      const reason = (event.data as { reason?: string }).reason || '等待用户输入'
      return {
        kind: 'wait',
        id: `wait-${index}`,
        reason,
      }
    }

    if (event.type === 'done') {
      const message = (event.data as { message?: string }).message || '任务执行完成'
      return {
        kind: 'done',
        id: `done-${index}`,
        message,
      }
    }

    if (event.type === 'error') {
      return {
        kind: 'error',
        id: `error-${index}`,
        error:
          (event.data as { error?: string; message?: string }).error ||
          (event.data as { error?: string; message?: string }).message ||
          '发生未知错误',
      }
    }

    return []
  })
}

export function formatRelativeTime(value?: string): string {
  if (!value) return ''
  const normalizedValue =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value}Z`
      : value
  const target = new Date(normalizedValue).getTime()
  if (Number.isNaN(target)) return value
  const delta = Date.now() - target
  if (delta < 0) return '刚刚'
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  return `${Math.floor(delta / 86_400_000)} 天前`
}

export function attachmentLabel(attachment: ChatAttachment): string {
  return attachment.filename || attachment.id || attachment.file_id || '附件'
}

export function canPreviewFile(file: SessionFile): boolean {
  const extension = (file.extension || '').toLowerCase()
  const mimeType = (file.mime_type || file.content_type || '').toLowerCase()

  if (mimeType.startsWith('text/')) return true
  if (
    mimeType.includes('json') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('xml') ||
    mimeType.includes('yaml')
  ) {
    return true
  }

  return [
    '.txt',
    '.md',
    '.markdown',
    '.json',
    '.yml',
    '.yaml',
    '.xml',
    '.html',
    '.css',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.vue',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.sh',
    '.sql',
    '.csv',
    '.log',
  ].includes(extension)
}

export function isPdfFile(file: SessionFile): boolean {
  const extension = (file.extension || '').toLowerCase()
  const mimeType = (file.mime_type || file.content_type || '').toLowerCase()
  return extension === '.pdf' || mimeType === 'application/pdf'
}

export function isImageFile(file: SessionFile): boolean {
  const extension = (file.extension || '').toLowerCase()
  const mimeType = (file.mime_type || file.content_type || '').toLowerCase()
  return mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(extension)
}
