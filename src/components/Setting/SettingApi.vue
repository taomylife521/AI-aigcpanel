<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from "vue";
import { Modal } from "@arco-design/web-vue";
import { t, getLocale } from "../../lang";
import MarkdownDocViewer from "../common/MarkdownDocViewer.vue";
import apiDocContent from "../../docs/api-doc.md?raw";
import apiDocContentEn from "../../docs/api-doc.en.md?raw";

const apiDocVisible = ref(false);

// 当前语言
const currentLocale = ref("zh-CN");

// 根据当前语言选择文档内容
const docContent = computed(() => {
    return currentLocale.value.startsWith("en") ? apiDocContentEn : apiDocContent;
});

// Server status
const running = ref(false);
const port = ref(0);
const bindAddr = ref("127.0.0.1");
const publicEnabled = ref(false);

// Config
const enabled = ref(true);
const configPort = ref(0);
const configPublicEnabled = ref(false);
const configPublicToken = ref("");
const editingPort = ref("");
const editingPublicToken = ref("");

const listenAddr = computed(() => {
    if (!running.value) return "-";
    return `${bindAddr.value}:${port.value}`;
});

// ── Lifecycle ────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
    currentLocale.value = await getLocale();
    await loadConfig();
    await loadStatus();
    pollTimer = setInterval(async () => {
        await loadStatus();
    }, 3000);
});

onBeforeUnmount(() => {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
});

async function loadConfig() {
    const c = await window.$mapi.httpserver.getConfig();
    enabled.value = c.enabled;
    configPort.value = c.port;
    configPublicEnabled.value = c.publicEnabled;
    configPublicToken.value = c.publicToken;
    editingPort.value = c.port ? String(c.port) : "";
    editingPublicToken.value = c.publicToken || "";
}

async function loadStatus() {
    const s = await window.$mapi.httpserver.status();
    running.value = s.running;
    port.value = s.port;
    bindAddr.value = s.bindAddr;
    publicEnabled.value = s.publicEnabled;
}

// ── Actions ──────────────────────────────────────────────────────────────

async function toggleEnabled() {
    const newVal = !enabled.value;
    const res = await window.$mapi.httpserver.setEnabled(newVal);
    if (res.code === 0) {
        enabled.value = newVal;
        await loadStatus();
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), { status: "error" });
    }
}

async function togglePublic() {
    if (!configPublicEnabled.value) {
        const ok = await new Promise<boolean>((resolve) => {
            Modal.confirm({
                title: t("api.publicConfirmTitle"),
                content: t("api.publicConfirmContent"),
                okText: t("api.publicConfirmOk"),
                cancelText: t("common.cancel"),
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            });
        });
        if (!ok) return;
    }

    const newVal = !configPublicEnabled.value;
    const res = await window.$mapi.httpserver.setConfig({
        publicEnabled: newVal,
    });
    if (res.code === 0) {
        configPublicEnabled.value = newVal;
        await loadStatus();
        window.$mapi.app.toast(
            newVal ? t("api.publicOnMsg") : t("api.publicOffMsg"),
            { status: "success" },
        );
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), { status: "error" });
    }
}

function choosePort() {
    editingPort.value = String(port.value || configPort.value || 0);
}

async function savePort() {
    const p = parseInt(editingPort.value, 10);
    if (isNaN(p) || p < 1 || p > 65535) {
        window.$mapi.app.toast(t("api.portInvalid"), { status: "error" });
        return;
    }
    const res = await window.$mapi.httpserver.setPort(p);
    if (res.code === 0) {
        configPort.value = p;
        await loadStatus();
        window.$mapi.app.toast(t("api.portSaved"), { status: "success" });
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), { status: "error" });
    }
}

async function savePublicToken() {
    const res = await window.$mapi.httpserver.setConfig({
        publicToken: editingPublicToken.value,
    });
    if (res.code === 0) {
        configPublicToken.value = editingPublicToken.value;
        window.$mapi.app.toast(t("api.tokenSaved"), { status: "success" });
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), { status: "error" });
    }
}
</script>

