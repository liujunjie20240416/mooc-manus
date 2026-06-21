import { computed } from 'vue';
import { buildFileDownloadUrl, buildFilePreviewUrl } from '../lib/api';
import { isImageFile, isPdfFile } from '../lib/session';
const props = defineProps();
const emit = defineEmits();
const formattedTool = computed(() => props.activeTool ? JSON.stringify(props.activeTool, null, 2) : '');
const activeFileDownloadUrl = computed(() => (props.activeFile?.id ? buildFileDownloadUrl(props.activeFile.id) : ''));
const activeFilePreviewUrl = computed(() => (props.activeFile?.id ? buildFilePreviewUrl(props.activeFile.id) : ''));
const showImagePreview = computed(() => !!props.activeFile && isImageFile(props.activeFile));
const showPdfPreview = computed(() => !!props.activeFile && isPdfFile(props.activeFile));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "preview" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.files.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__list" },
});
for (const [file] of __VLS_getVForSourceType((__VLS_ctx.files))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (file.id),
        ...{ class: "preview__list-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('openFile', file);
            } },
        ...{ class: "preview__list-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (file.filename);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (file.filepath);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview__list-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('downloadFile', file);
            } },
        ...{ class: "ghost-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('deleteFile', file);
            } },
        ...{ class: "ghost-button ghost-button--danger" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__section preview__body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
if (__VLS_ctx.busy) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
if (__VLS_ctx.activeTool) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
        ...{ class: "preview__code" },
    });
    (__VLS_ctx.formattedTool);
}
else if (__VLS_ctx.activeFilePath) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "preview__path" },
    });
    (__VLS_ctx.activeFilePath);
    if (__VLS_ctx.activeFile?.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ class: "ghost-button" },
            href: (__VLS_ctx.activeFileDownloadUrl),
            target: "_blank",
            rel: "noreferrer",
        });
    }
    if (__VLS_ctx.showImagePreview) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            ...{ class: "preview__media" },
            src: (__VLS_ctx.activeFilePreviewUrl),
            alt: (__VLS_ctx.activeFile?.filename || 'image preview'),
        });
    }
    else if (__VLS_ctx.showPdfPreview) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.iframe)({
            ...{ class: "preview__frame" },
            src: (__VLS_ctx.activeFilePreviewUrl),
            title: "PDF preview",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
            ...{ class: "preview__code" },
        });
        (__VLS_ctx.activeFileContent);
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview__placeholder" },
    });
}
/** @type {__VLS_StyleScopedClasses['preview']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__section']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__header']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__list']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__list-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__list-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button--danger']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__section']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__body']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__header']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__code']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__path']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__media']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__frame']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__code']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__placeholder']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            emit: emit,
            formattedTool: formattedTool,
            activeFileDownloadUrl: activeFileDownloadUrl,
            activeFilePreviewUrl: activeFilePreviewUrl,
            showImagePreview: showImagePreview,
            showPdfPreview: showPdfPreview,
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
