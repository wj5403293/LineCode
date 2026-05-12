# Codex Protocol Notes

## Source Snapshot

- Repository: `https://github.com/openai/codex`
- Local clone: `/home/LangLang/code/ts/codex`
- Commit inspected: `79c65f8`
- Main files read:
  - `codex-rs/codex-api/src/common.rs`
  - `codex-rs/codex-api/src/endpoint/responses.rs`
  - `codex-rs/codex-api/src/sse/responses.rs`
  - `codex-rs/core/src/client.rs`
  - `codex-rs/protocol/src/models.rs`
  - `codex-rs/app-server/README.md`
  - `codex-rs/app-server-protocol/src/jsonrpc_lite.rs`
  - `codex-rs/app-server-protocol/src/protocol/v2/*.rs`
  - `sdk/typescript/src/*.ts`

## High-Level Architecture

Codex has two protocol layers:

1. Model layer: Codex talks to OpenAI through the Responses API, not plain `chat/completions`. The transport is HTTP SSE by default, with an optional Responses WebSocket path.
2. App layer: rich clients talk to `codex app-server` through JSON-RPC-like JSONL over stdio, or WebSocket over a Unix socket. The wire shape intentionally omits the usual `"jsonrpc": "2.0"` field.

The TypeScript SDK does not directly implement the Responses API. It spawns the Codex CLI with `codex exec --experimental-json`, writes the user input to stdin, then parses JSONL events from stdout.

## Responses API Request Shape

`ResponsesApiRequest` is the canonical model request:

```json
{
  "model": "gpt-5.1-codex",
  "instructions": "...",
  "input": [],
  "tools": [],
  "tool_choice": "auto",
  "parallel_tool_calls": true,
  "reasoning": { "effort": "medium", "summary": "auto" },
  "store": true,
  "stream": true,
  "include": [],
  "text": {},
  "client_metadata": {}
}
```

Important differences from Chat Completions:

- Conversation state is a list of `ResponseItem`, not `{role, content}` messages only.
- Tool outputs are explicit input items such as `function_call_output` and `custom_tool_call_output`.
- The app must preserve item order. A typical loop is assistant call item -> local tool execution -> matching output item by `call_id` -> next Responses request.
- WebSocket can use `previous_response_id` and send only incremental input, but Codex only does that when the new request is a strict extension of the previous request.
- `x-codex-turn-state` is captured from the response headers and replayed only within the same turn. Reusing it across turns is explicitly invalid.

## Stream Event Lifecycle

Codex parses these SSE events:

- `response.created`
- `response.output_item.added`
- `response.output_item.done`
- `response.output_text.delta`
- `response.custom_tool_call_input.delta`
- `response.reasoning_summary_text.delta`
- `response.reasoning_text.delta`
- `response.reasoning_summary_part.added`
- `response.completed`
- `response.failed`
- `response.incomplete`

`response.completed` carries `response_id`, token usage, and optional `end_turn`. A client must not end the whole agent turn just because one tool item completed. If the output contains a tool call, execute the tool, append the proper output item, and continue until the model produces a terminal answer or the turn is interrupted/failed.

## Response Items and Tools

`ResponseItem` includes:

- `message`: normal assistant/user message content, with optional `phase` such as commentary or final answer.
- `reasoning`: summary and optional raw reasoning content.
- `function_call` / `function_call_output`: structured function tools.
- `custom_tool_call` / `custom_tool_call_output`: freeform tools such as patch application.
- `local_shell_call`: model-requested local shell action.
- `web_search_call`, `tool_search_call`, image generation, and related output items.

For LineAI, the key point is that Codex-style tool continuation is item-based. Current OpenAI-compatible `chat/completions` logic cannot be treated as Codex-compatible unless it can serialize and replay these item types correctly.

## App-Server JSON-RPC v2

`codex app-server` protocol flow:

1. Client sends `initialize`, then an `initialized` notification.
2. Client creates or resumes a thread with `thread/start`, `thread/resume`, or `thread/fork`.
3. Client starts a user turn with `turn/start`.
4. Server streams notifications: `turn/started`, `item/started`, item deltas, `item/completed`, `turn/completed`.
5. Client may call `turn/steer` to add input to an active turn, or `turn/interrupt` to stop it.

