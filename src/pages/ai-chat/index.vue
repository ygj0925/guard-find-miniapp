<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { safeAreaInsets, systemInfo } from '@/utils/systemInfo'
import { aiHeaderMetrics } from './aiLayout'
import AiBrandHeader from './components/AiBrandHeader.vue'
import AiComposer from './components/AiComposer.vue'

defineOptions({
  name: 'AiChat',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '麟才寻你招聘助手',
    backgroundColor: '#EDF6FF',
  },
})

type MessageRole = 'assistant' | 'user'
type MessageStatus = 'complete' | 'streaming'
type SpeechRecognitionState = 'idle' | 'recording' | 'recognizing'

interface MockMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  status: MessageStatus
}

interface MockConversation {
  id: string
  messages: MockMessage[]
}

interface MockQuickQuestion {
  id: number
  tag: string
  displayQuestion: string
  sendContent: string
}

interface ScrollEvent {
  detail: {
    scrollHeight: number
    scrollTop: number
  }
}

interface KeyboardHeightEvent {
  height: number
}

const quickQuestions = ref<MockQuickQuestion[]>([
  { id: 1, tag: '岗位推荐', displayQuestion: '帮我找上海的研发岗位', sendContent: '帮我推荐上海的生物药研发岗位' },
  { id: 2, tag: '简历优化', displayQuestion: '怎样突出我的项目经历？', sendContent: '怎样在简历中突出我的项目经历？' },
  { id: 3, tag: '面试准备', displayQuestion: '医学岗位面试会问什么？', sendContent: '医学相关岗位面试通常会问什么？' },
])

const hasStarted = ref(false)
const inputValue = ref('')
const currentConversation = ref<MockConversation | null>(null)
const isReplying = ref(false)
const isFollowingLatest = ref(true)
const scrollIntoView = ref('')
const scrollWithAnimation = ref(false)
const keyboardHeight = ref(0)
const speechState = ref<SpeechRecognitionState>('idle')
const speechStateText = ref('')
const safeBottom = safeAreaInsets?.bottom || 0
const scrollViewportHeight = Number(systemInfo?.windowHeight || 0)
let messageSequence = 0
let replyTimer: ReturnType<typeof setTimeout> | null = null
let voiceTimer: ReturnType<typeof setTimeout> | null = null

const splashScrollStyle = computed(() => ({
  paddingTop: `${aiHeaderMetrics.height}px`,
  paddingBottom: `${safeBottom + 124}px`,
}))

const splashActionsStyle = computed(() => ({
  paddingBottom: `${safeBottom + 12}px`,
}))

const contentScrollStyle = computed(() => ({
  paddingTop: `${aiHeaderMetrics.height}px`,
  paddingBottom: `${keyboardHeight.value + (keyboardHeight.value > 0 ? 76 : safeBottom + 76)}px`,
}))

const newChatStyle = {
  top: `${aiHeaderMetrics.height + 12}px`,
}

const composerStyle = computed(() => ({
  bottom: `${keyboardHeight.value}px`,
  paddingBottom: `${keyboardHeight.value > 0 ? 12 : safeBottom + 12}px`,
}))

const scrollLatestStyle = computed(() => ({
  bottom: `${keyboardHeight.value + (keyboardHeight.value > 0 ? 82 : safeBottom + 82)}px`,
}))

