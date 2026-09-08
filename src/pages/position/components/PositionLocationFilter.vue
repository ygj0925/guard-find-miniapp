<script setup lang="ts">
import type { PositionLocationOption } from '@/api/position'
import { computed, ref, watch } from 'vue'

type SelectionState = 'none' | 'partial' | 'all'

interface VisibleLocationNode {
  key: string
  option: PositionLocationOption
  depth: number
  hasChildren: boolean
  leafValues: string[]
  selectedCount: number
  state: SelectionState
}

defineOptions({
  name: 'PositionLocationFilter',
})

const props = defineProps<{
  options: PositionLocationOption[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const expandedKeys = ref<string[]>([])
const selectedValueSet = computed(() => new Set(props.modelValue))

function isNationwideOption(option: PositionLocationOption) {
  return !option.value || option.label.trim() === '全国'
}

function childOptions(option: PositionLocationOption) {
  return (option.children || []).filter(child => !isNationwideOption(child))
}

function nodeKey(parentKey: string, option: PositionLocationOption, index: number) {
  const segment = `${index}:${option.value || option.label}`
  return parentKey ? `${parentKey}/${segment}` : segment
}

const treeOptions = computed(() => props.options.filter(option => !isNationwideOption(option)))

function collectLeafValues(option: PositionLocationOption): string[] {
  const children = childOptions(option)
  if (!children.length)
    return option.value ? [option.value] : []
  return children.flatMap(collectLeafValues)
}

function resolveSelectionState(leafValues: string[]) {
  if (!leafValues.length)
    return { selectedCount: 0, state: 'none' as SelectionState }
  const selectedCount = leafValues.filter(value => selectedValueSet.value.has(value)).length
  if (selectedCount === 0)
    return { selectedCount, state: 'none' as SelectionState }
  return {
    selectedCount,
    state: selectedCount === leafValues.length ? 'all' as SelectionState : 'partial' as SelectionState,
  }
}

const validLeafValues = computed(() => new Set(treeOptions.value.flatMap(collectLeafValues)))

const visibleNodes = computed<VisibleLocationNode[]>(() => {
  const nodes: VisibleLocationNode[] = []
  const appendNodes = (options: PositionLocationOption[], depth: number, parentKey = '') => {
    options.forEach((option, index) => {
      if (isNationwideOption(option))
        return
      const key = nodeKey(parentKey, option, index)
      const children = childOptions(option)
      const leafValues = collectLeafValues(option)
      const selection = resolveSelectionState(leafValues)
      nodes.push({
        key,
        option,
        depth,
        hasChildren: children.length > 0,
        leafValues,
        selectedCount: selection.selectedCount,
        state: selection.state,
      })
      if (children.length && expandedKeys.value.includes(key))
        appendNodes(children, depth + 1, key)
    })
  }
  appendNodes(treeOptions.value, 0)
  return nodes
})

function expandSelectedBranches(
  options: PositionLocationOption[],
  selected: Set<string>,
  parentKey = '',
  expanded = new Set(expandedKeys.value),
) {
  let branchHasSelection = false
  options.forEach((option, index) => {
    if (isNationwideOption(option))
      return
    const key = nodeKey(parentKey, option, index)
    const children = childOptions(option)
    if (!children.length) {
      branchHasSelection ||= selected.has(option.value)
      return
    }
    const childHasSelection = expandSelectedBranches(children, selected, key, expanded)
    if (childHasSelection)
      expanded.add(key)
    branchHasSelection ||= childHasSelection
  })
  expandedKeys.value = Array.from(expanded)
  return branchHasSelection
}

watch(
  [treeOptions, () => props.modelValue],
  ([options, values]) => {
    const normalizedValues = values.filter(value => validLeafValues.value.has(value))
    if (normalizedValues.length !== values.length)
      emit('update:modelValue', normalizedValues)
    expandSelectedBranches(options, new Set(normalizedValues))
  },
  { immediate: true },
)

function isExpanded(key: string) {
  return expandedKeys.value.includes(key)
}

function toggleExpansion(key: string) {
  expandedKeys.value = isExpanded(key)
    ? expandedKeys.value.filter(item => item !== key)
    : [...expandedKeys.value, key]
}

function toggleNodeSelection(node: VisibleLocationNode) {
  if (!node.leafValues.length)
    return
  const nextValues = new Set(props.modelValue)
  const shouldSelect = node.state !== 'all'
  node.leafValues.forEach((value) => {
    if (shouldSelect)
      nextValues.add(value)
    else
      nextValues.delete(value)
  })
  emit('update:modelValue', Array.from(nextValues))
}

function selectNationwide() {
  emit('update:modelValue', [])
}

function activateButtonWithKeyboard(event: KeyboardEvent) {
  // #ifdef H5
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  const element = event.currentTarget as HTMLElement | null
  element?.click()
  // #endif
}
</script>

<template>
  <view class="w-full" role="group" aria-label="工作地点">
    <button
      tabindex="0"
      class="m-0 box-border min-h-96rpx w-full flex cursor-pointer items-center rounded-2xl px-3.5 py-0 text-left leading-normal transition-[transform,background-color] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99] after:border-0 motion-reduce:transition-none"
      :class="modelValue.length === 0
        ? 'bg-[#e3f0ff] text-brand-blue shadow-[inset_0_0_0_2rpx_rgba(47,111,232,0.35)]'
        : 'bg-white text-app-ink shadow-[0_7rpx_24rpx_rgba(39,74,125,0.06)]'"
      role="checkbox"
      :aria-checked="modelValue.length === 0"
      aria-label="全国，不限制工作地点"
      @keydown="activateButtonWithKeyboard"
      @tap="selectNationwide"
    >
      <view class="mr-3 h-56rpx w-56rpx flex flex-none items-center justify-center rounded-xl bg-white/78">
        <view class="i-carbon-earth-filled text-base leading-none" aria-hidden="true" />
      </view>
      <view class="min-w-0 flex flex-1 flex-col">
        <text class="truncate text-sm font-650">全国</text>
        <text class="mt-0.5 truncate text-3xs" :class="modelValue.length === 0 ? 'text-[#5a7faa]' : 'text-app-muted'">不限工作地点</text>
      </view>
      <view
        class="h-44rpx w-44rpx flex flex-none items-center justify-center rounded-full transition-colors duration-220"
        :class="modelValue.length === 0 ? 'bg-brand-blue text-white' : 'bg-[#edf2f8] text-transparent'"
        aria-hidden="true"
      >
        <view class="i-carbon-checkmark text-sm leading-none" />
      </view>
    </button>

    <view class="mt-3 flex flex-col gap-2">
      <view
        v-for="node in visibleNodes"
        :key="node.key"
        class="box-border min-h-92rpx min-w-0 overflow-hidden transition-[transform,background-color] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        :class="node.depth === 0
          ? 'rounded-2xl bg-white shadow-[0_7rpx_24rpx_rgba(39,74,125,0.06)]'
          : node.state === 'none'
            ? 'rounded-xl bg-[#f8fbff]'
            : 'rounded-xl bg-[#eaf4ff]'"
        :style="{ marginLeft: `${Math.min(node.depth, 3) * 24}rpx` }"
      >
        <view v-if="node.hasChildren" class="min-h-92rpx w-full flex items-center">
          <button
            tabindex="0"
            class="m-0 min-h-92rpx min-w-0 flex flex-1 items-center bg-transparent p-0 text-left leading-normal after:border-0 active:opacity-72"
            :aria-expanded="isExpanded(node.key)"
            :aria-label="`${isExpanded(node.key) ? '收起' : '展开'}${node.option.label}`"
            @keydown="activateButtonWithKeyboard"
            @tap="toggleExpansion(node.key)"
          >
            <view
              class="ml-2 h-64rpx w-56rpx flex flex-none items-center justify-center"
              :class="node.state === 'none' ? 'text-app-muted' : 'text-brand-blue'"
            >
              <view
                class="i-carbon-chevron-right text-sm leading-none transition-transform duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                :class="isExpanded(node.key) ? 'rotate-90' : ''"
                aria-hidden="true"
              />
            </view>
            <view class="min-w-0 flex flex-1 flex-col py-2 pr-2">
              <text class="truncate text-sm text-app-ink font-650">{{ node.option.label }}</text>
              <text class="mt-0.5 truncate text-3xs text-app-muted">{{ node.leafValues.length }} 个地点</text>
            </view>
          </button>

          <button
            tabindex="0"
            class="m-0 min-h-88rpx flex flex-none items-center gap-2 bg-transparent px-3 py-0 leading-none after:border-0 active:opacity-72"
            role="checkbox"
            :aria-checked="node.state === 'partial' ? 'mixed' : node.state === 'all'"
            :aria-label="`${node.state === 'all' ? '取消全选' : '全选'}${node.option.label}`"
            @keydown="activateButtonWithKeyboard"
            @tap="toggleNodeSelection(node)"
          >
            <text class="text-3xs font-650" :class="node.state === 'none' ? 'text-app-muted' : 'text-brand-blue'">
              {{ node.state === 'all' ? '已全选' : node.state === 'partial' ? `${node.selectedCount}/${node.leafValues.length}` : '全选' }}
            </text>
            <view
              class="h-42rpx w-42rpx flex items-center justify-center rounded-full"
              :class="node.state === 'all'
                ? 'bg-brand-blue text-white'
                : node.state === 'partial'
                  ? 'bg-[#dcecff] text-brand-blue'
                  : 'bg-[#edf2f8] text-transparent'"
              aria-hidden="true"
            >
              <view v-if="node.state === 'partial'" class="i-carbon-subtract text-sm leading-none" />
              <view v-else class="i-carbon-checkmark text-sm leading-none" />
            </view>
          </button>
        </view>

        <button
          v-else
          tabindex="0"
          class="m-0 min-h-92rpx w-full flex items-center bg-transparent p-0 text-left leading-normal after:border-0 active:opacity-72"
          role="checkbox"
          :aria-checked="node.state === 'all'"
          :aria-label="`${node.state === 'all' ? '取消选择' : '选择'}${node.option.label}`"
          @keydown="activateButtonWithKeyboard"
          @tap="toggleNodeSelection(node)"
        >
          <view
            class="ml-2 h-64rpx w-56rpx flex flex-none items-center justify-center"
            :class="node.state === 'none' ? 'text-app-muted' : 'text-brand-blue'"
          >
            <view class="i-carbon-location text-sm leading-none" aria-hidden="true" />
          </view>
          <view class="min-w-0 flex flex-1 py-2 pr-2">
            <text class="truncate text-sm text-app-ink font-500">{{ node.option.label }}</text>
          </view>
          <view
            class="mr-3 h-44rpx w-44rpx flex flex-none items-center justify-center rounded-full"
            :class="node.state === 'all' ? 'bg-brand-blue text-white' : 'bg-[#edf2f8] text-transparent'"
            aria-hidden="true"
          >
            <view class="i-carbon-checkmark text-sm leading-none" />
          </view>
        </button>
      </view>
    </view>
  </view>
</template>
