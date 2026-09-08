package service

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"infinite-canvas/backend/internal/model"
)

type canvasMediaAssetReference struct {
	AssetID    string
	ResourceID string
}

// validateCanvasMediaAssets is the final server-side invariant for canvas sync:
// a persisted canvas may only point at an uploaded Resource through an Asset
// owned by the same user. The client writes Assets before canvases, so rejecting
// an incomplete pair prevents a durable Resource-only (ghost capacity) state.
func (s *Service) validateCanvasMediaAssets(userID string, raw json.RawMessage) error {
	references, err := canvasMediaAssetReferences(raw)
	if err != nil {
		return BadAuthRequest("画布媒体数据格式错误")
	}
	if len(references) == 0 {
		return nil
	}

	assetIDSet := make(map[string]struct{}, len(references))
	resourceIDSet := make(map[string]struct{}, len(references))
	for _, reference := range references {
		if reference.AssetID == "" {
			return BadAuthRequest("画布媒体尚未进入素材库，请等待同步完成后重试")
		}
		assetIDSet[reference.AssetID] = struct{}{}
		resourceIDSet[reference.ResourceID] = struct{}{}
	}

	assets, err := s.repo.AssetsForUserIDs(userID, sortedReferenceIDs(assetIDSet))
	if err != nil {
		return err
	}
	assetResources := make(map[string]map[string]struct{}, len(assets))
	for _, asset := range assets {
		assetResources[asset.ID] = documentReferencedResourceIDs(asset.PayloadJSON, resourceIDSet)
	}

	resources, err := s.repo.ResourcesForUserIDs(userID, sortedReferenceIDs(resourceIDSet))
	if err != nil {
		return err
	}
	readyResources := make(map[string]model.Resource, len(resources))
	for _, resource := range resources {
		if resource.Status == model.ResourceStatusReady {
			readyResources[resource.ID] = resource
		}
	}

	for _, reference := range references {
		resource, exists := readyResources[reference.ResourceID]
		if !exists {
			// 对于历史遗留节点或已清理的媒体，若资源表中已无此记录，不阻断画布工程的持久化保存
			continue
		}
		resourceIDs, assetExists := assetResources[reference.AssetID]
		if !assetExists {
			if err := s.ensureAssetRecordForResourceWithID(userID, reference.AssetID, resource); err == nil {
				assetResources[reference.AssetID] = map[string]struct{}{reference.ResourceID: {}}
				continue
			}
			return BadAuthRequest("画布媒体尚未进入素材库，请等待同步完成后重试")
		}
		if _, matches := resourceIDs[reference.ResourceID]; !matches {
			// 节点上记录的 assetId 与当前的云端资源不匹配（例如切换批次主图、删除批次图片或旧节点元数据陈旧），
			// 检查素材库中是否已存在关联该资源的素材记录；若不存在则自动兜底补齐，不阻断画布保存。
			if matched, err := s.repo.AssetForUserReferencingResource(userID, reference.ResourceID); err == nil && matched != nil {
				continue
			}
			if err := s.ensureAssetRecordForResourceWithID(userID, "", resource); err == nil {
				continue
			}
			return BadAuthRequest("画布媒体与素材库记录不一致，请重新同步")
		}
	}
	return nil
}

