<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  base64?: string
  label: string
}>()
const source = ref('')
let generation = 0
const paths = new Set<string>()
function clean() {
  // #ifdef MP-WEIXIN
  for (const filePath of paths)
    uni.getFileSystemManager().unlink({ filePath, fail: () => { } })
    // #endif
  paths.clear()
}
watch(() => props.base64, async (base64) => {
  const current = ++generation
  source.value = ''
  clean()
  if (!base64)
    return
    // #ifdef H5
  source.value = `data:image/png;base64,${base64}`
  // #endif
  // #ifdef MP-WEIXIN
  const path = `${wx.env.USER_DATA_PATH}/signature-${Date.now()}-${Math.random().toString(36).slice(2)}.png`
  try {
    await new Promise<void>((resolve, reject) => uni.getFileSystemManager().writeFile({ filePath: path, data: base64, encoding: 'base64', success: () => resolve(), fail: reject }))
    if (current !== generation) {
      uni.getFileSystemManager().unlink({ filePath: path, fail: () => {} })
      return
    }
    paths.add(path)
    source.value = path
  }
  catch {
    if (current === generation)
      source.value = ''
  }
  // #endif
}, { immediate: true })
onBeforeUnmount(() => {
  generation++
  clean()
})
</script>

<template>
  <image v-if="source" :src="source" :alt="label" mode="aspectFit" class="block h-24 w-full" />
  <text v-else class="text-xs text-app-muted">{{ label }}加载中</text>
</template>
