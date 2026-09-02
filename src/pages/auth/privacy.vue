<script setup lang="ts">
import AuthLayout from './components/AuthLayout.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '隐私政策',
  },
})

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <AuthLayout title="隐私政策" subtitle="我们重视并保护你的个人信息" @back="goBack">
    <view class="flex flex-col gap-5 text-xs text-app-ink-soft leading-relaxed">
      <text class="text-2xs text-app-muted">更新日期：2026 年 8 月 26 日</text>
      <wd-cell-group border>
        <wd-cell title="收集的信息" label="仅收集实现账号登录、求职服务和安全保障所必需的信息。" />
        <wd-cell title="信息使用" label="用于提供岗位推荐、账号服务、消息通知及必要的安全风控。" />
        <wd-cell title="信息保护" label="我们采取合理措施保护信息安全，并在法律允许范围内处理数据。" />
        <wd-cell title="你的权利" label="你可通过正式支持渠道咨询、更正或删除与服务相关的个人信息。" />
      </wd-cell-group>
      <text>使用本应用前，请确认你已阅读并理解本隐私政策。当前前端演示不会保存模拟注册、绑定或重置密码数据。</text>
    </view>
  </AuthLayout>
</template>
