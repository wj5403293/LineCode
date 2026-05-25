# LineCode

LineCode is a React Native mobile AI coding assistant. It combines chat, model management, file tools, local HTTP serving, and agent workflows so code-related tasks can be handled directly inside the app workspace.

LineCode 是一个基于 React Native 的移动端 AI 编程助手。它将对话、模型管理、文件工具、本地 HTTP 服务和 Agent 工作流整合在一起，让用户可以在应用内直接完成代码相关任务。

## Features / 功能特性

- AI chat with streaming responses and Markdown/code rendering.
- Supports OpenAI-compatible APIs, Anthropic APIs, and a separate Codex Responses API mode.
- Displays model thinking/reasoning when providers expose it.
- Configurable reasoning depth, reasoning preservation, output style, theme, and permission mode.
- MCP-style built-in tools: file read/write/edit/delete, glob search, HTTP file server, Agent, and Agent pipeline.
- File manager with create, rename, delete, ZIP export, and project browsing.
- Conversation history with persisted messages and tool states.
- Built-in or external browser mode for opening local server URLs.

- 支持流式 AI 对话、Markdown 渲染和代码高亮。
- 支持 OpenAI 兼容协议、Anthropic 协议和独立的 Codex Responses API 模式。
- 在模型供应商返回思考内容时显示 thinking/reasoning。
- 可配置思考深度、完整 reasoning 保留、输出样式、主题和权限模式。
- 内置 MCP 风格工具：读取、写入、编辑、删除文件，glob 搜索，HTTP 文件服务器，Agent 和 Agent 流水线。
- 文件管理器支持新建、重命名、删除、ZIP 导出和项目浏览。
- 对话历史会持久化保存消息和工具执行状态。
- 支持内置浏览器或系统浏览器打开本地服务地址。

## Tech Stack / 技术栈

- React Native `0.85.3`
- React `19.2.3`
- TypeScript `5.8`
- React Navigation
- AsyncStorage
- React Native FS
- Jest with `@react-native/jest-preset`
- ESLint and Prettier

## Project Structure / 项目结构

```text
.
├── App.tsx                  # App shell / 应用入口组件
├── index.js                 # React Native entry / RN 启动入口
├── android/                 # Android native project / Android 原生工程
├── ios/                     # iOS native project / iOS 原生工程
├── scripts/build-prompt.js  # Generates src/constants/prompt.ts
├── src/
│   ├── assets/              # Prompt and static assets / 提示词与静态资源
│   ├── components/          # Reusable UI / 通用组件
│   ├── hooks/               # Chat and app state hooks / 状态逻辑
│   ├── mcp/                 # Tool execution system / 工具执行系统
│   ├── navigation/          # Navigation stack / 导航
│   ├── screens/             # App screens / 页面
│   ├── services/            # AI, storage, settings, files / 服务层
│   ├── theme/               # Themes and theme context / 主题
│   ├── types/               # Shared TypeScript types / 类型定义
│   └── utils/               # Utilities / 工具函数
└── __tests__/               # Jest tests / 测试
```

## Requirements / 环境要求

- Node.js `>= 22.11.0`
- npm
- Android Studio for Android development
- Xcode and CocoaPods for iOS development
- A configured Android emulator, iOS simulator, or physical device

Follow the official React Native environment setup for your platform before running the app.

运行前请先完成对应平台的 React Native 官方开发环境配置。

## Installation / 安装

```sh
npm install
```

For iOS, install CocoaPods dependencies after installing npm packages:

```sh
bundle install
bundle exec pod install --project-directory=ios
```

iOS 开发需要在安装 npm 依赖后安装 CocoaPods 依赖。

## Development Commands / 开发命令

```sh
npm start
```

Builds the system prompt and starts Metro.  
构建系统提示词并启动 Metro。

```sh
npm run android
```

Builds the prompt and runs the remote-model Android app.  
构建提示词并运行纯远端模型版 Android 应用。

```sh
npm run android:local
```

Builds the prompt and runs the Android app with local GGUF support.  
构建提示词并运行带本地 GGUF 支持的 Android 应用。

```sh
npm run build-android-apks
```

Builds both Android release APKs: `remote` without local model native libraries, and `local` with GGUF support.  
同时构建两个 Android release APK：不带本地模型 native 库的 `remote` 版，以及带 GGUF 支持的 `local` 版。

```sh
npm run ios
```

Builds the prompt and runs the iOS app.  
构建提示词并运行 iOS 应用。

```sh
npm run build-prompt
```

Regenerates `src/constants/prompt.ts` from `src/assets/system-prompt.txt`.  
根据 `src/assets/system-prompt.txt` 重新生成 `src/constants/prompt.ts`。

```sh
npm test
```

Runs Jest tests.  
运行 Jest 测试。

```sh
npm run lint
```

Runs ESLint for the repository.  
运行 ESLint 检查。

## Model Configuration / 模型配置

Open the app, go to Settings, then add a model under model management. Each model stores:

- Provider: `openai`, `codex`, or `anthropic`
- Base URL
- API key
- Model ID

在应用内进入设置页，在模型管理中添加模型。每个模型包含供应商、Base URL、API Key 和模型 ID。

