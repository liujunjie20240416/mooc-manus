# MOOC-Manus 项目架构：运行时循环详解

---

## 系统整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js / Vue)                 │
│                                                                  │
│  ChatInput → SSE Stream Parser → Timeline Builder → UI Render   │
│     │                              ▲                             │
│     │  POST /api/sessions/:id/chat │ SSE events                  │
└─────┼──────────────────────────────┼─────────────────────────────┘
      │                              │
┌─────┼──────────────────────────────┼─────────────────────────────┐
│     ▼                              │          BACKEND (FastAPI)  │
│  ┌──────────────────────┐    ┌─────┴──────┐                      │
│  │   AgentService.chat()│◄───│ EventMapper │ SSE Serialization   │
│  │   (Application Layer)│    └────────────┘                      │
│  └──────────┬───────────┘                                        │
│             │                                                    │
│  ┌──────────▼───────────┐                                        │
│  │   AgentTaskRunner    │  ← Bridges Task ↔ PlannerReActFlow     │
│  │   (Domain Service)   │                                        │
│  └──────────┬───────────┘                                        │
│             │                                                    │
│  ┌──────────▼───────────┐    ┌───────────────────┐               │
│  │   PlannerReActFlow   │    │  Redis Streams    │               │
│  │   (State Machine)    │◄──►│  input / output   │               │
│  │                      │    └───────────────────┘               │
│  │  ┌────────────────┐  │                                        │
│  │  │  PlannerAgent  │  │    ┌───────────────────┐               │
│  │  │  (Plan CRUD)   │  │    │   PostgreSQL       │               │
│  │  └────────────────┘  │    │   (sessions JSONB) │               │
│  │  ┌────────────────┐  │    └───────────────────┘               │
│  │  │  ReActAgent    │  │                                        │
│  │  │  (Tool Calling)│  │    ┌───────────────────┐               │
│  │  └────────────────┘  │    │   Docker Sandbox   │               │
│  └──────────────────────┘    │   (code exec)      │               │
│                              └───────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

## 核心数据流概览

```
User Input (browser)
    │
    ▼
[Frontend] POST /api/sessions/{id}/chat  (SSE)
    │
    ▼
[AgentService.chat()]
    │ ① 创建 MessageEvent(role="user")
    │ ② XADD → Redis Stream "task:input:{uuid}"
    │ ③ 调用 task.invoke()
    ▼
[AgentTaskRunner.invoke()]
    │ ④ XREAD ← Redis Stream "task:input:{uuid}" (pop MessageEvent)
    │ ⑤ 同步附件到 Sandbox
    │ ⑥ 调用 PlannerReActFlow.invoke(message)
    ▼
[PlannerReActFlow] ─── 状态机循环 ───
    │
    ├─ PLANNING:   PlannerAgent.create_plan()
    │   ├── LLM 调用 (json_object, tool_choice=none)
    │   └── 产出: PlanEvent(CREATED) + TitleEvent + MessageEvent
    │
    ├─ EXECUTING:  ReActAgent.execute_step()  ← 每步循环
    │   ├── LLM 调用 (json_object + tools)
    │   ├── 产出: StepEvent(STARTED)
    │   │         → ToolEvent(CALLING)  → tool.invoke() → ToolEvent(CALLED)
    │   │         → MessageEvent (步骤结果)
    │   │         → StepEvent(COMPLETED)
    │   └── ReActAgent.compact_memory() (修剪浏览器/推理内容)
    │
    ├─ UPDATING:   PlannerAgent.update_plan()
    │   ├── LLM 调用 (json_object, tool_choice=none)
    │   └── 产出: PlanEvent(UPDATED)
    │
    ├─ SUMMARIZING: ReActAgent.summarize()
    │   ├── 最终 LLM 调用
    │   └── 产出: MessageEvent (最终答案 + 附件列表)
    │
    └─ COMPLETED:  产出 DoneEvent()
    │
    ▼
[AgentTaskRunner] (后处理)
    │ ⑦ ToolEvent 富化: 截图→COS, shell输出, 文件内容, 搜索结果
    │ ⑧ 文件同步: Sandbox → COS
    │ ⑨ _put_and_add_event():
    │    ├── XADD → Redis Stream "task:output:{uuid}"
    │    └── 持久化到 PostgreSQL (JSONB)
    ▼
[AgentService.chat()] (SSE 循环读取)
    │ ⑩ XREAD ← Redis Stream "task:output:{uuid}"
    │ ⑪ JSON 反序列化 → Event
    │ ⑫ EventMapper → SSE 格式
    │ ⑬ yield ServerSentEvent → EventSourceResponse
    ▼
[Frontend] 接收 SSE 事件流
    │ ⑭ parseSSEStream() → 累积到 events[]
    │ ⑮ eventsToTimeline() → TimelineItem[]
    │ ⑯ React 渲染: 聊天气泡 / 工具面板 / 步骤列表 / 计划面板
    ▼
用户看到完整的 Agent 交互过程
```

---

## 示例一：用户纯文本提问

> **用户输入**: "帮我用 Python 写一个冒泡排序，并测试它"

