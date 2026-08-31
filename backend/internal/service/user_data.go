package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"infinite-canvas/backend/internal/model"

	"gorm.io/gorm"
)

type AssetsSyncRequest struct {
	Assets []json.RawMessage `json:"assets"`
}

type CanvasProjectsSyncRequest struct {
	Projects []json.RawMessage `json:"projects"`
}

type UserDataSummary struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind,omitempty"`
	Category  string    `json:"category,omitempty"`
	Status    string    `json:"status,omitempty"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type UserDataSnapshot struct {
	Assets   []json.RawMessage `json:"assets"`
	Projects []json.RawMessage `json:"projects"`
}

func (s *Service) UserDataSnapshot(userID string) (UserDataSnapshot, error) {
	assets, err := s.UserAssets(userID)
	if err != nil {
		return UserDataSnapshot{}, err
	}
	projects, err := s.UserCanvasProjects(userID)
	if err != nil {
		return UserDataSnapshot{}, err
	}
	return UserDataSnapshot{Assets: assets, Projects: projects}, nil
}

func (s *Service) UserAssetSummaries(userID string) ([]UserDataSummary, error) {
	assets, err := s.repo.AssetSummaries(userID)
	if err != nil {
		return nil, err
	}
	result := make([]UserDataSummary, 0, len(assets))
	for _, asset := range assets {
		result = append(result, UserDataSummary{ID: asset.ID, Kind: asset.Kind, Category: string(asset.Category), Status: string(asset.Status), Title: asset.Title, CreatedAt: asset.CreatedAt, UpdatedAt: asset.UpdatedAt})
	}
	return result, nil
}

func (s *Service) UserAsset(userID string, id string) (json.RawMessage, error) {
	asset, err := s.repo.AssetForUser(userID, id)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(asset.PayloadJSON), nil
}

func (s *Service) UpsertUserAsset(userID string, raw json.RawMessage) (UserDataSummary, error) {
	asset, err := assetFromJSON(userID, raw)
	if err != nil {
		return UserDataSummary{}, err
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		return UserDataSummary{}, err
	}
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	existing, existingErr := s.repo.AssetForUser(userID, asset.ID)
	if existingErr != nil && !errors.Is(existingErr, gorm.ErrRecordNotFound) {
		return UserDataSummary{}, existingErr
	}
	existingBytes := int64(0)
	if existing != nil {
		existingBytes = int64(len([]byte(existing.PayloadJSON)))
	}
	usage, err := s.repo.UserStorageUsage(userID)
	if err != nil {
		return UserDataSummary{}, err
	}
	if err := validateStructuredStorageQuotaWithPolicy(usage, "asset", errors.Is(existingErr, gorm.ErrRecordNotFound), int64(len(raw))-existingBytes, policy.Resource); err != nil {
		return UserDataSummary{}, err
	}
	if err := s.repo.UpsertAsset(&asset); err != nil {
		return UserDataSummary{}, err
	}
	if existingErr != nil {
		s.recordActivity(userID, "asset", 1)
	}
	return UserDataSummary{ID: asset.ID, Kind: asset.Kind, Category: string(asset.Category), Status: string(asset.Status), Title: asset.Title, CreatedAt: asset.CreatedAt, UpdatedAt: asset.UpdatedAt}, nil
}

func (s *Service) DeleteUserAsset(userID string, id string) error {
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	return s.deleteUserAssetWithResources(userID, id)
}

func (s *Service) UserAssets(userID string) ([]json.RawMessage, error) {
	assets, err := s.repo.Assets(userID)
	if err != nil {
		return nil, err
	}
	result := make([]json.RawMessage, 0, len(assets))
	for _, asset := range assets {
		if strings.TrimSpace(asset.PayloadJSON) != "" {
			result = append(result, json.RawMessage(asset.PayloadJSON))
		}
	}
	return result, nil
}

func (s *Service) ReplaceUserAssets(userID string, req AssetsSyncRequest) ([]json.RawMessage, error) {
	assets := make([]model.Asset, 0, len(req.Assets))
	var totalBytes int64
	for _, raw := range req.Assets {
		item, err := assetFromJSON(userID, raw)
		if err != nil {
			return nil, err
		}
		assets = append(assets, item)
		totalBytes += int64(len(raw))
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		return nil, err
	}
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	usage, err := s.repo.UserStorageUsage(userID)
	if err != nil {
		return nil, err
	}
	if err := validateStructuredReplacementQuotaWithPolicy(usage, "asset", len(assets), totalBytes, policy.Resource); err != nil {
		return nil, err
	}
	if err := s.repo.ReplaceAssets(userID, assets); err != nil {
		return nil, err
	}
	if len(assets) > 0 {
		s.recordActivity(userID, "asset", len(assets))
	}
	return s.UserAssets(userID)
}

func (s *Service) UserCanvasProjects(userID string) ([]json.RawMessage, error) {
	projects, err := s.repo.CanvasProjects(userID)
	if err != nil {
		return nil, err
	}
	result := make([]json.RawMessage, 0, len(projects))
	for _, project := range projects {
		if strings.TrimSpace(project.PayloadJSON) != "" {
			result = append(result, json.RawMessage(project.PayloadJSON))
		}
	}
	return result, nil
}

func (s *Service) UserCanvasProjectSummaries(userID string) ([]UserDataSummary, error) {
	projects, err := s.repo.CanvasProjectSummaries(userID)
	if err != nil {
		return nil, err
	}
	result := make([]UserDataSummary, 0, len(projects))
	for _, project := range projects {
		result = append(result, UserDataSummary{ID: project.ID, Title: project.Title, CreatedAt: project.CreatedAt, UpdatedAt: project.UpdatedAt})
	}
	return result, nil
}

func (s *Service) UserCanvasProject(userID string, id string) (json.RawMessage, error) {
	project, err := s.repo.CanvasProjectForUser(userID, id)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(project.PayloadJSON), nil
}

func (s *Service) UpsertUserCanvasProject(userID string, raw json.RawMessage) (UserDataSummary, error) {
	project, err := canvasProjectFromJSON(userID, raw)
	if err != nil {
		return UserDataSummary{}, err
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		return UserDataSummary{}, err
	}
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	existing, existingErr := s.repo.CanvasProjectForUser(userID, project.ID)
	if existingErr != nil && !errors.Is(existingErr, gorm.ErrRecordNotFound) {
		return UserDataSummary{}, existingErr
	}
	existingBytes := int64(0)
	if existing != nil {
		existingBytes = int64(len([]byte(existing.PayloadJSON)))
	}
	usage, err := s.repo.UserStorageUsage(userID)
	if err != nil {
		return UserDataSummary{}, err
	}
	if err := validateStructuredStorageQuotaWithPolicy(usage, "canvas", errors.Is(existingErr, gorm.ErrRecordNotFound), int64(len(raw))-existingBytes, policy.Resource); err != nil {
		return UserDataSummary{}, err
	}
	if err := s.repo.UpsertCanvasProject(&project); err != nil {
		return UserDataSummary{}, err
	}
	if existingErr != nil || existing.PayloadJSON != project.PayloadJSON || existing.Title != project.Title {
		s.recordActivity(userID, "canvas", 1)
	}
	return UserDataSummary{ID: project.ID, Title: project.Title, CreatedAt: project.CreatedAt, UpdatedAt: project.UpdatedAt}, nil
}

func (s *Service) DeleteUserCanvasProject(userID string, id string) error {
	return s.repo.DeleteCanvasProject(userID, id)
}

func (s *Service) ReplaceUserCanvasProjects(userID string, req CanvasProjectsSyncRequest) ([]json.RawMessage, error) {
	projects := make([]model.CanvasProject, 0, len(req.Projects))
	var totalBytes int64
	for _, raw := range req.Projects {
		item, err := canvasProjectFromJSON(userID, raw)
		if err != nil {
			return nil, err
		}
		projects = append(projects, item)
		totalBytes += int64(len(raw))
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		return nil, err
	}
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	usage, err := s.repo.UserStorageUsage(userID)
	if err != nil {
		return nil, err
	}
	if err := validateStructuredReplacementQuotaWithPolicy(usage, "canvas", len(projects), totalBytes, policy.Resource); err != nil {
		return nil, err
	}
	if err := s.repo.ReplaceCanvasProjects(userID, projects); err != nil {
		return nil, err
	}
	if len(projects) > 0 {
		s.recordActivity(userID, "canvas", 1)
	}
	return s.UserCanvasProjects(userID)
}

func assetFromJSON(userID string, raw json.RawMessage) (model.Asset, error) {
	if err := validateSyncedPayload(raw, "素材"); err != nil {
		return model.Asset{}, err
	}
	var payload struct {
		ID               string `json:"id"`
		Kind             string `json:"kind"`
		Category         string `json:"category"`
		Status           string `json:"status"`
		PrimaryVersionID string `json:"primaryVersionId"`
		Title            string `json:"title"`
		CreatedAt        string `json:"createdAt"`
		UpdatedAt        string `json:"updatedAt"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return model.Asset{}, BadAuthRequest("素材数据格式错误")
	}
	now := time.Now()
	createdAt := parseClientTime(payload.CreatedAt, now)
	updatedAt := parseClientTime(payload.UpdatedAt, createdAt)
	id := strings.TrimSpace(payload.ID)
	if id == "" {
		id = newID()
	}
	if utf8.RuneCountInString(id) > model.AssetIDMaxLength {
		return model.Asset{}, BadAuthRequest("素材 ID 不能超过 80 个字符")
	}
	primaryVersionID := strings.TrimSpace(payload.PrimaryVersionID)
	if utf8.RuneCountInString(primaryVersionID) > 36 {
		return model.Asset{}, BadAuthRequest("素材主版本 ID 不能超过 36 个字符")
	}
	category := model.NormalizeAssetCategory(model.AssetCategory(payload.Category), payload.Kind)
	status := model.AssetVersionStatus(strings.TrimSpace(payload.Status))
	if status == "" {
		status = model.AssetVersionStatusConfirmed
	}
	return model.Asset{
		ID:               id,
		UserID:           userID,
		Kind:             strings.TrimSpace(payload.Kind),
		Category:         category,
		Status:           status,
		PrimaryVersionID: primaryVersionID,
		Title:            strings.TrimSpace(payload.Title),
		PayloadJSON:      string(raw),
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
	}, nil
}