OpenAI-compatible providers can be used by selecting OpenAI and entering the provider's compatible Base URL. Reasoning behavior depends on the provider. Some models expose `reasoning_content`, `reasoning_details`, or `<think>` blocks; LineCode parses these when available.

OpenAI 兼容供应商可选择 OpenAI 类型并填写兼容 Base URL。思考内容是否可见取决于供应商，LineCode 会尽量解析 `reasoning_content`、`reasoning_details` 或 `<think>` 内容。

Codex models should be added with the Codex provider. This mode calls `/responses`, uses Responses item history, and returns tool results as `function_call_output` items instead of using the OpenAI-compatible `/chat/completions` loop.

Codex 模型应选择 Codex 提供商。该模式调用 `/responses`，使用 Responses item 历史，并以 `function_call_output` item 回传工具结果，不走 OpenAI 兼容的 `/chat/completions` 循环。

## Tools and Permissions / 工具与权限

LineCode tools operate inside the app home workspace. Permission modes are available from the chat header:

- Read-only: blocks write and delete operations.
- Auto: executes allowed tools automatically, with delete confirmation.
- Confirm: requires confirmation for risky operations.

LineCode 的工具在应用 home 工作目录内运行。权限模式可在聊天页顶部切换：

- 只读：禁止写入和删除。
- 自动：自动执行允许的工具，删除仍需确认。
- 确认：危险操作需要用户确认。

## SSH Shell Mode / SSH Shell 模式

MCP settings can switch the execution target between the local workspace and SSH Shell. In SSH Shell mode, local file read/write, search, Agent, Agent Pipeline, and the HTTP server are disabled. The model can only request `shell_execute`; each command is shown in an inline confirmation bar with Skip, Run, and Auto Run actions.

MCP 设置可在本地工作区和 SSH Shell 之间切换执行目标。SSH Shell 模式下会禁用本地文件读写、搜索、Agent、Agent Pipeline 和 HTTP 服务器，只暴露 `shell_execute` 工具；每条命令会在底部以内联确认条显示，可选择跳过、运行或本轮自动运行。

Termux sshd setup / Termux 安装 sshd：

```sh
pkg update
pkg install openssh
passwd
sshd
whoami
ip addr
```

For password login, run `passwd` first and enter that password in MCP settings. For key-based login, create a key in Termux, authorize its public key, then paste the private key into LineCode:

密码登录先执行 `passwd`，再在 MCP 设置中填写该密码。无密码登录使用 SSH key，在 Termux 中生成密钥并授权 public key，然后把 private key 粘贴到 LineCode：

```sh
ssh-keygen -t ed25519 -f ~/.ssh/lineai_key -N ""
cat ~/.ssh/lineai_key.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/lineai_key
```

For local Termux, use `127.0.0.1:8022`. For another device or server, enter its host, port, username, and either password or private key in MCP settings.

本机 Termux 默认使用 `127.0.0.1:8022`。远程设备或服务器请在 MCP 设置中填写对应 host、port、username，并填写 password 或 private key。

## Agent Workflows / Agent 工作流

The `agent` tool can spawn focused coding or exploration agents. The `agent_pipeline` tool can run dependent groups of agents, executing independent work in parallel and dependent work in order. File locks are used to reduce write conflicts between coding agents.

`agent` 工具可分派代码探索或编程 Agent。`agent_pipeline` 工具可运行带依赖关系的 Agent 任务组，无依赖任务并行执行，有依赖任务按顺序执行。编程 Agent 使用文件锁降低并发写入冲突。

## Testing / 测试

Tests use Jest and the React Native preset. Existing tests are in `__tests__/App.test.tsx`. Add new tests as `*.test.ts` or `*.test.tsx`, either under `__tests__/` or next to the module under test.

测试使用 Jest 和 React Native preset。现有测试位于 `__tests__/App.test.tsx`。新增测试可放在 `__tests__/`，也可以与被测模块放在一起，命名为 `*.test.ts` 或 `*.test.tsx`。

## Security Notes / 安全说明

- Do not commit API keys, local logs, generated APKs, or private workspace data.
- Treat reasoning preservation carefully: it may send historical model thinking back to compatible providers.
- Review file write/delete actions before enabling automatic permissions for untrusted prompts.

- 不要提交 API Key、本地日志、生成的 APK 或私人工作区数据。
- 谨慎启用完整 reasoning 保留，因为它可能把历史思考内容发回兼容模型供应商。
- 对不可信提示词使用自动权限前，应确认文件写入和删除风险。

## Contributing / 贡献

Use concise Conventional Commit style when possible, for example:

```text
feat(agent): add pipeline execution
fix(mcp): persist interrupted tool state
docs: update README
```

Before opening a pull request, run:

```sh
npm test
npm run lint
```

PRs should describe the change, list test results, and include screenshots or recordings for UI changes.

提交建议使用简洁的 Conventional Commit 风格。提交 PR 前请运行测试和 lint，并在 PR 中说明改动内容、测试结果；涉及 UI 时请附截图或录屏。

## License / 许可证

No license has been specified yet.  
当前仓库尚未声明许可证。
