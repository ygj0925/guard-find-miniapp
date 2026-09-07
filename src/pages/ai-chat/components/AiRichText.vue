<script setup lang="ts">
import MpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue'
import { onUnmounted, ref, watch } from 'vue'
import { normalizeAllowedAiLink, renderAiMessageContent } from '../aiMessageContent'

const props = withDefaults(defineProps<{
  content: string
  streaming?: boolean
}>(), {
  streaming: false,
})

const emit = defineEmits<{
  rendered: []
}>()

const renderedContent = ref(renderAiMessageContent(props.content))
let renderTimer: ReturnType<typeof setTimeout> | undefined
let renderVersion = 1
let emittedRenderVersion = 0

function render() {
  const nextContent = renderAiMessageContent(props.content)
  if (nextContent === renderedContent.value)
    return
  renderedContent.value = nextContent
  renderVersion += 1
}

watch(() => [props.content, props.streaming] as const, () => {
  if (!props.streaming) {
    if (renderTimer) {
      clearTimeout(renderTimer)
      renderTimer = undefined
    }
    render()
    return
  }
  if (!renderTimer) {
    renderTimer = setTimeout(() => {
      renderTimer = undefined
      render()
    }, 100)
  }
})

onUnmounted(() => {
  if (renderTimer)
    clearTimeout(renderTimer)
})

function handleRendered() {
  if (emittedRenderVersion === renderVersion)
    return
  emittedRenderVersion = renderVersion
  emit('rendered')
}

function handleLinkTap(event: unknown) {
  const href = normalizeAllowedAiLink(readLinkHref(event))
  if (!href) {
    uni.showToast({ title: '该链接不安全，已阻止打开', icon: 'none' })
    return
  }

  // #ifdef H5
  if (/^mailto:/i.test(href)) {
    window.location.href = href
  }
  else {
    const popup = window.open(href, '_blank', 'noopener,noreferrer')
    if (popup)
      popup.opener = null
  }
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: href,
    success: () => uni.showToast({ title: '链接已复制，请在浏览器打开', icon: 'none' }),
  })
  // #endif
}

function readLinkHref(value: unknown): unknown {
  if (!isRecord(value))
    return ''
  if (typeof value.href === 'string')
    return value.href
  if (isRecord(value.attrs) && typeof value.attrs.href === 'string')
    return value.attrs.href
  if (!isRecord(value.detail))
    return ''
  if (typeof value.detail.href === 'string')
    return value.detail.href
  return isRecord(value.detail.attrs) ? value.detail.attrs.href : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const tagStyle = {
  p: 'margin: 0 0 10px; line-height: 1.75;',
  strong: 'font-weight: 600; color: #172033;',
  em: 'font-style: italic;',
  del: 'text-decoration: line-through;',
  h1: 'margin: 14px 0 8px; font-size: 19px; font-weight: 650; line-height: 1.4; color: #172033;',
  h2: 'margin: 14px 0 8px; font-size: 17px; font-weight: 650; line-height: 1.4; color: #172033;',
  h3: 'margin: 12px 0 6px; font-size: 15px; font-weight: 650; line-height: 1.4; color: #172033;',
  h4: 'margin: 10px 0 6px; font-size: 14px; font-weight: 650; color: #172033;',
  h5: 'margin: 10px 0 6px; font-size: 14px; font-weight: 600; color: #2b3a57;',
  h6: 'margin: 10px 0 6px; font-size: 13px; font-weight: 600; color: #2b3a57;',
  hr: 'margin: 12px 0; border: none; border-top: 1px solid #e2e8f4;',
  a: 'color: #2f6bd6; word-break: break-all;',
  ul: 'margin: 8px 0 10px; padding-left: 20px;',
  ol: 'margin: 8px 0 10px; padding-left: 20px;',
  li: 'margin: 4px 0; line-height: 1.7;',
  blockquote: 'margin: 8px 0; padding: 8px 12px; border-left: 3px solid #86a8ef; background: #f3f7ff; color: #3a4a68;',
  pre: 'margin: 8px 0; padding: 10px 12px; overflow: auto; border-radius: 8px; background: #f3f6fb; white-space: pre-wrap; word-break: break-word;',
  code: 'font-family: monospace; color: #31466d;',
  table: 'display: table; width: 100%; margin: 10px 0; border-collapse: collapse; font-size: 13px;',
  thead: 'background: #f3f7ff;',
  th: 'padding: 8px 10px; border: 1px solid #d7e0f2; font-weight: 600; color: #2b3a57; text-align: left; word-break: break-word;',
  td: 'padding: 8px 10px; border: 1px solid #e2e8f4; color: #3a4a68; word-break: break-word;',
  img: 'display: block; max-width: 100%; height: auto; margin: 10px 0; border-radius: 10px;',
}
</script>

<template>
  <MpHtml
    class="ai-rich-text"
    :content="renderedContent"
    :tag-style="tagStyle"
    :set-title="false"
    :copy-link="false"
    :preview-img="true"
    :show-img-menu="false"
    :selectable="true"
    :scroll-table="true"
    @load="handleRendered"
    @ready="handleRendered"
    @linktap="handleLinkTap"
  />
</template>

<style scoped lang="scss">
.ai-rich-text {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