func canvasProjectFromJSON(userID string, raw json.RawMessage) (model.CanvasProject, error) {
	if err := validateSyncedPayload(raw, "画布"); err != nil {
		return model.CanvasProject{}, err
	}
	var payload struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		ProjectID string `json:"projectId"`
		CreatedAt string `json:"createdAt"`
		UpdatedAt string `json:"updatedAt"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return model.CanvasProject{}, BadAuthRequest("画布数据格式错误")
	}
	now := time.Now()
	createdAt := parseClientTime(payload.CreatedAt, now)
	updatedAt := parseClientTime(payload.UpdatedAt, createdAt)
	id := strings.TrimSpace(payload.ID)
	if id == "" {
		id = newID()
	}
	return model.CanvasProject{
		ID:          id,
		UserID:      userID,
		ProjectID:   strings.TrimSpace(payload.ProjectID),
		Title:       strings.TrimSpace(payload.Title),
		PayloadJSON: string(raw),
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func validateSyncedPayload(raw json.RawMessage, label string) error {
	if len(raw) > 4<<20 {
		return BadAuthRequest(label + "数据超过 4MB，请先把媒体文件保存到资源存储")
	}
	var payload interface{}
	if err := json.Unmarshal(raw, &payload); err == nil && containsInlineMediaDataURL(payload) {
		return BadAuthRequest(label + "数据包含内嵌媒体，请先上传到资源存储")
	}
	return nil
}

// 同步数据只禁止作为字段值存在的媒体 Data URL；提示词和上游错误文案可能合法提到相同字符串。
func containsInlineMediaDataURL(value interface{}) bool {
	switch item := value.(type) {
	case string:
		text := strings.ToLower(strings.TrimSpace(item))
		return strings.HasPrefix(text, "data:image/") || strings.HasPrefix(text, "data:video/") || strings.HasPrefix(text, "data:audio/")
	case []interface{}:
		for _, child := range item {
			if containsInlineMediaDataURL(child) {
				return true
			}
		}
	case map[string]interface{}:
		for _, child := range item {
			if containsInlineMediaDataURL(child) {
				return true
			}
		}
	}
	return false
}

func parseClientTime(value string, fallback time.Time) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	if parsed, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return parsed
	}
	return fallback
}

type CanvasProjectStats struct {
	ProjectID          string `json:"projectId"`
	ImageCount         int64  `json:"imageCount"`
	VideoCount         int64  `json:"videoCount"`
	ImageCreditsMicros int64  `json:"imageCreditsMicros"`
	VideoCreditsMicros int64  `json:"videoCreditsMicros"`
	TotalCreditsMicros int64  `json:"totalCreditsMicros"`
}

func (s *Service) UserCanvasProjectStats(userID string, projectIDs []string) ([]CanvasProjectStats, error) {
	projects, err := s.repo.CanvasProjects(userID)
	if err != nil {
		return nil, err
	}
	requested := make(map[string]struct{}, len(projectIDs))
	for _, id := range projectIDs {
		if strings.TrimSpace(id) != "" {
			requested[strings.TrimSpace(id)] = struct{}{}
		}
	}
	stats := make(map[string]*CanvasProjectStats, len(requested))
	validIDs := make([]string, 0, len(requested))
	for _, project := range projects {
		if _, ok := requested[project.ID]; !ok {
			continue
		}
		stats[project.ID] = &CanvasProjectStats{ProjectID: project.ID}
		validIDs = append(validIDs, project.ID)
		var payload struct {
			Nodes []struct {
				Type     string `json:"type"`
				Metadata struct {
					Content string `json:"content"`
					Status  string `json:"status"`
					TaskID  string `json:"taskId"`
				} `json:"metadata"`
			} `json:"nodes"`
		}
		if json.Unmarshal([]byte(project.PayloadJSON), &payload) != nil {
			continue
		}
		for _, node := range payload.Nodes {
			// 只有绑定生成任务的媒体节点计入生成统计，用户手动上传的素材不计入生成数量。
			if strings.TrimSpace(node.Metadata.Content) == "" || strings.TrimSpace(node.Metadata.TaskID) == "" || node.Metadata.Status == "error" || node.Metadata.Status == "failed" || node.Metadata.Status == "running" || node.Metadata.Status == "queued" {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(node.Type)) {
			case "image":
				stats[project.ID].ImageCount++
			case "video":
				stats[project.ID].VideoCount++
			}
		}
	}
	if len(validIDs) == 0 {
		return []CanvasProjectStats{}, nil
	}
	tasks, err := s.repo.CanvasProjectTasks(userID, validIDs)
	if err != nil {
		return nil, err
	}
	taskIDs := make([]string, 0, len(tasks))
	taskKinds := make(map[string]string, len(tasks))
	for _, task := range tasks {
		taskIDs = append(taskIDs, task.ID)
		taskKinds[task.ID] = canvasStatsMediaKind(task.Type, task.Operation)
	}
	orders, err := s.repo.SettledBillingOrdersByTaskIDs(userID, taskIDs)
	if err != nil {
		return nil, err
	}
	for taskID, order := range orders {
		if item := stats[orderTaskProjectID(tasks, taskID)]; item != nil {
			switch taskKinds[taskID] {
			case "image":
				item.ImageCreditsMicros += order.ActualAmountMicrocredits
			case "video":
				item.VideoCreditsMicros += order.ActualAmountMicrocredits
			}
			item.TotalCreditsMicros += order.ActualAmountMicrocredits
		}
	}
	result := make([]CanvasProjectStats, 0, len(validIDs))
	for _, id := range projectIDs {
		if item := stats[strings.TrimSpace(id)]; item != nil {
			result = append(result, *item)
		}
	}
	return result, nil
}

func canvasStatsMediaKind(taskType string, operation string) string {
	value := strings.ToLower(taskType + " " + operation)
	if strings.Contains(value, "video") {
		return "video"
	}
	if strings.Contains(value, "image") || strings.Contains(value, "img") {
		return "image"
	}
	return ""
}

func orderTaskProjectID(tasks []model.Task, taskID string) string {
	for _, task := range tasks {
		if task.ID == taskID {
			return task.ProjectID
		}
	}
	return ""
}
