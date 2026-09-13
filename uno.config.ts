import type { Preset } from 'unocss'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

// https://www.npmjs.com/package/@uni-helper/unocss-preset-uni
import { presetUni } from '@uni-helper/unocss-preset-uni'
// @see https://unocss.dev/presets/legacy-compat
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUni({
      attributify: false,
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // 注册本地 SVG 图标集合, 从本地文件系统加载图标
        // 在 './src/static/my-icons' 目录下的所有 svg 文件将被注册为图标，
        // my-icons 是图标集合名称，使用 `i-my-icons-图标名` 调用
        'my-icons': FileSystemIconLoader(
          './src/static/my-icons',
          // 可选的，你可以提供一个 transform 回调来更改每个图标
          (svg) => {
            let svgStr = svg

            // 如果 SVG 文件未定义 `fill` 属性，则默认填充 `currentColor`, 这样图标颜色会继承文本颜色，方便在不同场景下适配
            svgStr = svgStr.includes('fill="')
              ? svgStr
              : svgStr.replace(/^<svg /, '<svg fill="currentColor" ')

            // 如果 svg 有 width, 和 height 属性，将这些属性改为 1em，否则无法显示图标
            svgStr = svgStr
              .replace(/(<svg.*?width=)"(.*?)"/, '$1"1em"')
              .replace(/(<svg.*?height=)"(.*?)"/, '$1"1em"')

            return svgStr
          },
        ),
      },
    }),
    // TODO: check 是否会有别的影响
    // 处理低端安卓机的样式问题
    // 将颜色函数 (rgb()和hsl()) 从空格分隔转换为逗号分隔，更好的兼容性app端，example：
    // `rgb(255 0 0)` -> `rgb(255, 0, 0)`
    // `rgba(255 0 0 / 0.5)` -> `rgba(255, 0, 0, 0.5)`
    presetLegacyCompat({
      commaStyleColorFunction: true,
      legacyColorSpace: true, // by QQ4群-量子蔷薇
      // @菲鸽 unocss 配置中，建议在 presetLegacyCompat 中添加 legacyColorSpace: true，以去除生成的颜色样式中的 in oklch 关键字，现在发现有些渐变色生成不符合预期
    }) as Preset,
  ],
  transformers: [
    // 启用指令功能：主要用于支持 @apply、@screen 和 theme() 等 CSS 指令
    transformerDirectives(),
    // 启用 () 分组功能
    // 支持css class组合，eg: `<div class="hover:(bg-gray-400 font-medium) font-(light mono)">测试 unocss</div>`
    transformerVariantGroup(),
  ],
  shortcuts: [
    {
      'center': 'flex justify-center items-center',
      'app-page': 'box-border min-h-[var(--app-viewport-height)] bg-app-surface text-app-ink',
      'app-tab-page': 'box-border min-h-[var(--app-viewport-height)] bg-app-surface text-app-ink pb-app-page-safe',
      'app-card': 'border-1rpx border-[rgba(255,255,255,0.88)] border-solid rounded-32rpx bg-[rgba(255,255,255,0.94)] shadow-[0_14rpx_34rpx_rgba(70,104,184,0.10)]',
      'app-glass-card': 'border-1rpx border-[rgba(255,255,255,0.88)] border-solid rounded-40rpx bg-[rgba(255,255,255,0.74)] shadow-[0_14rpx_34rpx_rgba(70,104,184,0.14)]',
      'app-brand-action': 'text-white bg-brand-hero',
    },
  ],
  // 动态图标需要在这里配置，或者写在vue页面中注释掉
  safelist: [
    'i-carbon-code',
    'i-carbon-home',
    'i-my-icons-home',
    'i-my-icons-home-filled',
    'i-my-icons-briefcase',
    'i-my-icons-briefcase-filled',
    'i-carbon-document',
    'i-carbon-bookmark',
    'i-carbon-task',
    'i-carbon-chat',
    'i-carbon-user',
    'i-carbon-user-filled',
    'i-carbon-locked',
    'i-carbon-notification',
    'i-carbon-notification-filled',
    'i-carbon-education',
    'i-carbon-chart-line',
    'i-carbon-user-multiple',
    'i-carbon-arrow-right',
    'i-carbon-chevron-right',
    'i-carbon-search',
    'i-carbon-send-alt',
    'i-carbon-attachment',
    'i-carbon-favorite',
    'i-carbon-portfolio',
    'i-carbon-share-knowledge',
    'i-carbon-dashboard',
    'i-carbon-calendar',
    'i-carbon-user-profile',
    'i-carbon-ai-status',
    'i-carbon-wallet',
    'i-carbon-building',
    'i-carbon-help',
    'i-carbon-apps',
    'i-carbon-template',
    'i-carbon-ibm-watson-language-translator',
    'i-carbon-menu',
    'i-carbon-checkmark',
  ],
  rules: [
    ['bg-brand-hero', { background: 'var(--app-brand-hero)' }],
    ['bg-brand-header', { background: 'var(--app-brand-header)' }],
    ['bg-blue-white-gradient', { background: 'var(--app-blue-white-gradient)' }],
    ['bg-position-hero', { background: 'var(--app-position-hero-gradient)' }],
    ['bg-home-hero', { background: 'var(--app-home-hero-background)' }],
    [
      'p-safe',
      {
        padding:
          'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      },
    ],
    ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
    ['pb-app-page-safe', { 'padding-bottom': 'var(--app-page-bottom-safe)' }],
    ['pb-auth-layout-safe', { 'padding-bottom': 'calc(44rpx + env(safe-area-inset-bottom))' }],
  ],
  theme: {
    colors: {
      /** 主题色，用法如: text-primary */
      'primary': 'var(--wot-color-theme,#2D6FE6)',
      'app-surface': 'var(--app-page-background)',
      'app-ink': 'var(--app-ink)',
      'app-ink-soft': 'var(--app-ink-soft)',
      'app-muted': 'var(--app-muted)',
      'brand-sky': 'var(--app-brand-sky)',
      'brand-blue': 'var(--app-brand-blue)',
      'brand-violet': 'var(--app-brand-violet)',
      'brand-mint': 'var(--app-brand-mint)',
      'app-success': 'var(--app-success)',
      'app-warning': 'var(--app-warning)',
      'app-danger': 'var(--app-danger)',
      'app-info': 'var(--app-info)',
      'app-placeholder': 'var(--app-placeholder)',
      'app-border': 'var(--app-border)',
    },
    fontSize: {
      /** 提供更小号的字体，用法如：text-2xs */
      '2xs': ['20rpx', '28rpx'],
      '3xs': ['18rpx', '26rpx'],
    },
  },
  // windows 系统会报错：[plugin:unocss:transformers:pre] Cannot overwrite a zero-length range - use append Left or prependRight instead.
  // 去掉下面的就正常了
  // content: {
  //   /**
  //    * 解决小程序报错 `./app.wxss(78:2814): unexpected unexpected at pos 5198`
  //    * 为什么同时使用include和exclude？虽然看起来多余，但同时配置两者是一种常见的 `防御性编程` 做法。
  //      1. 结构变化保障 : 如果未来项目结构发生变化，某些排除目录可能被移动到包含路径下，exclude配置可以确保它们仍被排除
  //      2. 明确性 : 明确列出要排除的目录使配置意图更加清晰
  //      3. 性能优化 : 避免处理不必要的文件，提高构建性能
  //      4. 防止冲突 : 排除第三方库和构建输出目录，避免潜在的CSS冲突
  //    */
  //   pipeline: {
  //     exclude: [
  //       'node_modules/**/*',
  //       'public/**/*',
  //       'dist/**/*',
  //     ],
  //     include: [
  //       './src/**/*',
  //     ],
  //   },
  // },
})
