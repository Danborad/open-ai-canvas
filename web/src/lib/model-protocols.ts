export type ModelProtocol =
    | "chat-completion"
    | "openai-response"
    | "openai-image"
    | "grok-image"
    | "grok2api-image"
    | "grok2api-video"
    | "grok2api-new-image"
    | "grok2api-new-video"
    | "flow2api-image"
    | "flow2api-video"
    | "volcengine-ark-image"
    | "volcengine-jimeng-image"
    | "openai-audio"
    | "async-audio"
    | "newapi"
    | "newapi-channel-1"
    | "newapi-channel-2"
    | "xai-video"
    | "volcengine-ark-video"
    | "volcengine-jimeng-video"
    | "gemini-veo"
    | "zarklab-image"
    | "zarklab-video";

export type ProtocolCapability = "text" | "image" | "video" | "audio";

export type ModelProtocolDefinition = {
    value: ModelProtocol;
    label: string;
    capability: ProtocolCapability;
    create: string;
    contentType: string;
    poll?: string;
    media: string;
};

export const MODEL_PROTOCOLS: ModelProtocolDefinition[] = [
    { value: "chat-completion", label: "OpenAI Chat Completions", capability: "text", create: "POST /v1/chat/completions", contentType: "application/json", media: "文本与多模态消息" },
    { value: "openai-response", label: "OpenAI Responses", capability: "text", create: "POST /v1/responses", contentType: "application/json", media: "文本与多模态输入" },
    { value: "openai-image", label: "OpenAI Images", capability: "image", create: "POST /v1/images/generations", contentType: "application/json / multipart", media: "生成、编辑与参考图" },
    { value: "grok-image", label: "Grok Images", capability: "image", create: "POST /v1/images/generations / edits", contentType: "application/json", media: "文生图与单张 URL 参考图，不支持蒙版" },
    { value: "grok2api-image", label: "Grok2API 图片", capability: "image", create: "POST /v1/images/generations / edits", contentType: "application/json", media: "Grok 图片生成与编辑，支持画幅、1K/2K 与张数" },
    { value: "grok2api-video", label: "Grok2API 视频", capability: "video", create: "POST /v1/videos/generations", poll: "GET /v1/videos/{request_id}", contentType: "application/json", media: "Grok 视频生成，支持 6/10/15 秒、画幅与 480P/720P" },
    { value: "grok2api-new-image", label: "Grok2API New 图片", capability: "image", create: "POST /v1/images/generations / edits", contentType: "application/json", media: "新版 Web/Console 图片模型，支持比例、尺寸别名、1K/2K 与流式能力" },
    { value: "grok2api-new-video", label: "Grok2API New 视频", capability: "video", create: "POST /v1/videos/generations", poll: "GET /v1/videos/{request_id}", contentType: "application/json", media: "新版 Web/Console 视频模型，支持 1-15 秒、最多 8 张参考图与模型分辨率" },
    { value: "flow2api-image", label: "Flow2API 图片", capability: "image", create: "POST /v1/chat/completions", contentType: "application/json", media: "Nano Banana 图片生成与编辑" },
    { value: "flow2api-video", label: "Flow2API 视频", capability: "video", create: "POST /v1/chat/completions", contentType: "application/json", media: "Veo/Omni 视频生成" },
    { value: "volcengine-ark-image", label: "火山方舟图片", capability: "image", create: "POST /api/v3/images/generations", contentType: "application/json", media: "文生图与 image 参考图，不支持蒙版" },
    { value: "volcengine-jimeng-image", label: "即梦官方图片", capability: "image", create: "POST CVSync2AsyncSubmitTask", poll: "POST CVSync2AsyncGetResult", contentType: "application/json + AK/SK 签名", media: "0-14 张参考图，模型标识填写 req_key" },
    { value: "openai-audio", label: "OpenAI Audio", capability: "audio", create: "POST /v1/audio/speech", contentType: "application/json", media: "文本转语音" },
    { value: "async-audio", label: "异步音频任务", capability: "audio", create: "POST /v1/audio/tasks", poll: "GET /v1/audio/tasks/{task_id}", contentType: "application/json", media: "语音、音效与音乐生成" },
    { value: "newapi", label: "OpenAI / NewAPI Videos", capability: "video", create: "POST /v1/videos", poll: "GET /v1/videos/{task_id}", contentType: "multipart/form-data", media: "input_reference[] 参考图" },
    { value: "newapi-channel-1", label: "NewAPI 媒体任务", capability: "video", create: "POST /v1/videos", poll: "GET /v1/videos/{task_id}", contentType: "application/json", media: "图片、视频、音频公网 URL" },
    {
        value: "newapi-channel-2",
        label: "NewAPI Video Generations",
        capability: "video",
        create: "POST /v1/video/generations",
        poll: "GET /v1/video/generations/{task_id}",
        contentType: "application/json",
        media: "image_urls（首帧、尾帧、其他参考图） / video_urls / audio_urls",
    },
    { value: "xai-video", label: "xAI 官方视频", capability: "video", create: "POST /v1/videos/generations", poll: "GET /v1/videos/{request_id}", contentType: "application/json", media: "单张起始图" },
    {
        value: "volcengine-ark-video",
        label: "火山方舟视频",
        capability: "video",
        create: "POST /api/v3/contents/generations/tasks",
        poll: "GET /api/v3/contents/generations/tasks/{task_id}",
        contentType: "application/json",
        media: "图片、视频、音频参考素材",
    },
    { value: "volcengine-jimeng-video", label: "即梦官方视频", capability: "video", create: "POST CVSync2AsyncSubmitTask", poll: "POST CVSync2AsyncGetResult", contentType: "application/json + AK/SK 签名", media: "文本或一张首帧图，模型标识填写 req_key" },
    { value: "gemini-veo", label: "Gemini Veo", capability: "video", create: "POST /v1beta/models/{model}:predictLongRunning", poll: "GET /v1beta/{operation_name}", contentType: "application/json", media: "文本与单张起始图" },
    { value: "zarklab-image", label: "ZarkLab 图片", capability: "image", create: "POST /v1/complete", contentType: "application/json + SSE", media: "Zark 图片生成与编辑，使用 X-API-Key 和 file_id" },
    { value: "zarklab-video", label: "ZarkLab 视频", capability: "video", create: "POST /v1/complete", poll: "SSE generation_complete", contentType: "application/json + SSE", media: "Zark 视频生成、动画与编辑，使用 X-API-Key 和 file_id" },
];

