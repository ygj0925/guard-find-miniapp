<script setup lang="ts">
import { onHide, onLaunch } from '@dcloudio/uni-app'
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { permission } from '@/router/permission'

const { proxy } = (getCurrentInstance() || {}) as any
const router = proxy?.$router

router && permission.install(router)

// #ifdef MP-WEIXIN
function watchMiniappUpdate() {
  if (!uni.canIUse('getUpdateManager'))
    return
  const manager = uni.getUpdateManager()
  manager.onUpdateReady(() => {
    uni.showModal({
      title: '发现新版本',
      content: '新版本已准备好，是否立即重启使用？',
      confirmText: '立即重启',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm)
          manager.applyUpdate()
      },
    })
  })
}
// #endif

onLaunch((options) => {
  // #ifdef MP-WEIXIN
  watchMiniappUpdate()
  // #endif
  // 处理直接进入页面路由的情况：如微信小程序分享后进入等
  // https://github.com/unibest-tech/unibest/issues/192
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  }
  else {
    navigateToInterceptor.invoke({ url: '/' })
  }
})
onHide(() => {
  console.log('App Hide')
})

// #ifdef H5
function syncTabbarWhenPageVisible() {
  // H5 下切回标签页时同步底部导航选中态
}
onMounted(() => {
  document.addEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.addEventListener('pageshow', syncTabbarWhenPageVisible)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.removeEventListener('pageshow', syncTabbarWhenPageVisible)
})
// #endif
</script>

<template>
  <slot />
</template>
