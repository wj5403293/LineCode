# LineCode 专业使用手册

> 适合对象：开发者、运维、模型服务维护者、MCP/Agent 使用者。  
> 目标：完整理解 LineCode 的模型接入、执行后端、项目边界、权限模式、MCP 扩展、排障与安全策略。

---

## 1. 总体架构

LineCode 的核心链路可以抽象为：

```text
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
```

关键概念：

| 层级 | 作用 |
| --- | --- |
| Model Provider | 负责调用在线模型或本地 GGUF 模型 |
| Project Workspace | 文件工具的默认根目录 |
| Permission Mode | 控制读写、shell、危险操作是否自动执行 |
| Execution Backend | Termux 或 SSH，负责 shell 执行 |
| MCP / Extension | 外部工具能力注册与调用 |
| Conversation Context | 消息、工具结果、压缩上下文和模型状态 |

推荐生产工作流：

1. 配置模型。
2. 配置执行环境。
3. 选择项目根目录。
4. 使用 `readonly` 或 `confirm` 建立环境事实。
5. 让模型输出修改计划。
6. 执行最小改动。
7. 运行测试和 lint。
8. 审查 diff。

---

## 2. Model Provider 配置

### 2.1 Provider 类型

应用常见 Provider：

| Provider | 典型用途 | 注意事项 |
| --- | --- | --- |
| OpenAI compatible | 大多数中转服务、OpenAI 兼容 API | Base URL 通常到 `/v1` |
| Anthropic | Claude / Anthropic 协议代理 | Base URL 按页面提示到 Anthropic 协议入口 |
| Codex / Responses | 支持 Responses API 的模型后端 | 不要把 Base URL 填到 `/responses` |
| Local | GGUF 本地推理 | 需要本地模型版构建 |

### 2.2 OpenAI 兼容接口

正确 Base URL 示例：

```text
https://api.openai.com/v1
https://api.example.com/v1
https://gateway.company.internal/v1
```

错误示例：

```text
https://api.example.com
https://api.example.com/v1/chat/completions
https://api.example.com/chat/completions
```

原因：应用内部会按 provider 拼接具体 endpoint。用户只需要填写 API root。

### 2.3 Anthropic 协议

Anthropic 模型通常使用 Messages API。若你使用的是代理，确认代理是否支持：

- messages endpoint。
- streaming。
- tool use / tool result。
- system prompt。
- max tokens。
- stop reason。

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

建议：

- 不要把 Key 写进项目文件。
- 不要在聊天中粘贴真实 Key。
- 不要让 AI 读取包含 Key 的 `.env`，除非任务明确需要。
- 公司代理建议配置最小权限 Key。

---

## 3. 本地 GGUF 推理

### 3.1 运行条件

本地推理需要：

- 安装本地模型版 APK。
- 设备有足够内存。
- GGUF 文件可读。
- llama.rn native 模块可用。

### 3.2 GGUF 导入流程

推荐策略：

1. 用户通过 SAF 选择 `.gguf`。
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

上下文建议：

```text
4096 → 8192 → 16384
```

逐步增加，不要一开始拉满。

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

```bash
pkg update && pkg upgrade
pkg install openssh git nodejs python ripgrep
```

常见开发依赖：

```bash
pkg install clang make cmake pkg-config
```

### 4.2 RUN_COMMAND 授权

Termux 需要允许外部应用调用：

```bash
mkdir -p ~/.termux
printf 'allow-external-apps = true\n' > ~/.termux/termux.properties
```

重启 Termux 后，Android 侧授予：

```text
com.termux.permission.RUN_COMMAND
```

如果外部调用无响应，优先检查：

```bash
cat ~/.termux/termux.properties
```

确认存在：

```text
allow-external-apps = true
```

### 4.3 Termux SSH

设置密码：

```bash
passwd
```

启动 sshd：

```bash
sshd
```

检查端口：

```bash
ss -ltnp | grep 8022
```

连接参数通常为：

```text
Host: 127.0.0.1
Port: 8022
Username: whoami 的输出
Password: passwd 设置的密码
```

### 4.4 termux-setup-storage

如果 Termux 需要访问共享存储：

```bash
termux-setup-storage
```

常见路径：

```text
~/storage/shared
/storage/emulated/0
```

注意：LineCode 的 Android 文件权限与 Termux 的 storage 权限是两套权限，不要混淆。

---

## 5. SSH 执行后端

### 5.1 适用场景

SSH 后端适合：

- 远程服务器开发。
- 桌面开发机。
- NAS。
- 重型构建。
- 手机性能不足的项目。

### 5.2 最小可用环境

远端建议安装：

```bash
git
ripgrep
node / npm / pnpm
python
构建工具链
```

建立环境事实：

```bash
pwd
whoami
uname -a
git status
node -v
python --version
```

### 5.3 权限隔离

建议为 AI 创建专用用户：

```bash
sudo adduser linecode
```

生产服务器上建议：

- 禁止无密码 sudo。
- 使用独立项目目录。
- 配置磁盘配额或容器。
- 使用 Git 保护可回滚性。
- 对删除、迁移、部署命令使用 confirm。

### 5.4 私钥策略

如果使用私钥：

- 使用专用 key。
- 不复用个人主 key。
- 给 key 设置 passphrase。
- 服务端 authorized_keys 可以限制来源和命令。

---

## 6. Project Workspace 与路径边界

