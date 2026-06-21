import { attachmentLabel } from '../lib/session';
const __VLS_props = defineProps();
const emit = defineEmits();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timeline" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.items))) {
    (item.id);
    if (item.kind === 'message') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "bubble" },
            'data-role': (item.role),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "bubble__role" },
        });
        (item.role);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "bubble__text" },
        });
        (item.message);
        if (item.attachments.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "attachment-list" },
            });
            for (const [attachment] of __VLS_getVForSourceType((item.attachments))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    key: (attachment.file_id || attachment.id || attachment.filename),
                    ...{ class: "file-pill" },
                });
                (__VLS_ctx.attachmentLabel(attachment));
            }
        }
    }
    else if (item.kind === 'step') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "event-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__content" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.step.description);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "status-chip" },
            'data-status': (item.step.status),
        });
        (item.step.status);
    }
    else if (item.kind === 'tool') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ onClick: (...[$event]) => {
                    if (!!(item.kind === 'message'))
                        return;
                    if (!!(item.kind === 'step'))
                        return;
                    if (!(item.kind === 'tool'))
                        return;
                    __VLS_ctx.emit('previewTool', item.tool);
                } },
            ...{ class: "event-card event-card--clickable" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__content" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.tool.function);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "status-chip" },
            'data-status': (item.tool.status || 'calling'),
        });
        (item.tool.status || 'calling');
    }
    else if (item.kind === 'plan') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "event-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ol, __VLS_intrinsicElements.ol)({
            ...{ class: "plan-list" },
        });
        for (const [step] of __VLS_getVForSourceType((item.plan))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                key: (step.id),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (step.description);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "status-chip" },
                'data-status': (step.status),
            });
            (step.status);
        }
    }
    else if (item.kind === 'wait') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "event-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.reason);
    }
    else if (item.kind === 'done') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "event-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.message);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ class: "event-card event-card--error" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "event-card__title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.error);
    }
}
/** @type {__VLS_StyleScopedClasses['timeline']} */ ;
/** @type {__VLS_StyleScopedClasses['bubble']} */ ;
/** @type {__VLS_StyleScopedClasses['bubble__role']} */ ;
/** @type {__VLS_StyleScopedClasses['bubble__text']} */ ;
/** @type {__VLS_StyleScopedClasses['attachment-list']} */ ;
/** @type {__VLS_StyleScopedClasses['file-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__content']} */ ;
/** @type {__VLS_StyleScopedClasses['status-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card--clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__content']} */ ;
/** @type {__VLS_StyleScopedClasses['status-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-list']} */ ;
/** @type {__VLS_StyleScopedClasses['status-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card--error']} */ ;
/** @type {__VLS_StyleScopedClasses['event-card__title']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            attachmentLabel: attachmentLabel,
            emit: emit,
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
