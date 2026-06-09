# Logo 图片下载说明

请将新的logo图片下载到本地：

## 图片URL
https://p.ipic.vip/hh0966.jpg

## 下载步骤
1. 浏览器打开上述URL
2. 右键保存图片
3. 将图片命名为 `logo-new.png` 或 `logo-new.jpg`
4. 将图片放到项目的 `static` 目录下

## 替换代码
如果需要使用本地图片，修改 cicada-assets.js：

```javascript
export const cicadaAssets = {
    // ...
    logoNew: '/static/logo-new.png',  // 本地路径
    // ...
}
```

同时修改首页模板中的图片引用：

```vue
<image class="brand-logo" src="/static/logo-new.png" mode="aspectFit"></image>
```

## 可能的问题
- 外部CDN链接在微信开发者工具中可能无法正常显示
- 建议使用本地图片确保兼容性
