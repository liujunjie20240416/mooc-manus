<script setup lang="ts">
import { ref } from 'vue'
import type { SessionFile } from '../types'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [message: string, files: File[]]
}>()

const message = ref('')
const pendingFiles = ref<File[]>([])

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  pendingFiles.value = Array.from(input.files || [])
}

function removeFile(name: string) {
  pendingFiles.value = pendingFiles.value.filter((file) => file.name !== name)
}

function submit() {
  if (props.disabled) return
  if (!message.value.trim() && pendingFiles.value.length === 0) return
  emit('send', message.value.trim(), pendingFiles.value)
  message.value = ''
  pendingFiles.value = []
}
</script>

<template>
  <div class="composer">
    <textarea
      v-model="message"
      class="composer__input"
      placeholder="输入你的任务，例如：总结页面信息，然后在沙箱里执行 pwd。"
      :disabled="disabled"
      @keydown.enter.exact.prevent="submit"
    />
    <div v-if="pendingFiles.length" class="composer__files">
      <span v-for="file in pendingFiles" :key="file.name" class="file-pill">
        {{ file.name }}
        <button type="button" @click="removeFile(file.name)">×</button>
      </span>
    </div>
    <div class="composer__actions">
      <label class="ghost-button composer__upload">
        <input type="file" multiple hidden :disabled="disabled" @change="onFileChange" />
        上传文件
      </label>
      <button class="primary-button" :disabled="disabled" @click="submit">发送</button>
    </div>
  </div>
</template>
