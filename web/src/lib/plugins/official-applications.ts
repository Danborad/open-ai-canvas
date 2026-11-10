import { ART_CRITIQUE_PLUGIN_ID } from "@/lib/art-critique/contracts";
import { EAGLE_PLUGIN_ID } from "@/lib/plugins/builtin/eagle";
import { PROMPT_OPTIMIZER_PLUGIN_ID } from "@/lib/plugins/builtin/prompt-optimizer";
import { RUNNINGHUB_PLUGIN_ID } from "@/lib/plugins/builtin/workflows";

/** 用户页与管理页共用的官方应用清单；应用由用户自主启停，区别于系统协议。 */
export const OFFICIAL_APPLICATION_PLUGIN_IDS = [RUNNINGHUB_PLUGIN_ID, EAGLE_PLUGIN_ID, PROMPT_OPTIMIZER_PLUGIN_ID, ART_CRITIQUE_PLUGIN_ID, "user-feedback"] as const;

export const EXTENDED_APPLICATION_PLUGIN_IDS = [
    "media-conversion",
    "composer-image-paste",
    "wecom-daily-report",
    "user-storage-status",
    "user-feedback",
] as const;

const officialApplicationIdSet = new Set<string>(OFFICIAL_APPLICATION_PLUGIN_IDS);
const extendedApplicationIdSet = new Set<string>(EXTENDED_APPLICATION_PLUGIN_IDS);

/** 判断插件是否为官方原生应用型插件。 */
export function isOfficialApplicationPluginId(pluginId: string) {
    return officialApplicationIdSet.has(pluginId);
}

/** 判断插件是否为扩展应用型插件（含官方与本地内置扩展）。 */
export function isApplicationPluginLike(pluginId: string) {
    return officialApplicationIdSet.has(pluginId) || extendedApplicationIdSet.has(pluginId);
}