### 6.1 Workspace 类型

| 类型 | 特点 |
| --- | --- |
| 应用私有项目 | 安全、适合测试、路径由应用管理 |
| 外部目录 | 真实项目、需要 Android 文件权限 |
| SSH 工作目录 | 远端路径，和手机本地无关 |

### 6.2 外部目录权限

Android 11+：

```text
MANAGE_EXTERNAL_STORAGE
```

Android 10 及以下：

```text
READ_EXTERNAL_STORAGE
WRITE_EXTERNAL_STORAGE
```

### 6.3 路径安全

让模型执行写操作前，先要求它确认：

```bash
pwd
git status
find . -maxdepth 2 -type f | head
```

如果输出的路径不是预期项目，停止任务。

---

## 7. 权限模式设计

### 7.1 readonly

允许：

- 读文件。
- 搜索。
- 分析。

禁止：

- 写文件。
- 删除。
- shell 写操作。

适合审计和规划。

### 7.2 confirm

对敏感操作弹确认。

适合默认开发。

建议确认时检查：

- 命令 cwd。
- 命令是否删除文件。
- 是否访问网络。
- 是否安装依赖。
- 是否写入敏感路径。

### 7.3 auto

减少确认次数。

仅推荐用于：

- 本地可回滚仓库。
- 小范围改动。
- 你明确知道任务边界。

不推荐用于：

- 生产服务器。
- 大范围重构。
- 数据迁移。
- 删除文件。
- 未读懂的 shell 脚本。

---

## 8. MCP 扩展

### 8.1 MCP 是什么

MCP server 为模型暴露工具。LineCode 通过配置 MCP，让模型获得额外能力。

常见 transport：

```text
stdio
HTTP
```

### 8.2 stdio MCP 配置模型

典型结构：

```json
{
  "name": "my-tool",
  "command": "node",
  "args": ["/path/to/server.js"],
  "env": {
    "API_KEY": "xxx"
  }
}
```

或：

```json
{
  "name": "python-tool",
  "command": "python",
  "args": ["-m", "package.server"],
  "env": {}
}
```

### 8.3 添加 MCP 前的检查

先在同一个执行环境中手动验证：

```bash
node /path/to/server.js
```

或：

```bash
python -m package.server
```

如果命令本身无法启动，应用里也不会成功。

### 8.4 MCP 安全

MCP 工具能力可能很高。添加前确认：

- 它能读哪些数据。
- 它能写哪些数据。
- 是否会访问网络。
- 是否需要密钥。
- 是否有删除/修改能力。

首次使用建议：

```text
列出你可用的 MCP 工具，不要调用。
```

然后做只读测试。

---

## 9. Agent 与长任务

### 9.1 适合 Agent 的任务

- 大型代码库探索。
- 多方案对比。
- 测试失败定位。
- 文档生成。
- 分阶段实现。

### 9.2 长任务建议 Prompt

```text
请先只读分析，不要修改文件。
输出：
1. 相关文件列表
2. 根因判断
3. 修改计划
4. 风险
我确认后再执行。
```

执行阶段：

```text
按刚才计划做最小改动。
完成后运行相关测试，给出修改文件、测试命令和结果。
```

### 9.3 压缩上下文

长对话可以使用“三个点 → 压缩上下文”。

建议压缩前让模型总结：

```text
请总结当前任务状态、已改文件、未完成事项、关键约束，便于压缩上下文后继续。
```

---

## 10. 输入法、虚拟导航与实验性键盘避让

默认策略应依赖系统：

```text
android:windowSoftInputMode="adjustResize"
SafeArea bottom inset
```

实验性策略：

```text
PopupWindow + keyboard frame event + measureInWindow
```

该策略可能在部分机型改善遮挡，也可能在部分系统上误判键盘/导航栏高度，导致输入栏跌落或飞起。

入口：

```text
设置 → 实验性功能 → 实验性键盘避让
```

建议：

- 默认关闭。
- 只有默认策略异常时开启。
- 开启后若更严重，立即关闭。

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

```bash
cat ~/.termux/termux.properties
which sshd
ss -ltnp | grep 8022
whoami
```

应用侧检查：

- RUN_COMMAND 权限。
- Termux 是否被系统杀后台。
- Host/Port/Username/Password。

### 11.3 SSH 无法连接

从另一台机器测试：

```bash
ssh -p PORT USER@HOST
```

检查：

- 防火墙。
- 端口映射。
- 密码/私钥。
- 用户 shell。
- 服务器 sshd_config。

### 11.4 文件工具异常

检查：

```bash
pwd
git status
ls -la
```

确认 workspace 是否正确。

### 11.5 MCP 不出现或不能调用

检查：

- command 是否存在。
- args 是否正确。
- env 是否齐全。
- server 是否能在同环境直接启动。
- stderr 是否有依赖缺失。
- transport 是否匹配。

---

## 12. 推荐安全基线

个人项目：

```text
权限模式：confirm
执行后端：Termux 或 SSH 普通用户
项目：Git 仓库
操作前：git status
操作后：测试 + diff
```

生产服务器：

```text
权限模式：readonly 或 confirm
用户：专用低权限用户
禁止：无确认 sudo / rm -rf / 数据迁移
要求：备份、审查、回滚方案
```

MCP：

```text
先只读验证
密钥最小权限
不要把密钥写进项目
高危工具保持 confirm
```
