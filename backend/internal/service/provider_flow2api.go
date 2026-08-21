package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Flow2API 使用 OpenAI 兼容的 /v1/chat/completions，但图片/视频结果以 Markdown 或 HTML 返回。
// 画幅与分辨率走 generationConfig.imageConfig，短模型名（如 Nano Banana 2）由上游自动解析。

var (
	flow2APIMarkdownImageRe = regexp.MustCompile(`!\[[^\]]*]\(([^)\s]+)\)`)
	flow2APIHTMLVideoRe     = regexp.MustCompile(`(?i)<video[^>]+src=['"]([^'"]+)['"]`)
	flow2APIAnyURLRe        = regexp.MustCompile(`https?://[^\s"'<>\]]+|data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+`)
)

func runFlow2APIImageTask(ctx context.Context, input canvasGenerationInput) (map[string]interface{}, error) {
	body, err := flow2APIChatBody(input, "image")
	if err != nil {
		return nil, err
	}
	var payload map[string]interface{}
	if err := postJSON(ctx, input.Config, "/chat/completions", body, &payload); err != nil {
		return nil, err
	}
	content := extractChatCompletionText(payload)
	if content == "" {
		return nil, errors.New("Flow2API 没有返回图片内容")
	}
	mediaURLs := flow2APIExtractMediaURLs(content, "image")
	if len(mediaURLs) == 0 {
		return nil, fmt.Errorf("Flow2API 未解析到图片地址：%s", truncateRunes(content, 180))
	}
	// 同一响应可能含 /tmp 缓存与上游源链；任一成功即可，避免单链 404/401 直接失败。
	dataURL, err := flow2APIResolveFirstMediaDataURL(ctx, input.Config, mediaURLs)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"mode": "image", "images": []map[string]string{{"dataUrl": dataURL}}}, nil
}

