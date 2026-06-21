<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Composer from './components/Composer.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import Sidebar from './components/Sidebar.vue'
import Timeline from './components/Timeline.vue'
import VncPanel from './components/VncPanel.vue'
import {
  buildFileDownloadUrl,
  buildVncWebsocketUrl,
  createSession,
  deleteSessionFile,
  deleteSession,
  getA2aServers,
  getAgentConfig,
  getLLMConfig,
  getMcpServers,
  getSessionDetail,
  getSessionFiles,
  getSessions,
  openChatStream,
  openSessionsStream,
  readSessionFile,
  setA2aServerEnabled,
  setMcpServerEnabled,
  stopSession,
  updateAgentConfig,
  updateLLMConfig,
  uploadFile,
} from './lib/api'
import { canPreviewFile, dedupeSessionFiles, eventsToTimeline, normalizeEvents } from './lib/session'
import type { A2AServerItem, AgentConfig, LLMConfig, MCPServerItem, SSEEventData, SessionDetail, SessionFile, SessionSummary } from './types'

const sessions = ref<SessionSummary[]>([])
const selectedSessionId = ref<string | null>(null)
const currentSession = ref<SessionDetail | null>(null)
const events = ref<SSEEventData[]>([])
const files = ref<SessionFile[]>([])
const selectedFile = ref<SessionFile | null>(null)
const selectedFileContent = ref('')
const selectedFilePath = ref('')
const selectedTool = ref<Record<string, unknown> | null>(null)
const loading = ref(false)
const sending = ref(false)
const previewLoading = ref(false)
const errorMessage = ref('')
const settingsOpen = ref(false)
const settingsSaving = ref(false)
const llmConfig = ref<LLMConfig>({})
const agentConfig = ref<AgentConfig>({})
const mcpServers = ref<MCPServerItem[]>([])
const a2aServers = ref<A2AServerItem[]>([])
const vncOpen = ref(false)
const streamController = ref<AbortController | null>(null)
const sessionsStreamController = ref<AbortController | null>(null)

const timeline = computed(() => eventsToTimeline(events.value))
const vncUrl = computed(() => (selectedSessionId.value ? buildVncWebsocketUrl(selectedSessionId.value) : ''))

async function loadSessions() {
  sessions.value = await getSessions()
  if (!selectedSessionId.value && sessions.value.length > 0) {
    selectedSessionId.value = sessions.value[0].session_id
  }
}

async function loadSettings() {
  const [llm, agent, mcp, a2a] = await Promise.all([
    getLLMConfig(),
    getAgentConfig(),
    getMcpServers(),
    getA2aServers(),
  ])
  llmConfig.value = llm
  agentConfig.value = agent
  mcpServers.value = mcp
  a2aServers.value = a2a
}

async function loadSession(sessionId: string) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, fileList] = await Promise.all([
      getSessionDetail(sessionId),
      getSessionFiles(sessionId),
    ])
    currentSession.value = detail
    events.value = normalizeEvents(detail.events)
    files.value = dedupeSessionFiles(fileList)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载会话失败'
  } finally {
    loading.value = false
  }
}

function appendEvent(event: SSEEventData) {
  events.value = [...events.value, event]
  if (event.type === 'title' && currentSession.value) {
    const title = (event.data as { title?: string }).title
    if (title) currentSession.value = { ...currentSession.value, title }
  }
  if (event.type === 'done' && currentSession.value) {
    currentSession.value = { ...currentSession.value, status: 'completed' }
  }
  if (event.type === 'wait' && currentSession.value) {
    currentSession.value = { ...currentSession.value, status: 'waiting' }
  }
}

function stopActiveStream() {
  streamController.value?.abort()
  streamController.value = null
}

async function openPassiveStream(sessionId: string) {
  stopActiveStream()
  const controller = new AbortController()
  streamController.value = controller
  try {
    await openChatStream(sessionId, {}, appendEvent, controller.signal)
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.warn(error)
    }
  }
}

async function ensureSelectedSession(): Promise<string> {
  if (selectedSessionId.value) return selectedSessionId.value
  const session = await createSession()
  selectedSessionId.value = session.session_id
  await loadSessions()
  return session.session_id
}

