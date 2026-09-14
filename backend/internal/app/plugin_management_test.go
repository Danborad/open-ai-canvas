package app

import (
	"testing"

	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestApplicationPluginUsesUserStateUnderPlatformAvailability(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.PluginPlatformState{}, &model.UserPluginState{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	center, err := newPluginRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db), pluginRuntime: center}
	user := &model.User{ID: "user-1", Role: model.UserRoleUser}
	admin := &model.User{ID: "admin-1", Role: model.UserRoleAdmin}

	states, err := svc.PluginStatesForUser(user)
	if err != nil {
		t.Fatal(err)
	}
	initial := states[WorkflowPluginRunningHub]
	if !initial.PlatformAvailable || initial.UserEnabled || initial.EffectiveEnabled || !initial.CanToggle {
		t.Fatalf("initial RunningHub state = %#v", initial)
	}

	enabled, err := svc.SetUserPluginEnabled(user, WorkflowPluginRunningHub, true)
	if err != nil {
		t.Fatal(err)
	}
	if !enabled.UserConfigured || !enabled.UserEnabled || !enabled.EffectiveEnabled {
		t.Fatalf("enabled RunningHub state = %#v", enabled)
	}
	if _, err := svc.SetPluginPlatformAvailability(user, WorkflowPluginRunningHub, false); err == nil {
		t.Fatal("ordinary user changed platform plugin availability")
	}
	disabled, err := svc.SetPluginPlatformAvailability(admin, WorkflowPluginRunningHub, false)
	if err != nil {
		t.Fatal(err)
	}
	if disabled.PlatformAvailable || disabled.EffectiveEnabled || disabled.EnabledUserCount != 1 {
		t.Fatalf("platform-disabled RunningHub state = %#v", disabled)
	}
	if err := svc.RequireWorkflowPluginForUser(user.ID, "runninghub-workflow-image"); err == nil {
		t.Fatal("platform-disabled workflow was accepted for a new user request")
	}
	if _, err := svc.SetPluginPlatformAvailability(admin, WorkflowPluginRunningHub, true); err != nil {
		t.Fatal(err)
	}
	if err := svc.RequireWorkflowPluginForUser(user.ID, "runninghub-workflow-video"); err != nil {
		t.Fatalf("restored user workflow rejected: %v", err)
	}
}

func TestUploadedManifestCannotClaimUserActivationScope(t *testing.T) {
	policy := pluginManagement(PluginPromptOptimizer, PluginOriginUploaded)
	if policy.Origin != PluginOriginUploaded || policy.ActivationScope != PluginScopeSystem || policy.ConfigurationScope != PluginConfigurationSystem {
		t.Fatalf("uploaded plugin policy = %#v", policy)
	}
}

func TestBundledDirectoryPluginsAreReconciledAndResolvable(t *testing.T) {
	center, err := newPluginRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	registry := center.registrySnapshot()
	if registry == nil {
		t.Fatal("registry snapshot is nil")
	}

	flowImage, ok := registry.Resolve("flow2api-image")
	if !ok {
		t.Fatal("flow2api-image adapter was not resolved from bundled directory")
	}
	if flowImage.Metadata().ID != "flow2api-image" || !flowImage.Metadata().Enabled {
		t.Fatalf("flow2api-image metadata mismatch: %#v", flowImage.Metadata())
	}

	flowVideo, ok := registry.Resolve("flow2api-video")
	if !ok {
		t.Fatal("flow2api-video adapter was not resolved from bundled directory")
	}
	if flowVideo.Metadata().ID != "flow2api-video" || !flowVideo.Metadata().Enabled {
		t.Fatalf("flow2api-video metadata mismatch: %#v", flowVideo.Metadata())
	}
}

func TestArtCritiqueIsUserToggleableApplication(t *testing.T) {
	policy := pluginManagement(PluginAIArtCritique, "bundled")
	if policy.Origin != PluginOriginOfficial || policy.Kind != PluginKindApplication || policy.ActivationScope != PluginScopeUser || policy.ConfigurationScope != PluginConfigurationNone {
		t.Fatalf("AI art critique policy = %#v", policy)
	}
}

// Regression: editor-shell was missing from officialApplicationPolicies, so the
// backend classified it as a system protocol and reported it to the admin page
// as "管理员已停用该插件" even though nothing disabled it.
func TestEditorShellIsUserToggleableApplication(t *testing.T) {
	policy := pluginManagement(PluginEditorShell, "bundled")
	if policy.Origin != PluginOriginOfficial || policy.Kind != PluginKindApplication || policy.ActivationScope != PluginScopeUser || policy.ConfigurationScope != PluginConfigurationNone {
		t.Fatalf("editor shell policy = %#v", policy)
	}
}

func TestEditorShellReportsPlatformAvailableWithoutPlatformState(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.PluginPlatformState{}, &model.UserPluginState{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	center, err := newPluginRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db), pluginRuntime: center}
	user := &model.User{ID: "user-1", Role: model.UserRoleUser}

	states, err := svc.PluginStatesForUser(user)
	if err != nil {
		t.Fatal(err)
	}
	state, ok := states[PluginEditorShell]
	if !ok {
		t.Fatalf("editor shell missing from plugin states: %#v", states)
	}
	if !state.PlatformAvailable || !state.CanToggle {
		t.Fatalf("editor shell should be a user-toggleable application, got %#v", state)
	}
	if state.BlockedReason == "管理员已停用该插件" {
		t.Fatalf("editor shell reported as admin-disabled: %#v", state)
	}
}
