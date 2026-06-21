# SpermManus 改造设计

**日期**: 2026-05-23
**状态**: 待审核

---

## 一、背景

将 mooc-manus 项目改造为 SpermManus——精子分析助手。在保持现有架构不变的前提下，接入两个外部 AI 服务：

- **精子检测**：输入显微镜图片，输出标注后的图片（含 bounding box）+ 精子数量
- **精子分类**：输入显微镜图片（+ 检测结果），输出形态分类标签（正常/异常等）

用户上传一张或多张精子显微镜图片，系统根据用户意图自动执行检测、分类或两者组合，返回结果。

---

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                     SpermManus (主系统)                    │
│                                                         │
│  Vue UI ←→ Nginx ←→ FastAPI ←→ Redis Stream ←→ Task    │
│                                          │              │
│                                   AgentTaskRunner        │
│                                          │              │
│                               PlannerReActFlow           │
│                                  │        │              │
│                           PlannerAgent  ReActAgent       │
│                                           │              │
│                              ┌────────────┴──────┐       │
│                              │  A2ATool          │       │
│                              │  (已有, 无需改动)   │       │
│                              └─────────┬─────────┘       │
│                                        │                 │
│                              A2AClientManager            │
│                              (已有, 无需改动)              │
│                                        │                 │
└───────────────────────────────────────┬─────────────────┘
                                        │ A2A JSON-RPC
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            ┌───────▼──────┐   ┌────────▼───────┐          │
            │ Detection     │   │ Classification  │          │
            │ Agent         │   │ Agent           │          │
            │ (新增)         │   │ (新增)           │          │
            │               │   │                 │          │
            │ agent-card    │   │ agent-card      │          │
            │ + /detect     │   │ + /classify     │          │
            └───────────────┘   └─────────────────┘          │
                    │                   │                    │
                    ▼                   ▼                    │
            检测脚本 (.py)       分类脚本 (.py)              │
```

**核心原则**：通过 A2A 协议将两个外部脚本包装为独立 Agent，PlannerAgent 根据用户意图分解任务，ReActAgent 通过 A2ATool 调用远程 Agent。现有架构零改动。

---

## 三、两个外部 A2A Agent（新增）

### 3.1 共同规范

每个 Agent 是一个最小化 FastAPI 服务，提供两个端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/.well-known/agent-card.json` | GET | A2A Agent 名片，声明 name、skills、inputs/outputs |
| `/` | POST | JSON-RPC `message/send`，接收任务并返回结果 |

内部处理流程：收到 A2A 请求 → 从 COS 下载输入图片 → 调用本地脚本 → 上传结果到 COS → 返回 JSON 响应。

### 3.2 Sperm Detection Agent

```
Agent Card:
  name: "Sperm Detection Agent"
  description: "Detect sperm cells in microscope images using deep learning"
  skills:
    - name: detect_sperm
      description: "Detect sperm cells and output annotated image with bounding boxes"
      inputs:
        image_url: str       # COS 图片地址
        confidence: float    # 检测置信度阈值 (默认 0.5)
      outputs:
        annotated_image_url: str   # 标注图 COS 地址
        count: int                  # 检测到的精子数量
        bboxes: list                # 边界框坐标列表

内部实现:
  1. httpx.get(image_url) 下载图片到 /tmp
  2. subprocess 调用检测脚本 (或直接 import)
  3. 标注图上传到 COS
  4. 返回 { annotated_image_url, count, bboxes }
```

### 3.3 Sperm Classification Agent

```
Agent Card:
  name: "Sperm Classification Agent"
  description: "Classify sperm cells by morphology and motility"
  skills:
    - name: classify_sperm
      description: "Classify detected sperm cells into morphological categories"
      inputs:
        image_url: str            # COS 图片地址
        detection_result: dict    # 可选，检测 Agent 的输出
      outputs:
        labels: list              # 形态分类标签列表
        summary: str              # 可读的分类摘要

内部实现:
  1. httpx.get(image_url) 下载图片到 /tmp
  2. 调用分类脚本
  3. 返回 { labels, summary }
```

### 3.4 Agent 服务骨架（两个 Agent 共享）

