// Keep the long-form tutorials as Markdown strings so they render exactly like the docs.
export type TutorialVariant = 'beginner' | 'professional';

export interface TutorialDocument {
  variant: TutorialVariant;
  title: string;
  subtitle: string;
  markdown: string;
}

export const beginnerTutorialMarkdown = `# LineCode 零基础使用教程

> 适合对象：第一次接触 API、大模型、Termux、SSH、MCP 的用户。  
> 目标：照着做，最终可以在手机里让 AI 聊天、读项目、改代码、运行命令、接入工具。

---

## 0. 先认识几个词

### LineCode 是什么

LineCode 是一个手机上的 AI 编程助手。你可以把它理解成：

- 一个聊天窗口：你在这里和 AI 对话。
- 一个模型管理器：告诉应用用哪个大模型。
- 一个项目管理器：告诉 AI 要看哪个文件夹。
- 一个命令执行器：让 AI 可以运行命令，比如 \`npm test\`。
- 一个工具/MCP 管理器：给 AI 增加更多能力。

### 什么是大模型

大模型就是回答你问题的 AI，例如 OpenAI、Claude、Gemini、Qwen、DeepSeek，或者你自己手机里的 GGUF 本地模型。

LineCode 本身不是模型。你需要先配置一个模型，应用才能回复。

### 什么是 API Key

API Key 是服务商给你的“钥匙”。应用拿着这把钥匙去调用大模型。

请不要把 API Key 发给别人，不要截图公开，不要提交到 Git 仓库。

### 什么是 Base URL

Base URL 是大模型接口地址。

常见格式：

\`\`\`text
https://api.example.com/v1
\`\`\`

如果是 OpenAI 兼容接口，通常必须以 \`/v1\` 结尾。

错误示例：

\`\`\`text
https://api.example.com
https://api.example.com/v1/chat/completions
\`\`\`

### 什么是模型 ID

模型 ID 是真正要调用的模型名称。

示例：

\`\`\`text
gpt-4.1
claude-sonnet-4
qwen-plus
deepseek-chat
\`\`\`

具体填什么，要看你的服务商文档或模型列表。

---

## 1. 第一次启动应该做什么

建议按这个顺序：

1. 进入应用。
2. 授予文件权限。
3. 打开“设置”。
4. 添加一个大模型。
5. 回聊天页，选择模型。
6. 发送一句“你好”。
7. 如果要让 AI 改代码，再配置项目和执行环境。
8. 如果要运行命令，配置 Termux 或 SSH。
9. 如果要增加外部工具，再添加 MCP。

不要一开始就让 AI 改项目。先确认模型能正常回复。

---

## 2. 接入在线大模型

### 2.1 打开添加模型页面

路径：

\`\`\`text
聊天页 → 右上角更多/设置 → 模型 → 添加模型
\`\`\`

如果有预设服务商，优先选择预设。没有就选择自定义或 OpenAI 兼容。

### 2.2 需要填写哪些内容

#### 名称

名称只给你自己看。

示例：

\`\`\`text
我的 OpenAI
公司中转 Claude
DeepSeek
\`\`\`

#### Base URL

这是接口地址。

OpenAI 兼容接口通常写：

\`\`\`text
https://你的服务商域名/v1
\`\`\`

不要写成：

\`\`\`text
https://你的服务商域名/v1/chat/completions
\`\`\`

因为应用会自己拼接请求路径。

#### API Key

填服务商提供的 Key。

一般长得像：

\`\`\`text
sk-xxxxxxxxxxxxxxxx
\`\`\`

不同服务商格式可能不同。

#### 模型 ID

如果页面支持“查询”，可以先点查询，再从列表里选。

如果查询失败，不一定代表不能用。很多代理服务不支持模型列表接口。这时可以选择“自定义 ID”，手动输入服务商文档里的模型名。

### 2.3 保存并测试

1. 点保存。
2. 回模型列表。
3. 点选刚添加的模型。
4. 回聊天页。
5. 发送：

\`\`\`text
你好，请用一句话回复我。
\`\`\`

如果能回复，说明模型配置成功。

### 2.4 常见错误

#### 401 或 403

通常是 API Key 错了、过期了、没有权限、余额不足。

检查：

- Key 是否复制完整。
- 前后有没有多余空格。
- 服务商账户是否可用。
- 模型是否需要额外开通。

#### 404

通常是 Base URL 或模型 ID 错了。

检查：

- Base URL 是否多写了 \`/chat/completions\`。
- OpenAI 兼容接口是否以 \`/v1\` 结尾。
- 模型 ID 是否真实存在。

#### 查询模型失败

不一定影响聊天。

解决：

- 改用自定义模型 ID。
- 直接手动输入服务商给你的模型名。

---

## 3. 接入本地 GGUF 模型

> 只有“本地模型版”安装包支持本地模型。普通包可能会提示不支持。

### 3.1 准备 GGUF 文件

本地模型文件必须是 \`.gguf\`。

示例文件名：

\`\`\`text
Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf
\`\`\`

如果文件不是 \`.gguf\`，不能作为本地模型导入。

### 3.2 添加本地模型

路径：

\`\`\`text
设置 → 模型 → 添加模型 → 本地
\`\`\`

填写：

- 名称：给自己看的名字。
- 模型文件：选择 \`.gguf\` 文件。
- 上下文长度：新手建议先填 \`4096\`。
- 加速：先选“自动”。

### 3.3 导入很慢怎么办

GGUF 文件可能几百 MB 到几十 GB。应用会导入到私有目录，所以需要等待。

建议：

- 保持应用前台。
- 不要锁屏。
- 确保手机剩余空间足够。

### 3.4 本地模型选多大

手机上建议：

- 入门：1.5B、3B。
- 中等手机：7B Q4。
- 大内存旗舰：可以尝试更大，但不保证稳定。

如果加载失败：

1. 换更小模型。
2. 降低上下文长度。
3. 加速改成 CPU。
4. 确认文件确实是 GGUF。

---

## 4. 配置 Termux，让 AI 在手机本机运行命令

### 4.1 Termux 是什么

Termux 是 Android 上的 Linux 命令行环境。

配置好后，AI 可以在手机本机执行命令，例如：

\`\`\`bash
pwd
ls
npm install
npm test
python script.py
\`\`\`

### 4.2 安装 Termux

建议安装 F-Droid 版本 Termux。不建议使用长期未更新的旧版应用商店 Termux。

### 4.3 初始化 Termux

打开 Termux，执行：

\`\`\`bash
pkg update && pkg upgrade
\`\`\`

安装常用工具：

\`\`\`bash
pkg install openssh git nodejs python ripgrep
\`\`\`

如果你做 Android/Node/前端项目，通常还会用到：

\`\`\`bash
pkg install clang make cmake
\`\`\`

### 4.4 允许外部应用调用 Termux

在 Termux 里执行：

\`\`\`bash
mkdir -p ~/.termux
printf 'allow-external-apps = true\\n' > ~/.termux/termux.properties
\`\`\`

然后：

1. 完全退出 Termux。
2. 从最近任务里划掉 Termux。
3. 重新打开 Termux。

### 4.5 配置 SSH 服务

在 Termux 中设置密码：

\`\`\`bash
passwd
\`\`\`

启动 SSH：

\`\`\`bash
sshd
\`\`\`

Termux 的 SSH 端口通常是 \`8022\`，本机地址通常是 \`127.0.0.1\`。

用户名可以在 Termux 里执行：

\`\`\`bash
whoami
\`\`\`

### 4.6 在 LineCode 里连接 Termux

在应用里打开相关设置页，选择本地/Termux 或 SSH 执行方式。

常见填写：

\`\`\`text
Host: 127.0.0.1
Port: 8022
Username: Termux 里 whoami 的输出
Password: 你 passwd 设置的密码
\`\`\`

保存后测试连接。

### 4.7 测试命令

回聊天页，对 AI 说：

\`\`\`text
请运行 pwd，然后告诉我当前目录。
\`\`\`

如果出现确认框，确认它只是在运行 \`pwd\`，然后允许。

能看到输出就说明 Termux 基本可用。

---

## 5. 配置远程 SSH

### 5.1 什么时候用 SSH

如果你希望 AI 操作电脑、服务器、NAS、远程开发机，就用 SSH。

例如：

- 你的代码在电脑上。
- 手机性能不够。
- 项目依赖很大，不适合放手机。
- 需要运行后端服务或构建任务。

### 5.2 远程机器需要准备什么

远程机器要开启 SSH 服务。

你需要知道：

\`\`\`text
Host: 服务器 IP 或域名
Port: SSH 端口，通常 22
Username: 用户名
Password 或 Private Key: 密码或私钥
\`\`\`

### 5.3 推荐先做的测试

连接成功后，不要马上让 AI 改代码。

先让它执行：

\`\`\`bash
pwd
ls
whoami
git status
\`\`\`

确认：

- 当前目录对不对。
- 用户对不对。
- 项目是不是你想操作的项目。

### 5.4 SSH 安全建议

强烈建议：

- 给 AI 单独创建一个用户。
- 不要给它 root 密码。
- 不要默认允许 sudo。
- 重要项目先确认有 Git 记录。
- 让 AI 改文件前先让它说明计划。

---

## 6. 打开或创建项目

### 6.1 项目是什么

项目就是 AI 读写文件的工作目录。

如果项目选错，AI 可能会看错文件、改错文件。

### 6.2 创建项目

适合测试。路径通常在应用私有目录里。优点是不容易影响你已有文件。

### 6.3 打开外部项目

适合真实开发。

Android 可能会要求文件权限：

- Android 11 及以上：可能需要“管理所有文件”。
- Android 10 及以下：需要读写存储权限。

授权后，选择你的项目根目录。

### 6.4 每次开始任务前先确认目录

建议对 AI 说：

\`\`\`text
先只读检查当前项目目录，运行 pwd 和列出根目录文件，不要修改任何文件。
\`\`\`

确认无误后再继续。

---

## 7. 权限模式

聊天页顶部可以选择权限模式。

### 只读

AI 只能读取和分析。适合让 AI 看代码、找 bug、给方案。

### 确认

危险操作会问你。适合日常使用。新手建议默认使用这个。

### 自动

大多数操作自动执行。适合项目有 Git、任务风险明确、可回滚的场景。

不要在陌生项目或生产服务器上一上来就用自动。

---

## 8. 添加 MCP 和扩展

### 8.1 MCP 是什么

MCP 可以理解为“给 AI 装工具插件”。

比如 MCP 可以让 AI：

- 查数据库。
- 控制浏览器。
- 访问某个服务。
- 调用你自己的脚本。
- 使用外部知识库。

### 8.2 添加 MCP 需要什么

一个 MCP 通常需要：

\`\`\`text
名称
启动命令
参数
环境变量
\`\`\`

例如某个 MCP 文档可能要求：

\`\`\`bash
node /path/to/server.js
\`\`\`

那你就要把命令和参数填到应用里。

### 8.3 环境变量是什么

环境变量常用于放密钥。

例如：

\`\`\`text
API_KEY=xxxx
DATABASE_URL=xxxx
\`\`\`

不要把这些密钥发给别人。

### 8.4 添加后怎么测试

添加 MCP 后，回聊天页，先问：

\`\`\`text
你现在能使用哪些工具？先不要调用，只列出来。
\`\`\`

然后再让它做一个只读测试。不要一开始就让新 MCP 执行写入或删除。

---

## 9. 常用功能速查

### 清空对话

聊天页三个点 → 清空对话。

### 压缩上下文

聊天变长后，三个点 → 压缩上下文。

### 查看教程

聊天页三个点 → 使用教程。

可以选择新手教程或专业教程。

### 实验性功能

设置 → 实验性功能。

这里放不够稳定、可能因机型不同效果不同的功能。例如实验性键盘避让。

---

## 10. 推荐新手工作流

### 让 AI 看代码

\`\`\`text
请先只读分析这个项目结构，不要修改文件。告诉我主要目录和启动方式。
\`\`\`

### 让 AI 修 bug

\`\`\`text
请先定位问题，不要修改文件。找到原因后给我修改计划，我确认后再改。
\`\`\`

### 让 AI 修改代码

\`\`\`text
请按最小改动修复这个问题。修改前说明会改哪些文件。修改后运行相关测试。
\`\`\`

### 让 AI 运行命令

安全命令示例：

\`\`\`bash
pwd
ls
git status
npm test
\`\`\`

需要谨慎的命令：

\`\`\`bash
rm -rf
sudo
curl ... | sh
chmod -R
mv 大范围目录
\`\`\`

---

## 11. 出问题怎么排查

### AI 不回复

检查：是否选择模型、API Key、Base URL、模型 ID、网络、余额和限流。

### AI 不能运行命令

检查：Termux 或 SSH 是否配置好、连接测试是否通过、权限模式是否允许 shell、Termux 是否在后台被杀。

### AI 改错地方

立刻停止，让它执行：

\`\`\`bash
pwd
git status
\`\`\`

确认项目目录。如果有 Git，可以回滚。

### 输入框被输入法挡住

先使用默认设置。如果机型有问题，可以打开：

\`\`\`text
设置 → 实验性功能 → 实验性键盘避让
\`\`\`

如果开启后更严重，马上关闭。
`;

