# LineCode 开发文档

本文档面向参与 LineCode 开发、调试、测试和发布的人。项目入口说明放在 [README.md](../README.md)，Agent 协作约定放在 [AGENTS.md](../AGENTS.md)。

## 1. 环境准备

必需环境：

- Node.js `>=22.11.0`
- npm
- Android Studio、Android SDK、JDK 和可用设备或模拟器
- iOS 开发需要 macOS、Xcode、CocoaPods 与 Ruby Bundler

首次安装：

```sh
npm install
```

iOS：

```sh
bundle install
bundle exec pod install --project-directory=ios
```

如果原生依赖或 React Native 版本变化，优先重新安装 npm 依赖，再清理对应平台构建缓存。

## 2. 日常开发命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 运行 `sync-version` 与 `build-prompt` 后启动 Metro。 |
| `npm run android` | 构建提示词并运行 `remoteDebug` Android 包。 |
| `npm run android:local` | 构建提示词并运行带本地 GGUF 支持的 `localDebug` Android 包。 |
| `npm run ios` | 构建提示词并运行 iOS 应用。 |
| `npm run build-prompt` | 从 `src/assets/system-prompt.txt` 生成 `src/constants/prompt.ts`。 |
| `npm run sync-version` | 根据 `version.json` 同步应用和原生版本。 |
| `npm run build-android-apks` | 构建 remote/local 两个 Release APK。 |
| `npm run build-android-user-cert-apks` | 构建用户证书调试签名的 remote/local Release APK。 |
| `npm test` | 运行 Jest 测试。 |
| `npm run lint` | 运行 ESLint。 |

`npm start` 会先执行 `prestart`，因此修改 `version.json` 或系统提示词后通常不需要手动补跑脚本。单独运行 Metro 时不要绕过版本和提示词同步，除非你明确知道本地产物已经是最新的。

## 3. 工程结构

主要目录：

| 路径 | 职责 |
| --- | --- |
| `App.tsx` | 主题、导航容器、错误边界、首次启动引导、热更新检查与外部存储权限入口。 |
| `src/navigation/` | React Navigation 栈和路由参数类型。 |
| `src/screens/` | 路由级页面，页面之间通过 `RootNavigator` 注入回调跳转。 |
| `src/components/` | 可复用 UI、消息渲染、代码块、MCP 工具状态和公共控件。 |
| `src/chat/` | 对话控制、流式更新缓冲、滚动状态、消息生命周期和对话持久化调度。 |
| `src/services/` | AI 调用、设置、存储、文件系统、热更新、SSH、权限、插件和错误报告。 |
| `src/mcp/` | 工具注册、执行器、Agent 工具管理和运行时 registry。 |
| `src/services/evolution/` | 记忆、索引、RAG 检索和技能发现。 |
| `src/theme/` | 主题上下文、颜色和样式 token。 |
| `src/types/` | 共享类型定义。 |
| `scripts/` | 构建系统提示词、同步版本、生成热更新和依赖补丁。 |
| `hot-update-manager/` | React + Node 热更新管理后台。 |

开发时尽量沿用已有边界：页面负责组合交互，组件负责显示，`chat/` 负责对话生命周期，`services/` 负责副作用和持久化，`mcp/` 负责工具协议和执行。

## 4. 对话与工具链路

聊天主流程由 `src/chat/useChatController.ts` 协调。流式内容先进入 `StreamUpdateBuffer`，再更新消息列表，避免高频 delta 直接触发过多渲染。消息状态、工具状态和持久化逻辑集中在 `src/chat/` 与 `src/services/conversation.ts`。

AI 服务位于 `src/services/ai/`：

- OpenAI 兼容模式使用 chat completions 风格消息。
- Anthropic 模式处理 Claude 消息结构。
- Codex 模式使用 Responses API item 历史和工具输出 item。

工具执行位于 `src/mcp/`。新增工具时需要：

1. 在 `src/mcp/tools/` 下实现工具类或复用已有基类。
2. 在工具 registry 中注册名称、schema、权限和执行函数。
3. 明确读写范围、错误信息和权限模式下的行为。
4. 为复杂状态或边界条件补测试。

高风险工具必须尊重权限模式。只读模式不能写入或删除，自动模式也应对删除和远端命令保留确认路径。

## 5. 模型配置

模型配置通过应用内设置写入持久化存储。新增 provider 或修改模型字段时，注意同步：

- 设置页和模型编辑页的表单类型。
- `src/services/settings.ts` 中的持久化默认值和迁移兼容。
- AI service 中 provider 分支、stream parser 和错误处理。
- 是否会影响 reasoning 保留、工具调用格式或历史消息格式。

Reasoning 相关逻辑需要特别谨慎。完整 reasoning 保留可能把历史思考内容再次发送给模型供应商，涉及隐私和成本风险。

## 6. 本地模型与 Android 变体

Android 有 remote/local 两类运行方式：

- `remote` 不包含本地模型 native 库，适合只使用远端模型。
- `local` 包含 GGUF 运行时相关能力，适合本地模型实验。

本地模型文件、Hexagon 运行时库、生成 APK 和构建中间产物都不应提交到 Git。`.gitignore` 已忽略 `models/`、`*.gguf`、`android/app/src/*/assets/ggml-hexagon/`、`*.apk` 和 `dist/`。

## 7. SSH Shell 模式

SSH Shell 模式由 `src/services/SSHService.ts` 和 MCP 设置页控制。启用后，本地文件读写、搜索、Agent、Agent Pipeline 和 HTTP server 会被禁用，只保留 `shell_execute`。每条命令都需要通过界面确认、跳过或本轮自动运行。