function createMessage(role: MessageRole, content: string, status: MessageStatus = 'complete'): MockMessage {
  messageSequence += 1
  return {
    id: `message-${Date.now()}-${messageSequence}`,
    role,
    content,
    createdAt: Date.now(),
    status,
  }
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

function getMockReply(question: string) {
  if (question.includes('研发') || question.includes('上海')) {
    return '根据你的方向，建议优先关注生物药研发、工艺开发和分析研究岗位。你可以继续告诉我学历、专业和工作年限，我会帮你进一步缩小范围。'
  }
  if (question.includes('简历') || question.includes('项目')) {
    return '项目经历建议按“目标、行动、结果”来写：先说明项目阶段，再写你负责的实验或协作内容，最后补充可量化的结果与业务价值。'
  }
  if (question.includes('面试') || question.includes('医学')) {
    return '医学岗位通常会关注疾病领域理解、文献解读、沟通协作和合规意识。建议准备一个专业沟通案例，并清楚说明你的判断过程。'
  }
  return '我已记录你的求职需求。你可以补充意向城市、目标岗位、专业背景和工作年限，我会根据演示职位数据给出更具体的建议。'
}

function clearReplyTimer() {
  if (replyTimer) {
    clearTimeout(replyTimer)
    replyTimer = null
  }
}

function clearVoiceTimer() {
  if (voiceTimer) {
    clearTimeout(voiceTimer)
    voiceTimer = null
  }
}

function startExperience() {
  hasStarted.value = true
  if (currentConversation.value) {
    scrollToBottom(true, false)
  }
}

function openHistory() {
  uni.showActionSheet({
    itemList: ['上海研发岗位咨询', '医学联络官面试准备'],
    success(result) {
      clearReplyTimer()
      const histories = [
        ['我想找上海的研发岗位', '可以重点关注生物药研发、工艺开发和分析研究方向。建议在简历中突出实验平台、项目阶段及具体成果。'],
        ['如何准备医学联络官面试？', '建议准备疾病领域知识、文献解读案例和跨部门沟通经历，并用具体情境说明你的表达与协作能力。'],
      ]
      const history = histories[result.tapIndex]
      if (!history) {
        return
      }
      currentConversation.value = {
        id: `history-${result.tapIndex}`,
        messages: [createMessage('user', history[0]), createMessage('assistant', history[1])],
      }
      isReplying.value = false
      scrollToBottom(true, false)
    },
  })
}

function startNewConversation() {
  clearReplyTimer()
  currentConversation.value = null
  inputValue.value = ''
  isReplying.value = false
  isFollowingLatest.value = true
  scrollIntoView.value = ''
}

function sendMessage(content = inputValue.value) {
  const question = content.trim()
  if (!question || isReplying.value) {
    return
  }

  if (!currentConversation.value) {
    currentConversation.value = {
      id: `conversation-${Date.now()}`,
      messages: [],
    }
  }

  inputValue.value = ''
  currentConversation.value.messages.push(createMessage('user', question))
  const assistantMessage = createMessage('assistant', '', 'streaming')
  currentConversation.value.messages.push(assistantMessage)
  isReplying.value = true
  scrollToBottom(true, true)

  clearReplyTimer()
  replyTimer = setTimeout(() => {
    assistantMessage.content = getMockReply(question)
    assistantMessage.status = 'complete'
    isReplying.value = false
    replyTimer = null
    scrollToBottom(true, true)
  }, 760)
}

function cancelReply() {
  clearReplyTimer()
  const messages = currentConversation.value?.messages || []
  const pendingMessage = [...messages].reverse().find(message => message.status === 'streaming')
  if (pendingMessage) {
    pendingMessage.content = '已停止回复'
    pendingMessage.status = 'complete'
  }
  isReplying.value = false
}

async function scrollToBottom(forceFollow = true, animated = true) {
  if (!forceFollow && !isFollowingLatest.value) {
    return
  }

  isFollowingLatest.value = true
  scrollWithAnimation.value = animated
  scrollIntoView.value = ''
  await nextTick()
  scrollIntoView.value = 'message-bottom'
}

function handleContentScroll(event: ScrollEvent) {
  if (!currentConversation.value || scrollViewportHeight <= 0) {
    return
  }
  const distanceToBottom = event.detail.scrollHeight - event.detail.scrollTop - scrollViewportHeight
  isFollowingLatest.value = distanceToBottom <= 24
}

function resumeAutoScroll() {
  isFollowingLatest.value = true
}

function returnToLatest() {
  scrollToBottom(true, true)
}

function handleKeyboardHeightChange(event: KeyboardHeightEvent) {
  keyboardHeight.value = Math.max(0, Number(event.height || 0))
  if (keyboardHeight.value > 0) {
    scrollToBottom(true, false)
  }
}

function handleRecordStart() {
  clearVoiceTimer()
  speechState.value = 'recording'
  speechStateText.value = '松开结束 · 00:00'
}

function handleRecordStop() {
  if (speechState.value !== 'recording') {
    return
  }
  speechState.value = 'recognizing'
  speechStateText.value = '正在转成文字…'
  voiceTimer = setTimeout(() => {
    inputValue.value = '帮我推荐适合我的研发岗位'
    speechState.value = 'idle'
    speechStateText.value = ''
    voiceTimer = null
  }, 650)
}

function handleRecordCancel() {
  clearVoiceTimer()
  speechState.value = 'idle'
  speechStateText.value = ''
}

onMounted(() => uni.onKeyboardHeightChange(handleKeyboardHeightChange))
onUnmounted(() => {
  clearReplyTimer()
  clearVoiceTimer()
  uni.offKeyboardHeightChange(handleKeyboardHeightChange)
})
</script>

<template>
  <view class="ai-page">
    <view class="ai-header-fixed">
      <AiBrandHeader :show-history="hasStarted" @history="openHistory" />
    </view>

    <view v-if="!hasStarted" class="page-scroll" :style="splashScrollStyle">
      <view class="splash-page">
        <view class="splash-copy">
          <text>你好！</text>
          <text>我是麟才寻你招聘助手，</text>
          <text>陪你发现更适合的职业机会！</text>
        </view>

        <image class="splash-hero" src="https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/第一页_01.png" mode="widthFix" />

        <view class="feature-row">
          <view class="feature-item">
            <image src="https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/第一页_09.png" mode="aspectFit" />
            <text>岗位匹配</text>
          </view>
          <view class="feature-divider" />
          <view class="feature-item">
            <image src="https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/第一页_06.png" mode="aspectFit" />
            <text>简历优化</text>
          </view>
          <view class="feature-divider" />
          <view class="feature-item">
            <image src="https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/第一页_03.png" mode="aspectFit" />
            <text>面试辅导</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!hasStarted" class="splash-actions" :style="splashActionsStyle">
      <view class="start-button" @tap="startExperience">
        <text>开启求职对话</text>
        <view class="start-arrow">
          <text>›</text>
        </view>
      </view>
      <text class="ai-disclaimer">内容由 AI 生成</text>
    </view>

    <template v-else>
      <view v-if="currentConversation" class="chat-actions" :style="newChatStyle">
        <view class="new-chat-button" @tap="startNewConversation">
          ＋ 新对话
        </view>
      </view>

      <scroll-view
        class="page-scroll content-scroll"
        scroll-y
        :style="contentScrollStyle"
        :scroll-into-view="scrollIntoView"
        :scroll-with-animation="scrollWithAnimation"
        :lower-threshold="24"
        @scroll="handleContentScroll"
        @scrolltolower="resumeAutoScroll"
      >
        <view class="welcome-card">
          <view class="welcome-copy">
            <text>hello~我是麟才，</text>
            <text>你的招聘求职助手，</text>
            <text>欢迎与我交流职业问题！</text>
          </view>
          <image class="welcome-character" src="https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/56.gif" mode="aspectFit" />
        </view>

        <view class="quick-list">
          <view
            v-for="item in quickQuestions"
            :key="item.id"
            class="quick-item"
            :class="{ 'without-tag': !item.tag }"
            @tap="sendMessage(item.sendContent)"
          >
            <view v-if="item.tag" class="quick-tag">
              <text>{{ item.tag }}</text>
            </view>
            <view class="quick-question">
              <text>{{ item.displayQuestion }}</text>
            </view>
            <view class="quick-arrow" />
          </view>
        </view>

        <template v-if="currentConversation">
          <view v-for="message in currentConversation.messages" :id="message.id" :key="message.id" class="message-row" :class="message.role">
            <text v-if="message.role === 'user'" class="message-time">{{ formatMessageTime(message.createdAt) }}</text>
            <view
              v-if="message.content || (message.role === 'assistant' && message.status === 'streaming')"
              class="message-bubble"
              :class="{ 'typing-bubble': message.role === 'assistant' && message.status === 'streaming' && !message.content }"
            >
              <template v-if="message.role === 'assistant' && message.status === 'streaming' && !message.content">
                <view class="typing-dot" />
                <view class="typing-dot" />
                <view class="typing-dot" />
              </template>
              <template v-else>
                {{ message.content }}
              </template>
            </view>
          </view>
        </template>
        <view id="message-bottom" class="message-bottom" />
      </scroll-view>

      <view
        v-if="currentConversation && !isFollowingLatest"
        class="scroll-to-latest"
        :style="scrollLatestStyle"
        @tap="returnToLatest"
      >
        <view class="scroll-to-latest-arrow" />
      </view>

      <view class="composer-fixed" :style="composerStyle">
        <AiComposer
          v-model="inputValue"
          :disabled="isReplying"
          :replying="isReplying"
          :chat-mode="Boolean(currentConversation)"
          :speech-state="speechState"
          :speech-state-text="speechStateText"
          @send="sendMessage()"
          @stop="cancelReply"
          @record-start="handleRecordStart"
          @record-stop="handleRecordStop"
          @record-cancel="handleRecordCancel"
        />
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.ai-page {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover fixed;
  color: var(--app-ink);
}

:global(page) {
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover
    no-repeat;
}

.ai-header-fixed {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 30;
  background: rgba(237, 246, 255, 0.96);
}

.page-scroll {
  box-sizing: border-box;
  height: 100%;
}

.splash-page {
  box-sizing: border-box;
  min-height: 100%;
}

.splash-actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  box-sizing: border-box;
  padding-top: 18rpx;
  background-image:
    linear-gradient(180deg, rgba(237, 246, 255, 0) 0%, rgba(237, 246, 255, 0.68) 38%, rgba(237, 246, 255, 0.16) 100%),
    url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg');
  background-repeat: no-repeat;
  background-position:
    center,
    center bottom;
  background-size:
    100% 100%,
    100vw 100vh;
}