func (s *Service) ensureAssetRecordForResourceWithID(userID string, assetID string, resource model.Resource) error {
	cleanAssetID := strings.TrimSpace(assetID)
	if cleanAssetID == "" {
		cleanAssetID = newID()
	}
	if utf8.RuneCountInString(cleanAssetID) > model.AssetIDMaxLength {
		cleanAssetID = cleanAssetID[:model.AssetIDMaxLength]
	}
	existing, err := s.repo.AssetForUser(userID, cleanAssetID)
	if err == nil && existing != nil {
		return nil
	}

	now := time.Now().UTC()
	title := strings.TrimSpace(filepath.Base(resource.ObjectKey))
	if title == "" || title == "." || title == "/" {
		title = "画布媒体素材"
	}
	kind := strings.TrimSpace(resource.Kind)
	if kind == "" {
		kind = "image"
	}
	category := model.NormalizeAssetCategory(model.AssetCategoryMaterial, kind)
	storageKey := "resource:" + resource.ID
	fileURL := "/api/resources/" + resource.ID + "/file"
	payload := map[string]any{
		"id":        cleanAssetID,
		"title":     title,
		"kind":      kind,
		"category":  string(category),
		"status":    string(model.AssetVersionStatusConfirmed),
		"source":    "Canvas",
		"createdAt": now.Format(time.RFC3339Nano),
		"updatedAt": now.Format(time.RFC3339Nano),
		"data": map[string]any{
			"storageKey": storageKey,
			"url":        fileURL,
			"dataUrl":    fileURL,
		},
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	newAsset := model.Asset{
		ID:          cleanAssetID,
		UserID:      userID,
		Kind:        kind,
		Category:    category,
		Status:      model.AssetVersionStatusConfirmed,
		Title:       title,
		PayloadJSON: string(payloadBytes),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return s.repo.UpsertAsset(&newAsset)
}

// validateAssetCanvasReferences prevents an Asset update from changing the
// resource behind a canvas that already points at that Asset.
func (s *Service) validateAssetCanvasReferences(userID string, asset model.Asset) error {
	canvases, err := s.repo.CanvasProjects(userID)
	if err != nil {
		return err
	}
	for _, canvas := range canvases {
		references, parseErr := canvasMediaAssetReferences(json.RawMessage(canvas.PayloadJSON))
		if parseErr != nil {
			return BadAuthRequest("已有画布媒体数据无法解析，已停止修改素材")
		}
		for _, reference := range references {
			if reference.AssetID != asset.ID {
				continue
			}
			candidate := map[string]struct{}{reference.ResourceID: {}}
			if !documentReferencesResources(asset.PayloadJSON, candidate) {
				return BadAuthRequest("素材仍被画布引用，不能替换为其他云端资源")
			}
		}
	}
	return nil
}

// validateAssetReplacementCanvasReferences applies the same invariant to the
// legacy full-replacement endpoint, which otherwise could silently remove an
// Asset that a canvas still needs.
func (s *Service) validateAssetReplacementCanvasReferences(userID string, assets []model.Asset) error {
	assetByID := make(map[string]model.Asset, len(assets))
	for _, asset := range assets {
		assetByID[asset.ID] = asset
	}
	canvases, err := s.repo.CanvasProjects(userID)
	if err != nil {
		return err
	}
	for _, canvas := range canvases {
		references, parseErr := canvasMediaAssetReferences(json.RawMessage(canvas.PayloadJSON))
		if parseErr != nil {
			return BadAuthRequest("已有画布媒体数据无法解析，已停止替换素材库")
		}
		for _, reference := range references {
			asset, exists := assetByID[reference.AssetID]
			if !exists {
				return BadAuthRequest("素材仍被画布引用，不能从素材库移除")
			}
			candidate := map[string]struct{}{reference.ResourceID: {}}
			if !documentReferencesResources(asset.PayloadJSON, candidate) {
				return BadAuthRequest("画布媒体与替换后的素材库记录不一致")
			}
		}
	}
	return nil
}

func canvasMediaAssetReferences(raw json.RawMessage) ([]canvasMediaAssetReference, error) {
	var payload struct {
		Nodes []struct {
			Type     string `json:"type"`
			Metadata struct {
				AssetID    string `json:"assetId"`
				StorageKey string `json:"storageKey"`
				Content    string `json:"content"`
			} `json:"metadata"`
		} `json:"nodes"`
		Timeline struct {
			Clips []struct {
				DirectMedia *struct {
					Kind       string `json:"kind"`
					AssetID    string `json:"assetId"`
					StorageKey string `json:"storageKey"`
					URL        string `json:"url"`
					DataURL    string `json:"dataUrl"`
					Content    string `json:"content"`
				} `json:"directMedia"`
			} `json:"clips"`
		} `json:"timeline"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}

	references := make([]canvasMediaAssetReference, 0)
	for _, node := range payload.Nodes {
		if !isCanvasMediaKind(node.Type) {
			continue
		}
		resourceID := firstCanvasResourceID(node.Metadata.StorageKey, node.Metadata.Content)
		if resourceID == "" {
			continue
		}
		references = append(references, canvasMediaAssetReference{
			AssetID: strings.TrimSpace(node.Metadata.AssetID), ResourceID: resourceID,
		})
	}
	for _, clip := range payload.Timeline.Clips {
		media := clip.DirectMedia
		if media == nil || !isCanvasMediaKind(media.Kind) {
			continue
		}
		resourceID := firstCanvasResourceID(media.StorageKey, media.URL, media.DataURL, media.Content)
		if resourceID == "" {
			continue
		}
		references = append(references, canvasMediaAssetReference{
			AssetID: strings.TrimSpace(media.AssetID), ResourceID: resourceID,
		})
	}
	return references, nil
}

func firstCanvasResourceID(values ...string) string {
	for _, value := range values {
		if resourceID := canvasResourceID(value); resourceID != "" {
			return resourceID
		}
	}
	return ""
}

func isCanvasMediaKind(kind string) bool {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "image", "video", "audio":
		return true
	default:
		return false
	}
}
