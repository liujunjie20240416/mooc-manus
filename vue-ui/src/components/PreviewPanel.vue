<script setup lang="ts">
import { computed } from 'vue'
import { buildFileDownloadUrl, buildFilePreviewUrl } from '../lib/api'
import { isImageFile, isPdfFile } from '../lib/session'
import type { SessionFile } from '../types'

const props = defineProps<{
  files: SessionFile[]
  activeFile: SessionFile | null
  activeFileContent: string
  activeFilePath: string
  activeTool: Record<string, unknown> | null
  busy?: boolean
}>()

const emit = defineEmits<{
  openFile: [file: SessionFile]
  downloadFile: [file: SessionFile]
  deleteFile: [file: SessionFile]
}>()

const formattedTool = computed(() =>
  props.activeTool ? JSON.stringify(props.activeTool, null, 2) : '',
)
const activeFileDownloadUrl = computed(() => (props.activeFile?.id ? buildFileDownloadUrl(props.activeFile.id) : ''))
const activeFilePreviewUrl = computed(() => (props.activeFile?.id ? buildFilePreviewUrl(props.activeFile.id) : ''))
const showImagePreview = computed(() => !!props.activeFile && isImageFile(props.activeFile))
const showPdfPreview = computed(() => !!props.activeFile && isPdfFile(props.activeFile))
</script>

<template>
  <aside class="preview">
    <div class="preview__section">
      <div class="preview__header">
        <h3>任务文件</h3>
        <span>{{ files.length }}</span>
      </div>
      <div class="preview__list">
        <div v-for="file in files" :key="file.id" class="preview__list-row">
          <button class="preview__list-item" @click="emit('openFile', file)">
            <strong>{{ file.filename }}</strong>
            <span>{{ file.filepath }}</span>
          </button>
          <div class="preview__list-actions">
            <button class="ghost-button" @click="emit('downloadFile', file)">下载</button>
            <button class="ghost-button ghost-button--danger" @click="emit('deleteFile', file)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div class="preview__section preview__body">
      <div class="preview__header">
        <h3>内容预览</h3>
        <span v-if="busy">加载中</span>
      </div>
      <template v-if="activeTool">
        <pre class="preview__code">{{ formattedTool }}</pre>
      </template>
      <template v-else-if="activeFilePath">
        <p class="preview__path">{{ activeFilePath }}</p>
        <a
          v-if="activeFile?.id"
          class="ghost-button"
          :href="activeFileDownloadUrl"
          target="_blank"
          rel="noreferrer"
        >
          下载当前文件
        </a>
        <img v-if="showImagePreview" class="preview__media" :src="activeFilePreviewUrl" :alt="activeFile?.filename || 'image preview'" />
        <iframe v-else-if="showPdfPreview" class="preview__frame" :src="activeFilePreviewUrl" title="PDF preview" />
        <pre v-else class="preview__code">{{ activeFileContent }}</pre>
      </template>
      <template v-else>
        <div class="preview__placeholder">选择文件或工具事件后在这里预览。</div>
      </template>
    </div>
  </aside>
</template>
