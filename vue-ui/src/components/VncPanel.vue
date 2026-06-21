<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  url: string
  open: boolean
}>()

const status = ref('未连接')
const display = ref<HTMLDivElement | null>(null)
let rfb: { disconnect: () => void; scaleViewport?: boolean; background?: string; addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void } | null = null

async function connect() {
  if (!props.open || !display.value) return
  disconnect()
  status.value = '连接中'
  console.log('[VNC] connecting to:', props.url)
  try {
    const module = await import('@novnc/novnc/lib/rfb.js')
    const RFB = module.default
    console.log('[VNC] RFB loaded:', typeof RFB)
    rfb = new RFB(display.value, props.url, {
      credentials: { username: '', password: '', target: '' },
    })
    const currentRfb = rfb
    currentRfb.scaleViewport = true
    currentRfb.background = '#111'
    currentRfb.addEventListener('connect', () => {
      console.log('[VNC] connected')
      status.value = '已连接'
    })
    currentRfb.addEventListener('disconnect', (e: unknown) => {
      const detail = (e as CustomEvent)?.detail
      console.log('[VNC] disconnected, reason:', detail)
      status.value = '已断开'
    })
    currentRfb.addEventListener('securityfailure', (e: unknown) => {
      console.log('[VNC] security failure:', e)
    })
  } catch (error) {
    console.error('[VNC] connect error:', error)
    status.value = error instanceof Error ? error.message : '连接失败'
  }
}

function disconnect() {
  if (!rfb) return
  try {
    rfb.disconnect()
  } catch {
    // noop
  }
  rfb = null
}

watch(
  () => [props.open, props.url],
  () => {
    if (props.open) connect()
    else disconnect()
  },
)

onMounted(connect)
onBeforeUnmount(disconnect)
</script>

<template>
  <div class="vnc" :class="{ 'vnc--hidden': !open }">
    <div class="preview__header">
      <h3>沙箱 VNC</h3>
      <span>{{ status }}</span>
    </div>
    <div ref="display" class="vnc__display" />
  </div>
</template>
