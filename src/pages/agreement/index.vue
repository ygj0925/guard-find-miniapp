<script setup lang="ts">
/**
 * 用户协议与隐私政策。文本为占位模板，【】内字段上线前需由运营方替换并经法务审核。
 */
definePage({ style: { navigationBarTitleText: '用户协议', backgroundColor: '#F7F8FA' } })

type DocType = 'user' | 'privacy'
interface Section { heading: string, paragraphs: string[] }

const appName = import.meta.env.VITE_APP_TITLE
const OPERATOR = '【运营主体名称】'
const CONTACT = '【客服电话/邮箱】'
const EFFECTIVE = '【生效日期】'

const DOCS: Record<DocType, { title: string, intro: string, sections: Section[] }> = {
  user: {
    title: '用户协议',
    intro: `欢迎使用“${appName}”小程序（以下简称“本小程序”）。本协议由您与${OPERATOR}（以下简称“我们”）订立，请您在使用前仔细阅读。您点击同意或实际使用本小程序，即视为已阅读并接受本协议全部内容。`,
    sections: [
      {
        heading: '一、服务内容',
        paragraphs: [
          '本小程序为您提供房源信息浏览、收藏、看房预约、与公寓管家在线沟通等服务。房源由我们或经认证的管家发布，具体以页面展示为准。',
          '我们会持续优化服务，可能对功能进行调整、暂停或终止，并尽可能提前在小程序内告知。',
        ],
      },
      {
        heading: '二、账号与登录',
        paragraphs: [
          '您可使用微信授权登录，系统将为您自动创建账号。请妥善保管您的微信账号，因您自身原因导致账号被他人使用的后果由您承担。',
          '如发现账号被盗用或存在安全风险，请及时联系客服。',
        ],
      },
      {
        heading: '三、使用规范',
        paragraphs: [
          '您应遵守法律法规及公序良俗，不得发布或传播违法、虚假、侵权、骚扰或广告类信息，不得利用本小程序从事任何违法活动。',
          '预约看房时请填写真实的联系方式，并按约定时间看房；如需取消请及时操作。',
          '对违反本协议的行为，我们有权采取删除信息、限制功能或终止服务等措施。',
        ],
      },
      {
        heading: '四、房源信息与交易',
        paragraphs: [
          '我们会尽力核实房源信息，但房屋实际状况、价格及租售条件请以实地看房和最终签署的合同为准。',
          '租赁或买卖合同由您与房源方另行签署，请在签约前核实房屋权属及相关证件，谨慎支付任何款项。',
        ],
      },
      {
        heading: '五、免责与责任限制',
        paragraphs: [
          '因不可抗力、网络故障、第三方服务异常等非我们原因导致的服务中断或损失，我们在法律允许范围内不承担责任。',
        ],
      },
      {
        heading: '六、协议变更与争议解决',
        paragraphs: [
          '我们可能根据业务调整修订本协议，修订后将在小程序内公布。若您继续使用，即视为接受修订后的协议。',
          '本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商；协商不成的，提交【管辖法院所在地】人民法院诉讼解决。',
        ],
      },
      {
        heading: '七、联系我们',
        paragraphs: [`如对本协议有任何疑问，可通过“我的 - 联系公寓管家”或${CONTACT}与我们联系。`],
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    intro: `${OPERATOR}（以下简称“我们”）深知个人信息对您的重要性。本政策说明“${appName}”小程序如何收集、使用、存储和保护您的个人信息，以及您享有的权利。`,
    sections: [
      {
        heading: '一、我们收集的信息',
        paragraphs: [
          '登录：您使用微信登录时，我们会获取微信提供的用户标识（OpenID），用于创建和识别您的账号。',
          '资料：您主动提供的昵称、头像。',
          '看房预约：您填写的联系人姓名、联系电话、看房时间与备注，用于安排看房并告知房源方。',
          '沟通：您与管家或其他用户的聊天内容，用于提供在线咨询服务。',
          '使用记录：您的收藏与浏览记录，用于在“我的”中为您展示。',
          '房源发布（仅管家）：您上传的房源图片与描述。上传图片需访问您的相册或相机，仅在您主动选择时调用。',
          '运行日志：为排查故障，我们可能记录设备型号、系统版本、小程序版本及错误信息，不包含聊天内容。',
        ],
      },
      {
        heading: '二、信息的使用',
        paragraphs: [
          '我们仅在实现上述功能所必需的范围内使用您的信息，不会将其用于与服务无关的用途。',
          '您的联系方式仅向您预约的房源方展示，用于沟通看房事宜。',
        ],
      },
      {
        heading: '三、信息的共享与披露',
        paragraphs: [
          '除以下情形外，我们不会向第三方共享您的个人信息：获得您的明确同意；为完成看房预约向对应房源方提供必要信息；依据法律法规或有权机关的要求。',
          '本小程序运行于微信平台，微信对相关信息的处理遵循其自身的隐私政策。',
        ],
      },
      {
        heading: '四、信息的存储与保护',
        paragraphs: [
          '您的信息存储于中华人民共和国境内的服务器，保存期限为实现服务目的所必需的最短时间，法律法规另有规定的除外。',
          '我们采取访问控制、传输加密等措施保护您的信息安全。如发生安全事件，我们将依法及时告知您。',
        ],
      },
      {
        heading: '五、您的权利',
        paragraphs: [
          '您可以在小程序内查看和管理收藏、浏览记录、预约与会话，也可以长按删除会话。',
          `如需查询、更正、删除个人信息或注销账号，请通过${CONTACT}联系我们，我们将在 15 个工作日内处理。`,
          '您可以随时在微信“设置 - 隐私”中撤回授权，撤回后将无法继续使用相关功能。',
        ],
      },
      {
        heading: '六、未成年人保护',
        paragraphs: ['本服务主要面向成年人。若您是未满 18 周岁的未成年人，请在监护人的陪同和同意下使用。'],
      },
      {
        heading: '七、政策更新与联系我们',
        paragraphs: [
          '我们可能适时修订本政策，修订后将在小程序内公布；重大变更时会以弹窗等显著方式提示您。',
          `如您对本政策有任何疑问，请通过${CONTACT}与我们联系。`,
        ],
      },
    ],
  },
}

const type = ref<DocType>('user')
const doc = computed(() => DOCS[type.value])

onLoad((query) => {
  type.value = query?.type === 'privacy' ? 'privacy' : 'user'
  uni.setNavigationBarTitle({ title: doc.value.title })
})
</script>

<template>
  <view class="agreement-page app-page">
    <view class="app-content py-4">
      <view class="app-panel p-5">
        <text class="block text-22px text-app-ink font-bold leading-8">{{ doc.title }}</text>
        <text class="mt-2 block text-xs text-app-muted">生效日期：{{ EFFECTIVE }}</text>
        <text class="mt-4 block text-sm text-app-ink-soft leading-6">{{ doc.intro }}</text>
        <view v-for="section in doc.sections" :key="section.heading" class="mt-6">
          <text class="block text-base text-app-ink font-semibold leading-6">{{ section.heading }}</text>
          <text
            v-for="(paragraph, index) in section.paragraphs"
            :key="index"
            class="mt-2 block text-sm text-app-ink-soft leading-6"
          >
            {{ paragraph }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.agreement-page {
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}
</style>