Termux sshd 常用初始化：

```sh
pkg update
pkg install openssh
passwd
sshd
whoami
ip addr
```

本机 Termux 默认使用 `127.0.0.1:8022`。远端设备需要填写 host、port、username，并选择 password 或 private key。

## 8. 热更新开发

版本由 `version.json` 单一来源维护。修改任何 app、native 或 hot update 版本字段后，运行：

```sh
npm run sync-version
```

生成普通热更新：

```sh
npm run build-hot-update -- --changelog "修复流式消息滚动状态"
```

生成带 APK 更新的热更新：

```sh
npm run build-hot-update -- --apk-update --remote-apk <remote.apk> --local-apk <local.apk> --changelog "发布新版 APK"
```

输出目录为 `dist/hot-update/`，其中：

- `base.zip` 是热更新包。
- `base.txt` 是当前更新索引，内容为 JSON。
- `base-{hotUpdateVersionCode}.txt` 是历史版本详情，内容为 JSON。
- `base-remote.enc` 和 `base-local.enc` 是可选的 XOR 加密 APK 包。
- `payload/manifest.json` 包含 bundle、文件列表和 SHA-256 校验信息。

每次生成热更新都要递增 `hotUpdateVersionCode`，并写真实 changelog。不要留下默认 `Hot update <version>`，因为它会显示给用户。

热更新管理器运行方式见 [hot-update-manager/README.md](../hot-update-manager/README.md)。它的 `data/store.json`、`data/artifacts/`、`.env`、`dist/` 和 `node_modules/` 都是本地运行数据，不应提交。

## 9. 测试策略

测试使用 Jest 和 `@react-native/jest-preset`。新增测试可以放在 `__tests__/`，也可以和模块放在一起命名为 `*.test.ts` 或 `*.test.tsx`。

优先覆盖：

- `src/chat/` 中的流式消息、滚动状态、消息生命周期和中断恢复。
- `src/services/` 中的设置迁移、存储、AI provider 解析、热更新和文件系统行为。
- `src/mcp/` 中的工具权限、工具输出格式、错误处理和 Agent 协调。
- 用户可见的复杂交互和回归过的边界条件。

提交前根据风险运行：

```sh
npm test
npm run lint
```

如果改动涉及 Android 原生、Gradle 配置、本地模型或热更新，补跑对应 Android 构建命令。

## 10. 调试建议

常用方向：

- Metro 或 JS 运行时问题：先看终端日志和 React Native 红屏信息。
- Android 原生问题：使用 Android Studio Logcat 或 `adb logcat`，重点过滤 `ReactNativeJS`、`AndroidRuntime`、`LineCode`、`RNLlama`。
- 热更新问题：检查 `dist/hot-update/payload/manifest.json`、bundle hash、`base.txt` JSON 和应用内更新错误报告。
- 存储问题：检查设置迁移、AsyncStorage key、SQLite 初始化和数据清理路径。
- SSH 问题：先用系统 `ssh` 验证 host、port、username、password/key，再检查应用内权限确认状态。

排查时不要把本地日志、设备私有路径、API Key、Cookie、模型文件或 APK 提交到仓库。

## 11. Git 忽略与索引清理

仓库根 `.gitignore` 已按以下类别维护：

- 本地环境与密钥：`.env*`、签名配置、keystore。
- 依赖与缓存：`node_modules/`、CocoaPods、Gradle、Metro 和测试缓存。
- 构建产物：`build/`、`dist/`、APK/AAB/IPA、JS bundle。
- 模型和本地 runtime：`models/`、`*.gguf`、`*.safetensors`、Hexagon assets。
- 本地工具数据：`.agents/`、`.claude/`、`.trae/`、`.codex/`、热更新管理器 runtime 数据。

如果生成物只是被 `git add` 进暂存区，还没有提交，用：

```sh
git restore --staged <path>
```

如果文件已经被 Git 跟踪，但现在应该交给 `.gitignore` 管理，用：

```sh
git rm --cached <path>
```

再运行：

```sh
git status --short --ignored
git ls-files -ci --exclude-standard
```

`git ls-files -ci --exclude-standard` 没有输出时，说明当前没有“已跟踪但已被忽略规则覆盖”的文件。

## 12. 代码风格

- TypeScript + React 函数组件。
- 两空格缩进、单引号、分号，遵循 ESLint/Prettier 配置。
- 组件使用 PascalCase，hooks 使用 `useSomething`，service 使用 `SomethingService`。
- 优先使用现有 UI primitive、主题 token 和服务层工具。
- 不在页面里直接堆副作用；持久化、网络、文件系统、SSH 和热更新逻辑放到 `services/`。
- 修改公共类型或消息协议时，同时检查调用点、持久化兼容和测试。

## 13. 提交与 PR

提交信息建议使用 Conventional Commit：

```text
feat(agent): add pipeline execution
fix(mcp): persist interrupted tool state
refactor(chat): isolate stream update buffer
docs: update development guide
```

PR 或变更说明应包含：

- 改动目的和核心行为变化。
- 关键文件。
- 已运行的测试或无法运行的原因。
- UI 改动的截图或录屏。
- 是否涉及 Android/iOS 原生、存储迁移、AI provider 行为、工具权限或热更新。

安全相关改动需要明确说明写文件、删文件、启动服务、执行命令、发送历史 reasoning 或访问远端 API 的行为边界。
