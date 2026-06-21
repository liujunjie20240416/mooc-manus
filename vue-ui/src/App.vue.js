import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Composer from './components/Composer.vue';
import PreviewPanel from './components/PreviewPanel.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import Sidebar from './components/Sidebar.vue';
import Timeline from './components/Timeline.vue';
import VncPanel from './components/VncPanel.vue';
import { buildFileDownloadUrl, buildVncWebsocketUrl, createSession, deleteSessionFile, deleteSession, getA2aServers, getAgentConfig, getLLMConfig, getMcpServers, getSessionDetail, getSessionFiles, getSessions, openChatStream, openSessionsStream, readSessionFile, setA2aServerEnabled, setMcpServerEnabled, stopSession, updateAgentConfig, updateLLMConfig, uploadFile, } from './lib/api';
import { canPreviewFile, dedupeSessionFiles, eventsToTimeline, normalizeEvents } from './lib/session';
const sessions = ref([]);
const selectedSessionId = ref(null);
const currentSession = ref(null);
const events = ref([]);
const files = ref([]);
const selectedFile = ref(null);
const selectedFileContent = ref('');
const selectedFilePath = ref('');
const selectedTool = ref(null);
const loading = ref(false);
const sending = ref(false);
const previewLoading = ref(false);
const errorMessage = ref('');
const settingsOpen = ref(false);
const settingsSaving = ref(false);
const llmConfig = ref({});
const agentConfig = ref({});
const mcpServers = ref([]);
const a2aServers = ref([]);
const vncOpen = ref(false);
const streamController = ref(null);
const sessionsStreamController = ref(null);
const timeline = computed(() => eventsToTimeline(events.value));
const vncUrl = computed(() => (selectedSessionId.value ? buildVncWebsocketUrl(selectedSessionId.value) : ''));
async function loadSessions() {
    sessions.value = await getSessions();
    if (!selectedSessionId.value && sessions.value.length > 0) {
        selectedSessionId.value = sessions.value[0].session_id;
    }
}
async function loadSettings() {
    const [llm, agent, mcp, a2a] = await Promise.all([
        getLLMConfig(),
        getAgentConfig(),
        getMcpServers(),
        getA2aServers(),
    ]);
    llmConfig.value = llm;
    agentConfig.value = agent;
    mcpServers.value = mcp;
    a2aServers.value = a2a;
}
async function loadSession(sessionId) {
    loading.value = true;
    errorMessage.value = '';
    try {
        const [detail, fileList] = await Promise.all([
            getSessionDetail(sessionId),
            getSessionFiles(sessionId),
        ]);
        currentSession.value = detail;
        events.value = normalizeEvents(detail.events);
        files.value = dedupeSessionFiles(fileList);
    }
    catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '加载会话失败';
    }
    finally {
        loading.value = false;
    }
}
function appendEvent(event) {
    events.value = [...events.value, event];
    if (event.type === 'title' && currentSession.value) {
        const title = event.data.title;
        if (title)
            currentSession.value = { ...currentSession.value, title };
    }
    if (event.type === 'done' && currentSession.value) {
        currentSession.value = { ...currentSession.value, status: 'completed' };
    }
    if (event.type === 'wait' && currentSession.value) {
        currentSession.value = { ...currentSession.value, status: 'waiting' };
    }
}
function stopActiveStream() {
    streamController.value?.abort();
    streamController.value = null;
}
async function openPassiveStream(sessionId) {
    stopActiveStream();
    const controller = new AbortController();
    streamController.value = controller;
    try {
        await openChatStream(sessionId, {}, appendEvent, controller.signal);
    }
    catch (error) {
        if (error.name !== 'AbortError') {
            console.warn(error);
        }
    }
}
async function ensureSelectedSession() {
    if (selectedSessionId.value)
        return selectedSessionId.value;
    const session = await createSession();
    selectedSessionId.value = session.session_id;
    await loadSessions();
    return session.session_id;
}
async function handleSend(message, pendingFiles) {
    const sessionId = await ensureSelectedSession();
    if (!currentSession.value || currentSession.value.session_id !== sessionId) {
        await loadSession(sessionId);
    }
    sending.value = true;
    errorMessage.value = '';
    selectedFile.value = null;
    selectedTool.value = null;
    stopActiveStream();
    try {
        const uploaded = await Promise.all(pendingFiles.map((file) => uploadFile(file)));
        files.value = dedupeSessionFiles([...files.value, ...uploaded]);
        const controller = new AbortController();
        streamController.value = controller;
        await openChatStream(sessionId, {
            message,
            attachments: uploaded.map((item) => item.id),
        }, appendEvent, controller.signal);
        await loadSessions();
        await loadSession(sessionId);
    }
    catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '发送失败';
    }
    finally {
        sending.value = false;
    }
}
async function handleCreateSession() {
    const session = await createSession();
    selectedSessionId.value = session.session_id;
    currentSession.value = {
        session_id: session.session_id,
        title: '',
        status: 'pending',
        events: [],
    };
    events.value = [];
    files.value = [];
    selectedFile.value = null;
    selectedFileContent.value = '';
    selectedFilePath.value = '';
    selectedTool.value = null;
    await loadSessions();
}
async function handleOpenFile(file) {
    if (!selectedSessionId.value)
        return;
    selectedFile.value = file;
    selectedTool.value = null;
    selectedFilePath.value = file.filepath;
    errorMessage.value = '';
    if (!canPreviewFile(file)) {
        selectedFileContent.value = '该文件类型暂不支持在线预览，请使用下载按钮查看。';
        return;
    }
    previewLoading.value = true;
    try {
        const data = await readSessionFile(selectedSessionId.value, file.filepath);
        selectedFilePath.value = data.filepath;
        selectedFileContent.value = data.content;
    }
    catch (error) {
        selectedFileContent.value = '在线预览失败，请尝试下载文件查看。';
        errorMessage.value = error instanceof Error ? error.message : '文件预览失败';
    }
    finally {
        previewLoading.value = false;
    }
}
function handleDownloadFile(file) {
    if (!file.id)
        return;
    window.open(buildFileDownloadUrl(file.id), '_blank');
}
async function handleDeleteFile(file) {
    if (!selectedSessionId.value || !file.id)
        return;
    errorMessage.value = '';
    try {
        await deleteSessionFile(selectedSessionId.value, file.id);
        files.value = files.value.filter((item) => item.id !== file.id);
        if (selectedFile.value?.id === file.id) {
            selectedFile.value = null;
            selectedFileContent.value = '';
            selectedFilePath.value = '';
        }
    }
    catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '删除文件失败';
    }
}
async function handleSaveLlm(payload) {
    settingsSaving.value = true;
    try {
        llmConfig.value = await updateLLMConfig(payload);
    }
    finally {
        settingsSaving.value = false;
    }
}
async function handleSaveAgent(payload) {
    settingsSaving.value = true;
    try {
        agentConfig.value = await updateAgentConfig(payload);
    }
    finally {
        settingsSaving.value = false;
    }
}
async function handleToggleMcp(serverName, enabled) {
    await setMcpServerEnabled(serverName, enabled);
    mcpServers.value = await getMcpServers();
}
async function handleToggleA2a(id, enabled) {
    await setA2aServerEnabled(id, enabled);
    a2aServers.value = await getA2aServers();
}
async function handleStopSession() {
    if (!selectedSessionId.value)
        return;
    await stopSession(selectedSessionId.value);
    await loadSession(selectedSessionId.value);
    await loadSessions();
}
async function handleDeleteSession() {
    if (!selectedSessionId.value)
        return;
    const currentId = selectedSessionId.value;
    await deleteSession(currentId);
    selectedSessionId.value = null;
    currentSession.value = null;
    events.value = [];
    files.value = [];
    selectedFile.value = null;
    selectedFileContent.value = '';
    selectedFilePath.value = '';
    selectedTool.value = null;
    await loadSessions();
}
watch(selectedSessionId, async (sessionId) => {
    if (!sessionId)
        return;
    await loadSession(sessionId);
    if (currentSession.value && currentSession.value.status !== 'completed') {
        await openPassiveStream(sessionId);
    }
    else {
        stopActiveStream();
    }
});
onMounted(async () => {
    await Promise.all([loadSessions(), loadSettings()]);
    sessionsStreamController.value = new AbortController();
    openSessionsStream((incoming) => {
        sessions.value = incoming;
    }, sessionsStreamController.value.signal).catch((error) => {
        if (error.name !== 'AbortError') {
            console.warn(error);
        }
    });
});
onBeforeUnmount(() => {
    stopActiveStream();
    sessionsStreamController.value?.abort();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-shell" },
});
/** @type {[typeof Sidebar, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(Sidebar, new Sidebar({
    ...{ 'onCreate': {} },
    ...{ 'onSelect': {} },
    ...{ 'onSettings': {} },
    sessions: (__VLS_ctx.sessions),
    selectedSessionId: (__VLS_ctx.selectedSessionId),
    settingsOpen: (__VLS_ctx.settingsOpen),
}));
const __VLS_1 = __VLS_0({
    ...{ 'onCreate': {} },
    ...{ 'onSelect': {} },
    ...{ 'onSettings': {} },
    sessions: (__VLS_ctx.sessions),
    selectedSessionId: (__VLS_ctx.selectedSessionId),
    settingsOpen: (__VLS_ctx.settingsOpen),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onCreate: (__VLS_ctx.handleCreateSession)
};
const __VLS_7 = {
    onSelect: ((id) => (__VLS_ctx.selectedSessionId = id))
};
const __VLS_8 = {
    onSettings: (...[$event]) => {
        __VLS_ctx.settingsOpen = !__VLS_ctx.settingsOpen;
    }
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "workspace" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "workspace__header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "sidebar__eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.currentSession?.title || '开始一个新任务');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace__actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.vncOpen = !__VLS_ctx.vncOpen;
        } },
    ...{ class: "ghost-button" },
    disabled: (!__VLS_ctx.selectedSessionId),
});
(__VLS_ctx.vncOpen ? '隐藏 VNC' : '显示 VNC');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleStopSession) },
    ...{ class: "ghost-button" },
    disabled: (!__VLS_ctx.selectedSessionId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleDeleteSession) },
    ...{ class: "ghost-button ghost-button--danger" },
    disabled: (!__VLS_ctx.selectedSessionId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace__body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "conversation" },
});
if (__VLS_ctx.errorMessage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error-banner" },
    });
    (__VLS_ctx.errorMessage);
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
}
else if (__VLS_ctx.timeline.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else {
    /** @type {[typeof Timeline, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(Timeline, new Timeline({
        ...{ 'onPreviewTool': {} },
        items: (__VLS_ctx.timeline),
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onPreviewTool': {} },
        items: (__VLS_ctx.timeline),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_12;
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = {
        onPreviewTool: ((tool) => (__VLS_ctx.selectedTool = tool))
    };
    var __VLS_11;
}
/** @type {[typeof Composer, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(Composer, new Composer({
    ...{ 'onSend': {} },
    disabled: (__VLS_ctx.sending),
}));
const __VLS_17 = __VLS_16({
    ...{ 'onSend': {} },
    disabled: (__VLS_ctx.sending),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_19;
let __VLS_20;
let __VLS_21;
const __VLS_22 = {
    onSend: (__VLS_ctx.handleSend)
};
var __VLS_18;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace__side" },
});
if (__VLS_ctx.selectedSessionId) {
    /** @type {[typeof VncPanel, ]} */ ;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(VncPanel, new VncPanel({
        open: (__VLS_ctx.vncOpen),
        url: (__VLS_ctx.vncUrl),
    }));
    const __VLS_24 = __VLS_23({
        open: (__VLS_ctx.vncOpen),
        url: (__VLS_ctx.vncUrl),
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
}
/** @type {[typeof PreviewPanel, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(PreviewPanel, new PreviewPanel({
    ...{ 'onOpenFile': {} },
    ...{ 'onDownloadFile': {} },
    ...{ 'onDeleteFile': {} },
    files: (__VLS_ctx.files),
    activeFile: (__VLS_ctx.selectedFile),
    activeFileContent: (__VLS_ctx.selectedFileContent),
    activeFilePath: (__VLS_ctx.selectedFilePath),
    activeTool: (__VLS_ctx.selectedTool),
    busy: (__VLS_ctx.previewLoading),
}));
const __VLS_27 = __VLS_26({
    ...{ 'onOpenFile': {} },
    ...{ 'onDownloadFile': {} },
    ...{ 'onDeleteFile': {} },
    files: (__VLS_ctx.files),
    activeFile: (__VLS_ctx.selectedFile),
    activeFileContent: (__VLS_ctx.selectedFileContent),
    activeFilePath: (__VLS_ctx.selectedFilePath),
    activeTool: (__VLS_ctx.selectedTool),
    busy: (__VLS_ctx.previewLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_29;
let __VLS_30;
let __VLS_31;
const __VLS_32 = {
    onOpenFile: (__VLS_ctx.handleOpenFile)
};
const __VLS_33 = {
    onDownloadFile: (__VLS_ctx.handleDownloadFile)
};
const __VLS_34 = {
    onDeleteFile: (__VLS_ctx.handleDeleteFile)
};
var __VLS_28;
/** @type {[typeof SettingsPanel, ]} */ ;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(SettingsPanel, new SettingsPanel({
    ...{ 'onClose': {} },
    ...{ 'onSaveLlm': {} },
    ...{ 'onSaveAgent': {} },
    ...{ 'onToggleMcp': {} },
    ...{ 'onToggleA2a': {} },
    open: (__VLS_ctx.settingsOpen),
    llmConfig: (__VLS_ctx.llmConfig),
    agentConfig: (__VLS_ctx.agentConfig),
    mcpServers: (__VLS_ctx.mcpServers),
    a2aServers: (__VLS_ctx.a2aServers),
    saving: (__VLS_ctx.settingsSaving),
}));
const __VLS_36 = __VLS_35({
    ...{ 'onClose': {} },
    ...{ 'onSaveLlm': {} },
    ...{ 'onSaveAgent': {} },
    ...{ 'onToggleMcp': {} },
    ...{ 'onToggleA2a': {} },
    open: (__VLS_ctx.settingsOpen),
    llmConfig: (__VLS_ctx.llmConfig),
    agentConfig: (__VLS_ctx.agentConfig),
    mcpServers: (__VLS_ctx.mcpServers),
    a2aServers: (__VLS_ctx.a2aServers),
    saving: (__VLS_ctx.settingsSaving),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
let __VLS_38;
let __VLS_39;
let __VLS_40;
const __VLS_41 = {
    onClose: (...[$event]) => {
        __VLS_ctx.settingsOpen = false;
    }
};
const __VLS_42 = {
    onSaveLlm: (__VLS_ctx.handleSaveLlm)
};
const __VLS_43 = {
    onSaveAgent: (__VLS_ctx.handleSaveAgent)
};
const __VLS_44 = {
    onToggleMcp: (__VLS_ctx.handleToggleMcp)
};
const __VLS_45 = {
    onToggleA2a: (__VLS_ctx.handleToggleA2a)
};
var __VLS_37;
/** @type {__VLS_StyleScopedClasses['app-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace__header']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button--danger']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace__body']} */ ;
/** @type {__VLS_StyleScopedClasses['conversation']} */ ;
/** @type {__VLS_StyleScopedClasses['error-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace__side']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Composer: Composer,
            PreviewPanel: PreviewPanel,
            SettingsPanel: SettingsPanel,
            Sidebar: Sidebar,
            Timeline: Timeline,
            VncPanel: VncPanel,
            sessions: sessions,
            selectedSessionId: selectedSessionId,
            currentSession: currentSession,
            files: files,
            selectedFile: selectedFile,
            selectedFileContent: selectedFileContent,
            selectedFilePath: selectedFilePath,
            selectedTool: selectedTool,
            loading: loading,
            sending: sending,
            previewLoading: previewLoading,
            errorMessage: errorMessage,
            settingsOpen: settingsOpen,
            settingsSaving: settingsSaving,
            llmConfig: llmConfig,
            agentConfig: agentConfig,
            mcpServers: mcpServers,
            a2aServers: a2aServers,
            vncOpen: vncOpen,
            timeline: timeline,
            vncUrl: vncUrl,
            handleSend: handleSend,
            handleCreateSession: handleCreateSession,
            handleOpenFile: handleOpenFile,
            handleDownloadFile: handleDownloadFile,
            handleDeleteFile: handleDeleteFile,
            handleSaveLlm: handleSaveLlm,
            handleSaveAgent: handleSaveAgent,
            handleToggleMcp: handleToggleMcp,
            handleToggleA2a: handleToggleA2a,
            handleStopSession: handleStopSession,
            handleDeleteSession: handleDeleteSession,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