```
sperm-detection-agent/
├── Dockerfile
├── requirements.txt
├── main.py              # FastAPI + A2A 端点
├── agent_card.py        # Agent 名片定义
├── script_wrapper.py    # 脚本调用封装
└── models/              # 检测模型文件

sperm-classification-agent/
├── Dockerfile
├── requirements.txt
├── main.py
├── agent_card.py
├── script_wrapper.py
└── models/              # 分类模型文件
```

---

## 四、主系统改动

### 4.1 配置（`config.yaml`）

在 `a2a_config.a2a_servers` 中追加：

```yaml
a2a_config:
  a2a_servers:
    # ... 已有配置保持不变 ...
    - name: "Sperm Detection Agent"
      url: "http://sperm-detection-agent:8080"
    - name: "Sperm Classification Agent"
      url: "http://sperm-classification-agent:8080"
```

`A2AClientManager` 在初始化时自动拉取 `agent-card.json`，发现新 Agent 并缓存。`A2ATool` 自动暴露 `get_remote_agent_cards()` 和 `call_remote_agent()` 两个工具给 LLM，无需任何代码改动。

### 4.2 Agent Prompt（`prompts/sperm_analysis.py`）

新增 Planner 的 domain prompt 文件：

```
你是精子分析助手 SpermManus。当用户发送显微镜图片并要求分析时：

1. 意图判断：
   - 用户要求"分析/检测并分类" → 先调用 Sperm Detection Agent 检测，再调用 Sperm Classification Agent 分类
   - 用户要求"只检测/标注" → 仅调用 Sperm Detection Agent
   - 用户要求"只分类" → 仅调用 Sperm Classification Agent

2. 批量处理：
   - 多张图片时，为每张图片生成独立的检测 Step
   - 所有检测完成后再统一执行分类 Step

3. 最终输出：
   - 标注后的图片 + 精子数量统计 + 形态分类汇总
```

在 `agent_config.planner_system_prompt` 中引用此文件内容，或直接在配置中追加。

### 4.3 核心流程（零改动）

| 组件 | 改动量 | 原因 |
|------|--------|------|
| `PlannerReActFlow` | 0 | 状态机 PLANNING→EXECUTING→UPDATING→SUMMARIZING→COMPLETED 不变 |
| `PlannerAgent` | 0 | 通过 prompt 引导即可识别新 Agent |
| `ReActAgent` | 0 | 通过 `A2ATool.call_remote_agent()` 调用，和调用现有 A2A Agent 一致 |
| `A2ATool` | 0 | 自动从 `agent-card.json` 发现新 Agent |
| `A2AClientManager` | 0 | 初始化时自动发现 `config.yaml` 中的新服务器 |
| `AgentTaskRunner` | 0 | 图片→COS→Sandbox 同步流程不变 |
| 图片上传 `/api/files` | 0 | 现有 COS 上传逻辑不变 |
| `DockerSandbox` | 0 | 脚本不在沙箱中运行 |
| `vue-ui/` 前端 | 0 | 图片上传已有，结果走现有 Timeline SSE |

---

## 五、数据流

### 5.1 完整分析（检测 + 分类）

```
用户: 上传 sperm_001.png + "分析这张精液样本"

1. FastAPI → Redis Stream → AgentTaskRunner
2. AgentTaskRunner: 同步 sperm_001.png 到 sandbox
3. PlannerAgent 生成 Plan:
     Step 1: 调用 Sperm Detection Agent 检测精子
     Step 2: 调用 Sperm Classification Agent 分类
     Step 3: 汇总结果给用户
4. ReActAgent 执行 Step 1:
     → A2ATool.call_remote_agent("sperm-detection-agent", query)
     → Detection Agent: COS 下载图片 → 检测 → 上传标注图
     ← { annotated_image_url, count: 42, bboxes: [...] }
5. ReActAgent 执行 Step 2:
     → A2ATool.call_remote_agent("sperm-classification-agent", query)
     ← { labels: ["正常: 35", "头部异常: 5", "尾部异常: 2"], summary: "..." }
6. ReActAgent 执行 Step 3: 总结报告
7. 前端 Timeline: SSE 事件流 → 标注图 + 分类报告
```

### 5.2 批量处理

```
用户: 上传 10 张图片 + "批量分析这些样本"

PlannerAgent 生成 Plan:
    Step 1-10: 每张图片一个检测 Step → Detection Agent
    Step 11:   统一分类 → Classification Agent
    Step 12:   汇总批量报告

ReActAgent 顺序执行 (当前架构)，每个 Step 完成即通过 SSE 推送进度。
```

