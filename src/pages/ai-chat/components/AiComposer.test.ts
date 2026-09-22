import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AiComposer from './AiComposer.vue'

function mountVoiceComposer() {
  return mount(AiComposer, {
    props: {
      modelValue: '',
      voiceMode: true,
      speechState: 'idle',
    },
  })
}

beforeEach(() => {
  Object.assign(uni, { hideKeyboard: vi.fn() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ai composer voice gesture', () => {
  it('starts after a deliberate hold and stops when the finger is released', async () => {
    vi.useFakeTimers()
    const wrapper = mountVoiceComposer()
    const holdButton = wrapper.get('.hold-to-talk')

    await holdButton.trigger('touchstart')
    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('record-start')).toHaveLength(1)

    await holdButton.trigger('touchend')
    expect(wrapper.emitted('record-stop')).toHaveLength(1)
  })

  it('does not start recording when the finger is released before the hold delay', async () => {
    vi.useFakeTimers()
    const wrapper = mountVoiceComposer()
    const holdButton = wrapper.get('.hold-to-talk')

    await holdButton.trigger('touchstart')
    vi.advanceTimersByTime(200)
    await holdButton.trigger('touchend')
    vi.advanceTimersByTime(200)

    expect(wrapper.emitted('record-start')).toBeUndefined()
    expect(wrapper.emitted('record-stop')).toBeUndefined()
  })

  it('cancels an active recording when WeChat cancels the touch sequence', async () => {
    vi.useFakeTimers()
    const wrapper = mountVoiceComposer()
    const holdButton = wrapper.get('.hold-to-talk')

    await holdButton.trigger('touchstart')
    vi.advanceTimersByTime(350)
    await holdButton.trigger('touchcancel')

    expect(wrapper.emitted('record-start')).toHaveLength(1)
    expect(wrapper.emitted('record-cancel')).toHaveLength(1)
  })
})