### 第一阶段：前端 → 后端 (消息进入 Redis)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                              │
│                                                                 │
│ 1. 用户在 ChatInput 组件输入文字                                 │
│                                                                 │
│ 2. 点击发送按钮 → handleSend()                                    │
│    src/components/chat-input.tsx                                │
│                                                                 │
│ 3. 调用 sessionApi.chat({                                       │
│      session_id: "abc-123",                                     │
│      message: "帮我用 Python 写一个冒泡排序，并测试它",            │
│      attachments: [],        ← 无附件                            │
│      event_id: "evt-001",    ← 客户端生成的唯一ID                 │
│      timestamp: "2026-06-03T10:00:00Z"                          │
│    })                                                           │
│                                                                 │
│ 4. chat() 在 fetch.ts 中创建 SSE 连接:                           │
│    POST /api/sessions/abc-123/chat                               │
│    Headers: {                                                   │
│      Accept: "text/event-stream",                               │
│      Content-Type: "application/json"                           │
│    }                                                            │
│    Body: JSON.stringify(payload)                                 │
│    signal: abortController.signal  (5分钟超时)                   │
│                                                                 │
│ 5. 同时, 前端在 useSessionDetail 中:                             │
│    - 设置 streaming = true                                       │
│    - 准备接收 SSE 事件流                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: FastAPI Router                                         │
│                                                                 │
│ POST /api/sessions/{session_id}/chat                            │
│ src/api/app/interfaces/endpoints/session_routes.py:161          │
│                                                                 │
│ async def chat(                                                 │
│     session_id: str,                                            │
│     request: ChatRequest,  # {message, attachments, event_id}    │
│     agent_service: AgentService = Depends(get_agent_service)     │
│ ):                                                              │
│     return EventSourceResponse(                                  │
│         agent_service.chat(session_id, request)                  │
│     )                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: AgentService.chat()                                     │
│ src/api/app/application/services/agent_service.py               │
│                                                                 │
│ async def chat(session_id, chat_request):                       │
│                                                                 │
│     # Step ①: 加载会话                                           │
│     session = await uow.sessions.get_by_id(session_id)           │
│                                                                 │
│     # Step ②: 创建用户 MessageEvent                              │
│     user_event = MessageEvent(                                   │
│         type="message",                                          │
│         role="user",                                             │
│         message="帮我用 Python 写一个冒泡排序，并测试它",           │
│         attachments=[],                                          │
│     )                                                           │
│                                                                 │
│     # Step ③: 获取或创建 Task (RedisStreamTask)                  │
│     task = Task.get(session_id)                                  │
│     # 如果不存在，创建一个新的 RedisStreamTask:                    │
│     #   task_id = uuid4()                                        │
│     #   创建两个 Redis Streams:                                   │
│     #     task:input:{task_id}   ← 输入队列                      │
│     #     task:output:{task_id}  ← 输出队列                      │
│     #   注册到 _task_registry[task_id]                            │
│                                                                 │
│     # Step ④: 创建 AgentTaskRunner (如果不存在)                   │
│     runner = AgentTaskRunner(...)                                │
│                                                                 │
│     # Step ⑤: 将用户事件放入 input stream                        │
│     task.input_stream.put(user_event.model_dump_json())          │
│     # ↓ 对应 Redis 命令:                                         │
│     # XADD task:input:{task_id} * event {...}                    │
│                                                                 │
│     # Step ⑥: 触发异步任务执行                                    │
│     task.invoke()                                                │
│     # ↓ 内部 spawn:                                              │
│     # asyncio.create_task(runner.invoke(task))                   │
│                                                                 │
│     # Step ⑦: 循环读取输出流 → SSE                               │
│     while True:                                                  │
│         raw = await task.output_stream.get(...)                   │
│         # ↓ 对应 Redis 命令:                                      │
│         # XREAD BLOCK 5000 STREAMS task:output:{task_id} ...     │
│                                                                 │
│         event = TypeAdapter(Event).validate_json(raw)             │
│         sse_event = EventMapper.to_sse(event, session_id)        │
│         yield sse_event                                          │
│                                                                 │
│         if isinstance(event, (DoneEvent, ErrorEvent, WaitEvent)):│
│             break                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 第二阶段：AgentTaskRunner 启动 & PlannerAgent 规划