> 后续优化：如果在 Planner 中标记 `parallel: true`，Flow 层可用 `asyncio.gather` 并行执行多个检测 Step。

### 5.3 单独检测 / 单独分类

```
用户: "只检测这张图" → Plan: Step 1 → Detection Agent → 标注图
用户: "只分类这张图" → Plan: Step 1 → Classification Agent → 标签
```

### 5.4 文件传输设计

图片通过 COS URL 在系统间传递，不通过 A2A 消息体传 base64：

```
主系统 → A2A 消息: { image_url: "https://cos.xxx/sperm_001.png" }
Agent 内部: httpx.get(image_url) → 下载 → 处理 → 上传结果到 COS
Agent → 主系统: { annotated_image_url: "https://cos.xxx/sperm_001_annotated.png", ... }
```

两个 Agent 需配置 COS 凭证以访问主系统的文件存储。

---

## 六、部署拓扑

`docker-compose.yml` 新增两个服务：

```yaml
services:
  # ... 现有 manus-api, manus-ui, manus-nginx, manus-postgres, manus-redis 保持不变 ...

  sperm-detection-agent:
    build: ../sperm-detection-agent/
    networks: [manus-network]
    environment:
      - COS_SECRET_ID=${COS_SECRET_ID}
      - COS_SECRET_KEY=${COS_SECRET_KEY}
      - COS_BUCKET=${COS_BUCKET}
      - COS_REGION=${COS_REGION}
      - MODEL_PATH=/models/detection.pt
    volumes:
      - sperm_detection_models:/models

  sperm-classification-agent:
    build: ../sperm-classification-agent/
    networks: [manus-network]
    environment:
      - COS_SECRET_ID=${COS_SECRET_ID}
      - COS_SECRET_KEY=${COS_SECRET_KEY}
      - COS_BUCKET=${COS_BUCKET}
      - COS_REGION=${COS_REGION}
      - MODEL_PATH=/models/classification.pt
    volumes:
      - sperm_classification_models:/models
```

两个 Agent 不暴露端口到宿主机，仅通过 Docker 内部网络 (`manus-network`) 被主系统访问。

---

## 七、完整不改动清单

| 层级 | 组件 | 说明 |
|------|------|------|
| Domain | `external/sandbox.py` | Sandbox 协议 |
| Domain | `external/task.py` | Task/TaskRunner 协议 |
| Domain | `external/browser.py` | Browser 协议 |
| Domain | `external/llm.py` | LLM 协议 |
| Domain | `services/agents/base.py` | BaseAgent 基类 |
| Domain | `services/agents/planner.py` | PlannerAgent |
| Domain | `services/agents/react.py` | ReActAgent |
| Domain | `services/flows/planner_react.py` | PlannerReActFlow 状态机 |
| Domain | `services/tools/a2a.py` | A2ATool + A2AClientManager |
| Domain | `services/tools/file.py` | FileTool |
| Domain | `services/tools/shell.py` | ShellTool |
| Domain | `services/tools/browser.py` | BrowserTool |
| Domain | `services/tools/search.py` | SearchTool |
| Domain | `services/tools/mcp.py` | MCPTool |
| Infrastructure | `external/sandbox/docker_sandbox.py` | DockerSandbox |
| Infrastructure | `external/task/redis_stream_task.py` | RedisStreamTask |
| Infrastructure | `external/llm/` | OpenAI LLM 适配器 |
| Infrastructure | `repositories/` | DB 仓储 |
| Interfaces | `endpoints/` | 全部 API 路由 |
| Interfaces | `schemas/` | 全部 Schema |
| Frontend | `vue-ui/` | Vue 3 前端 |

---

## 八、实施步骤

| 步骤 | 内容 | 预估改动量 |
|------|------|-----------|
| 1 | 创建 `sperm-detection-agent` 项目 | ~150 行 Python |
| 2 | 创建 `sperm-classification-agent` 项目 | ~150 行 Python |
| 3 | 修改 `config.yaml`，追加 2 个 A2A server | 6 行配置 |
| 4 | 新增 `prompts/sperm_analysis.py` | ~30 行 prompt |
| 5 | 修改 `docker-compose.yml`，新增 2 个服务 | ~25 行 YAML |
| 6 | 端到端测试 | - |

核心改动量约 **360 行新代码 + 30 行配置**，现有代码零破坏。
