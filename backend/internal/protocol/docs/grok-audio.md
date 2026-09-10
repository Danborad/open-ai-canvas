# Grok Audio Speech

该插件调用 Grok2API / xAI 兼容的同步文字转语音接口，支持 `grok-voice-latest`、`grok-voice-think-fast-2.0`、`grok-voice-think-fast-1.0` 等多语言语音合成模型，支持 28 款拟真人声音色（默认音色 `Eve`）。

## 接口与鉴权

{{OPERATIONS}}

```http
POST {channel_base_url}/v1/audio/speech
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

## 模型与音色

- **推荐模型**：`grok-voice-latest`、`grok-voice-think-fast-2.0`、`grok-voice-think-fast-1.0`
- **支持音色**：女性音色（`Eve`、`Ara`、`Aurora`、`Celeste`、`Iris`、`Liora`、`Luna`）、男性音色（`Rex`、`Sal`、`Leo`、`Atlas`、`Helios`、`Orion`、`Perseus`）等 28 款原生音色，默认 `Eve`。支持自动映射 OpenAI 常用音色名。
- **音频格式**：`mp3`、`opus`、`aac`、`flac`、`wav`、`pcm`，默认 `mp3`。
- **语速调节**：`speed` 支持 `0.25` ~ `4.0`。

## 参数与字段映射

{{PARAMETERS}}

请求正文示例：

```json
{
  "model": "grok-voice-latest",
  "input": "你好！这是来自 Grok2API 的语音合成测试。",
  "voice": "Eve",
  "response_format": "mp3",
  "speed": 1
}
```

cURL 命令行调用示例：

```bash
curl "{channel_base_url}/v1/audio/speech" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-voice-latest","voice":"Eve","input":"你好！这是来自 Grok2API 的语音合成测试。","response_format":"mp3"}' \
  --output speech.mp3
```

## 响应处理

接口直接返回合成后的音频流二进制文件（如 MP3 数据），由宿主校验 MIME 类型后自动转存持久化。

## 官方资料

- [Grok2API Media API 指南](https://github.com/chenyme/grok2api)
- [xAI API Reference](https://docs.x.ai/docs/api-reference)

{{CONTRACT}}
