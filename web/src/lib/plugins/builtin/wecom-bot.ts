import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";

export const WECOM_BOT_PLUGIN_ID = "wecom-daily-report";

export const wecomBotPlugin: RegisteredPlugin = {
    manifest: {
        id: WECOM_BOT_PLUGIN_ID,
        name: "企业微信每日汇报",
        version: "1.0.0",
        publishedAt: "2026-09-10",
        updatedAt: "2026-09-10",
        apiVersion: PLUGIN_API_VERSION,
        description: "定时将今日平台活跃用户、图片与视频生成量、成功率、Top 创作账号、系统资源占用及 ESA 域名流量汇总发送至企业微信群机器人。",
        author: "影策平台",
        surfaces: ["settings"],
        permissions: ["usage.read"],
        trusted: true,
        contributes: { usageObservers: ["wecom-daily-report"] },
    },
};

registerPlugin(wecomBotPlugin);
