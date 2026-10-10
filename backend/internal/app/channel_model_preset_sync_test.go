package app

import (
	"testing"

	"yingce/backend/internal/model"
)

// 预设渠道启动同步不得停用管理员手动启用或从上游导入的模型，否则每次后端重启
// 都会把用户刚启用的模型（例如 flow2api 的 Nano Banana 2.1）再次关掉。
func TestPresetChannelSyncKeepsAdminEnabledModels(t *testing.T) {
	svc, db := newChannelModelTestService(t)
	channel := model.ModelChannel{
		ID: "flow", Name: "flow2api", Scope: model.ChannelScopeSystem, Enabled: true,
		BaseURL: "http://192.168.31.63:8000", ModelsJSON: `["Nano Banana Pro"]`, RetiredModelsJSON: `[]`,
	}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	// 管理员从上游导入并手动启用的、不在预设清单里的模型。
	custom := model.ChannelModel{ID: "custom-2-1", ChannelID: channel.ID, ModelKey: "Nano Banana 2.1", DisplayName: "Nano Banana 2.1", Capability: "image", Protocol: "flow2api-image", Enabled: true, PriceConfigured: true}
	preset := model.ChannelModel{ID: "preset-pro", ChannelID: channel.ID, ModelKey: "Nano Banana Pro", DisplayName: "Nano Banana Pro", Capability: "image", Protocol: "flow2api-image", Enabled: true, PriceConfigured: true}
	if err := db.Create(&custom).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&preset).Error; err != nil {
		t.Fatal(err)
	}

	if err := svc.EnsureSystemChannelModels(); err != nil {
		t.Fatal(err)
	}

	reloaded, err := svc.repo.ChannelModelByKey(channel.ID, "Nano Banana 2.1")
	if err != nil {
		t.Fatal(err)
	}
	if !reloaded.Enabled {
		t.Fatal("preset channel startup sync disabled an admin-enabled model")
	}
}

// 显式标记为下架的模型仍然会在预设同步中被停用。
func TestPresetChannelSyncDisablesRetiredModels(t *testing.T) {
	svc, db := newChannelModelTestService(t)
	channel := model.ModelChannel{
		ID: "flow", Name: "flow2api", Scope: model.ChannelScopeSystem, Enabled: true,
		BaseURL: "http://192.168.31.63:8000", ModelsJSON: `["Nano Banana Pro"]`, RetiredModelsJSON: `["Legacy Model"]`,
	}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	retired := model.ChannelModel{ID: "legacy", ChannelID: channel.ID, ModelKey: "Legacy Model", DisplayName: "Legacy Model", Capability: "image", Protocol: "flow2api-image", Enabled: true, PriceConfigured: true}
	if err := db.Create(&retired).Error; err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureSystemChannelModels(); err != nil {
		t.Fatal(err)
	}
	reloaded, err := svc.repo.ChannelModelByKeyIncludingDisabled(channel.ID, "Legacy Model")
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Enabled {
		t.Fatal("retired model should be disabled by preset sync")
	}
}
