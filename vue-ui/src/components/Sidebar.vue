<script setup lang="ts">
import { computed } from 'vue'
import type { SessionSummary } from '../types'
import { formatRelativeTime } from '../lib/session'

const props = defineProps<{
  sessions: SessionSummary[]
  selectedSessionId: string | null
  settingsOpen: boolean
}>()

const emit = defineEmits<{
  create: []
  select: [sessionId: string]
  settings: []
}>()

const orderedSessions = computed(() => [...props.sessions])
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__top">
      <div>
        <p class="sidebar__eyebrow">MoocManus</p>
        <h1 class="sidebar__title">Vue 控制台</h1>
      </div>
      <button class="ghost-button" @click="emit('settings')">
        {{ settingsOpen ? '关闭设置' : '打开设置' }}
      </button>
    </div>

    <button class="primary-button sidebar__new" @click="emit('create')">新建任务</button>

    <div class="sidebar__section">
      <div class="sidebar__section-header">
        <span>会话</span>
        <span>{{ orderedSessions.length }}</span>
      </div>
      <div class="session-list">
        <button
          v-for="session in orderedSessions"
          :key="session.session_id"
          class="session-card"
          :class="{ 'session-card--active': session.session_id === selectedSessionId }"
          @click="emit('select', session.session_id)"
        >
          <div class="session-card__row">
            <strong class="session-card__title">{{ session.title || '未命名任务' }}</strong>
          </div>
          <div class="session-card__row session-card__meta">
            <span>{{ formatRelativeTime(session.latest_message_at) }}</span>
            <span class="status-chip" :data-status="session.status">{{ session.status }}</span>
          </div>
        </button>
      </div>
    </div>
  </aside>
</template>
