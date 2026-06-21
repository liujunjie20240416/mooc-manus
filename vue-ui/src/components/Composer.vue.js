import { ref } from 'vue';
const props = defineProps();
const emit = defineEmits();
const message = ref('');
const pendingFiles = ref([]);
function onFileChange(event) {
    const input = event.target;
    pendingFiles.value = Array.from(input.files || []);
}
function removeFile(name) {
    pendingFiles.value = pendingFiles.value.filter((file) => file.name !== name);
}
function submit() {
    if (props.disabled)
        return;
    if (!message.value.trim() && pendingFiles.value.length === 0)
        return;
    emit('send', message.value.trim(), pendingFiles.value);
    message.value = '';
    pendingFiles.value = [];
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "composer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
    ...{ onKeydown: (__VLS_ctx.submit) },
    value: (__VLS_ctx.message),
    ...{ class: "composer__input" },
    placeholder: "输入你的任务，例如：总结页面信息，然后在沙箱里执行 pwd。",
    disabled: (__VLS_ctx.disabled),
});
if (__VLS_ctx.pendingFiles.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "composer__files" },
    });
    for (const [file] of __VLS_getVForSourceType((__VLS_ctx.pendingFiles))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            key: (file.name),
            ...{ class: "file-pill" },
        });
        (file.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.pendingFiles.length))
                        return;
                    __VLS_ctx.removeFile(file.name);
                } },
            type: "button",
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "composer__actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "ghost-button composer__upload" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.onFileChange) },
    type: "file",
    multiple: true,
    hidden: true,
    disabled: (__VLS_ctx.disabled),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.submit) },
    ...{ class: "primary-button" },
    disabled: (__VLS_ctx.disabled),
});
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
/** @type {__VLS_StyleScopedClasses['composer__input']} */ ;
/** @type {__VLS_StyleScopedClasses['composer__files']} */ ;
/** @type {__VLS_StyleScopedClasses['file-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['composer__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost-button']} */ ;
/** @type {__VLS_StyleScopedClasses['composer__upload']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            message: message,
            pendingFiles: pendingFiles,
            onFileChange: onFileChange,
            removeFile: removeFile,
            submit: submit,
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
