package canvas

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"
	"yingce/backend/internal/assets"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"

	"gorm.io/gorm"
)

type CanvasShareRequest struct {
	ExpiresDays int   `json:"expiresDays"`
	Rotate      bool  `json:"rotate"`
	AllowCopy   *bool `json:"allowCopy"`
}

type CanvasShareStatus struct {
	Enabled   bool       `json:"enabled"`
	Token     string     `json:"token,omitempty"`
	AllowCopy bool       `json:"allowCopy"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

type PublicCanvasShare struct {
	Project   map[string]any `json:"project"`
	AllowCopy bool           `json:"allowCopy"`
	ExpiresAt *time.Time     `json:"expiresAt,omitempty"`
}

var publicCanvasMetadataKeys = map[string]bool{
	"content": true, "composerContent": true, "prompt": true, "status": true, "fontSize": true,
	"generationMode": true, "generationType": true, "model": true, "size": true, "quality": true, "transparentBackground": true,
	"count": true, "seconds": true, "vquality": true, "generateAudio": true, "watermark": true,
	"audioVoice": true, "audioFormat": true, "audioSpeed": true, "audioInstructions": true,
	"naturalWidth": true, "naturalHeight": true, "freeResize": true, "isBatchRoot": true,
	"batchRootId": true, "batchChildIds": true, "batchUsesReferenceImages": true, "primaryImageId": true,
	"imageBatchExpanded": true, "mimeType": true, "bytes": true, "durationMs": true, "hasAudio": true, "assetTags": true,
	"workflowKind": true, "workflowTitle": true, "workflowDescription": true, "shotIndex": true,
	"sceneId": true, "characterIds": true, "referenceSetId": true, "referenceAssetNodeIds": true, "assetBindings": true,
	"characterName": true, "characterPrompt": true, "characterAliases": true, "characterView": true, "characterViewNodeIds": true,
	"videoEditOperation": true, "videoCameraMoveId": true, "videoCameraMovePrompt": true,
	"videoStartFrameNodeId": true, "videoEndFrameNodeId": true, "versionOfNodeId": true,
	"versionLabel": true, "versionPrimary": true, "previsSceneId": true, "previsShotId": true,
	"previsPreviewNodeId": true, "previsDepthNodeId": true, "previsDepthVideoNodeId": true, "previsNormalNodeId": true,
	"skillId": true, "skillVersion": true, "skillSnapshot": true, "storyboard": true,
	"storyboardShotDuration": true, "storyboardShotCount": true, "storyboardComposerHeight": true, "frame": true,
}

var publicCanvasForbiddenKeys = map[string]bool{
	"apiKey": true, "storageKey": true, "taskId": true, "taskStatus": true, "taskProgress": true,
	"taskStage": true, "taskCreatedAt": true, "taskUpdatedAt": true,
	"errorDetails": true, "references": true,
}

func (s *Service) CanvasShareStatus(userID string, projectID string) (CanvasShareStatus, error) {
	if _, err := s.repo.CanvasProjectForUser(userID, projectID); err != nil {
		return CanvasShareStatus{}, err
	}
	share, err := s.repo.CanvasShareForProject(userID, projectID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return CanvasShareStatus{Enabled: false}, nil
	}
	if err != nil {
		return CanvasShareStatus{}, err
	}
	return s.canvasShareStatus(share)
}

func (s *Service) CreateCanvasShare(userID string, projectID string, req CanvasShareRequest) (CanvasShareStatus, error) {
	if req.ExpiresDays < 0 || req.ExpiresDays > 365 {
		return CanvasShareStatus{}, kernel.BadAuthRequest("分享有效期必须在 0 到 365 天之间")
	}
	if _, err := s.repo.CanvasProjectForUser(userID, projectID); err != nil {
		return CanvasShareStatus{}, err
	}
	isNew := false
	share, err := s.repo.CanvasShareForProject(userID, projectID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		isNew = true
		share = &model.CanvasShare{ID: kernel.NewID(), UserID: userID, ProjectID: projectID, AllowCopy: true}
	} else if err != nil {
		return CanvasShareStatus{}, err
	}
	if req.Rotate || strings.TrimSpace(share.TokenCipher) == "" {
		token, tokenErr := newCanvasShareToken()
		if tokenErr != nil {
			return CanvasShareStatus{}, tokenErr
		}
		share.TokenHash = canvasShareTokenHash(token)
		share.TokenCipher, err = s.host.EncryptSecret(token)
		if err != nil {
			return CanvasShareStatus{}, err
		}
	}
	share.Enabled = true
	if req.AllowCopy != nil {
		share.AllowCopy = *req.AllowCopy
	} else if isNew {
		share.AllowCopy = true
	}
	share.ExpiresAt = nil
	if req.ExpiresDays > 0 {
		expiresAt := time.Now().Add(time.Duration(req.ExpiresDays) * 24 * time.Hour)
		share.ExpiresAt = &expiresAt
	}
	if err := s.repo.Save(share); err != nil {
		return CanvasShareStatus{}, err
	}
	return s.canvasShareStatus(share)
}

func (s *Service) DeleteCanvasShare(userID string, projectID string) error {
	if _, err := s.repo.CanvasProjectForUser(userID, projectID); err != nil {
		return err
	}
	return s.repo.DeleteCanvasShare(userID, projectID)
}

func (s *Service) PublicCanvasShare(token string) (PublicCanvasShare, error) {
	share, project, err := s.sharedCanvasProject(token)
	if err != nil {
		return PublicCanvasShare{}, err
	}
	publicProject, _, err := publicCanvasProject(project, token)
	if err != nil {
		return PublicCanvasShare{}, err
	}
	return PublicCanvasShare{Project: publicProject, AllowCopy: share.AllowCopy, ExpiresAt: share.ExpiresAt}, nil
}

func (s *Service) OpenSharedCanvasResource(token string, resourceID string) (*model.Resource, io.ReadCloser, error) {
	stream, err := s.OpenSharedCanvasResourceRange(token, resourceID, "")
	if err != nil {
		return nil, nil, err
	}
	return stream.Resource, stream.Body, nil
}

func (s *Service) OpenSharedCanvasResourceRange(token string, resourceID string, rangeHeader string) (*assets.ResourceStream, error) {
	userID, resource, _, err := s.sharedCanvasResource(token, resourceID)
	if err != nil {
		return nil, err
	}
	return s.host.OpenResourceRange(userID, resource, rangeHeader)
}

func (s *Service) PrepareSharedCanvasResourceDelivery(token string, resourceID string, options assets.AccessOptions, rangeHeader string) (*assets.ResourceDelivery, error) {
	userID, resource, share, err := s.sharedCanvasResource(token, resourceID)
	if err != nil {
		return nil, err
	}
	if share.ExpiresAt != nil {
		options.ExpiresAt = *share.ExpiresAt
	}
	return s.host.PrepareResourceDelivery(userID, resource, options, rangeHeader)
}

func (s *Service) sharedCanvasResource(token string, resourceID string) (string, *model.Resource, *model.CanvasShare, error) {
	share, project, err := s.sharedCanvasProject(token)
	if err != nil {
		return "", nil, nil, err
	}
	_, allowedResources, err := publicCanvasProject(project, token)
	if err != nil {
		return "", nil, nil, err
	}
	if !allowedResources[resourceID] {
		return "", nil, nil, gorm.ErrRecordNotFound
	}
	resource, err := s.repo.ResourceForUser(share.UserID, resourceID)
	if err != nil {
		return "", nil, nil, err
	}
	return share.UserID, resource, share, nil
}

func (s *Service) sharedCanvasProject(token string) (*model.CanvasShare, *model.CanvasProject, error) {
	token = strings.TrimSpace(token)
	if len(token) < 32 || len(token) > 128 {
		return nil, nil, gorm.ErrRecordNotFound
	}
	share, err := s.repo.CanvasShareByTokenHash(canvasShareTokenHash(token))
	if err != nil {
		return nil, nil, err
	}
	if share.ExpiresAt != nil && !share.ExpiresAt.After(time.Now()) {
		return nil, nil, gorm.ErrRecordNotFound
	}
	project, err := s.repo.CanvasProjectForUser(share.UserID, share.ProjectID)
	return share, project, err
}

func (s *Service) canvasShareStatus(share *model.CanvasShare) (CanvasShareStatus, error) {
	if share == nil || !share.Enabled || (share.ExpiresAt != nil && !share.ExpiresAt.After(time.Now())) {
		return CanvasShareStatus{Enabled: false}, nil
	}
	token, err := s.host.DecryptSecret(share.TokenCipher)
	if err != nil {
		return CanvasShareStatus{}, err
	}
	createdAt := share.CreatedAt
	return CanvasShareStatus{Enabled: true, Token: token, AllowCopy: share.AllowCopy, ExpiresAt: share.ExpiresAt, CreatedAt: &createdAt}, nil
}

func newCanvasShareToken() (string, error) {
	payload := make([]byte, 32)
	if _, err := rand.Read(payload); err != nil {
		return "", fmt.Errorf("生成分享令牌失败：%w", err)
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func canvasShareTokenHash(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func publicCanvasProject(project *model.CanvasProject, token string) (map[string]any, map[string]bool, error) {
	var source map[string]any
	if project == nil || json.Unmarshal([]byte(project.PayloadJSON), &source) != nil {
		return nil, nil, errors.New("分享画布数据格式无效")
	}
	allowedResources := map[string]bool{}
	result := map[string]any{
		"id":             kernel.StringValue(source["id"]),
		"title":          kernel.DefaultString(kernel.StringValue(source["title"]), project.Title),
		"createdAt":      source["createdAt"],
		"updatedAt":      source["updatedAt"],
		"backgroundMode": source["backgroundMode"],
		"showImageInfo":  source["showImageInfo"],
		"viewport":       scrubPublicCanvasValue(source["viewport"]),
		"connections":    publicCanvasConnections(source["connections"]),
		"chatSessions":   []any{},
		"activeChatId":   nil,
		"previsScenes":   []any{},
	}
	rawNodes, _ := source["nodes"].([]any)
	nodes := make([]any, 0, len(rawNodes))
	for _, rawNode := range rawNodes {
		if node, ok := publicCanvasNode(rawNode, token, allowedResources); ok {
			nodes = append(nodes, node)
		}
	}
	result["nodes"] = nodes
	return result, allowedResources, nil
}

func publicCanvasConnections(value any) []any {
	rawConnections, _ := value.([]any)
	result := make([]any, 0, len(rawConnections))
	for _, raw := range rawConnections {
		connection, _ := raw.(map[string]any)
		if connection == nil {
			continue
		}
		result = append(result, map[string]any{
			"id": connection["id"], "fromNodeId": connection["fromNodeId"], "toNodeId": connection["toNodeId"],
			"fromHandleId": connection["fromHandleId"], "toHandleId": connection["toHandleId"],
		})
	}
	return result
}

func publicCanvasNode(value any, token string, allowedResources map[string]bool) (map[string]any, bool) {
	node, _ := value.(map[string]any)
	if node == nil || kernel.StringValue(node["id"]) == "" || kernel.StringValue(node["type"]) == "" {
		return nil, false
	}
	result := map[string]any{
		"id": node["id"], "type": node["type"], "title": node["title"], "position": scrubPublicCanvasValue(node["position"]),
		"width": node["width"], "height": node["height"], "parentId": node["parentId"],
	}
	metadata, _ := node["metadata"].(map[string]any)
	publicMetadata := map[string]any{}
	for key, value := range metadata {
		if !publicCanvasMetadataKeys[key] {
			continue
		}
		publicMetadata[key] = scrubPublicCanvasValue(value)
	}
	if resourceID := assets.ResourceID(kernel.StringValue(metadata["storageKey"])); resourceID != "" {
		allowedResources[resourceID] = true
		publicMetadata["content"] = sharedCanvasResourceURL(token, resourceID)
	} else if resourceID := assets.ResourceID(kernel.StringValue(metadata["content"])); resourceID != "" {
		allowedResources[resourceID] = true
		publicMetadata["content"] = sharedCanvasResourceURL(token, resourceID)
	} else if nodeType := kernel.StringValue(node["type"]); nodeType == "image" || nodeType == "video" || nodeType == "audio" {
		delete(publicMetadata, "content")
	}
	delete(publicMetadata, "storageKey")
	result["metadata"] = publicMetadata
	return result, true
}

func scrubPublicCanvasValue(value any) any {
	switch item := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(item))
		for key, child := range item {
			if publicCanvasForbiddenKeys[key] {
				continue
			}
			result[key] = scrubPublicCanvasValue(child)
		}
		return result
	case []any:
		result := make([]any, len(item))
		for index, child := range item {
			result[index] = scrubPublicCanvasValue(child)
		}
		return result
	default:
		return value
	}
}

func sharedCanvasResourceURL(token string, resourceID string) string {
	return "/api/public/canvas-shares/" + token + "/resources/" + resourceID + "/file"
}

type ForkCanvasShareResult struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func (s *Service) ForkPublicCanvasShare(targetUserID string, token string, customTitle string) (ForkCanvasShareResult, error) {
	if targetUserID == "" {
		return ForkCanvasShareResult{}, kernel.BadAuthRequest("目标用户无效")
	}
	share, project, err := s.sharedCanvasProject(token)
	if err != nil {
		return ForkCanvasShareResult{}, err
	}
	if !share.AllowCopy {
		return ForkCanvasShareResult{}, kernel.Forbidden("该分享为只读模式，不支持复制项目到当前账号")
	}

	title := strings.TrimSpace(customTitle)
	if title == "" {
		title = project.Title
		if title == "" {
			title = "复制的项目"
		} else {
			title = title + " (副本)"
		}
	}

	quota, err := s.host.CanvasQuotaCheck(targetUserID)
	if err != nil {
		return ForkCanvasShareResult{}, err
	}

	var newProjectID string
	err = s.host.WithStorageLock(func() error {
		return s.repo.Transaction(func(tx *repository.Repository) error {
			rawJSONStr := project.PayloadJSON
			docRefs, err := assets.CollectDocumentResourceReferences(rawJSONStr)
			if err != nil {
				return kernel.BadAuthRequest("原画布资源引用无效")
			}

			resourceIDs := make(map[string]struct{}, len(docRefs))
			for _, ref := range docRefs {
				if ref.ResourceID != "" {
					resourceIDs[ref.ResourceID] = struct{}{}
				}
			}

			now := time.Now().UTC()
			resourceMap := make(map[string]string) // oldResourceID -> newResourceID
			assetMap := make(map[string]string)    // oldResourceID -> newAssetID

			if len(resourceIDs) > 0 {
				oldResources, err := s.repo.ResourcesForUserIDs(share.UserID, assets.SortedIDs(resourceIDs))
				if err != nil {
					return err
				}
				for _, oldRes := range oldResources {
					newResID := kernel.NewID()
					resourceMap[oldRes.ID] = newResID
					newRes := model.Resource{
						ID:                newResID,
						UserID:            targetUserID,
						Kind:              oldRes.Kind,
						Status:            oldRes.Status,
						Provider:          oldRes.Provider,
						Endpoint:          oldRes.Endpoint,
						Bucket:            oldRes.Bucket,
						StorageSettingID:  oldRes.StorageSettingID,
						ObjectKey:         oldRes.ObjectKey,
						PublicURL:         oldRes.PublicURL,
						MimeType:          oldRes.MimeType,
						Size:              oldRes.Size,
						Width:             oldRes.Width,
						Height:            oldRes.Height,
						DurationMs:        oldRes.DurationMs,
						ETag:              oldRes.ETag,
						PlaybackStatus:    oldRes.PlaybackStatus,
						PlaybackObjectKey: oldRes.PlaybackObjectKey,
						PlaybackError:     oldRes.PlaybackError,
						ThumbnailStatus:   oldRes.ThumbnailStatus,
						ThumbnailMimeType: oldRes.ThumbnailMimeType,
						ThumbnailSize:     oldRes.ThumbnailSize,
						ThumbnailWidth:    oldRes.ThumbnailWidth,
						ThumbnailHeight:   oldRes.ThumbnailHeight,
						CreatedAt:         now,
						UpdatedAt:         now,
					}
					if err := tx.CreateResource(&newRes); err != nil {
						return err
					}

					newAssetID := kernel.NewID()
					if err := New(tx, s.host).ensureAssetRecordForResourceWithID(targetUserID, newAssetID, newRes); err != nil {
						return err
					}
					assetMap[oldRes.ID] = newAssetID
				}
			}

			var payload map[string]any
			if err := json.Unmarshal([]byte(rawJSONStr), &payload); err != nil {
				return err
			}

			newProjectID = kernel.NewID()
			payload["id"] = newProjectID
			payload["title"] = title
			payload["createdAt"] = now.Format(time.RFC3339Nano)
			payload["updatedAt"] = now.Format(time.RFC3339Nano)
			delete(payload, "revision")
			delete(payload, "remoteContentHash")
			delete(payload, "projectId") // 复制为独立自由画布

			// 深度替换 payload 内引用的所有旧 ResourceID 和 AssetID
			replacePayloadResources(payload, resourceMap, assetMap)

			newPayloadBytes, err := json.Marshal(payload)
			if err != nil {
				return err
			}

			newProject := model.CanvasProject{
				ID:          newProjectID,
				UserID:      targetUserID,
				Title:       title,
				Revision:    0,
				PayloadJSON: string(newPayloadBytes),
				CreatedAt:   now,
				UpdatedAt:   now,
			}

			if err := quota(tx, true, int64(len(newPayloadBytes))); err != nil {
				return err
			}

			return tx.UpsertCanvasProject(&newProject)
		})
	})
	if err != nil {
		return ForkCanvasShareResult{}, err
	}

	return ForkCanvasShareResult{
		ID:    newProjectID,
		Title: title,
	}, nil
}

func replacePayloadResources(data any, resourceMap map[string]string, assetMap map[string]string) {
	switch v := data.(type) {
	case map[string]any:
		if metadata, ok := v["metadata"].(map[string]any); ok {
			delete(metadata, "taskId")
			delete(metadata, "taskStatus")
			delete(metadata, "taskProgress")
			delete(metadata, "taskStage")
			delete(metadata, "taskCreatedAt")
			delete(metadata, "taskUpdatedAt")
			delete(metadata, "taskCompletedAt")
			delete(metadata, "errorDetails")

			oldResID := assets.ResourceID(kernel.StringValue(metadata["storageKey"]))
			if oldResID == "" {
				oldResID = assets.ResourceID(kernel.StringValue(metadata["content"]))
			}
			if newResID, ok := resourceMap[oldResID]; ok {
				metadata["storageKey"] = "resource:" + newResID
				metadata["content"] = "/api/resources/" + newResID + "/file"
				if newAssetID, ok := assetMap[oldResID]; ok {
					metadata["assetId"] = newAssetID
				}
			}
		}

		for k, val := range v {
			if str, ok := val.(string); ok {
				for oldID, newID := range resourceMap {
					if strings.Contains(str, oldID) {
						str = strings.ReplaceAll(str, "/api/public/canvas-shares/", "/api/resources/")
						str = strings.ReplaceAll(str, oldID, newID)
						v[k] = str
					}
				}
			} else {
				replacePayloadResources(val, resourceMap, assetMap)
			}
		}
	case []any:
		for _, item := range v {
			replacePayloadResources(item, resourceMap, assetMap)
		}
	}
}

func (s *Service) ensureAssetRecordForResourceWithID(userID string, assetID string, resource model.Resource) error {
	cleanAssetID := strings.TrimSpace(assetID)
	if cleanAssetID == "" {
		cleanAssetID = kernel.NewID()
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
	assetPayload := map[string]any{
		"id":         cleanAssetID,
		"title":      title,
		"kind":       kind,
		"storageKey": "resource:" + resource.ID,
		"createdAt":  now,
		"updatedAt":  now,
	}
	payloadBytes, err := json.Marshal(assetPayload)
	if err != nil {
		return err
	}
	newAsset := model.Asset{
		ID:          cleanAssetID,
		UserID:      userID,
		Kind:        kind,
		Title:       title,
		PayloadJSON: string(payloadBytes),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return s.repo.Create(&newAsset)
}