func runFlow2APIVideoTask(ctx context.Context, input canvasGenerationInput) (map[string]interface{}, error) {
	body, err := flow2APIChatBody(input, "video")
	if err != nil {
		return nil, err
	}
	var payload map[string]interface{}
	if err := postJSON(ctx, input.Config, "/chat/completions", body, &payload); err != nil {
		return nil, err
	}
	content := extractChatCompletionText(payload)
	if content == "" {
		return nil, errors.New("Flow2API 没有返回视频内容")
	}
	mediaURLs := flow2APIExtractMediaURLs(content, "video")
	if len(mediaURLs) == 0 {
		return nil, fmt.Errorf("Flow2API 未解析到视频地址：%s", truncateRunes(content, 180))
	}
	var lastErr error
	for _, mediaURL := range mediaURLs {
		data, mimeType, err := flow2APIFetchBinary(ctx, input.Config, mediaURL)
		if err != nil {
			lastErr = err
			continue
		}
		if mimeType == "" {
			mimeType = "video/mp4"
		}
		return map[string]interface{}{"mode": "video", "video": map[string]interface{}{"dataUrl": dataURL(mimeType, data), "mimeType": mimeType}}, nil
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("Flow2API 视频下载失败")
}

func flow2APIChatBody(input canvasGenerationInput, mode string) (map[string]interface{}, error) {
	userContent, err := textChatContent(input)
	if err != nil {
		return nil, err
	}
	messages := make([]map[string]interface{}, 0, 2)
	if systemPrompt := strings.TrimSpace(input.Config.SystemPrompt); systemPrompt != "" {
		messages = append(messages, map[string]interface{}{"role": "system", "content": systemPrompt})
	}
	messages = append(messages, map[string]interface{}{"role": "user", "content": userContent})

	generationConfig := map[string]interface{}{}
	imageConfig := map[string]interface{}{}
	if aspect := flow2APIAspectRatio(input.Config.Size); aspect != "" && mode == "image" {
		imageConfig["aspectRatio"] = aspect
	}
	if imageSize := flow2APIImageSize(input.Config); imageSize != "" && mode == "image" {
		imageConfig["imageSize"] = imageSize
	}
	if mode == "image" {
		count := normalizeFlow2APIImageCount(input.Config.Count)
		if count > 1 {
			imageConfig["numberOfImages"] = count
		}
	}
	if mode == "video" {
		if aspect := flow2APIAspectRatio(input.Config.Size); aspect != "" {
			generationConfig["aspectRatio"] = aspect
		}
		if flow2APIVideoSupportsDuration(input.Config.Model) {
			if duration := flow2APIDurationSeconds(input.Config.VideoSeconds); duration > 0 {
				generationConfig["durationSeconds"] = duration
			}
		}
		count := normalizeFlow2APIImageCount(input.Config.Count)
		if count > 1 {
			generationConfig["numberOfVideos"] = count
		}
	}
	if len(imageConfig) > 0 {
		generationConfig["imageConfig"] = imageConfig
	}

	body := map[string]interface{}{
		"model":    strings.TrimSpace(input.Config.Model),
		"messages": messages,
		// 非流式完整结果更适合后端任务落库；上游仍支持 stream=true。
		"stream": false,
	}
	if len(generationConfig) > 0 {
		body["generationConfig"] = generationConfig
	}
	return body, nil
}

func flow2APIVideoSupportsDuration(modelName string) bool {
	value := strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(value, "omni flash") || strings.Contains(value, "omni-flash") || value == "omni"
}

func flow2APIAspectRatio(size string) string {
	value := strings.ToLower(strings.TrimSpace(size))
	if value == "" || value == "auto" {
		return ""
	}
	// 画布可能传 9:16-2k / 2048x1152 / 9:16
	if strings.Contains(value, "x") {
		parts := strings.Split(value, "x")
		if len(parts) == 2 {
			w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
			h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
			if errW == nil && errH == nil && w > 0 && h > 0 {
				return flow2APIRatioFromWH(w, h)
			}
		}
	}
	base := value
	if idx := strings.Index(base, "-"); idx > 0 {
		base = base[:idx]
	}
	switch base {
	case "1:1", "square":
		return "1:1"
	case "16:9", "landscape":
		return "16:9"
	case "9:16", "portrait":
		return "9:16"
	case "4:3", "four-three", "four_three":
		return "4:3"
	case "3:4", "three-four", "three_four":
		return "3:4"
	case "3:2":
		return "16:9"
	case "2:3":
		return "9:16"
	case "21:9":
		return "16:9"
	default:
		if strings.Contains(base, ":") {
			return base
		}
		return ""
	}
}

func normalizeFlow2APIImageCount(value string) int {
	value = strings.TrimSuffix(strings.TrimSpace(strings.ToLower(value)), "x")
	count, err := strconv.Atoi(value)
	if err != nil || count < 1 {
		return 1
	}
	if count > 4 {
		return 4
	}
	return count
}

func flow2APIRatioFromWH(w, h int) string {
	// 用最接近的 Flow 支持画幅。
	type candidate struct {
		label string
		ratio float64
	}
	options := []candidate{
		{"1:1", 1},
		{"16:9", 16.0 / 9.0},
		{"9:16", 9.0 / 16.0},
		{"4:3", 4.0 / 3.0},
		{"3:4", 3.0 / 4.0},
	}
	actual := float64(w) / float64(h)
	best := options[0]
	bestDiff := flow2APIAbsFloat(actual - best.ratio)
	for _, item := range options[1:] {
		diff := flow2APIAbsFloat(actual - item.ratio)
		if diff < bestDiff {
			best = item
			bestDiff = diff
		}
	}
	return best.label
}

func flow2APIImageSize(config providerConfig) string {
	// Nano Banana 默认档就是 1K；只有 2K 需要通过 imageSize=2k 显式传给 Flow2API。
	// 旧配置里的 high/4k 不再发 4k，统一收敛到 2k。
	quality := strings.ToLower(strings.TrimSpace(config.Quality))
	switch quality {
	case "4k", "high", "2k", "medium":
		return "2K"
	case "1k", "low", "auto", "":
		return "1K"
	default:
		return "1K"
	}
}

func flow2APIVideoOutputSize(vquality string) string {
	value := strings.ToLower(strings.TrimSpace(vquality))
	switch {
	case value == "" || value == "auto":
		return ""
	case strings.Contains(value, "4k") || value == "2160" || value == "2160p":
		return "1080p"
	case strings.Contains(value, "1080") || value == "high":
		return "1080p"
	default:
		return ""
	}
}

func flow2APIDurationSeconds(value string) int {
	raw := strings.TrimSpace(strings.ToLower(value))
	raw = strings.TrimSuffix(raw, "s")
	if raw == "" {
		return 0
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return 0
	}
	return seconds
}

func flow2APIExtractMediaURLs(content string, mode string) []string {
	seen := map[string]bool{}
	urls := make([]string, 0, 4)
	add := func(raw string) {
		value := strings.TrimSpace(raw)
		value = strings.Trim(value, "\"'`")
		if value == "" || seen[value] {
			return
		}
		seen[value] = true
		urls = append(urls, value)
	}
	if mode == "video" {
		for _, match := range flow2APIHTMLVideoRe.FindAllStringSubmatch(content, -1) {
			if len(match) > 1 {
				add(match[1])
			}
		}
	}
	for _, match := range flow2APIMarkdownImageRe.FindAllStringSubmatch(content, -1) {
		if len(match) > 1 {
			add(match[1])
		}
	}
	for _, match := range flow2APIAnyURLRe.FindAllString(content, -1) {
		if mode == "video" {
			lower := strings.ToLower(match)
			if strings.Contains(lower, ".mp4") || strings.Contains(lower, "/tmp/") || strings.HasPrefix(lower, "http") {
				add(match)
			}
			continue
		}
		add(match)
	}
	// 优先使用 Flow2API 本地 /tmp 缓存，避免直连上游云存储签名 URL 时 401。
	preferLocal := make([]string, 0, len(urls))
	others := make([]string, 0, len(urls))
	for _, item := range urls {
		lower := strings.ToLower(item)
		if strings.Contains(lower, "/tmp/") || strings.HasPrefix(lower, "data:") {
			preferLocal = append(preferLocal, item)
		} else {
			others = append(others, item)
		}
	}
	return append(preferLocal, others...)
}

func flow2APIResolveFirstMediaDataURL(ctx context.Context, config providerConfig, mediaURLs []string) (string, error) {
	var lastErr error
	for _, mediaURL := range mediaURLs {
		dataURLValue, err := flow2APIResolveMediaDataURL(ctx, config, mediaURL)
		if err != nil {
			lastErr = err
			continue
		}
		return dataURLValue, nil
	}
	if lastErr != nil {
		return "", lastErr
	}
	return "", errors.New("Flow2API 图片下载失败")
}

func flow2APIResolveMediaDataURL(ctx context.Context, config providerConfig, mediaURL string) (string, error) {
	if strings.HasPrefix(mediaURL, "data:") {
		return mediaURL, nil
	}
	data, mimeType, err := flow2APIFetchBinary(ctx, config, mediaURL)
	if err != nil {
		return "", err
	}
	if mimeType == "" {
		mimeType = "image/png"
	}
	return dataURL(mimeType, data), nil
}

func flow2APIFetchBinary(ctx context.Context, config providerConfig, mediaURL string) ([]byte, string, error) {
	resolved, err := flow2APIAbsoluteURL(config.BaseURL, mediaURL)
	if err != nil {
		return nil, "", err
	}
	// 上游云存储签名 URL 加 Bearer 会 401；仅对本机 Flow2API /tmp 可选带 key。
	withAuth := flow2APIShouldAttachAuth(config.BaseURL, resolved)
	data, mimeType, status, body, err := flow2APIDoDownload(ctx, resolved, config.APIKey, withAuth)
	if err != nil {
		return nil, "", err
	}
	if status >= 200 && status < 300 {
		return data, mimeType, nil
	}
	// 带鉴权失败时再试一次无鉴权（签名 URL / 公开 /tmp）。
	if withAuth && (status == 401 || status == 403) {
		data2, mime2, status2, body2, err2 := flow2APIDoDownload(ctx, resolved, "", false)
		if err2 == nil && status2 >= 200 && status2 < 300 {
			return data2, mime2, nil
		}
		if err2 != nil {
			return nil, "", fmt.Errorf("下载 Flow2API 媒体失败：%w", err2)
		}
		return nil, "", fmt.Errorf("下载 Flow2API 媒体失败：HTTP %d %s", status2, truncateRunes(string(body2), 120))
	}
	return nil, "", fmt.Errorf("下载 Flow2API 媒体失败：HTTP %d %s", status, truncateRunes(string(body), 120))
}

func flow2APIShouldAttachAuth(baseURL string, mediaURL string) bool {
	parsedMedia, err := url.Parse(mediaURL)
	if err != nil || parsedMedia.Host == "" {
		return false
	}
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	if err != nil || base.Host == "" {
		return false
	}
	// 仅 Flow2API 同源路径才带渠道 key；外链签名地址不能加 Authorization。
	return strings.EqualFold(parsedMedia.Host, base.Host)
}

func flow2APIDoDownload(ctx context.Context, resolved string, apiKey string, withAuth bool) ([]byte, string, int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, resolved, nil)
	if err != nil {
		return nil, "", 0, nil, err
	}
	if withAuth {
		if key := strings.TrimSpace(apiKey); key != "" && key != "system" {
			req.Header.Set("Authorization", "Bearer "+key)
		}
	}
	client := OutboundHTTPClient(providerHTTPTimeout)
	if deadline, ok := ctx.Deadline(); ok {
		if remaining := time.Until(deadline); remaining > 0 && remaining < providerHTTPTimeout {
			client = OutboundHTTPClient(remaining)
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", 0, nil, fmt.Errorf("下载 Flow2API 媒体失败：%w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxProviderResponseBytes+1))
	if err != nil {
		return nil, "", resp.StatusCode, nil, err
	}
	if int64(len(data)) > maxProviderResponseBytes {
		return nil, "", resp.StatusCode, nil, errors.New("Flow2API 媒体超过大小限制")
	}
	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		ext := strings.ToLower(path.Ext(resolved))
		switch ext {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".webp":
			mimeType = "image/webp"
		case ".png":
			mimeType = "image/png"
		case ".mp4":
			mimeType = "video/mp4"
		case ".webm":
			mimeType = "video/webm"
		}
	}
	return data, mimeType, resp.StatusCode, data, nil
}

func flow2APIAbsoluteURL(baseURL string, mediaURL string) (string, error) {
	value := strings.TrimSpace(mediaURL)
	if value == "" {
		return "", errors.New("Flow2API 媒体地址为空")
	}
	if strings.HasPrefix(value, "data:") {
		return value, nil
	}
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	base = strings.TrimSuffix(base, "/v1")
	base = strings.TrimSuffix(base, "/v1beta")
	if base == "" {
		return "", errors.New("Flow2API Base URL 无效")
	}
	// Flow 返回的 /tmp 缓存应始终走渠道 BaseURL，避免 127.0.0.1 / 错误 host 在容器内 404。
	if parsed, err := url.Parse(value); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		if strings.HasPrefix(parsed.Path, "/tmp/") {
			return strings.TrimRight(base, "/") + parsed.Path, nil
		}
		return value, nil
	}
	if strings.HasPrefix(value, "/") {
		return base + value, nil
	}
	if strings.HasPrefix(value, "tmp/") {
		return base + "/" + value, nil
	}
	joined, err := url.JoinPath(base, value)
	if err != nil {
		return base + "/" + value, nil
	}
	return joined, nil
}

func flow2APIAbsFloat(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}
