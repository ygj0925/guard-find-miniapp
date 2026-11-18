<script setup lang="ts">
import type { Handwriting, SignaturePoint } from '@/api/leases'
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: Handwriting
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [
        value: Handwriting,
  ]
}>()
const instance = getCurrentInstance()
const canvasId = `signature-pad-${instance?.uid || 0}`
const height = ref(160)
const ready = ref(false)
const message = ref('')
let context: UniApp.CanvasContext | null = null
let width = 400
let left = 0
let top = 0
let strokes: SignaturePoint[][] = []
let drawing: SignaturePoint[] | null = null
let disposed = false
function draw() {
  if (!context)
    return
  context.clearRect(0, 0, width, height.value)
  context.setStrokeStyle('#182333')
  context.setLineWidth(5 * width / 1000)
  context.setLineCap('round')
  context.setLineJoin('round')
  for (const stroke of strokes) {
    context.beginPath()
    stroke.forEach((point, i) => {
      if (!i)
        context!.moveTo(point.x * width / 1000, point.y * height.value / 400)
      else
        context!.lineTo(point.x * width / 1000, point.y * height.value / 400)
    })
    context.stroke()
  }
  context.draw()
}
async function measure() {
  if (disposed)
    return
  await nextTick()
  uni.createSelectorQuery().in(instance?.proxy).select(`#${canvasId}`).boundingClientRect((raw) => {
    const rect = raw as UniApp.NodeInfo
    if (disposed || !rect.width)
      return
    width = rect.width
    left = rect.left || 0
    top = rect.top || 0
    height.value = width * 0.4
    context = uni.createCanvasContext(canvasId, instance?.proxy)
    ready.value = true
    void nextTick(draw)
  }).exec()
}
interface TouchEvent {
  touches?: {
    x?: number
    y?: number
    clientX?: number
    clientY?: number
  }[]
}
function point(event: TouchEvent): SignaturePoint | null {
  const touch = event.touches?.[0]
  if (!touch)
    return null
  const x = touch.x ?? (touch.clientX === undefined ? 0 : touch.clientX - left)
  const y = touch.y ?? (touch.clientY === undefined ? 0 : touch.clientY - top)
  return { x: Math.round(Math.max(0, Math.min(1000, x / width * 1000))), y: Math.round(Math.max(0, Math.min(400, y / height.value * 400))) }
}
function start(event: TouchEvent) {
  if (props.disabled || !ready.value)
    return
  const next = point(event)
  if (!next)
    return
  if (strokes.length >= 120) {
    message.value = '笔画较多，请重写后提交'
    return
  }
  drawing = [next]
  strokes.push(drawing)
}
function move(event: TouchEvent) {
  if (!drawing || props.disabled)
    return
  const next = point(event)
  if (!next || drawing.length >= 2500 || strokes.reduce((sum, item) => sum + item.length, 0) >= 12000)
    return
  const previous = drawing[drawing.length - 1]
  if (Math.hypot(next.x - previous.x, next.y - previous.y) < 2)
    return
  drawing.push(next)
  draw()
}
function finish() {
  if (!drawing)
    return
  if (drawing.length < 2)
    strokes.pop()
  drawing = null
  emit('update:modelValue', { strokes: strokes.map(stroke => stroke.map(p => ({ ...p }))) })
  draw()
}
function reset(undo = false) {
  if (props.disabled)
    return
  drawing = null
  if (undo)
    strokes.pop()
  else
    strokes = []
  message.value = ''
  emit('update:modelValue', { strokes: strokes.map(stroke => [...stroke]) })
  draw()
}
watch(() => props.modelValue, (value) => {
  strokes = value.strokes.map(stroke => stroke.map(p => ({ ...p })))
  drawing = null
  draw()
}, { immediate: true })
onMounted(() => {
  void measure()
  uni.onWindowResize?.(measure)
})
onBeforeUnmount(() => {
  disposed = true
  uni.offWindowResize?.(measure)
})
</script>

<template>
  <view>
    <view class="signature-surface">
      <canvas :id="canvasId" :canvas-id="canvasId" :style="{ width: '100%', height: `${height}px` }" :disable-scroll="!disabled" aria-label="手写姓名签名区域" @touchstart="start" @touchmove.stop.prevent="move" @touchend="finish" @touchcancel="finish" />
    </view>
    <view class="mt-2 flex items-center justify-between gap-2">
      <text class="text-xs text-app-muted">{{ message || '请用手指手写完整姓名' }}</text>
      <view class="flex gap-2">
        <button class="app-secondary-button px-3 text-sm" :disabled="disabled || !modelValue.strokes.length" @tap="reset(true)">
          撤销一笔
        </button>
        <button class="app-secondary-button px-3 text-sm" :disabled="disabled || !modelValue.strokes.length" @tap="reset()">
          重写
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.signature-surface {
  overflow: hidden;
  border: 1px dashed var(--app-border, #b8c6d8);
  border-radius: 12px;
  background: #fff;
  touch-action: none;
}
</style>
