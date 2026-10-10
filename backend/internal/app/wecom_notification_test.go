package app

import (
	"context"
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

func TestMaskWecomWebhookURL(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=12345678-abcd-1234-abcd-123456789abc", "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=******9abc"},
		{"https://example.com/webhook", "https://ex...hook"},
	}

	for _, tt := range tests {
		got := maskWecomWebhookURL(tt.input)
		if got != tt.expected {
			t.Errorf("maskWecomWebhookURL(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestFormatWecomDailyReportText(t *testing.T) {
	data := &WecomDailyReportData{
		ReportTime:       time.Date(2026, 9, 10, 22, 0, 0, 0, time.UTC),
		TotalUsers:       38,
		ActiveUsersToday: 5,
		TotalTasksToday:  50,
		SuccessTasks:     48,
		FailedTasks:      2,
		TotalImagesToday: 46,
		ImageSuccess:     45,
		ImageFailed:      1,
		TotalVideosToday: 4,
		VideoSuccess:     3,
		VideoFailed:      1,
		TopCreators: []repository.CreatorStat{
			{AccountName: "danborad@gmail.com", TaskCount: 29},
			{AccountName: "zhangxunvvv@163.com", TaskCount: 21},
		},
		ModelStats: []ModelUsageStat{
			{ModelName: "gpt-image-2", TaskCount: 46, SuccessCount: 45, FailedCount: 1},
			{ModelName: "Omni 1.1 Flash", TaskCount: 3, SuccessCount: 2, FailedCount: 1},
			{ModelName: "MiniMax-H3", TaskCount: 1, SuccessCount: 1, FailedCount: 0},
		},
		SystemImages:     6859,
		SystemImageBytes: 12951254676,
		SystemVideos:     227,
		SystemVideoBytes: 1073968824,
		SystemTotalBytes: 14025381055,
		ESADomain:        "art.960916.xyz",
		ESATrafficBytes:  574964874,
		ESARequestCount:  6420,
		ESAEnabled:       true,
	}

	text := FormatWecomDailyReportText(data)

	// Check core elements
	checks := []string{
		"影策创作台 · 每日运行简报",
		"平台注册总用户：38 人",
		"今日活跃用户数：5 人",
		"生成任务总量：50 次",
		"96.0%",
		"图片生成：46 张 (成功 45 / 失败 1)",
		"视频生成：4 条 (成功 3 / 失败 1)",
		"danborad@gmail.com (29 次)",
		"zhangxunvvv@163.com (21 次)",
		"调用模型统计",
		"gpt-image-2：46 次 (成功 45 / 失败 1)",
		"Omni 1.1 Flash：3 次 (成功 2 / 失败 1)",
		"MiniMax-H3：1 次 (全部成功)",
		"系统总图片数：6859 张",
		"系统总视频数：227 条",
		"art.960916.xyz",
		"今日总请求数：6420 次",
	}

	for _, check := range checks {
		if !strings.Contains(text, check) {
			t.Errorf("FormatWecomDailyReportText missing %q\nFull text:\n%s", check, text)
		}
	}

	// 验证未使用的模型不出现：空模型列表时完全不输出该段
	emptyData := *data
	emptyData.ModelStats = nil
	emptyText := FormatWecomDailyReportText(&emptyData)
	if strings.Contains(emptyText, "调用模型统计") {
		t.Errorf("expected no model section when empty, got:\n%s", emptyText)
	}

	// 验证包含渠道名称时的格式化
	channelData := *data
	channelData.ModelStats = []ModelUsageStat{
		{ModelName: "gpt-image-2.5", ChannelName: "chat2api 1K · 福利渠道", TaskCount: 236, SuccessCount: 159, FailedCount: 77},
		{ModelName: "minimax_h3_lightx2v_v5", ChannelName: "AutoDL.Art", TaskCount: 10, SuccessCount: 10, FailedCount: 0},
	}
	channelText := FormatWecomDailyReportText(&channelData)
	if !strings.Contains(channelText, "gpt-image-2.5 [chat2api 1K · 福利渠道]：236 次 (成功 159 / 失败 77)") {
		t.Errorf("expected channel formatting in model stats, got:\n%s", channelText)
	}
	if !strings.Contains(channelText, "minimax_h3_lightx2v_v5 [AutoDL.Art]：10 次 (全部成功)") {
		t.Errorf("expected channel formatting in model stats, got:\n%s", channelText)
	}
}

func TestFormatWecomUserRegisteredText(t *testing.T) {
	svc, _, _ := newResourceDeletionTestService(t)
	user := &model.User{
		ID:          "user-123",
		Username:    "luffy",
		DisplayName: "草帽路飞",
		Email:       "luffy@onepiece.com",
		CreatedAt:   time.Date(2026, 9, 16, 15, 30, 0, 0, time.UTC),
	}

	text := svc.FormatWecomUserRegisteredText(user)

	checks := []string{
		"新用户注册通知",
		"用户账号：luffy",
		"用户昵称：草帽路飞",
		"绑定邮箱：luffy@onepiece.com",
		"注册时间：2026-09-16 23:30:00",
		"平台总用户：",
	}

	for _, check := range checks {
		if !strings.Contains(text, check) {
			t.Errorf("FormatWecomUserRegisteredText missing %q\nFull text:\n%s", check, text)
		}
	}
}

func TestBuildDailyReportData(t *testing.T) {
	svc, _, _ := newResourceDeletionTestService(t)
	ctx := context.Background()

	data, err := svc.BuildDailyReportData(ctx, "art.960916.xyz")
	if err != nil {
		t.Fatalf("BuildDailyReportData failed: %v", err)
	}

	if data.ESADomain != "art.960916.xyz" {
		t.Errorf("expected ESADomain = art.960916.xyz, got %s", data.ESADomain)
	}
}
