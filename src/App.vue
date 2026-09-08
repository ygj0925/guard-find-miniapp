<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { permission } from '@/router/permission'
import { tabbarStore } from '@/tabbar/store'
// #ifdef H5
import { bridgeWechatH5OAuthCallback } from '@/service/auth/wechat-h5-oauth'
// #endif

const { proxy } = (getCurrentInstance() || {}) as any
const router = proxy?.$router

router && permission.install(router)

let h5OAuthCallbackRedirecting = false

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  // #ifdef H5
  h5OAuthCallbackRedirecting = bridgeWechatH5OAuthCallback()
  if (h5OAuthCallbackRedirecting)
    return
  // #endif
})
onShow((options) => {
  console.log('App.vue onShow', options)
  // #ifdef H5
  if (!h5OAuthCallbackRedirecting)
    h5OAuthCallbackRedirecting = bridgeWechatH5OAuthCallback()
  // #endif
  if (h5OAuthCallbackRedirecting)
    return
  // 处理直接进入页面路由的情况：如h5直接输入路由、微信小程序分享后进入等
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
  if (document.visibilityState === 'visible') {
    tabbarStore.syncCurIdxByCurrentPageAsync()
  }
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
