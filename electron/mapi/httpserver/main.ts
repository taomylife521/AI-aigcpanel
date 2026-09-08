import express from "express";
import type { Request, Response } from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ipcMain } from "electron";
import { marked } from "marked";
import { Log } from "../log/main";
import ConfigMain from "../config/main";
import { AppEnv } from "../env";
import apiRouter from "./routes/index";
import docHtml from "./doc.html?raw";
import docMd from "./doc.md?raw";
import docMdEn from "./doc.en.md?raw";
import { sendJson } from "./utils";

let server: http.Server | null = null;
let isRunning = false;
let runningPort = 0;
let runningBindAddr = "127.0.0.1";
let runningToken = "";
let runningPublicEnabled = false;

// ── Helpers ──────────────────────────────────────────────────────────────

const getAvailablePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const s = http.createServer();
        s.listen(0, "127.0.0.1", () => {
            const addr = s.address() as { port: number };
            const port = addr.port;
            s.close(() => resolve(port));
        });
        s.on("error", reject);
    });
};

const generateToken = (): string => {
    return (
        crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "")
    );
};

const writeCliAuthFile = (port: number, token: string): void => {
    try {
        const filePath = path.join(AppEnv.userData, "cli-auth.json");
        fs.writeFileSync(filePath, JSON.stringify({ port, token }), "utf-8");
    } catch (e) {
        Log.error("httpserver.writeCliAuthFile.error", e);
    }
};

// ── Express app factory ──────────────────────────────────────────────────

const createApp = (
    port: number,
    internalToken: string,
    publicToken: string,
    publicEnabled: boolean,
) => {
    const app = express();

    // Body parser
    app.use(express.json());

    // CORS
    app.use((_req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization",
        );
        if (_req.method === "OPTIONS") {
            res.status(200).end();
            return;
        }
        next();
    });

    // Doc page (no auth required)
    app.get("/doc", (_req, res) => {
        const bindAddr = publicEnabled ? "0.0.0.0" : "127.0.0.1";
        // 语言选择：?lang=en 优先，其次 Accept-Language
        let lang = "zh";
        if (typeof _req.query.lang === "string" && _req.query.lang) {
            lang = _req.query.lang;
        } else {
            const accept = _req.headers["accept-language"] || "";
            if (accept.startsWith("en")) {
                lang = "en";
            }
        }
        const md = lang === "en" ? docMdEn : docMd;
        const mdRendered = marked(md, { breaks: true, gfm: true }) as string;
        const title = lang === "en" ? "AIGCPanel API Documentation" : "AIGCPanel HTTP 接口文档";
        let html = docHtml
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(/\{\{PORT\}\}/g, String(port))
            .replace(/\{\{BIND_ADDR\}\}/g, bindAddr)
            .replace(/\{\{CONTENT\}\}/g, mdRendered);
        res.status(200)
            .set("Content-Type", "text/html; charset=utf-8")
            .send(html);
    });

    // Auth middleware: accept internal token always;
    // also accept public token when public mode is on
    app.use((req, res, next) => {
        const auth = req.headers["authorization"] || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

        if (token === internalToken) {
            next();
            return;
        }

        if (publicEnabled && publicToken && token === publicToken) {
            next();
            return;
        }

        res.status(401).json({ code: -1, msg: "Unauthorized" });
    });

    // API routes
    app.use(apiRouter);

    // 404 fallback
    app.use((_req: Request, res: Response) => {
        sendJson(res, 404, { code: -1, msg: "Not found" });
    });

    return app;
};

// ── Lifecycle ────────────────────────────────────────────────────────────

