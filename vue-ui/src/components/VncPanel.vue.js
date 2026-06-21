import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps();
const status = ref('未连接');
const display = ref(null);
let rfb = null;
async function connect() {
    if (!props.open || !display.value)
        return;
    disconnect();
    status.value = '连接中';
    try {
        const module = await import('@novnc/novnc/lib/rfb.js');
        const RFB = module.default;
        rfb = new RFB(display.value, props.url, {
            credentials: { username: '', password: '', target: '' },
        });
        const currentRfb = rfb;
        currentRfb.scaleViewport = true;
        currentRfb.background = '#111';
        currentRfb.addEventListener('connect', () => {
            status.value = '已连接';
        });
        currentRfb.addEventListener('disconnect', () => {
            status.value = '已断开';
        });
    }
    catch (error) {
        status.value = error instanceof Error ? error.message : '连接失败';
    }
}
function disconnect() {
    if (!rfb)
        return;
    try {
        rfb.disconnect();
    }
    catch {
        // noop
    }
    rfb = null;
}
watch(() => [props.open, props.url], () => {
    if (props.open)
        connect();
    else
        disconnect();
});
onMounted(connect);
onBeforeUnmount(disconnect);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "vnc" },
    ...{ class: ({ 'vnc--hidden': !__VLS_ctx.open }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview__header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.status);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ref: "display",
    ...{ class: "vnc__display" },
});
/** @type {typeof __VLS_ctx.display} */ ;
/** @type {__VLS_StyleScopedClasses['vnc']} */ ;
/** @type {__VLS_StyleScopedClasses['preview__header']} */ ;
/** @type {__VLS_StyleScopedClasses['vnc__display']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            status: status,
            display: display,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
