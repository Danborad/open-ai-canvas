package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type zarkMCPResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  struct {
		StructuredContent struct {
			Success          bool     `json:"success"`
			RunID            string   `json:"run_id"`
			GeneratedFileIDs []string `json:"generated_file_ids"`
			Error            string   `json:"error"`
			Message          string   `json:"message"`
		} `json:"structuredContent"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"result"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type zarkStatusText struct {
	Status           string   `json:"status"`
	Phase            string   `json:"phase"`
	Message          string   `json:"message"`
	GeneratedFileIDs []string `json:"generated_file_ids"`
	Error            string   `json:"error"`
}

type zarkLabFileResponse struct {
	URL         string                 `json:"url"`
	DownloadURL string                 `json:"download_url"`
	PreviewURL  string                 `json:"preview_url"`
	FileURL     string                 `json:"file_url"`
	MimeType    string                 `json:"mime_type"`
	Data        map[string]interface{} `json:"data"`
	File        map[string]interface{} `json:"file"`
}

func runZarkLabMediaTask(ctx context.Context, input canvasGenerationInput, mediaKind string) (map[string]interface{}, error) {
	apiKey := strings.TrimSpace(input.Config.APIKey)
	if apiKey == "" {
		return nil, errors.New("请填写 ZarkLab API Key")
	}
	baseURL := strings.TrimRight(strings.TrimSpace(input.Config.BaseURL), "/")
	if baseURL == "" {
		baseURL = "https://api.zarklab.ai"
	}
	input.Config.BaseURL = baseURL

	prompt := buildZarkMCPPrompt(input, mediaKind)
	fileIDs := make([]string, 0)
	for _, ref := range input.ReferenceImages {
		if fid := extractZarkFileID(ref); fid != "" {
			fileIDs = append(fileIDs, fid)
		}
	}

	arguments := map[string]interface{}{
		"prompt": prompt,
		"wait":   true,
	}
	if len(fileIDs) > 0 {
		arguments["fileIds"] = fileIDs
	}

	mcpPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      time.Now().UnixMilli(),
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      "zark_ai",
			"arguments": arguments,
		},
	}

	rawJSON, err := json.Marshal(mcpPayload)
	if err != nil {
		return nil, fmt.Errorf("序列化 ZarkLab MCP 请求失败：%w", err)
	}

	reqURL := apiURL(baseURL, "/mcp")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(rawJSON))
	if err != nil {
		return nil, fmt.Errorf("构造 ZarkLab MCP 请求失败：%w", err)
	}

	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	ApplyOutboundHeaders(req, input.Config.Headers)

	resp, err := OutboundHTTPClient(providerHTTPTimeout).Do(req)
	if err != nil {
		return nil, fmt.Errorf("ZarkLab 连接失败：%w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取 ZarkLab 响应失败：%w", err)
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("ZarkLab 请求返回错误码 %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var mcpResp zarkMCPResponse
	if err := json.Unmarshal(bodyBytes, &mcpResp); err != nil {
		return nil, fmt.Errorf("解析 ZarkLab 响应失败：%w", err)
	}

	if mcpResp.Error != nil && mcpResp.Error.Message != "" {
		return nil, fmt.Errorf("ZarkLab 报错：%s", mcpResp.Error.Message)
	}

	structContent := mcpResp.Result.StructuredContent
	resultFileIDs := structContent.GeneratedFileIDs

	if len(resultFileIDs) == 0 && len(mcpResp.Result.Content) > 0 {
		for _, c := range mcpResp.Result.Content {
			if c.Type == "text" && c.Text != "" {
				var st zarkStatusText
				if json.Unmarshal([]byte(c.Text), &st) == nil && len(st.GeneratedFileIDs) > 0 {
					resultFileIDs = st.GeneratedFileIDs
					break
				}
			}
		}
	}

	if len(resultFileIDs) == 0 && structContent.RunID != "" {
		resultFileIDs, err = pollZarkRunStatus(ctx, input.Config, structContent.RunID)
		if err != nil {
			return nil, err
		}
	}

	if len(resultFileIDs) == 0 {
		errMsg := firstNonEmpty(structContent.Error, structContent.Message, "ZarkLab 接口未返回生成文件")
		return nil, errors.New(errMsg)
	}

	if mediaKind == "image" {
		images := make([]map[string]string, 0, len(resultFileIDs))
		for _, fid := range resultFileIDs {
			mediaData, mimeType, fetchErr := fetchZarkLabFileContent(ctx, input.Config, fid)
			if fetchErr != nil {
				return nil, fetchErr
			}
			images = append(images, map[string]string{
				"dataUrl":  dataURL(mimeType, mediaData),
				"mimeType": mimeType,
			})
		}
		return map[string]interface{}{"mode": "image", "images": images}, nil
	}

	// video
	videoData, mimeType, fetchErr := fetchZarkLabFileContent(ctx, input.Config, resultFileIDs[0])
	if fetchErr != nil {
		return nil, fetchErr
	}
	return map[string]interface{}{
		"mode": "video",
		"video": map[string]interface{}{
			"dataUrl":  dataURL(mimeType, videoData),
			"mimeType": mimeType,
		},
	}, nil
}

func buildZarkMCPPrompt(input canvasGenerationInput, mediaKind string) string {
	rawPrompt := strings.TrimSpace(input.Prompt)
	modelName := strings.TrimSpace(input.Config.Model)
	if modelName == "" {
		modelName = "auto"
	}

	var sb strings.Builder
	if !strings.HasPrefix(strings.ToLower(rawPrompt), "use ") && !strings.EqualFold(modelName, "auto") {
		sb.WriteString("Use ")
		sb.WriteString(modelName)
		sb.WriteString(": ")
	}
	sb.WriteString(rawPrompt)

	ratio := normalizeZarkLabAspectRatio(input.Config.Size, mediaKind)
	if ratio != "" && !strings.Contains(strings.ToLower(rawPrompt), "aspect ratio") && !strings.Contains(strings.ToLower(rawPrompt), "ratio") {
		sb.WriteString(", aspect ratio ")
		sb.WriteString(ratio)
	}

	if mediaKind == "video" {
		duration := normalizeZarkLabVideoDuration(input.Config.VideoSeconds)
		if !strings.Contains(strings.ToLower(rawPrompt), "duration") && !strings.Contains(strings.ToLower(rawPrompt), "second") {
			sb.WriteString(", ")
			sb.WriteString(strconv.Itoa(duration))
			sb.WriteString("s duration")
		}
		if input.Config.VQuality != "" {
			res := strings.TrimSpace(input.Config.VQuality)
			if !strings.Contains(strings.ToLower(rawPrompt), "resolution") && !strings.Contains(strings.ToLower(rawPrompt), strings.ToLower(res)) {
				sb.WriteString(", ")
				sb.WriteString(res)
				sb.WriteString(" resolution")
			}
		}
	} else {
		// image
		if strings.EqualFold(input.Config.Quality, "High") || strings.EqualFold(input.Config.Quality, "Standard") {
			if !strings.Contains(strings.ToLower(rawPrompt), "quality") {
				sb.WriteString(", ")
				sb.WriteString(input.Config.Quality)
				sb.WriteString(" quality")
			}
		}
	}

	return withSystemPrompt(input.Config, sb.String())
}

func pollZarkRunStatus(ctx context.Context, config providerConfig, runID string) ([]string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	pollPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      time.Now().UnixMilli(),
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      "get_run_status",
			"arguments": map[string]interface{}{"runId": runID},
		},
	}
	rawJSON, _ := json.Marshal(pollPayload)
	reqURL := apiURL(baseURL, "/mcp")

	for deadline := providerPollingDeadline(ctx); time.Now().Before(deadline); {
		if err := sleepContext(ctx, 3*time.Second); err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(rawJSON))
		if err != nil {
			return nil, err
		}
		req.Header.Set("X-API-Key", config.APIKey)
		req.Header.Set("Content-Type", "application/json")
		ApplyOutboundHeaders(req, config.Headers)

		resp, err := OutboundHTTPClient(providerHTTPTimeout).Do(req)
		if err != nil {
			continue
		}
		respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()

		var statusResp zarkMCPResponse
		if json.Unmarshal(respBytes, &statusResp) != nil {
			continue
		}

		if len(statusResp.Result.StructuredContent.GeneratedFileIDs) > 0 {
			return statusResp.Result.StructuredContent.GeneratedFileIDs, nil
		}

		if len(statusResp.Result.Content) > 0 {
			for _, item := range statusResp.Result.Content {
				if item.Type == "text" {
					var st zarkStatusText
					if json.Unmarshal([]byte(item.Text), &st) == nil {
						if len(st.GeneratedFileIDs) > 0 {
							return st.GeneratedFileIDs, nil
						}
						if strings.EqualFold(st.Status, "failed") {
							errMsg := firstNonEmpty(st.Error, st.Message, "ZarkLab 任务生成失败")
							return nil, errors.New(errMsg)
						}
					}
				}
			}
		}

		if strings.EqualFold(statusResp.Result.StructuredContent.Message, "failed") {
			return nil, errors.New("ZarkLab 任务生成失败")
		}
	}

	return nil, errors.New("ZarkLab 任务生成超时")
}

func extractZarkFileID(media providerMedia) string {
	raw := strings.TrimSpace(media.URL)
	if strings.HasPrefix(raw, "file-") || strings.HasPrefix(raw, "zark-") {
		return raw
	}
	if strings.HasPrefix(raw, "asset://file-") {
		return strings.TrimPrefix(raw, "asset://")
	}
	return ""
}

func normalizeZarkLabAspectRatio(value string, mediaKind string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	supported := map[string]bool{
		"1:1": true, "4:5": true, "2:3": true, "3:2": true, "9:16": true, "16:9": true,
		"4:3": true, "3:4": true, "21:9": true, "5:4": true, "9:21": true,
		"4:1": true, "1:4": true, "8:1": true, "1:8": true,
	}
	if supported[value] {
		return value
	}
	if value == "auto" {
		return "1:1"
	}
	if mediaKind == "video" {
		return "16:9"
	}
	return "1:1"
}

func normalizeZarkLabVideoDuration(value string) int {
	seconds, err := strconv.Atoi(strings.TrimSuffix(strings.TrimSpace(strings.ToLower(value)), "s"))
	if err != nil || seconds <= 0 {
		return 5
	}
	if seconds < 3 {
		return 3
	}
	if seconds > 30 {
		return 30
	}
	return seconds
}

func fetchZarkLabFileContent(ctx context.Context, config providerConfig, fileID string) ([]byte, string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	fileInfoURL := apiURL(baseURL, "/media/files/"+url.PathEscape(fileID))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileInfoURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("构造 ZarkLab 文件信息请求失败：%w", err)
	}
	req.Header.Set("X-API-Key", config.APIKey)
	ApplyOutboundHeaders(req, config.Headers)

	resp, err := OutboundHTTPClient(providerHTTPTimeout).Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("查询 ZarkLab 文件信息失败：%w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("查询 ZarkLab 文件信息返回错误状态码：%d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, "", fmt.Errorf("读取 ZarkLab 文件元数据失败：%w", err)
	}

	var info zarkLabFileResponse
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, "", fmt.Errorf("解析 ZarkLab 文件元数据失败：%w", err)
	}

	downloadURL := firstNonEmpty(
		info.DownloadURL,
		info.URL,
		info.PreviewURL,
		info.FileURL,
		stringField(info.Data, "download_url"),
		stringField(info.Data, "url"),
		stringField(info.File, "download_url"),
		stringField(info.File, "url"),
	)

	if downloadURL == "" {
		return nil, "", fmt.Errorf("ZarkLab 文件信息中未包含下载地址：%s", string(data))
	}

	return getProviderExternalBinary(withProviderRequestKind(ctx, "download"), config, downloadURL)
}
