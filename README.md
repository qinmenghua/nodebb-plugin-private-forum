# nodebb-plugin-private-forum (NodeBB v4)

把整个论坛锁成“仅登录可见”：未登录的访客访问任何内容页面时，都会被自动重定向到登录页。

这是原插件 [LM1LC3N7/nodebb-plugin-private-forum](https://github.com/LM1LC3N7/nodebb-plugin-private-forum) 的 NodeBB v4 兼容版本。

## 功能

- 未登录访问任何内容页面时，自动跳转到 `/login`。
- 放行登录、注册、找回密码等流程，访客仍然可以注册账号、重置密码。
- 放行静态资源（`/assets/...`、`/plugins/...` 以及 `.css`/`.js`/图片/字体等），保证登录页本身能正常渲染。
- 不向访客泄露任何论坛内容：除公开页面接口外的所有 `/api/*` 请求都会返回 `401`。

## 安装

```bash
npm install nodebb-plugin-private-forum-v2
```

然后在 NodeBB 后台 **插件（Plugins）** 页面启用 **Private Forum (v2)**。

> 注意：npm 包名与安装目录名都必须是 `nodebb-plugin-private-forum-v2`（原包名 `nodebb-plugin-private-forum` 已被原作者占用）。NodeBB 使用 `package.json` 里的 `name` 作为插件 ID（`pluginData.id = packageData.name`），因此安装目录名必须与包名完全一致，否则插件无法被识别。

自托管 / 离线部署时，可把插件源码放进挂载进容器的目录，并通过 `NODEBB_ADDITIONAL_PLUGINS` 环境变量引用：

```yaml
services:
  nodebb:
    image: nodebb-custom:4.x
    environment:
      NODEBB_ADDITIONAL_PLUGINS: /opt/custom-plugins/nodebb-plugin-private-forum-v2
    volumes:
      - ./custom-plugins:/opt/custom-plugins:ro
```

同样要求目录名与包名一致。修改 `library.js` 后需要重启 NodeBB 容器才会生效。

## 使用

插件**没有任何配置项**，启用即生效：

1. 后台启用插件后重启（或重新构建）NodeBB。
2. 用浏览器无痕窗口打开论坛任意地址（如 `/recent`、`/category/1`、`/topic/1`），应被立即跳转到 `/login`。
3. 登录后所有页面正常访问；`/login`、`/register`、`/reset` 页面对访客始终可打开。

### 放行名单

以下路径对未登录访客保持可访问：

| 类型 | 路径 |
| --- | --- |
| 账号流程 | `/login`、`/logout`、`/register`、`/reset`、`/auth`、`/confirm`、`/email` |
| 其他公开页 | `/sitemap` |
| 页面接口 | `/api/login`、`/api/register`、`/api/reset` |
| 静态资源 | `/assets/...`、`/plugins/...` 及 `.css`、`.js`、图片、字体、`.map` 等后缀 |

其余所有路径（含 `/api/*`）对访客一律拦截。

## 兼容性

`nbbpm.compatibility: ^4.0.0`，已在 NodeBB v4.16.0 上验证。

## 许可证

MIT — 原作者 Louis MILCENT (LM1LC3N7)。
