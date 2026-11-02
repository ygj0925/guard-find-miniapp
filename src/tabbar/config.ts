import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { CustomTabBarItem, NativeTabBarItem } from './types'

export const TABBAR_STRATEGY_MAP = {
  NO_TABBAR: 0,
  NATIVE_TABBAR: 1,
  CUSTOM_TABBAR: 2,
}

export const selectedTabbarStrategy = TABBAR_STRATEGY_MAP.CUSTOM_TABBAR

export const nativeTabbarList: NativeTabBarItem[] = [
  {
    iconPath: 'static/tabbar/home.png',
    selectedIconPath: 'static/tabbar/homeHL.png',
    pagePath: 'pages/index/index',
    text: '首页',
  },
  {
    iconPath: 'static/tabbar/personal.png',
    selectedIconPath: 'static/tabbar/personalHL.png',
    pagePath: 'pages/me/me',
    text: '我的',
  },
]

export const customTabbarList: CustomTabBarItem[] = [
  {
    text: '首页',
    pagePath: 'pages/index/index',
    iconType: 'unocss',
    icon: 'i-my-icons-home',
    iconActive: 'i-my-icons-home-filled',
  },
  {
    text: '消息',
    pagePath: 'pages/message/index',
    iconType: 'unocss',
    icon: 'i-carbon-chat',
    iconActive: 'i-carbon-chat',
  },
  {
    text: '我的',
    pagePath: 'pages/me/me',
    iconType: 'unocss',
    icon: 'i-carbon-user',
    iconActive: 'i-carbon-user-filled',
  },
]

export const tabbarCacheEnable
  = [TABBAR_STRATEGY_MAP.NATIVE_TABBAR, TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy)

export const customTabbarEnable = [TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy)

export const needHideNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR

const _tabbarList = customTabbarEnable ? customTabbarList.map(item => ({ text: item.text, pagePath: item.pagePath })) : nativeTabbarList
export const tabbarList = customTabbarEnable ? customTabbarList : nativeTabbarList

export const isNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NATIVE_TABBAR

const _tabbar: TabBar = {
  custom: selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR,
  color: '#999999',
  selectedColor: '#018D71',
  backgroundColor: '#F8F8F8',
  borderStyle: 'black',
  height: '50px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: _tabbarList as unknown as TabBar['list'],
}

export const tabBar = tabbarCacheEnable ? _tabbar : undefined