```
┌─────────────────────────────────────────────────────────────────┐
│ AgentTaskRunner.invoke(task)                                     │
│ src/api/app/domain/services/agent_task_runner.py                 │
│                                                                 │
│ async def invoke(self, task: Task):                             │
│                                                                 │
│     try:                                                        │
│         # Step ①: 确保 Sandbox 运行                              │
│         await self.sandbox.start(session_id)                     │
│         # ↓ 启动 Docker 容器 (docker_sandbox.py)                  │
│         # docker run -d --network sandbox_net \                 │
│         #   --name sandbox_{session_id} \                       │
│         #   sandbox-image                                        │
│                                                                 │
│         # Step ②: 初始化 MCP Tool (连接外部 MCP 服务器)           │
│         await self.mcp_tool.init()                               │
│                                                                 │
│         # Step ③: 初始化 A2A Tool (连接其他 Agent)               │
│         await self.a2a_tool.init()                               │
│                                                                 │
│         # Step ④: 从 input stream 弹出用户消息                    │
│         message_json = await task.input_stream.pop()             │
│         # ↓ 对应 Redis 命令 (带分布式锁):                         │
│         # XRANGE task:input:{task_id} - + COUNT 1               │
│         # XDEL task:input:{task_id} {msg_id}                    │
│                                                                 │
│         message = MessageEvent.model_validate_json(message_json) │
│                                                                 │
│         # Step ⑤: 同步附件到 Sandbox                              │
│         for attachment in message.attachments:                   │
│             content = await self.file_storage.download(           │
│                 attachment.file_id                               │
│             )                                                   │
│             await self.sandbox.write_file(                       │
│                 f"/workspace/{attachment.filename}",             │
│                 content                                          │
│             )                                                   │
│         # 本次无附件, 跳过                                         │
│                                                                 │
│         # Step ⑥: 运行流程                                       │
│         async for event in self._run_flow(message):             │
│             await self._put_and_add_event(task, event)           │
│                                                                 │
│     finally:                                                    │
│         await self.mcp_tool.cleanup()                            │
│         await self.a2a_tool.cleanup()                            │
│                                                                 │
│ ─── _run_flow(message) ───                                      │
│                                                                 │
│     flow = self.flow  # PlannerReActFlow 实例                    │
│     async for event in flow.invoke(message):                    │
│         yield event                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PlannerReActFlow.invoke(message)                                 │
│ src/api/app/domain/services/flows/planner_react.py              │
│                                                                 │
│ FlowStatus 状态机:                                               │
│                                                                 │
│   IDLE ──→ PLANNING ──→ EXECUTING ──→ UPDATING                 │
│     ▲                       │            │                      │
│     │                       └────────────┘                      │
│     │                         (循环, 直到所有步骤完成)             │
│     │                              │                            │
│     │                              ▼                            │
│     └──────── COMPLETED ←── SUMMARIZING                         │
│                                                                 │
│ ─── 状态: PLANNING ───                                          │
│                                                                 │
│ async with self.planner.create_plan(message) as stream:         │
│     async for event in stream:                                  │
│         yield event                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PlannerAgent.create_plan(message)                                │
│ src/api/app/domain/services/agents/planner.py                   │
│                                                                 │
│ async def create_plan(self, message: MessageEvent):             │
│                                                                 │
│     # 构建 LLM 请求                                              │
│     messages = [                                                │
│         {"role": "system", "content": PLANNER_SYSTEM_PROMPT},    │
│         {"role": "user", "content": f"""                         │
│            创建执行计划:                                          │
│            用户问题: {message.message}                            │
│            附件: []                                              │
│         """}                                                    │
│     ]                                                           │
│                                                                 │
│     # LLM 调用 (json_object 格式, 不使用工具)                     │
│     response = await self.llm.invoke(                           │
│         messages=messages,                                      │
│         response_format="json_object",                           │
│         tool_choice="none",                                     │
│     )                                                           │
│                                                                 │
│     # LLM 返回 JSON:                                             │
│     # {                                                         │
│     #   "title": "冒泡排序实现与测试",                             │
│     #   "steps": [                                              │
│     #     {                                                     │
│     #       "id": "step-1",                                     │
│     #       "description": "编写冒泡排序的 Python 实现",          │
│     #       "goal": "实现一个接受列表参数、返回排序后列表的函数",    │
│     #       "expected_output": "Python 代码文件"                  │
│     #     },                                                    │
│     #     {                                                     │
│     #       "id": "step-2",                                     │
│     #       "description": "编写测试代码验证冒泡排序",             │
│     #       "goal": "编写能验证排序正确性的测试用例",              │
│     #       "expected_output": "运行测试并确认通过"                │
│     #     },                                                    │
│     #     {                                                     │
│     #       "id": "step-3",                                     │
│     #       "description": "运行冒泡排序并展示结果",               │
│     #       "goal": "执行排序并确认输出正确",                      │
│     #       "expected_output": "排序后的列表输出"                  │
│     #     }                                                     │
│     #   ]                                                       │
│     # }                                                         │
│                                                                 │
│     # 解析 JSON → Plan 模型                                      │
│     plan = Plan(                                                │
│         title="冒泡排序实现与测试",                                 │
│         steps=[                                                 │
│             Step(id="step-1", description="编写冒泡排序..."),     │
│             Step(id="step-2", description="编写测试代码..."),     │
│             Step(id="step-3", description="运行并展示结果..."),    │
│         ]                                                       │
│     )                                                           │
│                                                                 │
│     # 产出事件 (按顺序):                                          │
│                                                                 │
│     yield PlanEvent(                                             │
│         type="plan",                                            │
│         status=PlanEventStatus.CREATED,                          │
│         plan=plan                                               │
│     )                                                           │
│                                                                 │
│     yield TitleEvent(                                            │
│         type="title",                                           │
│         title="冒泡排序实现与测试"                                  │
│     )                                                           │
│                                                                 │
│     yield MessageEvent(                                          │
│         type="message",                                         │
│         role="assistant",                                       │
│         message="我将为你: \n1. 编写冒泡排序\n2. 编写测试\n3. 运行并展示结果" │
│     )                                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 第三阶段：ReActAgent 循环执行 (步骤1: 写代码)

```
┌─────────────────────────────────────────────────────────────────┐
│ 回到 PlannerReActFlow                                            │
│                                                                 │
│ 状态转换: PLANNING → EXECUTING (Step 1: "编写冒泡排序的 Python 实现")│
│                                                                 │
│ current_step = plan.steps[0]  # step-1                          │
│                                                                 │
│ async with self.react_agent.execute_step(                       │
│     plan, current_step, message                                  │
│ ) as stream:                                                    │
│     async for event in stream:                                  │
│         yield event                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ReActAgent.execute_step(plan, step, message)                     │
│ src/api/app/domain/services/agents/react.py                     │
│                                                                 │
│ async def execute_step(self, plan, step, message):              │
│                                                                 │
│     # 产出: Step 开始事件                                         │
│     yield StepEvent(                                             │
│         type="step",                                            │
│         step=step,                                              │
│         status=StepEventStatus.STARTED                           │
│     )                                                           │
│                                                                 │
│     # ─── BaseAgent.invoke() 主循环 ───                          │
│     # (最多 max_iterations=100 轮)                               │
│                                                                 │
│     # 迭代 1: LLM 决定写代码                                      │
│     iteration = 0                                               │
│     while iteration < max_iterations:                           │
│                                                                 │
│         # LLM 调用                                               │
│         llm_response = await self.llm.invoke(                   │
│             messages=[                                           │
│                 {"role": "system", "content": REACT_SYSTEM_PROMPT},│
│                 {"role": "user", "content": f"""                  │
│                    计划: {plan.title}                             │
│                    当前步骤: {step.description}                     │
│                    用户原始问题: {message.message}                  │
│                    请执行此步骤。                                   │
│                 """}                                              │
│             ],                                                    │
│             tools=self.tools,  # [ShellTool, FileTool, BrowserTool, ...]│
│             response_format="json_object",                       │
│         )                                                        │
│                                                                 │
│         # LLM 响应: 决定调用 file.write 工具                       │
│         # llm_response.choices[0].message.content = {            │
│         #   "thought": "我需要创建冒泡排序的 Python 文件",         │
│         #   "action": "write the bubble sort code to a file"     │
│         # }                                                      │
│         # llm_response.choices[0].message.tool_calls = [{        │
│         #   "id": "call_abc123",                                  │
│         #   "function": {                                        │
│         #     "name": "file_write",                               │
│         #     "arguments": '{"file_path":"bubble_sort.py",        │
│         #       "content":"def bubble_sort(arr):\\n    ..."}'     │
│         #   }                                                    │
│         # }]                                                     │
│                                                                 │
│         # ─── 工具调用前: ToolEvent(CALLING) ───                 │
│         yield ToolEvent(                                         │
│             type="tool",                                         │
│             tool_call_id="call_abc123",                           │
│             tool_name="file",                                    │
│             function_name="file_write",                           │
│             function_args={                                      │
│                 "file_path": "bubble_sort.py",                    │
│                 "content": "def bubble_sort(arr):\n    n = ..."  │
│             },                                                   │
│             status=ToolEventStatus.CALLING,                       │
│         )                                                        │
│                                                                 │
│         # ─── 执行工具 ───                                       │
│         tool_result = await self.file_tool.file_write(           │
│             file_path="bubble_sort.py",                           │
│             content="def bubble_sort(arr):\n    n = len(arr)\n..."│
│         )                                                        │
│         # tool_result = ToolResult(                               │
│         #     success=True,                                       │
│         #     data={"file_path": "bubble_sort.py",                │
│         #           "bytes_written": 234}                         │
│         # )                                                      │
│                                                                 │
│         # ─── 工具调用后: ToolEvent(CALLED) ───                  │
│         yield ToolEvent(                                         │
│             type="tool",                                         │
│             tool_call_id="call_abc123",                           │
│             tool_name="file",                                    │
│             function_name="file_write",                           │
│             function_args={...},                                 │
│             function_result=tool_result,                         │
│             status=ToolEventStatus.CALLED,                        │
│         )                                                        │
│                                                                 │
│         # 继续循环，LLM 可能还会调用其他工具...                      │
│         # 当 LLM 不再返回 tool_calls, 循环结束                     │
│                                                                 │
│     # 产出: 步骤完成                                              │
│     yield StepEvent(                                             │
│         type="step",                                             │
│         step=step,                                               │
│         status=StepEventStatus.COMPLETED                          │
│     )                                                            │
│                                                                 │
│     # 内存压缩                                                   │
│     self.memory.compact()  # 修剪 browser_content, reasoning      │
└─────────────────────────────────────────────────────────────────┘
```

### 第四阶段：循环继续 & 最终完成

```
┌─────────────────────────────────────────────────────────────────┐
│ PlannerReActFlow: 状态循环                                       │
│                                                                 │
│ ─── EXECUTING (Step 2: "编写测试代码验证冒泡排序") ───           │
│   → ReActAgent.execute_step()                                   │
│     → StepEvent(STARTED, step-2)                                │
│     → ToolEvent(CALLING,  file_write, "test_bubble_sort.py")    │
│     → ToolEvent(CALLED,   file_write, 成功写入)                  │
│     → ToolEvent(CALLING,  shell_exec, "python test_bubble_sort.py")│
│     → ToolEvent(CALLED,   shell_exec, "测试通过!")               │
│     → StepEvent(COMPLETED, step-2)                              │
│                                                                 │
│ ─── EXECUTING (Step 3: "运行冒泡排序并展示结果") ───             │
│   → ReActAgent.execute_step()                                   │
│     → StepEvent(STARTED, step-3)                                │
│     → ToolEvent(CALLING,  shell_exec, "python bubble_sort.py")  │
│     → ToolEvent(CALLED,   shell_exec, "[1, 2, 3, 5, 8]")       │
│     → StepEvent(COMPLETED, step-3)                              │
│                                                                 │
│ ─── SUMMARIZING ───                                            │
│   → ReActAgent.summarize()                                      │
│     → 最终 LLM 调用: 汇总所有步骤结果                              │
│     → MessageEvent(                                              │
│         role="assistant",                                       │
│         message="冒泡排序已成功实现并测试通过。\n\n"               │
│                 "创建的文件:\n"                                   │
│                 "- bubble_sort.py: 冒泡排序函数\n"                │
│                 "- test_bubble_sort.py: 测试代码\n\n"             │
│                 "测试结果: [1, 2, 3, 5, 8] — 排序正确!",         │
│         attachments=[                                            │
│             File(id="f1", filename="bubble_sort.py"),           │
│             File(id="f2", filename="test_bubble_sort.py"),      │
│         ]                                                       │
│       )                                                         │
│                                                                 │
│ ─── COMPLETED ───                                              │
│   → PlanEvent(COMPLETED)                                        │
│   → DoneEvent()                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 第五阶段：事件流的完整时间线 (所有产出事件)