.splash-copy {
  display: flex;
  flex-direction: column;
  padding: 32rpx 44rpx 0;
  color: var(--app-ink-soft);
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.55;
}

.splash-hero {
  width: 590rpx;
  height: 714rpx;
  display: block;
  margin: 22rpx auto 0;
}

.feature-row {
  display: grid;
  grid-template-columns: 1fr 1rpx 1fr 1rpx 1fr;
  align-items: center;
  margin: -8rpx 42rpx 0;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  color: var(--app-ink-soft);
  font-size: 26rpx;
  font-weight: 500;
}

.feature-item image {
  width: 116rpx;
  height: 92rpx;
}

.feature-divider {
  width: 1rpx;
  height: 92rpx;
  background: rgba(83, 132, 243, 0.45);
}

.start-button {
  box-sizing: border-box;
  width: 514rpx;
  height: 126rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 48rpx;
  margin: 0 auto;
  padding: 12rpx 14rpx 12rpx 54rpx;
  border-radius: 68rpx;
  background: linear-gradient(100deg, #0d68ed 0%, #3d70ff 72%, #567aff 100%);
  box-shadow: 0 12rpx 30rpx rgba(36, 97, 229, 0.28);
  color: #fff;
  font-size: 36rpx;
  font-weight: 600;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.start-button:active {
  transform: scale(0.98);
  box-shadow: 0 6rpx 18rpx rgba(36, 97, 229, 0.24);
}

.start-arrow {
  width: 92rpx;
  height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #1763da;
  font-size: 78rpx;
  font-weight: 300;
  line-height: 1;
}

.start-arrow text {
  margin-top: -10rpx;
}

.ai-disclaimer {
  display: block;
  margin-top: 10rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  text-align: center;
}

@media screen and (max-height: 700px) {
  .splash-copy {
    padding-top: 16rpx;
    font-size: 34rpx;
    line-height: 1.42;
  }

  .splash-hero {
    width: 500rpx;
    margin-top: 0;
  }

  .feature-row {
    margin-top: -18rpx;
  }

  .feature-item image {
    width: 100rpx;
    height: 76rpx;
  }

  .feature-divider {
    height: 76rpx;
  }

  .start-button {
    width: 480rpx;
    height: 108rpx;
    font-size: 32rpx;
  }

  .start-arrow {
    width: 80rpx;
    height: 80rpx;
    font-size: 68rpx;
  }
}

.content-scroll {
  padding-right: 24rpx;
  padding-left: 24rpx;
}

.welcome-card {
  position: relative;
  box-sizing: border-box;
  min-height: 246rpx;
  display: flex;
  align-items: center;
  margin-top: 112rpx;
  padding: 36rpx 286rpx 36rpx 52rpx;
  overflow: visible;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14rpx 34rpx rgba(70, 104, 184, 0.14);
}

.welcome-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  color: var(--app-ink-soft);
  font-size: 30rpx;
  line-height: 1.55;
}

.welcome-character {
  position: absolute;
  right: -34rpx;
  bottom: -40rpx;
  z-index: 3;
  width: 360rpx;
  height: 360rpx;
  clip-path: inset(0 0 40rpx 0);
  filter: drop-shadow(0 18rpx 22rpx rgba(50, 103, 198, 0.18));
  pointer-events: none;
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 46rpx;
  margin-top: 42rpx;
}

.quick-item {
  position: relative;
  box-sizing: border-box;
  height: 80rpx;
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 2rpx solid rgba(151, 170, 255, 0.82);
  border-radius: 42rpx;
  background: rgba(255, 255, 255, 0.98);
}

.quick-tag {
  position: absolute;
  top: -2rpx;
  bottom: -2rpx;
  left: -2rpx;
  z-index: 2;
  box-sizing: border-box;
  width: 210rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  border-radius: 42rpx 0 0 42rpx;
  background: linear-gradient(104deg, #96aaff 0%, #6f96ff 48%, #4d7df2 100%);
  clip-path: polygon(
    0 0,
    100% 0,
    99% 2%,
    97.9% 4.3%,
    96.9% 6.9%,
    95.8% 9.9%,
    94.9% 13.4%,
    94% 17.5%,
    93.2% 22.1%,
    92.6% 27.3%,
    92.2% 33.3%,
    91.9% 40%,
    91.8% 45.8%,
    91.9% 51.3%,
    91.8% 56.6%,
    91.7% 61.8%,
    91.2% 67.2%,
    90.4% 72.8%,
    89.1% 78.7%,
    87.2% 85.1%,
    84.5% 92.2%,
    81% 100%,
    0 100%
  );
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
}

.quick-tag text {
  position: relative;
  z-index: 1;
  width: 174rpx;
  height: 80rpx;
  display: block;
  line-height: 80rpx;
  text-align: center;
}

.quick-question {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  margin-left: 174rpx;
  padding: 0 12rpx 0 40rpx;
}

.quick-item.without-tag .quick-question {
  margin-left: 0;
  padding-left: 34rpx;
}

.quick-question text {
  width: 100%;
  height: 80rpx;
  display: block;
  overflow: hidden;
  color: var(--app-ink);
  font-size: 27rpx;
  line-height: 80rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-arrow {
  box-sizing: border-box;
  width: 20rpx;
  height: 20rpx;
  flex: 0 0 20rpx;
  margin-right: 30rpx;
  border-top: 4rpx solid #78a0ff;
  border-right: 4rpx solid #78a0ff;
  transform: rotate(45deg);
}

.chat-actions {
  position: fixed;
  right: 24rpx;
  z-index: 25;
  display: flex;
  justify-content: flex-end;
}

.new-chat-button {
  min-height: 56rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 10rpx 24rpx;
  border: 1rpx solid rgba(108, 145, 225, 0.24);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 24rpx rgba(61, 98, 177, 0.14);
  color: var(--app-ink-soft);
  font-size: 24rpx;
}

.message-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 28rpx;
}

.message-row.user {
  align-items: flex-end;
}

.message-row.assistant {
  align-items: flex-start;
}

.message-time {
  margin-bottom: 14rpx;
  color: var(--app-muted);
  font-size: 24rpx;
}

.message-bubble {
  box-sizing: border-box;
  max-width: 88%;
  padding: 28rpx 30rpx;
  border-radius: 30rpx;
  font-size: 29rpx;
  line-height: 1.75;
  white-space: pre-wrap;
}

.user .message-bubble {
  border-bottom-right-radius: 8rpx;
  background: linear-gradient(135deg, #4d89ff, #5b7ff3);
  box-shadow: 0 10rpx 24rpx rgba(66, 111, 224, 0.2);
  color: #fff;
}

.assistant .message-bubble {
  border-bottom-left-radius: 8rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 28rpx rgba(77, 101, 155, 0.12);
  color: var(--app-ink);
}

.typing-bubble {
  display: flex;
  gap: 10rpx;
  padding: 24rpx 30rpx;
}

.typing-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #6592f2;
  animation: typing 1.1s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.message-bottom {
  height: 24rpx;
}

.scroll-to-latest {
  position: fixed;
  left: 50%;
  z-index: 42;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(125, 158, 228, 0.36);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10rpx 28rpx rgba(55, 94, 174, 0.2);
  transform: translateX(-50%);
  transition: bottom 0.18s ease;
}

.scroll-to-latest-arrow {
  width: 18rpx;
  height: 18rpx;
  margin-top: -8rpx;
  border-right: 5rpx solid var(--app-ink-soft);
  border-bottom: 5rpx solid var(--app-ink-soft);
  transform: rotate(45deg);
}

.composer-fixed {
  position: fixed;
  right: 0;
  left: 0;
  z-index: 40;
  box-sizing: border-box;
  padding: 12rpx 22rpx 0;
  background: transparent;
  transition:
    bottom 0.18s ease,
    padding-bottom 0.18s ease;
  pointer-events: none;
}

.composer-fixed :deep(.composer-shell) {
  pointer-events: auto;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-7rpx);
  }
}
</style>
