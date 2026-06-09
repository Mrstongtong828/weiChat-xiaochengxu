# CDN 资源上传说明

这个目录里的图片用于上传到 uniCloud 云存储或其他 CDN，不要再放回 `static/cicada`。

## 为什么要放到 CDN

微信小程序会把 `static` 目录里的资源打进主包。之前 `static/cicada` 里的公司图片、海报和二维码会导致主包体积超过微信开发者工具代码质量要求。现在这些图片已经移到 `cdn-assets/cicada`，页面通过 HTTPS 链接加载。

## 上传步骤

1. 登录 uniCloud 后台。
2. 进入 `云存储`。
3. 上传 `cdn-assets/cicada` 目录里的图片。
4. 复制每张图片上传后得到的 HTTPS 链接。
5. 打开 `config/cicada-assets.js`，把占位链接替换成真实 HTTPS 链接。
6. 在微信公众平台进入 `开发管理 -> 服务器域名`，把 CDN 域名加入 `downloadFile 合法域名`。
7. 重新用 HBuilderX 运行到微信开发者工具。

## 需要上传的文件

- `brand-cicada-tooth-blue.png`
- `brand-cicada-tooth-blue-original.png`
- `logo-cicada-mark.jpg`
- `logo-cicada-full.jpg`
- `photo-factory.jpg`
- `photo-building.jpg`
- `qr-wechat.jpg`
- `survey-poster.png`
- `survey-qr-wechat.jpg`

## 替换位置

所有链接集中配置在：

```text
config/cicada-assets.js
```

不要在页面里直接写 `/static/cicada/...`。
