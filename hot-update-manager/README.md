# LineCode Hot Update Manager

React + Node 子项目，用于管理 `scripts/build-hot-update.mjs` 生成的热更新产物，并通过蓝奏云上传/删除 `base.zip` 与 `base.txt`，同时保留历史 `base-{versionCode}.txt` 更新日志。`.txt` 文件内容仍然是 JSON，用来兼容蓝奏云不允许上传 `.json` 后缀的限制。

## 运行

```bash
cd hot-update-manager
npm install
ADMIN_PASSWORD='change-me' npm run dev
```

生产模式：

```bash
npm run build
ADMIN_PASSWORD='change-me' npm run start
```

后台默认监听 `http://127.0.0.1:3737`，开发模式前端由 Vite 监听 `http://127.0.0.1:5173`。

## 数据

运行时数据写入 `data/store.json`，上传归档写入 `data/artifacts/`。这两个路径已被 `.gitignore` 排除，因为其中会包含蓝奏云 cookie、云端文件 ID 和发布记录。

可用环境变量：

- `ADMIN_PASSWORD`: 管理员明文密码。
- `ADMIN_PASSWORD_SHA256`: 管理员密码 SHA-256，优先级低于 `ADMIN_PASSWORD`。
- `SESSION_SECRET`: session 签名密钥，未设置时会从管理员密码派生。
- `HOT_UPDATE_MANAGER_DATA_DIR`: 覆盖 JSON 数据目录。
- `PORT`: Node 服务端口，默认 `3737`。

## 热更新格式

管理器读取仓库根目录下的 `dist/hot-update`：

- `base.txt`: 当前可用更新索引，包含完整更新链路，内容为 JSON。
- `base-{versionCode}.txt`: 单个历史版本详情，包含 changelog 与 `requiresApk`，内容为 JSON。
- `base.zip`: 热更新包。
- `payload/manifest.json`: 必须包含 `versionCode/versionName`、`bundle`、`files`，并且 bundle 文件需要 SHA-256 校验。

## 蓝奏云 API 说明

蓝奏云没有稳定公开的官方 Node SDK；这里按 `yieldray/lanzou-api` 的公开实现做适配：

- 管理后台 Cookie 来自 `https://pc.woozooo.com/mydisk.php`，该项目注释中说明有效期约两天。
- 文件列表使用 `https://pc.woozooo.com/doupload.php`，`task=5`。
- 上传使用 `https://pc.woozooo.com/fileup.php`，字段包含 `task=1`、`folder_id_bb_n`、`upload_file`。
- 删除文件使用 `doupload.php`，`task=6`、`file_id=<文件 ID>`；请求不带 `uid` query，并按发布记录的文件夹 ID 写入 Cookie 中的 `folder_id_c`。
- 获取分享信息使用 `doupload.php`，`task=22`。

参考：`https://github.com/YieldRay/lanzou-api` 与 `https://yieldray.github.io/lanzou-api/classes/lanzou.default.html`。