```
按时间顺序排列的所有事件流:

T=0.0s   POST /api/sessions/abc-123/chat
         ↓
T=0.1s   [Redis: task:input:{id}]  MessageEvent(role="user")
         ↓
T=0.2s   AgentTaskRunner 从 Redis pop 消息
         ↓
T=1.5s   [PlannerAgent LLM 调用完成]
         ├── PlanEvent(CREATED, steps=3)
         ├── TitleEvent("冒泡排序实现与测试")
         └── MessageEvent(assistant, "我将为你: 1.编写...")
         ↓
T=2.0s   StepEvent(STARTED, step-1, "编写冒泡排序的 Python 实现")
         ↓
T=2.5s   ToolEvent(CALLING,  file_write, "bubble_sort.py")
T=2.7s   ToolEvent(CALLED,   file_write, 写入成功)
         ↓
T=3.0s   StepEvent(COMPLETED, step-1)
         ↓
T=3.1s   StepEvent(STARTED, step-2, "编写测试代码验证冒泡排序")
T=3.5s   ToolEvent(CALLING,  file_write, "test_bubble_sort.py")
T=3.7s   ToolEvent(CALLED,   file_write, 写入成功)
T=4.0s   ToolEvent(CALLING,  shell_exec, "python test_bubble_sort.py")
T=4.3s   ToolEvent(CALLED,   shell_exec, console=[...])
T=4.5s   StepEvent(COMPLETED, step-2)
         ↓
T=4.6s   StepEvent(STARTED, step-3, "运行冒泡排序并展示结果")
T=4.9s   ToolEvent(CALLING,  shell_exec, "python bubble_sort.py")
T=5.2s   ToolEvent(CALLED,   shell_exec, console=["[1,2,3,5,8]"])
T=5.3s   StepEvent(COMPLETED, step-3)
         ↓
T=6.0s   [SUMMARIZING] MessageEvent(assistant, "冒泡排序已成功实现...")
         ↓
T=6.1s   PlanEvent(COMPLETED)
T=6.1s   DoneEvent()
         ↓
T=6.2s   SSE 连接关闭, 前端收到所有事件
```