const start = async (port?: number): Promise<void> => {
    if (isRunning) {
        await stop();
    }

    // Read config
    const enabled = await ConfigMain.get("httpServerEnabled", true);
    if (!enabled) {
        Log.info("httpserver.start skipped (disabled by config)");
        return;
    }

    const configPort = await ConfigMain.get("httpServerPort", 0);
    const resolvedPort = port || configPort || (await getAvailablePort());

    const publicEnabled = await ConfigMain.get(
        "httpServerPublicEnabled",
        false,
    );
    const publicToken = await ConfigMain.get("httpServerPublicToken", "");

    // Generate internal token if not exists
    let internalToken = await ConfigMain.get("httpServerToken", "");
    if (!internalToken) {
        internalToken = generateToken();
        await ConfigMain.set("httpServerToken", internalToken);
    }

    // Determine bind address
    const bindAddr = publicEnabled ? "0.0.0.0" : "127.0.0.1";

    return new Promise((resolve, reject) => {
        const app = createApp(
            resolvedPort,
            internalToken,
            publicToken,
            publicEnabled,
        );
        const s = http.createServer(app);
        s.listen(resolvedPort, bindAddr, async () => {
            server = s;
            isRunning = true;
            runningPort = resolvedPort;
            runningBindAddr = bindAddr;
            runningToken = internalToken;
            runningPublicEnabled = publicEnabled;

            await ConfigMain.set("httpServerPort", resolvedPort);
            writeCliAuthFile(resolvedPort, internalToken);
            Log.info("httpserver.start", {
                port: resolvedPort,
                bindAddr,
                publicEnabled,
            });
            resolve();
        });
        s.on("error", (err: any) => {
            Log.error("httpserver.error", err);
            reject(err);
        });
    });
};

const stop = async (): Promise<void> => {
    return new Promise((resolve) => {
        if (!server) {
            isRunning = false;
            runningPort = 0;
            resolve();
            return;
        }
        server.close(() => {
            server = null;
            isRunning = false;
            runningPort = 0;
            runningBindAddr = "127.0.0.1";
            runningPublicEnabled = false;
            resolve();
        });
    });
};

const status = () => ({
    running: isRunning,
    port: runningPort,
    bindAddr: runningBindAddr,
    publicEnabled: runningPublicEnabled,
});

// ── IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle("httpserver:status", async () => {
    return status();
});

ipcMain.handle("httpserver:start", async () => {
    try {
        await start();
        return { code: 0 };
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
});

ipcMain.handle("httpserver:stop", async () => {
    await stop();
    return { code: 0 };
});

ipcMain.handle("httpserver:restart", async () => {
    try {
        await start();
        return { code: 0 };
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
});

ipcMain.handle("httpserver:getPort", async () => {
    return await ConfigMain.get("httpServerPort", 0);
});

ipcMain.handle("httpserver:setPort", async (_, port: number) => {
    await ConfigMain.set("httpServerPort", port);
    if (isRunning) {
        try {
            await start();
        } catch (e) {
            return { code: -1, msg: String(e) };
        }
    }
    return { code: 0 };
});

ipcMain.handle("httpserver:getEnabled", async () => {
    return await ConfigMain.get("httpServerEnabled", true);
});

ipcMain.handle("httpserver:setEnabled", async (_, enabled: boolean) => {
    await ConfigMain.set("httpServerEnabled", enabled);
    if (enabled) {
        try {
            await start();
        } catch (e) {
            return { code: -1, msg: String(e) };
        }
    } else {
        await stop();
    }
    return { code: 0 };
});

ipcMain.handle("httpserver:getConfig", async () => {
    const port = await ConfigMain.get("httpServerPort", 0);
    const enabled = await ConfigMain.get("httpServerEnabled", true);
    const publicEnabled = await ConfigMain.get("httpServerPublicEnabled", false);
    const publicToken = await ConfigMain.get("httpServerPublicToken", "");
    const internalToken = await ConfigMain.get("httpServerToken", "");
    return { port, enabled, publicEnabled, publicToken, internalToken };
});

ipcMain.handle("httpserver:setConfig", async (_, config: any) => {
    if (config.port !== undefined)
        await ConfigMain.set("httpServerPort", config.port);
    if (config.enabled !== undefined)
        await ConfigMain.set("httpServerEnabled", config.enabled);
    if (config.publicEnabled !== undefined)
        await ConfigMain.set("httpServerPublicEnabled", config.publicEnabled);
    if (config.publicToken !== undefined)
        await ConfigMain.set("httpServerPublicToken", config.publicToken);
    // Restart if currently running
    if (isRunning) {
        try {
            await start();
        } catch (e) {
            return { code: -1, msg: String(e) };
        }
    }
    return { code: 0 };
});

export const HttpServerMain = {
    start,
    stop,
    status,
};

export default HttpServerMain;