<template>
    <div>
        <!-- 服务开关 -->
        <div class="flex items-center mb-3">
            <div class="w-24 flex-shrink-0">{{ t("api.service") }}</div>
            <div class="flex items-center gap-3">
                <a-switch
                    :model-value="enabled"
                    @change="toggleEnabled"
                    :disabled="false"
                />
                <span
                    v-if="running"
                    class="text-green-600 text-sm flex items-center gap-1"
                >
                    <span
                        class="inline-block w-2 h-2 rounded-full bg-green-500"
                    ></span>
                    {{ t("api.running") }}
                </span>
                <span v-else class="text-gray-400 text-sm">{{ t("api.stopped") }}</span>
            </div>
        </div>

        <!-- 监听地址 -->
        <div class="flex mb-3">
            <div class="w-24 flex-shrink-0">{{ t("api.listenAddr") }}</div>
            <div class="flex-grow">
                <div
                    class="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 text-sm font-mono inline-block"
                >
                    <template v-if="running">
                        {{ listenAddr }}
                    </template>
                    <template v-else>
                        <span class="text-gray-400">{{ t("api.notStarted") }}</span>
                    </template>
                </div>
            </div>
        </div>

        <!-- 端口设置 -->
        <div class="flex mb-3 items-center">
            <div class="w-24 flex-shrink-0">{{ t("api.listenPort") }}</div>
            <div class="flex items-center gap-2">
                <a-input
                    v-model="editingPort"
                    :placeholder="t('api.listenPort')"
                    style="width: 120px"
                    :disabled="running"
                />
                <a-button
                    size="small"
                    @click="choosePort"
                    :disabled="running"
                >
                    {{ t("api.useCurrentPort") }}
                </a-button>
                <a-button
                    size="small"
                    type="primary"
                    @click="savePort"
                    :disabled="running"
                >
                    {{ t("api.savePort") }}
                </a-button>
                <span v-if="running" class="text-xs text-gray-400">
                    {{ t("api.stopFirstHint") }}
                </span>
            </div>
        </div>

        <!-- 公网访问开关 -->
        <div class="flex mb-3 items-center">
            <div class="w-24 flex-shrink-0">{{ t("api.publicAccess") }}</div>
            <div class="flex items-center gap-3">
                <a-switch
                    :model-value="configPublicEnabled"
                    @change="togglePublic"
                />
                <span
                    v-if="configPublicEnabled"
                    class="text-orange-500 text-sm"
                >
                    {{ t("api.publicOn") }}
                </span>
                <span v-else class="text-gray-400 text-sm">
                    {{ t("api.publicOff") }}
                </span>
            </div>
        </div>

        <!-- 公网 Token -->
        <template v-if="configPublicEnabled">
            <div class="flex mb-3 items-center">
                <div class="w-24 flex-shrink-0">{{ t("api.authToken") }}</div>
                <div class="flex items-center gap-2">
                    <a-input-password
                        v-model="editingPublicToken"
                        :placeholder="t('api.authTokenPlaceholder')"
                        style="width: 280px"
                        allow-clear
                    />
                    <a-button
                        size="small"
                        type="primary"
                        @click="savePublicToken"
                    >
                        {{ t("api.save") }}
                    </a-button>
                    <span
                        v-if="configPublicToken"
                        class="text-xs text-green-600"
                    >
                        {{ t("api.tokenSet") }}
                    </span>
                    <span v-else class="text-xs text-orange-500">
                        {{ t("api.tokenNotSet") }}
                    </span>
                </div>
            </div>
        </template>

        <!-- 查看完整文档 -->
        <div class="flex mb-3">
            <div class="w-24 flex-shrink-0">{{ $t("common.docs") }}</div>
            <div class="flex-grow">
                <a-button @click="apiDocVisible = true">
                    <template #icon><icon-file /></template>
                    {{ t("api.viewDoc") }}
                </a-button>
            </div>
        </div>

        <!-- 完整文档弹窗 -->
        <a-modal
            v-model:visible="apiDocVisible"
            :width="'min(900px, 92vw)'"
            :footer="false"
            title-align="start"
            :body-style="{ padding: '0', height: 'calc(100vh - 12rem)' }"
            :modal-style="{ 'max-height': 'calc(100vh - 4rem)' }"
        >
            <template #title
                ><div class="font-bold">{{ t("api.viewDoc") }}</div></template
            >
            <MarkdownDocViewer :content="docContent" />
        </a-modal>
    </div>
</template>

<style scoped></style>