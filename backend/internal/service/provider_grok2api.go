package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

func runGrok2APINewImageTask(ctx context.Context, input canvasGenerationInput) (map[string]interface{}, error) {
	body, requestPath, err := grok2APINewImageRequestBody(input)
	if err != nil {
		return nil, err
	}
	var payload imageResponse
	if err := postJSON(ctx, input.Config, requestPath, body, &payload); err != nil {
		return nil, err
	}
	images, err := imageDataURLs(payload)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"mode": "image", "images": images}, nil
}

func grok2APINewImageRequestBody(input canvasGenerationInput) (map[string]interface{}, string, error) {
	if input.Mask != nil {
		return nil, "", errors.New("Grok2API New 图片编辑不支持蒙版，请移除蒙版后重试")
	}
	modelName := strings.TrimSpace(input.Config.Model)
	if !isGrok2APINewImageModel(modelName) {
		return nil, "", errors.New("Grok2API New 图片模型必须使用完整的 Web/ 或 Console/ 模型 ID")
	}
	count := normalizeGrok2APINewImageCount(input.Config.Count)
	referenceCount := len(input.ReferenceImages)
	if referenceCount > 0 {
		if err := validateGrok2APINewImageEdit(modelName, referenceCount, count); err != nil {
			return nil, "", err
		}
	} else if strings.EqualFold(modelName, "Web/grok-imagine-image-edit") {
		return nil, "", errors.New("Web/grok-imagine-image-edit 只能用于图片编辑")
	}
	body := map[string]interface{}{
		"model":           modelName,
		"prompt":          withSystemPrompt(input.Config, input.Prompt),
		"n":               count,
		"response_format": "b64_json",
	}
	if !strings.EqualFold(modelName, "Web/grok-imagine-image-lite") {
		body["aspect_ratio"] = normalizeGrok2APIImageAspectRatio(input.Config.Size)
		body["resolution"] = normalizeGrok2APINewImageResolution(modelName, input.Config.Quality, referenceCount > 0)
	}
	if referenceCount == 0 {
		return body, "/images/generations", nil
	}
	images := make([]map[string]string, 0, referenceCount)
	for _, image := range input.ReferenceImages {
		value, err := openAIImageInputURL(image)
		if err != nil {
			return nil, "", err
		}
		images = append(images, map[string]string{"url": value})
	}
	if len(images) == 1 {
		body["image"] = images[0]
	} else {
		body["images"] = images
	}
	return body, "/images/edits", nil
}

func isGrok2APINewImageModel(modelName string) bool {
	value := strings.ToLower(strings.TrimSpace(modelName))
	if !strings.HasPrefix(value, "web/") && !strings.HasPrefix(value, "console/") {
		return false
	}
	return strings.Contains(value, "grok-imagine-image")
}

func normalizeGrok2APINewImageCount(value string) int {
	count := normalizeGrok2APIImageCount(value)
	if count > 10 {
		return 10
	}
	return count
}

func normalizeGrok2APINewImageResolution(modelName string, value string, editing bool) string {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if editing && strings.HasPrefix(modelName, "web/") {
		return "1k"
	}
	if modelName == "web/grok-imagine-image-2.0" {
		return "1k"
	}
	return normalizeGrok2APIImageResolution(value)
}

func validateGrok2APINewImageEdit(modelName string, referenceCount int, count int) error {
	value := strings.ToLower(strings.TrimSpace(modelName))
	if strings.HasPrefix(value, "web/") {
		if strings.HasSuffix(value, "-lite") {
			return errors.New("Grok2API New 的 Web Lite 模型只支持图片生成")
		}
		if referenceCount > 8 {
			return fmt.Errorf("Grok2API New Web 图片编辑最多支持 8 张参考图，当前连接了 %d 张", referenceCount)
		}
		if count != 1 {
			return errors.New("Grok2API New Web 图片编辑仅支持生成 1 张图片")
		}
		return nil
	}
	if referenceCount > 3 {
		return fmt.Errorf("Grok2API New Console 图片编辑最多支持 3 张参考图，当前连接了 %d 张", referenceCount)
	}
	return nil
}

