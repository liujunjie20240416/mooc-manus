import { computed } from 'vue';
import { formatRelativeTime } from '../lib/session';
const props = defineProps();
const emit = defineEmits();
const orderedSessions = computed(() => [...props.sessions]);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "sidebar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar__top" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "sidebar__eyebrow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "sidebar__title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('settings');
        } },
    ...{ class: "ghost-button" },
});
(__VLS_ctx.settingsOpen ? '关闭设置' : '打开设置');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('create');
        } },
    ...{ class: "primary-button sidebar__new" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar__section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar__section-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.orderedSessions.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "session-list" },
});
for (const [session] of __VLS_getVForSourceType((__VLS_ctx.orderedSessions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('select', session.session_id);
            } },
        key: (session.session_id),
        ...{ class: "session-card" },
        ...{ class: ({ 'session-card--active': session.session_id === __VLS_ctx.selectedSessionId }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "session-card__row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "session-card__title" },
    });
    (session.title || '未命名任务');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "session-card__row session-card__meta" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.formatRelativeTime(session.latest_message_at));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "status-chip" },
        'data-status': (session.status),
    });
    (session.status);
}
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__top']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__title']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__new']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__section']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar__section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['session-list']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card__row']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card__row']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['status-chip']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatRelativeTime: formatRelativeTime,
            emit: emit,
            orderedSessions: orderedSessions,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
