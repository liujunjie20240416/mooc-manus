<script setup lang="ts">
import type { TimelineItem } from '../types'
import { attachmentLabel } from '../lib/session'

defineProps<{
  items: TimelineItem[]
}>()

const emit = defineEmits<{
  previewTool: [tool: Record<string, unknown>]
}>()
</script>

<template>
  <div class="timeline">
    <template v-for="item in items" :key="item.id">
      <article v-if="item.kind === 'message'" class="bubble" :data-role="item.role">
        <div class="bubble__role">{{ item.role }}</div>
        <p class="bubble__text">{{ item.message }}</p>
        <div v-if="item.attachments.length" class="attachment-list">
          <span v-for="attachment in item.attachments" :key="attachment.file_id || attachment.id || attachment.filename" class="file-pill">
            {{ attachmentLabel(attachment) }}
          </span>
        </div>
      </article>

      <article v-else-if="item.kind === 'step'" class="event-card">
        <div class="event-card__title">步骤</div>
        <div class="event-card__content">
          <strong>{{ item.step.description }}</strong>
          <span class="status-chip" :data-status="item.step.status">{{ item.step.status }}</span>
        </div>
      </article>

      <article v-else-if="item.kind === 'tool'" class="event-card event-card--clickable" @click="emit('previewTool', item.tool as Record<string, unknown>)">
        <div class="event-card__title">工具</div>
        <div class="event-card__content">
          <strong>{{ item.tool.function }}</strong>
          <span class="status-chip" :data-status="item.tool.status || 'calling'">{{ item.tool.status || 'calling' }}</span>
        </div>
      </article>

      <article v-else-if="item.kind === 'plan'" class="event-card">
        <div class="event-card__title">
          计划 · {{ item.plan.length }} 步
          <span v-if="item.planStatus" class="status-chip" :data-status="item.planStatus">{{ item.planStatus }}</span>
        </div>
        <ol class="plan-list">
          <li v-for="step in item.plan" :key="step.id">
            <span>{{ step.description }}</span>
            <span class="status-chip" :data-status="step.status">{{ step.status }}</span>
          </li>
        </ol>
      </article>

      <article v-else-if="item.kind === 'wait'" class="event-card">
        <div class="event-card__title">等待输入</div>
        <p>{{ item.reason }}</p>
      </article>

      <article v-else-if="item.kind === 'done'" class="event-card">
        <div class="event-card__title">完成</div>
        <p>{{ item.message }}</p>
      </article>

      <article v-else class="event-card event-card--error">
        <div class="event-card__title">错误</div>
        <p>{{ item.error }}</p>
      </article>
    </template>
  </div>
</template>
