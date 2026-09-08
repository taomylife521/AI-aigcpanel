import { ipcRenderer } from "electron";

const status = async (): Promise<{
    running: boolean;
    port: number;
    bindAddr: string;
    publicEnabled: boolean;
}> => {
    return ipcRenderer.invoke("httpserver:status");
};

const start = async (): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:start");
};

const stop = async (): Promise<{ code: number }> => {
    return ipcRenderer.invoke("httpserver:stop");
};

const restart = async (): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:restart");
};

const getPort = async (): Promise<number> => {
    return ipcRenderer.invoke("httpserver:getPort");
};

const setPort = async (
    port: number,
): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:setPort", port);
};

const getEnabled = async (): Promise<boolean> => {
    return ipcRenderer.invoke("httpserver:getEnabled");
};

const setEnabled = async (
    enabled: boolean,
): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:setEnabled", enabled);
};

const getConfig = async (): Promise<{
    port: number;
    enabled: boolean;
    publicEnabled: boolean;
    publicToken: string;
    internalToken: string;
}> => {
    return ipcRenderer.invoke("httpserver:getConfig");
};

const setConfig = async (
    config: any,
): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:setConfig", config);
};

export default {
    status,
    start,
    stop,
    restart,
    getPort,
    setPort,
    getEnabled,
    setEnabled,
    getConfig,
    setConfig,
};