func runGrok2APIImageTask(ctx context.Context, input canvasGenerationInput) (map[string]interface{}, error) {
	count := normalizeGrok2APIImageCount(input.Config.Count)
	if count > 4 {
		return nil, errors.New("Grok2API 图片生成张数不能超过 4")
	}
	if input.Mask != nil {
		return nil, errors.New("Grok2API 图片编辑不支持蒙版，请移除蒙版后重试")
	}
	if len(input.ReferenceImages) > 0 && count != 1 {
		return nil, errors.New("Grok2API 图片编辑当前仅支持生成 1 张图片")
	}
	body := map[string]interface{}{
		"model":           input.Config.Model,
		"prompt":          withSystemPrompt(input.Config, input.Prompt),
		"n":               count,
		"aspect_ratio":    normalizeGrok2APIImageAspectRatio(input.Config.Size),
		"resolution":      normalizeGrok2APIImageResolution(input.Config.Quality),
		"response_format": "b64_json",
	}
	if len(input.ReferenceImages) > 0 {
		images := make([]map[string]string, 0, len(input.ReferenceImages))
		for _, image := range input.ReferenceImages {
			value, err := openAIImageInputURL(image)
			if err != nil {
				return nil, err
			}
			images = append(images, map[string]string{"url": value})
		}
		body["images"] = images
	}
	requestPath := "/images/generations"
	if len(input.ReferenceImages) > 0 {
		requestPath = "/images/edits"
	}
	var payload imageResponse
	if err := postJSON(ctx, input.Config, requestPath, body, &payload); err != nil {
		return nil, err
	}
	images, err := imageDataURLs(payload)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"mode": "image", "images": images}, nil
}

func normalizeGrok2APIImageCount(value string) int {
	value = strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(strings.ToLower(value)), "x"), "x")
	count, err := strconv.Atoi(value)
	if err != nil || count <= 0 {
		return 1
	}
	return count
}

func normalizeGrok2APIImageResolution(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "2k", "2x", "medium", "high", "4k", "hd":
		return "2k"
	default:
		return "1k"
	}
}

func normalizeGrok2APIImageAspectRatio(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || value == "auto" {
		return "auto"
	}
	if strings.Contains(value, "-") {
		value = strings.SplitN(value, "-", 2)[0]
	}
	if strings.Contains(value, "x") {
		parts := strings.Split(value, "x")
		if len(parts) == 2 {
			width, widthErr := strconv.Atoi(strings.TrimSpace(parts[0]))
			height, heightErr := strconv.Atoi(strings.TrimSpace(parts[1]))
			if widthErr == nil && heightErr == nil && width > 0 && height > 0 {
				value = nearestGrok2APIImageAspectRatio(float64(width) / float64(height))
			}
		}
	}
	supported := map[string]bool{"auto": true, "1:1": true, "16:9": true, "9:16": true, "4:3": true, "3:4": true, "3:2": true, "2:3": true, "2:1": true, "1:2": true, "19.5:9": true, "9:19.5": true, "20:9": true, "9:20": true}
	if supported[value] {
		return value
	}
	return "auto"
}

func nearestGrok2APIImageAspectRatio(value float64) string {
	candidates := []struct {
		value string
		ratio float64
	}{{"1:1", 1}, {"16:9", 16.0 / 9}, {"9:16", 9.0 / 16}, {"4:3", 4.0 / 3}, {"3:4", 3.0 / 4}, {"3:2", 3.0 / 2}, {"2:3", 2.0 / 3}, {"2:1", 2}, {"1:2", 0.5}, {"19.5:9", 19.5 / 9}, {"9:19.5", 9.0 / 19.5}, {"20:9", 20.0 / 9}, {"9:20", 9.0 / 20}}
	best := candidates[0]
	bestDifference := math.Abs(value - best.ratio)
	for _, candidate := range candidates[1:] {
		if difference := math.Abs(value - candidate.ratio); difference < bestDifference {
			best = candidate
			bestDifference = difference
		}
	}
	return best.value
}
