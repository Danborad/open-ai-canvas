package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

const wecomSettingKey = "wecom_notification"

type WecomSettingRequest struct {
	Enabled       bool   `json:"enabled"`
	WebhookURL    string `json:"webhookUrl"`
	ScheduleTime  string `json:"scheduleTime"`
	TargetDomain  string `json:"targetDomain"`
	MentionAll    bool   `json:"mentionAll"`
	NotifyNewUser *bool  `json:"notifyNewUser"`
}

type PublicWecomSetting struct {
	Enabled        bool      `json:"enabled"`
	WebhookURL     string    `json:"webhookUrl"`
	HasWebhookURL  bool      `json:"hasWebhookUrl"`
	ScheduleTime   string    `json:"scheduleTime"`
	TargetDomain   string    `json:"targetDomain"`
	MentionAll     bool      `json:"mentionAll"`
	NotifyNewUser  bool      `json:"notifyNewUser"`
	LastSentAt     string    `json:"lastSentAt,omitempty"`
	LastSentStatus string    `json:"lastSentStatus,omitempty"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type wecomSettingValue struct {
	Enabled        bool   `json:"enabled"`
	WebhookURL     string `json:"webhookUrl"`
	ScheduleTime   string `json:"scheduleTime"`
	TargetDomain   string `json:"targetDomain"`
	MentionAll     bool   `json:"mentionAll"`
	NotifyNewUser  bool   `json:"notifyNewUser"`
	LastSentAt     string `json:"lastSentAt"`
	LastSentStatus string `json:"lastSentStatus"`
}

type ModelUsageStat struct {
	ModelName    string `json:"modelName"`
	ChannelName  string `json:"channelName,omitempty"`
	TaskCount    int64  `json:"taskCount"`
	SuccessCount int64  `json:"successCount"`
	FailedCount  int64  `json:"failedCount"`
}

type WecomDailyReportData struct {
	ReportTime       time.Time                `json:"reportTime"`
	TotalUsers       int64                    `json:"totalUsers"`
	ActiveUsersToday int64                    `json:"activeUsersToday"`
	TotalTasksToday  int64                    `json:"totalTasksToday"`
	SuccessTasks     int64                    `json:"successTasks"`
	FailedTasks      int64                    `json:"failedTasks"`
	TotalImagesToday int64                    `json:"totalImagesToday"`
	ImageSuccess     int64                    `json:"imageSuccess"`
	ImageFailed      int64                    `json:"imageFailed"`
	TotalVideosToday int64                    `json:"totalVideosToday"`
	VideoSuccess     int64                    `json:"videoSuccess"`
	VideoFailed      int64                    `json:"videoFailed"`
	TopCreators      []repository.CreatorStat `json:"topCreators"`
	ModelStats       []ModelUsageStat         `json:"modelStats"`
	SystemImages     int64                    `json:"systemImages"`
	SystemImageBytes int64                    `json:"systemImageBytes"`
	SystemVideos     int64                    `json:"systemVideos"`
	SystemVideoBytes int64                    `json:"systemVideoBytes"`
	SystemTotalBytes int64                    `json:"systemTotalBytes"`
	ESADomain        string                   `json:"esaDomain"`
	ESATrafficBytes  int64                    `json:"esaTrafficBytes"`
	ESARequestCount  int64                    `json:"esaRequestCount"`
	ESAEnabled       bool                     `json:"esaEnabled"`
	ESAError         string                   `json:"esaError,omitempty"`
}

type WecomTestResult struct {
	Sent    bool                  `json:"sent"`
	Content string                `json:"content"`
	Message string                `json:"message"`
	Data    *WecomDailyReportData `json:"data,omitempty"`
}

var wecomSendMu sync.Mutex

func defaultWecomSetting() wecomSettingValue {
	return wecomSettingValue{
		Enabled:       false,
		WebhookURL:    "",
		ScheduleTime:  "22:00",
		TargetDomain:  "art.960916.xyz",
		MentionAll:    false,
		NotifyNewUser: true,
	}
}

func (s *Service) readWecomSetting() (*model.SystemSetting, wecomSettingValue, error) {
	setting, err := s.repo.SystemSetting(wecomSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, defaultWecomSetting(), nil
	}
	if err != nil {
		return nil, wecomSettingValue{}, err
	}
	value := defaultWecomSetting()
	if strings.TrimSpace(setting.ValueJSON) != "" {
		var rawMap map[string]any
		if err := json.Unmarshal([]byte(setting.ValueJSON), &rawMap); err == nil {
			if _, exists := rawMap["notifyNewUser"]; !exists {
				value.NotifyNewUser = true
			}
		}
		if err := json.Unmarshal([]byte(setting.ValueJSON), &value); err != nil {
			return nil, wecomSettingValue{}, errors.New("企业微信通知配置格式无效")
		}
		if rawMap != nil {
			if _, exists := rawMap["notifyNewUser"]; !exists {
				value.NotifyNewUser = true
			}
		}
	}
	if value.WebhookURL != "" {
		decrypted, err := s.decryptSettingSecret(value.WebhookURL)
		if err == nil && decrypted != "" {
			value.WebhookURL = decrypted
		}
	}
	return setting, value, nil
}

func (s *Service) saveWecomSetting(setting *model.SystemSetting, value wecomSettingValue) error {
	stored := value
	if stored.WebhookURL != "" {
		encrypted, err := s.encryptSettingSecret(stored.WebhookURL)
		if err != nil {
			return err
		}
		stored.WebhookURL = encrypted
	}
	payload, err := json.Marshal(stored)
	if err != nil {
		return err
	}
	if setting == nil {
		setting = &model.SystemSetting{Key: wecomSettingKey}
	}
	setting.ValueJSON = string(payload)
	return s.repo.SaveSystemSetting(setting)
}

func maskWecomWebhookURL(raw string) string {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return ""
	}
	idx := strings.Index(clean, "key=")
	if idx < 0 {
		if len(clean) > 20 {
			return clean[:10] + "..." + clean[len(clean)-4:]
		}
		return clean
	}
	prefix := clean[:idx+4]
	secret := clean[idx+4:]
	if len(secret) <= 6 {
		return prefix + "******"
	}
	return prefix + "******" + secret[len(secret)-4:]
}

func (s *Service) AdminWecomNotificationSetting(actor *model.User) (*PublicWecomSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	setting, value, err := s.readWecomSetting()
	if err != nil {
		return nil, err
	}
	updatedAt := time.Now()
	if setting != nil {
		updatedAt = setting.UpdatedAt
	}
	return &PublicWecomSetting{
		Enabled:        value.Enabled,
		WebhookURL:     maskWecomWebhookURL(value.WebhookURL),
		HasWebhookURL:  strings.TrimSpace(value.WebhookURL) != "",
		ScheduleTime:   value.ScheduleTime,
		TargetDomain:   value.TargetDomain,
		MentionAll:     value.MentionAll,
		NotifyNewUser:  value.NotifyNewUser,
		LastSentAt:     value.LastSentAt,
		LastSentStatus: value.LastSentStatus,
		UpdatedAt:      updatedAt,
	}, nil
}

func (s *Service) UpdateWecomNotificationSetting(actor *model.User, req WecomSettingRequest) (*PublicWecomSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	setting, current, err := s.readWecomSetting()
	if err != nil {
		return nil, err
	}
	next := current
	next.Enabled = req.Enabled
	if strings.TrimSpace(req.WebhookURL) != "" {
		next.WebhookURL = strings.TrimSpace(req.WebhookURL)
	}
	if strings.TrimSpace(req.ScheduleTime) != "" {
		next.ScheduleTime = strings.TrimSpace(req.ScheduleTime)
	}
	if strings.TrimSpace(req.TargetDomain) != "" {
		next.TargetDomain = strings.TrimSpace(req.TargetDomain)
	}
	next.MentionAll = req.MentionAll
	if req.NotifyNewUser != nil {
		next.NotifyNewUser = *req.NotifyNewUser
	}

	if (next.Enabled || next.NotifyNewUser) && next.WebhookURL == "" {
		return nil, BadAuthRequest("启用企业微信通知必须配置 Webhook 地址")
	}

	if err := s.saveWecomSetting(setting, next); err != nil {
		return nil, err
	}
	return s.AdminWecomNotificationSetting(actor)
}

func chinaTimeZone() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}

func (s *Service) BuildDailyReportData(ctx context.Context, targetDomain string) (*WecomDailyReportData, error) {
	loc := chinaTimeZone()
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).UTC()
	nowUTC := now.UTC()
	dayStr := now.Format("2006-01-02")

	// 1. 用户统计
	totalUsers, err := s.repo.UserCount()
	if err != nil {
		totalUsers = 0
	}
	activeUsers, err := s.repo.DailyActiveUserCount(startOfDay, nowUTC, dayStr)
	if err != nil {
		activeUsers = 0
	}

	// 2. 今日任务生成情况
	taskStats, err := s.repo.DailyTaskStats(startOfDay, nowUTC)
	if err != nil {
		taskStats = repository.DailyTaskStats{}
	}

	// 3. 今日最高频生成账号
	topCreators, err := s.repo.DailyTopCreators(startOfDay, nowUTC, 3)
	if err != nil {
		topCreators = []repository.CreatorStat{}
	}

	// 4. 今日调用模型统计（聚合 cleanModel 并关联所属渠道，只保留今天实际产生过任务的模型）
	modelRows, _ := s.repo.DailyModelTaskStats(startOfDay, nowUTC)
	displayNames, _ := s.repo.ChannelModelDisplayNames()
	if displayNames == nil {
		displayNames = map[string]string{}
	}
	channelMeta, _ := s.repo.ChannelMetaMap()
	if channelMeta == nil {
		channelMeta = map[string]repository.ChannelMetaInfo{}
	}

	modelMap := make(map[string]*ModelUsageStat)
	var modelOrder []string

	for _, row := range modelRows {
		rawKey := strings.TrimSpace(row.Model)
		if rawKey == "" {
			continue
		}
		channelID := ""
		modelKey := rawKey
		if idx := strings.Index(rawKey, "::"); idx >= 0 {
			channelID = strings.TrimSpace(rawKey[:idx])
			modelKey = strings.TrimSpace(rawKey[idx+2:])
		}

		// 优先从 channelId::modelKey 取特定展示名，其次取通用 modelKey 展示名
		displayName := ""
		if channelID != "" {
			displayName = displayNames[channelID+"::"+modelKey]
		}
		if displayName == "" {
			displayName = displayNames[modelKey]
		}
		if displayName == "" {
			displayName = modelKey
		}

		// 解析渠道友好名称
		channelName := ""
		if ch, ok := channelMeta[channelID]; ok {
			cName := strings.TrimSpace(ch.Name)
			cAlias := strings.TrimSpace(ch.PublicAlias)
			if cName != "" && cAlias != "" && cAlias != cName {
				channelName = fmt.Sprintf("%s · %s", cName, cAlias)
			} else if cName != "" {
				channelName = cName
			} else if cAlias != "" {
				channelName = cAlias
			}
		}

		// 聚合键：不同渠道的模型分开呈现
		aggregateKey := displayName
		if channelName != "" {
			aggregateKey = channelName + "::" + displayName
		} else if channelID != "" {
			aggregateKey = channelID + "::" + displayName
		}

		if stat, exists := modelMap[aggregateKey]; exists {
			stat.TaskCount += row.TaskCount
			stat.SuccessCount += row.SuccessCount
			stat.FailedCount += row.FailedCount
		} else {
			stat = &ModelUsageStat{
				ModelName:    displayName,
				ChannelName:  channelName,
				TaskCount:    row.TaskCount,
				SuccessCount: row.SuccessCount,
				FailedCount:  row.FailedCount,
			}
			modelMap[aggregateKey] = stat
			modelOrder = append(modelOrder, aggregateKey)
		}
	}

	var modelStats []ModelUsageStat
	for _, name := range modelOrder {
		if stat := modelMap[name]; stat != nil && stat.TaskCount > 0 {
			modelStats = append(modelStats, *stat)
		}
	}
	sort.Slice(modelStats, func(i, j int) bool {
		return modelStats[i].TaskCount > modelStats[j].TaskCount
	})

	// 5. 当前系统资源占用状态
	kindStats, _ := s.repo.ResourceKindStats()
	storageSummary, _ := s.repo.ResourceStorageSummary()

	var systemImages, systemImageBytes int64
	var systemVideos, systemVideoBytes int64
	for _, ks := range kindStats {
		switch ks.Kind {
		case "image":
			systemImages = ks.Count
			systemImageBytes = ks.LogicalBytes
		case "video":
			systemVideos = ks.Count
			systemVideoBytes = ks.LogicalBytes
		}
	}
	systemTotalBytes := storageSummary.LogicalBytes
	if systemTotalBytes == 0 {
		systemTotalBytes = systemImageBytes + systemVideoBytes
	}

	// 5. ESA 当天流量统计 (只统计 targetDomain)
	cleanDomain := strings.TrimSpace(targetDomain)
	if cleanDomain == "" {
		cleanDomain = "art.960916.xyz"
	}
	esaTraffic, esaRequests, esaEnabled, esaErr := s.FetchESADomainStats(ctx, cleanDomain, startOfDay, nowUTC)
	var esaErrMsg string
	if esaErr != nil {
		esaErrMsg = esaErr.Error()
	}

	return &WecomDailyReportData{
		ReportTime:       now,
		TotalUsers:       totalUsers,
		ActiveUsersToday: activeUsers,
		TotalTasksToday:  taskStats.TotalTasks,
		SuccessTasks:     taskStats.TotalSuccess,
		FailedTasks:      taskStats.TotalFailed,
		TotalImagesToday: taskStats.TotalImages,
		ImageSuccess:     taskStats.ImageSuccess,
		ImageFailed:      taskStats.ImageFailed,
		TotalVideosToday: taskStats.TotalVideos,
		VideoSuccess:     taskStats.VideoSuccess,
		VideoFailed:      taskStats.VideoFailed,
		TopCreators:      topCreators,
		ModelStats:       modelStats,
		SystemImages:     systemImages,
		SystemImageBytes: systemImageBytes,
		SystemVideos:     systemVideos,
		SystemVideoBytes: systemVideoBytes,
		SystemTotalBytes: systemTotalBytes,
		ESADomain:        cleanDomain,
		ESATrafficBytes:  esaTraffic,
		ESARequestCount:  esaRequests,
		ESAEnabled:       esaEnabled,
		ESAError:         esaErrMsg,
	}, nil
}

func FormatWecomDailyReportText(data *WecomDailyReportData) string {
	var b strings.Builder
	b.WriteString("📊 【影策创作台 · 每日运行简报】\n")
	b.WriteString(fmt.Sprintf("📅 汇报时间：%s\n", data.ReportTime.Format("2006-01-02 15:04:05")))
	b.WriteString("----------------------------------------\n")

	b.WriteString("👥 用户活跃数据\n")
	b.WriteString(fmt.Sprintf("• 平台注册总用户：%d 人\n", data.TotalUsers))
	b.WriteString(fmt.Sprintf("• 今日活跃用户数：%d 人\n\n", data.ActiveUsersToday))

	b.WriteString("🎨 今日生成统计\n")
	var successRate string
	if data.TotalTasksToday > 0 {
		rate := float64(data.SuccessTasks) / float64(data.TotalTasksToday) * 100
		successRate = fmt.Sprintf("%.1f%%", rate)
	} else {
		successRate = "100.0%"
	}
	b.WriteString(fmt.Sprintf("• 生成任务总量：%d 次 (成功率 %s)\n", data.TotalTasksToday, successRate))
	b.WriteString(fmt.Sprintf("• 图片生成：%d 张 (成功 %d / 失败 %d)\n", data.TotalImagesToday, data.ImageSuccess, data.ImageFailed))
	b.WriteString(fmt.Sprintf("• 视频生成：%d 条 (成功 %d / 失败 %d)\n", data.TotalVideosToday, data.VideoSuccess, data.VideoFailed))
	if data.FailedTasks > 0 {
		b.WriteString(fmt.Sprintf("• 失败任务数：%d 个\n\n", data.FailedTasks))
	} else {
		b.WriteString("• 失败任务数：0 个 (全部成功运行)\n\n")
	}

	// 仅展示今天实际产生过任务的模型；未调用的模型不显示
	if len(data.ModelStats) > 0 {
		b.WriteString("🤖 调用模型统计\n")
		for _, stat := range data.ModelStats {
			channelTag := ""
			if stat.ChannelName != "" {
				channelTag = fmt.Sprintf(" [%s]", stat.ChannelName)
			}
			if stat.FailedCount > 0 {
				b.WriteString(fmt.Sprintf("• %s%s：%d 次 (成功 %d / 失败 %d)\n", stat.ModelName, channelTag, stat.TaskCount, stat.SuccessCount, stat.FailedCount))
			} else {
				b.WriteString(fmt.Sprintf("• %s%s：%d 次 (全部成功)\n", stat.ModelName, channelTag, stat.TaskCount))
			}
		}
		b.WriteString("\n")
	}

	b.WriteString("🏆 今日高频创作账号\n")
	if len(data.TopCreators) == 0 {
		b.WriteString("• 今日暂无生成任务\n\n")
	} else {
		for i, creator := range data.TopCreators {
			b.WriteString(fmt.Sprintf("• Top %d：%s (%d 次)\n", i+1, creator.AccountName, creator.TaskCount))
		}
		b.WriteString("\n")
	}

	b.WriteString("💾 系统资源占用\n")
	b.WriteString(fmt.Sprintf("• 系统总图片数：%d 张 (%s)\n", data.SystemImages, formatByteSize(data.SystemImageBytes)))
	b.WriteString(fmt.Sprintf("• 系统总视频数：%d 条 (%s)\n", data.SystemVideos, formatByteSize(data.SystemVideoBytes)))
	b.WriteString(fmt.Sprintf("• 存储总占用空间：%s\n\n", formatByteSize(data.SystemTotalBytes)))

	b.WriteString(fmt.Sprintf("🌐 域名流量统计 (%s)\n", data.ESADomain))
	if !data.ESAEnabled {
		b.WriteString("• ESA 监控状态：未启用\n")
	} else if data.ESAError != "" {
		b.WriteString(fmt.Sprintf("• ESA 数据异常：%s\n", data.ESAError))
	} else {
		b.WriteString(fmt.Sprintf("• 今日总请求数：%d 次\n", data.ESARequestCount))
		b.WriteString(fmt.Sprintf("• 今日响应流量：%s\n", formatByteSize(data.ESATrafficBytes)))
	}
	b.WriteString("----------------------------------------\n")
	b.WriteString("※ 本简报由系统自动化定时汇报机器人自动发出")
	return b.String()
}

func formatByteSize(bytes int64) string {
	if bytes < 0 {
		bytes = 0
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit && exp < 3; n /= unit {
		div *= unit
		exp++
	}
	units := []string{"KB", "MB", "GB", "TB"}
	return fmt.Sprintf("%.2f %s", float64(bytes)/float64(div), units[exp])
}

func (s *Service) sendWecomTextMessage(ctx context.Context, webhookURL string, content string, mentionAll bool) error {
	cleanURL := strings.TrimSpace(webhookURL)
	if cleanURL == "" {
		return errors.New("企业微信 Webhook 地址未配置")
	}
	payload := map[string]any{
		"msgtype": "text",
		"text": map[string]any{
			"content": content,
		},
	}
	if mentionAll {
		payload["text"].(map[string]any)["mentioned_list"] = []string{"@all"}
	}
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cleanURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("请求企业微信 Webhook 失败: %w", err)
	}
	defer resp.Body.Close()
	respBytes, _ := io.ReadAll(resp.Body)
	var wecomResp struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.Unmarshal(respBytes, &wecomResp); err != nil {
		return fmt.Errorf("企业微信响应格式错误 (HTTP %d): %s", resp.StatusCode, string(respBytes))
	}
	if wecomResp.ErrCode != 0 {
		return fmt.Errorf("企业微信返回错误 [%d]: %s", wecomResp.ErrCode, wecomResp.ErrMsg)
	}
	return nil
}

func (s *Service) TestWecomNotification(actor *model.User) (*WecomTestResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	_, setting, err := s.readWecomSetting()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(setting.WebhookURL) == "" {
		return nil, BadAuthRequest("请先配置企业微信 Webhook 地址")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	data, err := s.BuildDailyReportData(ctx, setting.TargetDomain)
	if err != nil {
		return nil, fmt.Errorf("构建每日简报数据失败: %w", err)
	}

	content := FormatWecomDailyReportText(data)
	if err := s.sendWecomTextMessage(ctx, setting.WebhookURL, content, setting.MentionAll); err != nil {
		return &WecomTestResult{
			Sent:    false,
			Content: content,
			Message: err.Error(),
			Data:    data,
		}, err
	}

	return &WecomTestResult{
		Sent:    true,
		Content: content,
		Message: "发送成功",
		Data:    data,
	}, nil
}

func (s *Service) PreviewWecomDailyReport(actor *model.User) (*WecomDailyReportData, string, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, "", err
	}
	_, setting, err := s.readWecomSetting()
	if err != nil {
		return nil, "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	data, err := s.BuildDailyReportData(ctx, setting.TargetDomain)
	if err != nil {
		return nil, "", err
	}
	content := FormatWecomDailyReportText(data)
	return data, content, nil
}

func (s *Service) FormatWecomUserRegisteredText(user *model.User) string {
	loc := chinaTimeZone()
	now := user.CreatedAt.In(loc)
	regTime := now.Format("2006-01-02 15:04:05")

	username := strings.TrimSpace(user.Username)
	if username == "" {
		username = user.ID
	}
	displayName := strings.TrimSpace(user.DisplayName)
	if displayName == "" {
		displayName = username
	}
	email := strings.TrimSpace(user.Email)
	if email == "" {
		email = "未绑定"
	}

	totalUsers, err := s.repo.UserCount()
	if err != nil || totalUsers == 0 {
		totalUsers = 1
	}

	var b strings.Builder
	b.WriteString("🎉 【影策创作台 · 新用户注册通知】\n")
	b.WriteString("----------------------------------------\n")
	b.WriteString(fmt.Sprintf("• 用户账号：%s\n", username))
	b.WriteString(fmt.Sprintf("• 用户昵称：%s\n", displayName))
	b.WriteString(fmt.Sprintf("• 绑定邮箱：%s\n", email))
	b.WriteString(fmt.Sprintf("• 注册时间：%s\n", regTime))
	b.WriteString(fmt.Sprintf("• 平台总用户：%d 人\n", totalUsers))
	b.WriteString("----------------------------------------\n")
	b.WriteString("※ 来自影策用户中心实时通知")
	return b.String()
}

func (s *Service) NotifyWecomUserRegistered(user *model.User) {
	if s == nil || user == nil {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[WeCom] panic in NotifyWecomUserRegistered: %v", r)
			}
		}()

		_, setting, err := s.readWecomSetting()
		if err != nil {
			return
		}
		cleanURL := strings.TrimSpace(setting.WebhookURL)
		if cleanURL == "" || !setting.NotifyNewUser {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		content := s.FormatWecomUserRegisteredText(user)
		if err := s.sendWecomTextMessage(ctx, cleanURL, content, false); err != nil {
			log.Printf("[WeCom] 发送新用户注册通知失败: %v", err)
		} else {
			log.Printf("[WeCom] 成功推送新用户注册通知: %s (%s)", user.Username, user.Email)
		}
	}()
}

func (s *Service) TestWecomUserRegisterNotification(actor *model.User) (*WecomTestResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	_, setting, err := s.readWecomSetting()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(setting.WebhookURL) == "" {
		return nil, BadAuthRequest("请先配置企业微信 Webhook 地址")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	sampleUser := *actor
	content := s.FormatWecomUserRegisteredText(&sampleUser)
	if err := s.sendWecomTextMessage(ctx, setting.WebhookURL, content, false); err != nil {
		return &WecomTestResult{
			Sent:    false,
			Content: content,
			Message: err.Error(),
		}, err
	}

	return &WecomTestResult{
		Sent:    true,
		Content: content,
		Message: "发送成功",
	}, nil
}

func (s *Service) startWecomNotificationWorker(ctx context.Context) {
	s.runWorkerLoop(func(ctx context.Context) {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		loc := chinaTimeZone()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.checkAndTriggerWecomScheduledReport(ctx, loc)
			}
		}
	})
}

func (s *Service) checkAndTriggerWecomScheduledReport(ctx context.Context, loc *time.Location) {
	wecomSendMu.Lock()
	defer wecomSendMu.Unlock()

	settingItem, setting, err := s.readWecomSetting()
	if err != nil || !setting.Enabled || strings.TrimSpace(setting.WebhookURL) == "" {
		return
	}

	scheduleTime := strings.TrimSpace(setting.ScheduleTime)
	if scheduleTime == "" {
		scheduleTime = "22:00"
	}

	now := time.Now().In(loc)
	currentTimeStr := now.Format("15:04")
	currentDateStr := now.Format("2006-01-02")

	if currentTimeStr != scheduleTime {
		return
	}

	// 检查今天是否已经发送过
	if setting.LastSentAt != "" {
		if parsed, err := time.Parse(time.RFC3339, setting.LastSentAt); err == nil {
			if parsed.In(loc).Format("2006-01-02") == currentDateStr && setting.LastSentStatus == "success" {
				return
			}
		}
	}

	log.Printf("[WeCom] 触发每日定时简报推送 (%s)...", currentTimeStr)

	subCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	data, err := s.BuildDailyReportData(subCtx, setting.TargetDomain)
	if err != nil {
		log.Printf("[WeCom] 汇报数据构建失败: %v", err)
		setting.LastSentAt = now.Format(time.RFC3339)
		setting.LastSentStatus = "数据构建失败: " + err.Error()
		_ = s.saveWecomSetting(settingItem, setting)
		return
	}

	content := FormatWecomDailyReportText(data)
	sendErr := s.sendWecomTextMessage(subCtx, setting.WebhookURL, content, setting.MentionAll)
	setting.LastSentAt = now.Format(time.RFC3339)
	if sendErr != nil {
		log.Printf("[WeCom] Webhook 推送失败: %v", sendErr)
		setting.LastSentStatus = "推送失败: " + sendErr.Error()
	} else {
		log.Printf("[WeCom] 每日简报推送成功！")
		setting.LastSentStatus = "success"
	}
	_ = s.saveWecomSetting(settingItem, setting)
}