async function handleSend(message: string, pendingFiles: File[]) {
  const sessionId = await ensureSelectedSession()
  if (!currentSession.value || currentSession.value.session_id !== sessionId) {
    await loadSession(sessionId)
  }

  sending.value = true
  errorMessage.value = ''
  selectedFile.value = null
  selectedTool.value = null
  stopActiveStream()

  try {
    const uploaded = await Promise.all(pendingFiles.map((file) => uploadFile(file)))
    files.value = dedupeSessionFiles([...files.value, ...uploaded])

    const controller = new AbortController()
    streamController.value = controller
    await openChatStream(
      sessionId,
      {
        message,
        attachments: uploaded.map((item) => item.id),
      },
      appendEvent,
      controller.signal,
    )
    await loadSessions()
    await loadSession(sessionId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发送失败'
  } finally {
    sending.value = false
  }
}

async function handleCreateSession() {
  const session = await createSession()
  selectedSessionId.value = session.session_id
  currentSession.value = {
    session_id: session.session_id,
    title: '',
    status: 'pending',
    events: [],
  }
  events.value = []
  files.value = []
  selectedFile.value = null
  selectedFileContent.value = ''
  selectedFilePath.value = ''
  selectedTool.value = null
  await loadSessions()
}

async function handleOpenFile(file: SessionFile) {
  if (!selectedSessionId.value) return
  selectedFile.value = file
  selectedTool.value = null
  selectedFilePath.value = file.filepath
  errorMessage.value = ''

  if (!canPreviewFile(file)) {
    selectedFileContent.value = '该文件类型暂不支持在线预览，请使用下载按钮查看。'
    return
  }

  previewLoading.value = true
  try {
    const data = await readSessionFile(selectedSessionId.value, file.filepath)
    selectedFilePath.value = data.filepath
    selectedFileContent.value = data.content
  } catch (error) {
    selectedFileContent.value = '在线预览失败，请尝试下载文件查看。'
    errorMessage.value = error instanceof Error ? error.message : '文件预览失败'
  } finally {
    previewLoading.value = false
  }
}

function handleDownloadFile(file: SessionFile) {
  if (!file.id) return
  window.open(buildFileDownloadUrl(file.id), '_blank')
}

async function handleDeleteFile(file: SessionFile) {
  if (!selectedSessionId.value || !file.id) return
  errorMessage.value = ''
  try {
    await deleteSessionFile(selectedSessionId.value, file.id)
    files.value = files.value.filter((item) => item.id !== file.id)
    if (selectedFile.value?.id === file.id) {
      selectedFile.value = null
      selectedFileContent.value = ''
      selectedFilePath.value = ''
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除文件失败'
  }
}

async function handleSaveLlm(payload: LLMConfig) {
  settingsSaving.value = true
  try {
    llmConfig.value = await updateLLMConfig(payload)
  } finally {
    settingsSaving.value = false
  }
}

async function handleSaveAgent(payload: AgentConfig) {
  settingsSaving.value = true
  try {
    agentConfig.value = await updateAgentConfig(payload)
  } finally {
    settingsSaving.value = false
  }
}

async function handleToggleMcp(serverName: string, enabled: boolean) {
  await setMcpServerEnabled(serverName, enabled)
  mcpServers.value = await getMcpServers()
}

async function handleToggleA2a(id: string, enabled: boolean) {
  await setA2aServerEnabled(id, enabled)
  a2aServers.value = await getA2aServers()
}

async function handleStopSession() {
  if (!selectedSessionId.value) return
  await stopSession(selectedSessionId.value)
  await loadSession(selectedSessionId.value)
  await loadSessions()
}

async function handleDeleteSession() {
  if (!selectedSessionId.value) return
  const currentId = selectedSessionId.value
  await deleteSession(currentId)
  selectedSessionId.value = null
  currentSession.value = null
  events.value = []
  files.value = []
  selectedFile.value = null
  selectedFileContent.value = ''
  selectedFilePath.value = ''
  selectedTool.value = null
  await loadSessions()
}

watch(selectedSessionId, async (sessionId) => {
  if (!sessionId) return
  await loadSession(sessionId)
  if (currentSession.value && currentSession.value.status !== 'completed') {
    await openPassiveStream(sessionId)
  } else {
    stopActiveStream()
  }
})

onMounted(async () => {
  await Promise.all([loadSessions(), loadSettings()])
  sessionsStreamController.value = new AbortController()
  openSessionsStream(
    (incoming) => {
      sessions.value = incoming
    },
    sessionsStreamController.value.signal,
  ).catch((error) => {
    if ((error as Error).name !== 'AbortError') {
      console.warn(error)
    }
  })
})

onBeforeUnmount(() => {
  stopActiveStream()
  sessionsStreamController.value?.abort()
})
</script>

<template>
  <div class="app-shell">
    <Sidebar
      :sessions="sessions"
      :selected-session-id="selectedSessionId"
      :settings-open="settingsOpen"
      @create="handleCreateSession"
      @select="(id) => (selectedSessionId = id)"
      @settings="settingsOpen = !settingsOpen"
    />

    <main class="workspace">
      <header class="workspace__header">
        <div>
          <p class="sidebar__eyebrow">任务工作台</p>
          <h2>{{ currentSession?.title || '开始一个新任务' }}</h2>
        </div>
        <div class="workspace__actions">
          <button class="ghost-button" :disabled="!selectedSessionId" @click="vncOpen = !vncOpen">
            {{ vncOpen ? '隐藏 VNC' : '显示 VNC' }}
          </button>
          <button class="ghost-button" :disabled="!selectedSessionId" @click="handleStopSession">停止任务</button>
          <button class="ghost-button ghost-button--danger" :disabled="!selectedSessionId" @click="handleDeleteSession">
            删除会话
          </button>
        </div>
      </header>

      <div class="workspace__body">
        <section class="conversation">
          <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
          <div v-if="loading" class="empty-state">会话加载中...</div>
          <div v-else-if="timeline.length === 0" class="empty-state">
            <h3>开始测试你的 Agent</h3>
            <p>这里直接对接现有 API 和 Sandbox。发送任务后会看到消息、步骤、工具事件和生成文件。</p>
          </div>
          <Timeline v-else :items="timeline" @preview-tool="(tool) => (selectedTool = tool)" />
          <Composer :disabled="sending" @send="handleSend" />
        </section>

        <div class="workspace__side">
          <VncPanel v-if="selectedSessionId" :open="vncOpen" :url="vncUrl" />
          <PreviewPanel
            :files="files"
            :active-file="selectedFile"
            :active-file-content="selectedFileContent"
            :active-file-path="selectedFilePath"
            :active-tool="selectedTool"
            :busy="previewLoading"
            @open-file="handleOpenFile"
            @download-file="handleDownloadFile"
            @delete-file="handleDeleteFile"
          />
        </div>
      </div>
    </main>

    <SettingsPanel
      :open="settingsOpen"
      :llm-config="llmConfig"
      :agent-config="agentConfig"
      :mcp-servers="mcpServers"
      :a2a-servers="a2aServers"
      :saving="settingsSaving"
      @close="settingsOpen = false"
      @save-llm="handleSaveLlm"
      @save-agent="handleSaveAgent"
      @toggle-mcp="handleToggleMcp"
      @toggle-a2a="handleToggleA2a"
    />
  </div>
</template>
