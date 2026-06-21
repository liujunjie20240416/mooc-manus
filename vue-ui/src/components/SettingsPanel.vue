<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { A2AServerItem, AgentConfig, LLMConfig, MCPServerItem } from '../types'

const props = defineProps<{
  open: boolean
  llmConfig: LLMConfig
  agentConfig: AgentConfig
  mcpServers: MCPServerItem[]
  a2aServers: A2AServerItem[]
  saving: boolean
}>()

const emit = defineEmits<{
  close: []
  saveLlm: [payload: LLMConfig]
  saveAgent: [payload: AgentConfig]
  toggleMcp: [serverName: string, enabled: boolean]
  toggleA2a: [id: string, enabled: boolean]
}>()

const llmDraft = reactive<LLMConfig>({})
const agentDraft = reactive<AgentConfig>({})

function syncDrafts() {
  Object.assign(llmDraft, props.llmConfig)
  Object.assign(agentDraft, props.agentConfig)
}

syncDrafts()
watch(() => props.llmConfig, syncDrafts, { deep: true })
watch(() => props.agentConfig, syncDrafts, { deep: true })

function onMcpToggle(event: Event, serverName: string) {
  const target = event.target as HTMLInputElement
  emit('toggleMcp', serverName, target.checked)
}

function onA2aToggle(event: Event, id: string) {
  const target = event.target as HTMLInputElement
  emit('toggleA2a', id, target.checked)
}
</script>

<template>
  <div v-if="open" class="settings">
    <div class="settings__overlay" @click="emit('close')" />
    <section class="settings__panel">
      <div class="settings__header">
        <div>
          <p class="sidebar__eyebrow">系统设置</p>
          <h2>后端配置</h2>
        </div>
        <button class="ghost-button" @click="emit('close')">关闭</button>
      </div>

      <div class="settings__grid">
        <form class="settings-card" @submit.prevent="emit('saveLlm', { ...llmDraft })">
          <h3>LLM</h3>
          <label>
            <span>Base URL</span>
            <input v-model="llmDraft.base_url" />
          </label>
          <label>
            <span>API Key</span>
            <input v-model="llmDraft.api_key" type="password" />
          </label>
          <label>
            <span>Model</span>
            <input v-model="llmDraft.model_name" />
          </label>
          <label>
            <span>Temperature</span>
            <input v-model.number="llmDraft.temperature" type="number" step="0.1" />
          </label>
          <label>
            <span>Max Tokens</span>
            <input v-model.number="llmDraft.max_tokens" type="number" />
          </label>
          <button class="primary-button" :disabled="saving">保存 LLM</button>
        </form>

        <form class="settings-card" @submit.prevent="emit('saveAgent', { ...agentDraft })">
          <h3>Agent</h3>
          <label>
            <span>Max Iterations</span>
            <input v-model.number="agentDraft.max_iterations" type="number" />
          </label>
          <label>
            <span>Max Retries</span>
            <input v-model.number="agentDraft.max_retries" type="number" />
          </label>
          <label>
            <span>Max Search Results</span>
            <input v-model.number="agentDraft.max_search_results" type="number" />
          </label>
          <button class="primary-button" :disabled="saving">保存 Agent</button>
        </form>

        <div class="settings-card">
          <h3>MCP Servers</h3>
          <div class="toggle-list">
            <label v-for="server in mcpServers" :key="server.server_name" class="toggle-item">
              <div>
                <strong>{{ server.server_name }}</strong>
                <p>{{ server.transport }} · {{ server.tools.join(', ') || '无工具' }}</p>
              </div>
              <input
                :checked="server.enabled"
                type="checkbox"
                @change="onMcpToggle($event, server.server_name)"
              />
            </label>
          </div>
        </div>

        <div class="settings-card">
          <h3>A2A Servers</h3>
          <div class="toggle-list">
            <label v-for="server in a2aServers" :key="server.id" class="toggle-item">
              <div>
                <strong>{{ server.name || server.id }}</strong>
                <p>{{ server.description || '无描述' }}</p>
              </div>
              <input
                :checked="server.enabled"
                type="checkbox"
                @change="onA2aToggle($event, server.id)"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