### 第六阶段：后端持久化 & 前端渲染

```
┌─────────────────────────────────────────────────────────────────┐
│ AgentTaskRunner._put_and_add_event() → 双写                     │
│                                                                 │
│ async def _put_and_add_event(self, task, event):                │
│                                                                 │
│     # ① 写入 Redis Stream (实时推送)                             │
│     await task.output_stream.put(event.model_dump_json())        │
│     # ↓ 对应 Redis 命令:                                         │
│     # XADD task:output:{task_id} * event {                       │
│     #   "type": "tool",                                         │
│     #   "tool_name": "file",                                    │
│     #   "function_name": "file_write",                           │
│     #   "status": "CALLED",                                     │
│     #   ...                                                     │
│     # }                                                         │
│                                                                 │
│     # ② 持久化到 PostgreSQL (JSONB)                              │
│     async with self.uow:                                        │
│         session = await self.uow.sessions.get_by_id(session_id)  │
│         session.events.append(event)  # 追加到 JSONB 数组         │
│         await self.uow.commit()                                  │
│     # ↓ 对应 SQL:                                               │
│     # UPDATE sessions                                           │
│     # SET events = events || '{"type":"tool",...}'::jsonb,     │
│     #     updated_at = NOW()                                    │
│     # WHERE session_id = 'abc-123'                              │
│                                                                 │
│     # ③ 特殊事件处理                                             │
│     if isinstance(event, TitleEvent):                           │
│         session.title = event.title                             │
│     elif isinstance(event, MessageEvent):                       │
│         session.latest_message = event.message[:100]             │
│         if event.role == "assistant":                            │
│             session.unread_message_count += 1                   │
│     elif isinstance(event, DoneEvent):                           │
│         session.status = "completed"                             │
│         task.done()  # 清理 Task                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ AgentService.chat() → SSE 输出                                   │
│                                                                 │
│ # 从 Redis 读取事件 → 转为 SSE 格式 → yield                     │
│                                                                 │
│ raw = await task.output_stream.get(...)                          │
│                                                          │
│ event = TypeAdapter(Event).validate_json(raw)                    │
│                                                                 │
│ # EventMapper.to_sse() 转换:                                    │
│ #   domain Event → SSE Event                                    │
│ #                                                                │
│ # 例如 ToolEvent →:                                              │
│ #   event: tool                                                 │
│ #   data: {"type":"tool","data":{                               │
│ #     "tool_call_id":"call_abc123",                              │
│ #     "tool_name":"file",                                        │
│ #     "function_name":"file_write",                              │
│ #     "function_args":{"file_path":"bubble_sort.py",...},        │
│ #     "content":{"kind":"file","content":"def bubble_sort..."},  │
│ #     "status":"CALLED"                                          │
│ #   }}                                                          │
│                                                                 │
│ yield ServerSentEvent(                                          │
│     event="tool",                                               │
│     data=json.dumps(sse_event_data),                             │
│     id=event_id                                                 │
│ )                                                               │
│                                                                 │
│ # 当遇到 DoneEvent → break, 关闭 SSE 连接                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: SSE 解析 & 渲染                                        │
│                                                                 │
│ 1. parseSSEStream() 逐行解析:                                    │
│    event: tool                                                  │
│    data: {"type":"tool","data":{...}}                            │
│    id: evt-001                                                  │
│                                                                 │
│ 2. useSessionDetail hook 累积事件:                               │
│    appendEvent(sseData)                                         │
│    → setEvents(prev => [...prev, normalizedEvent])              │
│    → 副作用: 更新 session.status, title 等                       │
│                                                                 │
│ 3. eventsToTimeline(events) → TimelineItem[]                    │
│    原始事件流:                                                   │
│      [PlanEvent, TitleEvent, MessageEvent(assistant),           │
│       StepEvent(started,step-1), ToolEvent(calling,file_write), │
│       ToolEvent(called,file_write), StepEvent(completed,step-1),│
│       StepEvent(started,step-2), ToolEvent(calling,file_write), │
│       ToolEvent(called,file_write), ToolEvent(calling,shell),   │
│       ToolEvent(called,shell), StepEvent(completed,step-2),     │
│       StepEvent(started,step-3), ToolEvent(calling,shell),      │
│       ToolEvent(called,shell), StepEvent(completed,step-3),     │
│       MessageEvent(assistant), PlanEvent(completed), DoneEvent] │
│                                                                 │
│     → 转换后的时间线:                                             │
│      [                                                          │
│        {kind:"assistant", data:{message:"我将为你..."}},        │
│        {kind:"step", data:{id:"step-1",status:"completed"},     │
│         tools:[                                                  │
│           {tool_name:"file", function_name:"file_write",         │
│            args:{file_path:"bubble_sort.py"}, status:"CALLED"}    │
│         ]},                                                     │
│        {kind:"step", data:{id:"step-2",status:"completed"},     │
│         tools:[                                                  │
│           {tool_name:"file_write", ...},                        │
│           {tool_name:"shell_exec", content:{console:[...]}}     │
│         ]},                                                     │
│        {kind:"step", data:{id:"step-3",status:"completed"},     │
│         tools:[                                                  │
│           {tool_name:"shell_exec", content:{console:["[1,2,3,5,8]"]}}│
│         ]},                                                     │
│        {kind:"assistant", data:{message:"冒泡排序已成功..."}},  │
│      ]                                                          │
│                                                                 │
│ 4. React 组件渲染:                                               │
│    ├── ChatMessage: 渲染 AI 文本气泡                              │
│    ├── StepItem:    渲染步骤卡片 (含工具调用展开)                   │
│    ├── ToolPreviewPanel: 侧边面板实时展示最新工具结果               │
│    │   ├── 文件工具 → 代码预览 (语法高亮)                          │
│    │   └── Shell 工具 → 终端输出 (黑色背景, 类似控制台)            │
│    └── PlanPanel:   左侧计划面板 (显示步骤进度)                    │
│                                                                 │
│ 5. 最终状态:                                                     │
│    - session.status = "completed"                                │
│    - streaming = false                                          │
│    - 空 SSE 流重新连接 (等待下一个用户消息)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 示例二：用户提问 + 文件附件

> **用户输入**: "请分析这张图片中的文字内容"
> **附加文件**: `screenshot.png`

### 与示例一的核心差异点

```
┌─────────────────────────────────────────────────────────────────┐
│ 差异点 ①: 前端文件上传 (发生在发送消息之前)                       │
│                                                                 │
│ ChatInput 组件:                                                  │
│   1. 用户点击附件按钮, 选择 screenshot.png                         │
│                                                                 │
│   2. fileApi.uploadFile(file, session_id)                        │
│      POST /api/files                                            │
│      Content-Type: multipart/form-data                           │
│      Body: FormData {                                           │
│        file: <screenshot.png blob>,                              │
│        session_id: "abc-456"                                    │
│      }                                                          │
│                                                                 │
│   3. 后端 FileService.upload():                                  │
│      - 计算 SHA-256 哈希                                         │
│      - 上传到 Tencent COS: /files/{session_id}/{hash}.png        │
│      - 存入 PostgreSQL files 表                                  │
│      - 返回 FileInfo { id: "file-uuid-1", filename: "screenshot.png",│
│                        extension: "png", size: 245760 }          │
│                                                                 │
│   4. ChatInput 状态: files = [{id:"file-uuid-1", filename:...}]  │
│                                                                 │
│   5. 用户点击发送 → sendMessage({                                 │
│        message: "请分析这张图片中的文字内容",                       │
│        attachments: ["file-uuid-1"],  ← 已上传文件的 ID            │
│        event_id: "evt-002"                                      │
│      })                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 差异点 ②: 附件同步到 Sandbox                                     │
│                                                                 │
│ AgentTaskRunner.invoke():                                       │
│                                                                 │
│     message = MessageEvent(                                     │
│         role="user",                                            │
│         message="请分析这张图片中的文字内容",                       │
│         attachments=[                                           │
│             File(id="file-uuid-1", filename="screenshot.png",   │
│                  file_path="/files/abc-456/abc...hash.png")      │
│         ]                                                       │
│     )                                                           │
│                                                                 │
│     # 附件同步 (这里与示例一不同!)                                 │
│     for attachment in message.attachments:                       │
│         # ① 从 COS 下载文件内容                                   │
│         content = await self.file_storage.download(              │
│             attachment.file_path                                │
│         )                                                       │
│         # ② 写入 Sandbox 工作目录                                 │
│         await self.sandbox.write_file(                          │
│             f"/workspace/{attachment.filename}",                │
│             content  # bytes 格式                                │
│         )                                                       │
│     # 现在 Sandbox 的 /workspace/screenshot.png 可用               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 差异点 ③: PlannerAgent 看到附件信息                               │
│                                                                 │
│ PlannerAgent.create_plan() 的 LLM 提示词包含附件信息:               │
│                                                                 │
│     messages = [                                                │
│         {"role": "system", "content": PLANNER_SYSTEM_PROMPT},    │
│         {"role": "user", "content": f"""                         │
│            创建执行计划:                                          │
│            用户问题: 请分析这张图片中的文字内容                      │
│            附件:                                                 │
│              - screenshot.png (已在 /workspace/ 目录下)           │
│         """}                                                    │
│     ]                                                           │
│                                                                 │
│ LLM 规划结果:                                                    │
│     {                                                           │
│       "title": "图片文字分析",                                     │
│       "steps": [                                                │
│         {"id":"step-1", "description":"查看图片文件信息",          │
│          "goal":"确认文件存在并获取基本信息"},                      │
│         {"id":"step-2", "description":"使用 OCR 工具提取图片文字",  │
│          "goal":"提取 screenshot.png 中的所有文字"},              │
│         {"id":"step-3", "description":"整理分析文字内容",          │
│          "goal":"对提取的文字进行归纳总结"}                         │
│       ]                                                         │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 差异点 ④: ReActAgent 执行中引用附件文件                            │
│                                                                 │
│ ReActAgent.execute_step(step-2):                                │
│                                                                 │
│     LLM 提示词包含文件在 Sandbox 中的路径信息:                      │
│                                                                 │
│     当前步骤: 使用 OCR 工具提取图片文字                             │
│     可用文件:                                                    │
│       - /workspace/screenshot.png  (用户上传)                     │
│                                                                 │
│     LLM 工具调用:                                                 │
│     tool_calls = [{                                             │
│       "id": "call_ocr001",                                      │
│       "function": {                                             │
│         "name": "shell_exec",                                   │
│         "arguments": {                                          │
│           "command": "python -c \"                                  │
│             from PIL import Image;                              │
│             import pytesseract;                                 │
│             img = Image.open('/workspace/screenshot.png');      │
│             text = pytesseract.image_to_string(img, lang='chi_sim');│
│             print(text)                                         │
│           \""                                                   │
│         }                                                       │
│       }                                                         │
│     }]                                                          │
│                                                                 │
│     → ToolEvent(CALLING, shell_exec, command="python -c ...")   │
│     → 执行 OCR命令 (在 Docker Sandbox 内运行)                      │
│     → ToolEvent(CALLED, shell_exec,                             │
│         content=ShellToolContent(                               │
│           console=[                                             │
│             ConsoleRecord(ps1="$", command="python -c ...",     │
│               output="会议纪要\n时间: 2026年6月3日\n地点: 301会议室\n...")│
│           ]                                                     │
│         ))                                                      │
│                                                                 │
│     → StepEvent(COMPLETED, step-2)                              │
│                                                                 │
│ 差异点 ⑤: SUMMARIZING 阶段                                       │
│                                                                 │
│     ReActAgent.summarize() 的最终输出包含文件引用:                  │
│                                                                 │
│     MessageEvent(                                               │
│         role="assistant",                                       │
│         message="图片 screenshot.png 中的文字内容如下:\n\n"        │
│                 "## 会议纪要\n\n"                                │
│                 "- 时间: 2026年6月3日\n"                          │
│                 "- 地点: 301会议室\n"                             │
│                 "- 参会人员: 张三, 李四, 王五\n"                   │
│                 "- 议题: Q2 产品规划评审\n\n"                     │
│                 "这是产品规划评审会议的纪要。",                     │
│         attachments=[                                           │
│             File(id="file-uuid-1", filename="screenshot.png"),   │
│             File(id="file-uuid-2", filename="ocr_result.txt"),   │
│         ]                                                       │
│     )                                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 示例二的完整事件时间线

```
T=0.0s    POST /api/files (上传 screenshot.png)
          → COS 存储 → DB 记录 → 返回 file-uuid-1

T=1.0s    POST /api/sessions/abc-456/chat
          Body: { message: "请分析...", attachments: ["file-uuid-1"] }

T=1.1s    [Redis: task:input] MessageEvent(role="user", attachments=[file-uuid-1])

T=1.2s    AgentTaskRunner:
          ├── COS 下载 screenshot.png
          ├── 写入 Sandbox /workspace/screenshot.png
          └── 调用 flow.invoke(message)

T=2.5s    [PLANNING] ← LLM 看到了附件信息
          ├── PlanEvent(CREATED, steps=3, 基于附件内容制定)
          ├── TitleEvent("图片文字分析")
          └── MessageEvent(assistant, "我将分析图片...")

T=3.0s    [EXECUTING Step 1] "查看图片文件信息"
          ├── StepEvent(STARTED)
          ├── ToolEvent(CALLING,  shell_exec, "ls -la /workspace/screenshot.png")
          ├── ToolEvent(CALLED,   shell_exec, "文件存在, 245760 bytes")
          └── StepEvent(COMPLETED)

T=4.0s    [EXECUTING Step 2] "使用 OCR 提取图片文字"
          ├── StepEvent(STARTED)
          ├── ToolEvent(CALLING,  shell_exec, "tesseract /workspace/screenshot.png ...")
          ├── ToolEvent(CALLED,   shell_exec, console=["会议纪要\n时间: 2026年...", ...])
          ├── ToolEvent(CALLING,  file_write, "ocr_result.txt")
          ├── ToolEvent(CALLED,   file_write, "写入成功, 1567 bytes")
          └── StepEvent(COMPLETED)

T=5.0s    [EXECUTING Step 3] "整理分析文字内容"
          ├── StepEvent(STARTED)
          ├── ToolEvent(CALLING,  shell_exec, "cat /workspace/ocr_result.txt | head -30")
          ├── ToolEvent(CALLED,   shell_exec, console=["会议纪要\n时间: ...", ...])
          └── StepEvent(COMPLETED)

T=6.0s    [SUMMARIZING]
          └── MessageEvent(assistant, "图片中的文字内容如下...", attachments=[screenshot.png, ocr_result.txt])

T=6.2s    PlanEvent(COMPLETED) + DoneEvent()

T=6.3s    AgentTaskRunner 后处理:
          ├── 新文件 ocr_result.txt → COS 上传 → DB 记录 (file-uuid-2)
          └── 所有事件 → PostgreSQL JSONB 持久化

T=6.5s    前端渲染:
          ├── 聊天消息: AI 回复 "图片中的文字内容如下..."
          ├── 附件卡片: screenshot.png, ocr_result.txt (可下载)
          ├── 工具预览面板: Shell 终端输出 (OCR 识别结果)
          └── 计划面板: 3 个步骤全部 Completed
```

---

## 核心组件职责总结

### 组件清单

| 组件 | 层级 | 职责 |
|------|------|------|
| **ChatInput** | 前端 | 输入文本, 上传文件, 发送消息 |
| **SSE Stream Parser** | 前端 | 解析 SSE 事件流 → 标准化事件 |
| **eventsToTimeline** | 前端 | 原始事件 → 时间线视图模型 |
| **SessionDetailView** | 前端 | 渲染聊天 + 步骤 + 工具 + 计划 |
| **ToolPreviewPanel** | 前端 | 实时展示工具执行结果 (代码/终端/搜索) |
| **FilePreviewPanel** | 前端 | 文件内容预览 (文本/图片) |
| **AgentService** | 后端 Application | 编排聊天流程, 管理 Task 生命周期 |
| **EventMapper** | 后端 Interface | Domain Event → SSE 格式转换 |
| **AgentTaskRunner** | 后端 Domain | Task ↔ Flow 桥接, 工具富化, 文件同步 |
| **PlannerReActFlow** | 后端 Domain | 状态机: IDLE→PLANNING→EXECUTING→UPDATING→SUMMARIZING→COMPLETED |
| **PlannerAgent** | 后端 Domain | LLM 驱动的计划创建与更新 |
| **ReActAgent** | 后端 Domain | LLM 驱动的步骤执行, 工具调用循环 |
| **BaseAgent** | 后端 Domain | LLM 调用 + Tool 调用 + 内存管理 |
| **RedisStreamTask** | 后端 Infra | 基于 Redis Streams 的任务队列 (input/output) |
| **RedisStreamMessageQueue** | 后端 Infra | Redis Streams CRUD + 分布式锁 |
| **DockerSandbox** | 后端 Infra | Docker 容器管理 (代码执行环境) |
| **PostgreSQL (JSONB)** | 存储 | 会话事件、文件、记忆的持久化 |
| **Redis Streams** | 存储 | 实时事件队列 (task input/output) |
| **COS** | 存储 | 文件对象存储 (上传/下载) |

### 所有事件的完整生命周期

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  创建阶段     │     │  执行阶段     │     │  终止事件     │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ PlanEvent    │     │ StepEvent    │     │ WaitEvent    │
│ (CREATED)    │     │ (STARTED)    │     │ (暂停, 等人)  │
│              │     │              │     │              │
│ TitleEvent   │     │ ToolEvent    │     │ ErrorEvent   │
│ (会话标题)    │     │ (CALLING)    │     │ (错误终止)    │
│              │     │              │     │              │
│ MessageEvent │     │ ToolEvent    │     │ DoneEvent    │
│ (assistant)  │     │ (CALLED)     │     │ (正常完成)    │
│              │     │              │     │              │
│              │     │ StepEvent    │     │ PlanEvent    │
│              │     │ (COMPLETED)  │     │ (COMPLETED)  │
│              │     │              │     │              │
│              │     │ PlanEvent    │     │              │
│              │     │ (UPDATED)    │     │              │
│              │     │              │     │              │
│              │     │ MessageEvent │     │              │
│              │     │ (assistant   │     │              │
│              │     │  摘要)       │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Redis 双 Stream 架构

```
          task:input:{uuid}              task:output:{uuid}
         ┌──────────────────┐           ┌───────────────────┐
写端:     │ AgentService      │           │ AgentTaskRunner    │
         │ (put user msg)    │           │ (put flow events)  │
         └────────┬─────────┘           └────────┬──────────┘
                  │                              │
         ┌────────▼─────────┐           ┌────────▼──────────┐
         │  Redis Stream    │           │  Redis Stream     │
         │  (FIFO Queue)    │           │  (FIFO Queue)     │
         └────────┬─────────┘           └────────┬──────────┘
                  │                              │
读端:     │ AgentTaskRunner    │           │ AgentService      │
         │ (pop user msg)     │           │ (get → SSE yield) │
         └──────────────────┘           └───────────────────┘

特性:
- 每个 Task 一对 Stream (隔离)
- XADD 写入, XREAD BLOCK 阻塞读取
- 分布式锁保护 pop 操作 (SET NX + Lua DEL)
- Task destroy 时自动清理 Stream
```

---

## 补充: 前端时序图

```
用户界面 (SessionDetailView)
├── 左侧面板 (LeftPanel)
│   ├── SessionList       ← 会话列表 SSE 流 (/sessions/stream)
│   └── PlanPanel         ← 展示 PlanEvent 的步骤树
├── 中间面板 (Chat Area)
│   ├── ChatHeader        ← 会话标题 (来自 TitleEvent)
│   ├── Timeline          ← 消息 + 步骤 + 工具 (来自 eventsToTimeline)
│   │   ├── ChatMessage   ← MessageEvent → 聊天气泡
│   │   ├── Attachments   ← MessageEvent.attachments → 文件卡片
│   │   ├── StepItem      ← StepEvent → 步骤卡片
│   │   │   └── ToolCall  ← ToolEvent → 工具调用项 (可展开)
│   │   └── ErrorBanner   ← ErrorEvent → 错误横幅
│   ├── ChatInput         ← 输入框 + 文件上传 + 发送按钮
│   │   └── AttachmentsPreview ← 待发送文件预览
│   └── SuggestedQuestions ← 建议问题 (空会话时显示)
├── 右侧面板 (条件渲染)
│   ├── ToolPreviewPanel  ← 工具结果实时预览 (Shell/Browser/File/Search)
│   ├── FilePreviewPanel  ← 文件内容预览 (文本/图片)
│   └── VNCOverlay        ← 全屏远程桌面 (WebSocket → Sandbox VNC)
└── 状态覆盖层
    ├── Loading spinner   ← streaming && events.length == 0
    ├── "Waiting for input" ← status == "waiting"
    └── "Task completed"  ← status == "completed" (DoneEvent 后)
```

---

*文档生成时间: 2026-06-03*
*项目: mooc-manus*