export const professionalTutorialMarkdown = `# LineCode 专业使用手册

> 适合对象：开发者、运维、模型服务维护者、MCP/Agent 使用者。  
> 目标：完整理解 LineCode 的模型接入、执行后端、项目边界、权限模式、MCP 扩展、排障与安全策略。

---

## 1. 总体架构

LineCode 的核心链路可以抽象为：

\`\`\`text
React Native UI
  ↓
Conversation / Settings / Project State
  ↓
Model Provider Adapter
  ↓
Tool Planning / Tool Call Parsing
  ↓
Permission Gate
  ↓
Local Filesystem / Termux / SSH / MCP Server
  ↓
Result Streaming Back To Model
\`\`\`

关键概念：

| 层级 | 作用 |
| --- | --- |
| Model Provider | 负责调用在线模型或本地 GGUF 模型 |
| Project Workspace | 文件工具的默认根目录 |
| Permission Mode | 控制读写、shell、危险操作是否自动执行 |
| Execution Backend | Termux 或 SSH，负责 shell 执行 |
| MCP / Extension | 外部工具能力注册与调用 |
| Conversation Context | 消息、工具结果、压缩上下文和模型状态 |

推荐生产工作流：配置模型 → 配置执行环境 → 选择项目根目录 → readonly/confirm 建立环境事实 → 输出修改计划 → 执行最小改动 → 运行测试和 lint → 审查 diff。

---

## 2. Model Provider 配置

### 2.1 Provider 类型

| Provider | 典型用途 | 注意事项 |
| --- | --- | --- |
| OpenAI compatible | 大多数中转服务、OpenAI 兼容 API | Base URL 通常到 \`/v1\` |
| Anthropic | Claude / Anthropic 协议代理 | Base URL 按页面提示到 Anthropic 协议入口 |
| Codex / Responses | 支持 Responses API 的模型后端 | 不要把 Base URL 填到 \`/responses\` |
| Local | GGUF 本地推理 | 需要本地模型版构建 |

### 2.2 OpenAI 兼容接口

正确 Base URL 示例：

\`\`\`text
https://api.openai.com/v1
https://api.example.com/v1
https://gateway.company.internal/v1
\`\`\`

错误示例：

\`\`\`text
https://api.example.com
https://api.example.com/v1/chat/completions
https://api.example.com/chat/completions
\`\`\`

原因：应用内部会按 provider 拼接具体 endpoint。用户只需要填写 API root。

### 2.3 Anthropic 协议

Anthropic 模型通常使用 Messages API。若你使用的是代理，确认代理是否支持 messages endpoint、streaming、tool use / tool result、system prompt、max tokens、stop reason。

常见问题：

| 现象 | 可能原因 |
| --- | --- |
| 404 | Base URL 路径不符合代理要求 |
| 400 | 请求格式与代理支持的 Anthropic 版本不匹配 |
| 工具调用失败 | 代理未完整实现 tool use |
| 流式中断 | SSE 实现或网关超时问题 |

### 2.4 模型列表查询

很多中转服务没有实现模型列表接口。模型列表查询失败不等于聊天不可用。

专业排障顺序：

1. 用服务商控制台确认模型 ID。
2. 在应用里选择自定义模型 ID。
3. 发送最小 prompt。
4. 再测试 tool calling。

### 2.5 API Key 安全

不要把 Key 写进项目文件，不要在聊天中粘贴真实 Key，不要让 AI 读取包含 Key 的 \`.env\`，除非任务明确需要。

---

## 3. 本地 GGUF 推理

### 3.1 运行条件

本地推理需要本地模型版 APK、足够内存、可读 GGUF 文件、可用 llama.rn native 模块。

### 3.2 GGUF 导入流程

推荐策略：

1. 用户通过 SAF 选择 \`.gguf\`。
2. 应用复制到私有目录。
3. 配置保存本地路径、上下文长度、加速策略。
4. 运行时通过私有路径加载。

这样可以避免 content URI 权限过期、外部文件移动、Android 文件权限差异导致的加载失败。

### 3.3 模型规模建议

| 设备 | 建议模型 |
| --- | --- |
| 低端/老设备 | 1.5B Q4 / 3B Q4 |
| 中端设备 | 3B Q4 / 7B Q4 |
| 高内存旗舰 | 7B Q4/Q5，谨慎尝试 14B |

上下文建议：\`4096 → 8192 → 16384\`，逐步增加，不要一开始拉满。

### 3.4 加速策略

| 选项 | 说明 |
| --- | --- |
| auto | 优先尝试可用加速，失败回退 |
| CPU | 最稳定基线 |
| NPU | 对 SoC、驱动、模型结构敏感 |

排障时先固定 CPU。如果 CPU 可用而 NPU 不可用，说明模型或设备加速链路不兼容。

---

## 4. Termux 执行后端

### 4.1 推荐安装

推荐 F-Droid Termux。

初始化：

\`\`\`bash
pkg update && pkg upgrade
pkg install openssh git nodejs python ripgrep
\`\`\`

常见开发依赖：

\`\`\`bash
pkg install clang make cmake pkg-config
\`\`\`

### 4.2 RUN_COMMAND 授权

Termux 需要允许外部应用调用：

\`\`\`bash
mkdir -p ~/.termux
printf 'allow-external-apps = true\\n' > ~/.termux/termux.properties
\`\`\`

重启 Termux 后，Android 侧授予：\`com.termux.permission.RUN_COMMAND\`。

### 4.3 Termux SSH

设置密码并启动 sshd：

\`\`\`bash
passwd
sshd
ss -ltnp | grep 8022
\`\`\`

连接参数通常为：

\`\`\`text
Host: 127.0.0.1
Port: 8022
Username: whoami 的输出
Password: passwd 设置的密码
\`\`\`

### 4.4 termux-setup-storage

如果 Termux 需要访问共享存储：

\`\`\`bash
termux-setup-storage
\`\`\`

常见路径：\`~/storage/shared\`、\`/storage/emulated/0\`。LineCode 的 Android 文件权限与 Termux storage 权限是两套权限，不要混淆。

---

## 5. SSH 执行后端

### 5.1 适用场景

SSH 后端适合远程服务器开发、桌面开发机、NAS、重型构建、手机性能不足的项目。

### 5.2 最小可用环境

远端建议安装 git、ripgrep、node/npm/pnpm、python、构建工具链。

建立环境事实：

\`\`\`bash
pwd
whoami
uname -a
git status
node -v
python --version
\`\`\`

### 5.3 权限隔离

建议为 AI 创建专用用户：

\`\`\`bash
sudo adduser linecode
\`\`\`

生产服务器上建议禁止无密码 sudo、使用独立项目目录、配置磁盘配额或容器、使用 Git 保护可回滚性、对删除/迁移/部署命令使用 confirm。

### 5.4 私钥策略

使用专用 key，不复用个人主 key，给 key 设置 passphrase。服务端 authorized_keys 可以限制来源和命令。

---

## 6. Project Workspace 与路径边界

### 6.1 Workspace 类型

| 类型 | 特点 |
| --- | --- |
| 应用私有项目 | 安全、适合测试、路径由应用管理 |
| 外部目录 | 真实项目、需要 Android 文件权限 |
| SSH 工作目录 | 远端路径，和手机本地无关 |

### 6.2 外部目录权限

Android 11+ 使用 \`MANAGE_EXTERNAL_STORAGE\`。Android 10 及以下使用 \`READ_EXTERNAL_STORAGE\` / \`WRITE_EXTERNAL_STORAGE\`。

### 6.3 路径安全

让模型执行写操作前，先要求它确认：

\`\`\`bash
pwd
git status
find . -maxdepth 2 -type f | head
\`\`\`

如果输出的路径不是预期项目，停止任务。

---

## 7. 权限模式设计

### 7.1 readonly

允许读文件、搜索、分析。禁止写文件、删除、shell 写操作。适合审计和规划。

### 7.2 confirm

对敏感操作弹确认。适合默认开发。确认时检查 cwd、是否删除文件、是否访问网络、是否安装依赖、是否写入敏感路径。

### 7.3 auto

减少确认次数。仅推荐用于本地可回滚仓库、小范围改动、任务边界明确的场景。不推荐用于生产服务器、大范围重构、数据迁移、删除文件、未读懂的 shell 脚本。

---

## 8. MCP 扩展

### 8.1 MCP 是什么

MCP server 为模型暴露工具。LineCode 通过配置 MCP，让模型获得额外能力。常见 transport：stdio、HTTP。

### 8.2 stdio MCP 配置模型

典型结构：

\`\`\`json
{
  "name": "my-tool",
  "command": "node",
  "args": ["/path/to/server.js"],
  "env": {
    "API_KEY": "xxx"
  }
}
\`\`\`

或：

\`\`\`json
{
  "name": "python-tool",
  "command": "python",
  "args": ["-m", "package.server"],
  "env": {}
}
\`\`\`

### 8.3 添加 MCP 前的检查

先在同一个执行环境中手动验证：

\`\`\`bash
node /path/to/server.js
python -m package.server
\`\`\`

如果命令本身无法启动，应用里也不会成功。

### 8.4 MCP 安全

确认它能读哪些数据、能写哪些数据、是否会访问网络、是否需要密钥、是否有删除/修改能力。

首次使用建议：

\`\`\`text
列出你可用的 MCP 工具，不要调用。
\`\`\`

然后做只读测试。

---

## 9. Agent 与长任务

适合 Agent 的任务：大型代码库探索、多方案对比、测试失败定位、文档生成、分阶段实现。

长任务建议 prompt：

\`\`\`text
请先只读分析，不要修改文件。
输出：
1. 相关文件列表
2. 根因判断
3. 修改计划
4. 风险
我确认后再执行。
\`\`\`

执行阶段：

\`\`\`text
按刚才计划做最小改动。
完成后运行相关测试，给出修改文件、测试命令和结果。
\`\`\`

---

## 10. 输入法、虚拟导航与实验性键盘避让

默认策略应依赖系统：

\`\`\`text
android:windowSoftInputMode="adjustResize"
SafeArea bottom inset
\`\`\`

实验性策略：

\`\`\`text
PopupWindow + keyboard frame event + measureInWindow
\`\`\`

该策略可能在部分机型改善遮挡，也可能在部分系统上误判键盘/导航栏高度，导致输入栏跌落或飞起。

入口：

\`\`\`text
设置 → 实验性功能 → 实验性键盘避让
\`\`\`

建议默认关闭。只有默认策略异常时开启。开启后若更严重，立即关闭。

---

## 11. 排障手册

### 11.1 模型调用失败

| 错误 | 检查项 |
| --- | --- |
| 401 | API Key、账户权限、Key 是否过期 |
| 403 | 服务商权限、模型是否开通、区域限制 |
| 404 | Base URL、模型 ID、协议路径 |
| 429 | 限流、余额、并发限制 |
| 5xx | 服务商故障、代理故障 |
| 流式断开 | 网关超时、SSE 实现、网络不稳定 |

### 11.2 Termux 无法执行

检查：

\`\`\`bash
cat ~/.termux/termux.properties
which sshd
ss -ltnp | grep 8022
whoami
\`\`\`

应用侧检查 RUN_COMMAND 权限、Termux 是否被系统杀后台、Host/Port/Username/Password。

### 11.3 SSH 无法连接

从另一台机器测试：

\`\`\`bash
ssh -p PORT USER@HOST
\`\`\`

检查防火墙、端口映射、密码/私钥、用户 shell、服务器 sshd_config。

### 11.4 文件工具异常

检查：

\`\`\`bash
pwd
git status
ls -la
\`\`\`

确认 workspace 是否正确。

### 11.5 MCP 不出现或不能调用

检查 command 是否存在、args 是否正确、env 是否齐全、server 是否能在同环境直接启动、stderr 是否有依赖缺失、transport 是否匹配。

---

## 12. 推荐安全基线

个人项目：

\`\`\`text
权限模式：confirm
执行后端：Termux 或 SSH 普通用户
项目：Git 仓库
操作前：git status
操作后：测试 + diff
\`\`\`

生产服务器：

\`\`\`text
权限模式：readonly 或 confirm
用户：专用低权限用户
禁止：无确认 sudo / rm -rf / 数据迁移
要求：备份、审查、回滚方案
\`\`\`

MCP：

\`\`\`text
先只读验证
密钥最小权限
不要把密钥写进项目
高危工具保持 confirm
\`\`\`
`;

export const tutorialDocuments: Record<TutorialVariant, TutorialDocument> = {
  beginner: {
    variant: 'beginner',
    title: '新手教程',
    subtitle: '零基础，一步一步配置模型、Termux、SSH 和 MCP。',
    markdown: beginnerTutorialMarkdown,
  },
  professional: {
    variant: 'professional',
    title: '专业教程',
    subtitle: '面向开发者的模型协议、执行后端、权限和 MCP 手册。',
    markdown: professionalTutorialMarkdown,
  },
};
