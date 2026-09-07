<script setup lang="ts">
import type { PositionLocationOption } from '@/api/position'
import { computed, ref, watch } from 'vue'

interface VisibleLocationNode {
  key: string
  option: PositionLocationOption
  depth: number
  hasChildren: boolean
  leafValues: string[]
}

type SelectionState = 'none' | 'partial' | 'all'

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

function isNationwideOption(option: PositionLocationOption) {
  return !option.value || option.label.trim() === '全国'
}

const treeOptions = computed(() => props.options.filter(option => !isNationwideOption(option)))

function collectLeafValues(option: PositionLocationOption): string[] {
  const children = (option.children || []).filter(child => !isNationwideOption(child))
  if (!children.length)
    return option.value ? [option.value] : []
  return children.flatMap(collectLeafValues)
}

const validLeafValues = computed(() => new Set(treeOptions.value.flatMap(collectLeafValues)))

const visibleNodes = computed<VisibleLocationNode[]>(() => {
  const nodes: VisibleLocationNode[] = []
  const appendNodes = (options: PositionLocationOption[], depth: number, parentKey = '') => {
    for (const option of options) {
      if (isNationwideOption(option))
        continue
      const key = parentKey ? `${parentKey}/${option.value}` : option.value
      const children = (option.children || []).filter(child => !isNationwideOption(child))
      nodes.push({
        key,
        option,
        depth,
        hasChildren: children.length > 0,
        leafValues: collectLeafValues(option),
      })
      if (children.length && expandedKeys.value.includes(key))
        appendNodes(children, depth + 1, key)
    }
  }
  appendNodes(treeOptions.value, 0)
  return nodes
})

