const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export class ApiError extends Error {
    constructor(code, message, data = null) {
        super(message);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'ApiError';
        this.code = code;
        this.data = data;
    }
}
async function parseApiResponse(response) {
    const payload = (await response.json());
    if (!response.ok || (payload.code !== 0 && payload.code !== 200)) {
        throw new ApiError(payload.code || response.status, payload.msg || '请求失败', payload.data);
    }
    return payload.data;
}
async function request(path, init) {
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return parseApiResponse(response);
}
export function buildApiUrl(path) {
    return `${API_BASE_URL}${path}`;
}
export function buildFileDownloadUrl(fileId) {
    return `${API_BASE_URL}/files/${fileId}/download`;
}
export function buildFilePreviewUrl(fileId) {
    return `${API_BASE_URL}/files/${fileId}/download?inline=true`;
}
export async function deleteSessionFile(sessionId, fileId) {
    await request(`/sessions/${sessionId}/files/${fileId}`, {
        method: 'DELETE',
    });
}
export function buildVncWebsocketUrl(sessionId) {
    const apiBase = API_BASE_URL.startsWith('http')
        ? API_BASE_URL
        : `${window.location.origin}${API_BASE_URL}`;
    const url = new URL(`${apiBase}/sessions/${sessionId}/vnc`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
}
export async function getSessions() {
    const data = await request('/sessions', { method: 'GET' });
    return data.sessions || [];
}
export async function createSession() {
    return request('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}
export async function getSessionDetail(sessionId) {
    return request(`/sessions/${sessionId}`, { method: 'GET' });
}
export async function getSessionFiles(sessionId) {
    const data = await request(`/sessions/${sessionId}/files`, { method: 'GET' });
    return data.files || [];
}
export async function readSessionFile(sessionId, filepath) {
    return request(`/sessions/${sessionId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath }),
    });
}
export async function readShellOutput(sessionId, shellSessionId) {
    return request(`/sessions/${sessionId}/shell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: shellSessionId }),
    });
}
export async function stopSession(sessionId) {
    await request(`/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}
export async function deleteSession(sessionId) {
    await request(`/sessions/${sessionId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}
export async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    return request('/files', {
        method: 'POST',
        body: form,
    });
}
export async function getLLMConfig() {
    return request('/app-config/llm', { method: 'GET' });
}
export async function updateLLMConfig(config) {
    return request('/app-config/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
}
export async function getAgentConfig() {
    return request('/app-config/agent', { method: 'GET' });
}
export async function updateAgentConfig(config) {
    return request('/app-config/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
}
export async function getMcpServers() {
    const data = await request('/app-config/mcp-servers', { method: 'GET' });
    return data.mcp_servers || [];
}
export async function setMcpServerEnabled(serverName, enabled) {
    await request(`/app-config/mcp-servers/${serverName}/enabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
}
export async function getA2aServers() {
    const data = await request('/app-config/a2a-servers', { method: 'GET' });
    return data.a2a_servers || [];
}
export async function setA2aServerEnabled(id, enabled) {
    await request(`/app-config/a2a-servers/${id}/enabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
}
function parseChunk(buffer) {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n\n');
    const rest = parts.pop() || '';
    const events = parts.map((block) => {
        const payload = {};
        for (const line of block.split('\n')) {
            if (line.startsWith('event:'))
                payload.event = line.slice(6).trim();
            if (line.startsWith('data:'))
                payload.data = (payload.data || '') + line.slice(5).trim();
        }
        return payload;
    });
    return { events, rest };
}
export async function openChatStream(sessionId, payload, onEvent, signal) {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
    });
    if (!response.ok || !response.body) {
        throw new ApiError(response.status, '无法建立 SSE 连接');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const result = await reader.read();
        if (result.done)
            break;
        buffer += decoder.decode(result.value, { stream: true });
        const parsed = parseChunk(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
            if (!event.data)
                continue;
            onEvent({
                type: (event.event || 'message'),
                data: JSON.parse(event.data),
            });
        }
    }
}
export async function openSessionsStream(onSessions, signal) {
    const response = await fetch(`${API_BASE_URL}/sessions/stream`, {
        method: 'POST',
        signal,
    });
    if (!response.ok || !response.body) {
        throw new ApiError(response.status, '无法建立会话列表流');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const result = await reader.read();
        if (result.done)
            break;
        buffer += decoder.decode(result.value, { stream: true });
        const parsed = parseChunk(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
            if (!event.data)
                continue;
            const payload = JSON.parse(event.data);
            if (Array.isArray(payload.sessions)) {
                onSessions(payload.sessions);
            }
        }
    }
}