export const MODEL_PROTOCOL_OPTIONS = protocolGroups(MODEL_PROTOCOLS.filter((item) => !item.value.startsWith("volcengine-jimeng-")));

export const SYSTEM_MODEL_PROTOCOL_OPTIONS = protocolGroups(MODEL_PROTOCOLS);

function protocolGroups(protocols: ModelProtocolDefinition[]) {
    return [
        { label: "文本", options: protocolOptions("text") },
        { label: "图片", options: protocolOptions("image") },
        { label: "视频", options: protocolOptions("video") },
        { label: "音频", options: protocolOptions("audio") },
    ].map((group) => ({ ...group, options: group.options.filter((option) => protocols.some((protocol) => protocol.value === option.value)) }));
}

export function modelProtocolDefinition(value?: string) {
    return MODEL_PROTOCOLS.find((item) => item.value === value);
}

export function modelProtocolLabel(value?: string) {
    return modelProtocolDefinition(value)?.label || "自动识别";
}

export function modelProtocolCapability(value?: string) {
    return modelProtocolDefinition(value)?.capability;
}

export function modelProtocolSummary(value?: string) {
    const protocol = modelProtocolDefinition(value);
    if (!protocol) return "保存模型时选择协议后，将在这里显示实际请求方式。";
    return [protocol.create, protocol.contentType, protocol.poll, protocol.media].filter(Boolean).join(" · ");
}

export function normalizeModelProtocol(value: unknown, capability?: ProtocolCapability): ModelProtocol | undefined {
    if (value === "flow2api") return capability === "video" ? "flow2api-video" : "flow2api-image";
    return typeof value === "string" && MODEL_PROTOCOLS.some((item) => item.value === value) ? (value as ModelProtocol) : undefined;
}

function protocolOptions(capability: ProtocolCapability) {
    const options = MODEL_PROTOCOLS.filter((item) => item.capability === capability).map((item) => ({ label: `${item.label} · ${item.create.replace("POST ", "")}`, value: item.value }));
    return options;
}