function expandSelectedBranches(options: PositionLocationOption[], selected: Set<string>, parentKey = '', expanded = new Set(expandedKeys.value)) {
  let branchHasSelection = false
  for (const option of options) {
    if (isNationwideOption(option))
      continue
    const key = parentKey ? `${parentKey}/${option.value}` : option.value
    const children = (option.children || []).filter(child => !isNationwideOption(child))
    if (!children.length) {
      branchHasSelection ||= selected.has(option.value)
      continue
    }
    const childHasSelection = expandSelectedBranches(children, selected, key, expanded)
    if (childHasSelection)
      expanded.add(key)
    branchHasSelection ||= childHasSelection
  }
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

function selectionState(node: VisibleLocationNode): SelectionState {
  if (!node.leafValues.length)
    return 'none'
  const selectedCount = node.leafValues.filter(value => props.modelValue.includes(value)).length
  if (selectedCount === 0)
    return 'none'
  return selectedCount === node.leafValues.length ? 'all' : 'partial'
}

function toggleNodeSelection(node: VisibleLocationNode) {
  if (!node.leafValues.length)
    return
  const nextValues = new Set(props.modelValue)
  const shouldSelect = selectionState(node) !== 'all'
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
</script>

<template>
  <view class="box-border max-w-full min-w-0 w-full overflow-hidden border-1rpx border-[#e2eaf5] rounded-2xl border-solid bg-white" role="tree" aria-label="工作地点">
    <view
      class="box-border max-w-full min-h-96rpx min-w-0 w-full flex cursor-pointer items-center overflow-hidden px-3.5 transition-colors duration-180 active:bg-[#edf5ff] motion-reduce:transition-none"
      :class="modelValue.length === 0 ? 'bg-[#f0f7ff]' : 'bg-white'"
      role="checkbox"
      :aria-checked="modelValue.length === 0"
      aria-label="全国，不限制工作地点"
      @tap="selectNationwide"
    >
      <view class="mr-3 h-56rpx w-56rpx flex flex-none items-center justify-center rounded-xl bg-[#e7f2ff] text-brand-blue">
        <view class="i-carbon-earth-filled text-base leading-none" aria-hidden="true" />
      </view>
      <view class="min-w-0 flex flex-1 flex-col overflow-hidden">
        <text class="truncate text-sm text-app-ink font-650">全国</text>
        <text class="mt-0.5 truncate text-3xs text-app-muted">不限工作地点</text>
      </view>
      <view
        class="h-42rpx w-42rpx flex flex-none items-center justify-center border-2rpx rounded-12rpx border-solid transition-colors duration-180"
        :class="modelValue.length === 0 ? 'border-brand-blue bg-brand-blue' : 'border-[#cbd8e8] bg-white'"
        aria-hidden="true"
      >
        <view v-if="modelValue.length === 0" class="h-14rpx w-14rpx rounded-4rpx bg-white" />
      </view>
    </view>

    <view
      v-for="node in visibleNodes"
      :key="node.key"
      class="box-border max-w-full min-h-96rpx min-w-0 w-full flex items-center overflow-hidden border-t-1rpx border-t-[#edf1f6] border-t-solid transition-colors duration-180"
      :class="node.depth > 0 ? 'bg-[#f8fbff]' : 'bg-white'"
      role="treeitem"
      :aria-level="node.depth + 1"
      :aria-expanded="node.hasChildren ? isExpanded(node.key) : undefined"
    >
      <view
        class="box-border min-h-96rpx min-w-0 flex flex-1 cursor-pointer items-center overflow-hidden pr-2 active:opacity-70"
        :style="{ paddingLeft: `${20 + Math.min(node.depth, 3) * 28}rpx` }"
        role="button"
        :aria-label="node.hasChildren ? `${isExpanded(node.key) ? '收起' : '展开'}${node.option.label}` : `选择${node.option.label}`"
        @tap="node.hasChildren ? toggleExpansion(node.key) : toggleNodeSelection(node)"
      >
        <view class="mr-1 h-64rpx w-56rpx flex flex-none items-center justify-center text-app-ink-soft">
          <view
            v-if="node.hasChildren"
            class="i-carbon-chevron-right text-sm leading-none transition-transform duration-180 motion-reduce:transition-none"
            :class="isExpanded(node.key) ? 'rotate-90' : ''"
            aria-hidden="true"
          />
          <view v-else class="h-10rpx w-10rpx rounded-full bg-[#b7c9df]" aria-hidden="true" />
        </view>
        <view class="min-w-0 flex flex-1 flex-col overflow-hidden py-2">
          <text class="truncate text-sm text-app-ink" :class="node.hasChildren ? 'font-650' : 'font-500'">{{ node.option.label }}</text>
          <text v-if="node.hasChildren" class="mt-0.5 truncate text-3xs text-app-muted">{{ node.leafValues.length }} 个地点</text>
        </view>
      </view>

      <view
        class="h-88rpx w-88rpx flex flex-none cursor-pointer items-center justify-center active:opacity-70"
        role="checkbox"
        :aria-checked="selectionState(node) === 'partial' ? 'mixed' : selectionState(node) === 'all'"
        :aria-label="`${selectionState(node) === 'all' ? '取消选择' : '选择'}${node.option.label}`"
        @tap.stop="toggleNodeSelection(node)"
      >
        <view
          class="h-42rpx w-42rpx flex items-center justify-center border-2rpx rounded-12rpx border-solid transition-colors duration-180"
          :class="selectionState(node) === 'all'
            ? 'border-brand-blue bg-brand-blue'
            : selectionState(node) === 'partial'
              ? 'border-brand-blue bg-[#e8f3ff]'
              : 'border-[#cbd8e8] bg-white'"
          aria-hidden="true"
        >
          <view v-if="selectionState(node) === 'all'" class="h-14rpx w-14rpx rounded-4rpx bg-white" />
          <view v-else-if="selectionState(node) === 'partial'" class="h-4rpx w-18rpx rounded-full bg-brand-blue" />
        </view>
      </view>
    </view>
  </view>
</template>
