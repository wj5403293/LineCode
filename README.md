# LineCode

LineCode 是一个 React Native + TypeScript 编写的移动端 AI 编程助手。它把多模型对话、代码渲染、文件工具、Agent 工作流、本地 HTTP 服务、SSH Shell 和热更新集成到同一个移动端工作区里，目标是在手机上也能完成真实的代码阅读、修改、验证和发布辅助工作。

## 核心能力

- 流式 AI 对话，支持 Markdown、代码高亮、thinking/reasoning 展示与历史持久化。
- 支持 OpenAI 兼容接口、Anthropic 接口、Codex Responses API 模式和本地 GGUF 模型运行时。
- 内置 MCP 风格工具：文件读写、编辑、删除、glob 搜索、本地 HTTP 文件服务、Agent 和 Agent Pipeline。
- 支持 SSH Shell 模式，把命令执行切到远端 Termux、服务器或其他 SSH 环境。
- 项目文件管理、ZIP 导出、内置浏览器打开本地服务、错误报告、存储管理和主题设置。
- 热更新链路覆盖 JS bundle、更新索引、更新日志和可选 APK 更新包。

## 快速开始

环境要求：

- Node.js `>=22.11.0`
- npm
- Android Studio 与可用的 Android 设备或模拟器
- iOS 开发需要 Xcode、CocoaPods 和 macOS

安装依赖：

```sh
npm install
```

iOS 依赖：

```sh
bundle install
bundle exec pod install --project-directory=ios
```

启动 Metro：

```sh
npm start
```

运行 Android：

```sh
npm run android
```

运行带本地 GGUF 支持的 Android：

```sh
npm run android:local
```

运行 iOS：

```sh
npm run ios
```

## 常用脚本

| 命令 | 用途 |
| --- | --- |
| `npm start` | 同步版本、构建系统提示词，然后启动 Metro。 |
| `npm run android` | 构建提示词并运行 remote Android Debug 包。 |
| `npm run android:local` | 构建提示词并运行 local Android Debug 包。 |
| `npm run ios` | 构建提示词并运行 iOS 应用。 |
| `npm run build-prompt` | 根据 `src/assets/system-prompt.txt` 重新生成 `src/constants/prompt.ts`。 |
| `npm run sync-version` | 从 `version.json` 同步 app、native 和热更新版本。 |
| `npm run build-android-apks` | 构建 remote/local 两个 Android Release APK。 |
| `npm run build-hot-update -- --changelog "<summary>"` | 生成热更新包和 JSON 索引文本。 |
| `npm test` | 运行 Jest 测试。 |
| `npm run lint` | 运行 ESLint。 |

## 文档

- [开发文档](docs/DEVELOPMENT.md)：环境配置、工程结构、架构边界、调试、测试、版本和发布流程。
- [Codex 协议记录](CODEX_PROTOCOL.md)：Codex Responses API 与 app-server 协议调研。
- [热更新管理器](hot-update-manager/README.md)：热更新后台、数据目录和蓝奏云上传流程。
- [Agent 协作约定](AGENTS.md)：仓库内编码、测试、提交和安全约定。

## 项目结构

```text
.
├── App.tsx                    # 应用根组件、导航容器、错误边界和热更新入口
├── index.js                   # React Native 入口
├── android/                   # Android 原生工程
├── ios/                       # iOS 原生工程
├── scripts/                   # 版本同步、提示词构建、热更新构建和依赖补丁脚本
├── src/
│   ├── assets/                # 系统提示词和静态资源
│   ├── chat/                  # 对话控制器、流式更新、消息生命周期和持久化调度
│   ├── components/            # 通用 UI、消息组件、MCP 组件和图标
│   ├── constants/             # 常量、生成的提示词和教程内容
│   ├── contexts/              # React Context
│   ├── hooks/                 # 复用状态逻辑
│   ├── mcp/                   # 工具注册、执行协调和 Agent 工具管理
│   ├── navigation/            # React Navigation 栈
│   ├── plugins/               # 插件入口与插件页面桥接
│   ├── screens/               # 路由级页面
│   ├── services/              # AI、设置、存储、文件系统、热更新和 SSH 服务
│   ├── theme/                 # 主题 tokens 和 ThemeProvider
│   ├── types/                 # 共享 TypeScript 类型
│   └── utils/                 # 工具函数
├── __tests__/                 # Jest 测试
├── docs/                      # 项目开发文档
└── hot-update-manager/        # 热更新管理后台
```

## 配置模型

进入应用的设置页，在模型管理里添加模型。每个模型需要配置 provider、Base URL、API Key 和 Model ID。

- OpenAI 兼容服务选择 `openai`，Base URL 填兼容接口地址。
- Anthropic 服务选择 `anthropic`。
- Codex Responses API 模式选择 `codex`，该模式走 `/responses` item 历史和 `function_call_output` 工具结果。
- 本地模型使用 local 配置，并确保对应 runtime 和模型文件已准备好。

不同供应商暴露 reasoning 的方式不同，LineCode 会尽量解析 `reasoning_content`、`reasoning_details` 或 `<think>` 内容。

## 工具权限

聊天页可切换工具权限模式：

- 只读：禁止写入和删除。
- 自动：自动执行允许的工具，删除等高风险操作仍需确认。
- 确认：风险操作需要用户确认后继续。

SSH Shell 模式会禁用本地文件工具、搜索、Agent、Agent Pipeline 和 HTTP 服务，只向模型暴露 `shell_execute`，每条命令会在界面内确认。

## 版本和热更新

版本只通过 `version.json` 维护。修改后运行：

```sh
npm run sync-version
```

生成热更新时需要递增 `hotUpdateVersionCode`，并提供真实 changelog：

```sh
npm run build-hot-update -- --changelog "修复流式消息滚动状态"
```

APK 更新还需要按需递增 native 版本字段，并传入 remote/local APK：

```sh
npm run build-hot-update -- --apk-update --remote-apk <remote.apk> --local-apk <local.apk> --changelog "发布新版 APK"
```

不要使用默认的 `Hot update <version>` 文案，它会展示给用户。

## 贡献检查

提交前至少运行与改动相关的检查：

```sh
npm test
npm run lint
```

提交信息建议使用 Conventional Commit：

```text
feat(agent): add pipeline execution
fix(mcp): persist interrupted tool state
docs: update development guide
```

不要提交 API Key、本地日志、生成 APK、热更新产物、私有模型文件或本地工作区数据。

## 许可

LineCode 采用双重许可：

- 开源许可：AGPL-3.0-only，完整条款见 [LICENSE](LICENSE)。
- 商业许可：需与版权持有人另行取得书面授权，说明见 [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)。

未取得商业许可时，只能按 AGPL-3.0-only 使用、修改、分发或提供网络访问。第三方依赖仍遵循各自许可证；已经按 AGPL 获得的副本不受后续商业授权影响。
