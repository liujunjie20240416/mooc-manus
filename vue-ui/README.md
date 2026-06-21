# MoocManus Vue UI

一个独立于现有 `ui/` 的 Vue 3 前端，用来对接当前仓库里的 `api` 和 `sandbox`。

## 启动

```bash
cd vue-ui
npm install
npm run dev
```

默认读取 `VITE_API_BASE_URL`，未设置时使用 `http://localhost:8000/api`。

```bash
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

## Docker 运行

根目录 `docker-compose.yml` 已切换为使用 `vue-ui/` 作为前端构建目录，生产环境会在构建时注入：

```bash
VITE_API_BASE_URL=/api
```

启动步骤：

```bash
docker compose up -d --build
```

访问地址：

```bash
http://localhost:8088
```

## 功能

- 会话列表
- 新建会话与发送消息
- SSE 流式聊天
- 会话文件列表与文件预览
- 工具事件预览
- VNC 面板
- LLM / Agent / MCP / A2A 配置页
