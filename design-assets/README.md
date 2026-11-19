# 微信小程序设计稿与图标资源

这组视觉稿沿用首页的浅冰蓝渐变、柔和弧形光带、蓝紫主色、圆角白色卡片和轻阴影。页面稿按微信小程序安全区绘制，右上角保留胶囊导航区域，底部保留安全区。

## 页面设计稿

| 文件 | 页面 |
| --- | --- |
| `screens/property-list-wechat.png` | 房源列表 |
| `screens/property-detail-wechat.png` | 房源详情 |
| `screens/property-map-wechat.png` | 地图找房 |
| `screens/lease-sign-wechat.png` | 线上签约 |
| `screens/profile-center-wechat.png` | 个人中心 |

## 高清 PNG 图标

`icons` 目录内的图标均为独立透明背景 PNG，可直接作为 `image` 资源使用。

| 文件 | 用途 |
| --- | --- |
| `home.png` | 首页/整套房源 |
| `apartment.png` | 公寓 |
| `room.png` | 单间 |
| `homestay.png` | 民宿短租 |
| `search.png` | 搜索 |
| `location.png` | 位置 |
| `map.png` | 地图找房 |
| `chat.png` | 在线咨询 |
| `phone.png` | 电话咨询 |
| `contract.png` | 合同管理 |
| `signature.png` | 手写签名 |
| `seal.png` | 电子章 |
| `calendar.png` | 预约与租期 |
| `profile.png` | 个人中心 |
| `service.png` | 客服中心 |
| `favorite.png` | 收藏 |
| `filter.png` | 筛选 |
| `navigation.png` | 导航 |

## 微信布局基准

- 顶部内容使用微信状态栏高度和胶囊区域计算结果，不固定写死 iOS 状态栏高度。
- 页面标题和操作按钮的下边缘低于胶囊底部，并在不同机型上保留安全间距。
- 底部 TabBar 内容避开 `safeAreaInsets.bottom`，浮动按钮避开 TabBar 和底部安全区。
- 页面视觉稿用于统一间距、颜色、卡片层级和信息优先级，实际页面仍以小程序真机安全区测量结果为准。