Thread start parameters include model/provider/cwd, approval policy, sandbox or permission profile, base/developer instructions, personality, and dynamic tools. Turn start parameters include `threadId`, structured input items, optional model overrides, reasoning effort/summary, output schema, cwd, sandbox/permissions, service tier, and collaboration mode.

## App-Server Items

The app-server converts lower-level Responses events into UI-friendly `ThreadItem` notifications:

- `userMessage`
- `agentMessage`
- `reasoning`
- `commandExecution`
- `fileChange`
- `mcpToolCall`
- `collabToolCall`
- `webSearch`
- `imageView`
- `contextCompaction`

Each item follows:

```text
item/started -> zero or more item-specific deltas -> item/completed
```

For UI correctness, render `item/started` immediately, stream deltas into the same item, and treat `item/completed` as authoritative final state.

## Approvals and Blocking Requests

Approvals are server-initiated JSON-RPC requests. The client must answer before the server continues:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`
- `mcpServer/elicitation/request`
- experimental `item/tool/call` for dynamic tools

Command approval order:

1. `item/started` for `commandExecution`
2. `item/commandExecution/requestApproval`
3. client response such as `{ "decision": "accept" }` or `{ "decision": "decline" }`
4. `serverRequest/resolved`
5. final `item/completed`

This matches the behavior LineAI needs for shell confirmation: the MCP/tool loop must pause while waiting for user approval, then resume after the decision is sent.

## Standalone Command Protocol

`command/exec` runs a command outside a thread/turn. It supports:

- argv vector command
- optional `processId`
- PTY mode with terminal size
- streaming stdin/stdout/stderr
- `command/exec/write`
- `command/exec/resize`
- `command/exec/terminate`
- `command/exec/outputDelta` notifications with base64 output chunks

This is useful for validation utilities, but agent-requested shell commands normally appear as turn items and go through the approval lifecycle above.

## MCP and Dynamic Tools

Codex has two relevant extension paths:

- MCP servers configured in Codex, surfaced as `mcpToolCall` items and MCP elicitations/approvals.
- Experimental `dynamicTools`, enabled by `initialize.params.capabilities.experimentalApi = true`, where the app-server sends `item/tool/call` requests to the client and expects structured content items in the response.

Dynamic tool names follow Responses function-tool constraints. Namespaces must also avoid reserved runtime namespaces such as `functions`, `web`, `container`, `terminal`, `tool_search`, and related built-ins.

## SDK Behavior

The TypeScript SDK wraps the CLI:

- `Codex.startThread()` creates a local SDK thread object.
- `thread.run()` buffers events until completion.
- `thread.runStreamed()` exposes an async generator of events.
- Events include `thread.started`, `turn.started`, `item.started`, `item.updated`, `item.completed`, `turn.completed`, `turn.failed`, and `error`.
- `resumeThread(threadId)` resumes sessions persisted by Codex under the user's Codex home.

SDK thread options become CLI flags or config overrides, for example `--model`, `--sandbox`, `--cd`, `--image`, `approval_policy`, `model_reasoning_effort`, `web_search`, and `sandbox_workspace_write.network_access`.

## Implications for LineAI

LineAI currently has an OpenAI-compatible Chat Completions processor plus a local MCP-style tool loop. That is not enough for full Codex protocol support.

Minimum viable support choices:

1. CLI integration: run `codex exec --experimental-json` through a host shell or SSH environment and render JSONL events. This is closest to the TypeScript SDK, but mobile packaging/process execution is the hard part.
2. App-server integration: launch `codex app-server`, perform `initialize`, manage threads/turns, approvals, and item notifications. This gives the richest UI protocol.
3. Direct Responses implementation: add a new processor using `/responses` SSE/WebSocket, implement `ResponseItem` history, tool output items, reasoning deltas, `x-codex-turn-state`, and multi-request turn continuation.

For the current MCP bug class, the important rule is: after a tool call, do not mark the assistant turn complete. Store the pending call, execute/confirm it, append the matching output item/message, and continue the model loop until a real terminal completion is received.
