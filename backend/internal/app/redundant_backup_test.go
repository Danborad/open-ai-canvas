package app

import (
	"os"
	"path/filepath"
	"testing"

	"yingce/backend/internal/model"
)

func TestGetRedundantBackupStatus(t *testing.T) {
	svc, _ := newSystemPerformanceTestService(t)
	admin := &model.User{ID: "admin-1", Role: "admin"}
	nonAdmin := &model.User{ID: "user-1", Role: "user"}

	// 1. 普通用户应被拦截
	if _, err := svc.GetRedundantBackupStatus(nonAdmin); err == nil {
		t.Fatal("expected non-admin to be rejected")
	}

	// 2. 管理员可读取状态
	tmpDir := t.TempDir()
	t.Setenv("CANVAS_REDUNDANT_BACKUP_DIR", tmpDir)

	status, err := svc.GetRedundantBackupStatus(admin)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.TargetDir != tmpDir {
		t.Errorf("status.TargetDir = %q, want %q", status.TargetDir, tmpDir)
	}

	// 3. 写入测试 manifest 并验证读取解析
	manifestJSON := `{
		"type": "redundant_stack_backup",
		"version": "v1.7.3.2",
		"schemaVersion": 80,
		"backupTime": "2026-10-31T12:00:00Z",
		"totalResources": 100,
		"totalResourceBytes": 102400,
		"databaseSqlBytes": 20480,
		"status": "ready"
	}`
	if err := os.WriteFile(filepath.Join(tmpDir, "manifest.json"), []byte(manifestJSON), 0644); err != nil {
		t.Fatal(err)
	}

	statusWithManifest, err := svc.GetRedundantBackupStatus(admin)
	if err != nil {
		t.Fatalf("unexpected error with manifest: %v", err)
	}
	if statusWithManifest.TotalResources != 100 || statusWithManifest.SchemaVersion != 80 {
		t.Errorf("unexpected manifest parsed: %+v", statusWithManifest)
	}
}

func TestExecuteRedundantBackupSQLite(t *testing.T) {
	svc, _ := newSystemPerformanceTestService(t)
	targetDir := t.TempDir()

	// 模拟写入一个测试资源
	testResourceDir := filepath.Join(svc.dataDir, "resources", "users", "test-user")
	if err := os.MkdirAll(testResourceDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(testResourceDir, "sample.png"), []byte("sample-image-data"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := svc.executeRedundantBackup(targetDir, RedundantBackupSetting{}); err != nil {
		t.Fatalf("executeRedundantBackup error: %v", err)
	}

	// 验证生成的文件
	if _, err := os.Stat(filepath.Join(targetDir, "initdb", "open_ai_canvas.db")); err != nil {
		t.Errorf("expected sqlite db backup file: %v", err)
	}
	if _, err := os.Stat(filepath.Join(targetDir, "docker-compose.yml")); err != nil {
		t.Errorf("expected docker-compose.yml: %v", err)
	}
	if _, err := os.Stat(filepath.Join(targetDir, "start.sh")); err != nil {
		t.Errorf("expected start.sh: %v", err)
	}
	if _, err := os.Stat(filepath.Join(targetDir, "manifest.json")); err != nil {
		t.Errorf("expected manifest.json: %v", err)
	}

	// 验证媒体同步
	copiedFile := filepath.Join(targetDir, "data", "resources", "users", "test-user", "sample.png")
	data, err := os.ReadFile(copiedFile)
	if err != nil || string(data) != "sample-image-data" {
		t.Errorf("unexpected copied file content: %s, err: %v", string(data), err)
	}
}

func TestRedundantBackupSetting(t *testing.T) {
	svc, db := newSystemPerformanceTestService(t)
	_ = db.AutoMigrate(&model.SystemSetting{})
	admin := &model.User{ID: "admin-1", Role: "admin"}

	// 1. 读取默认设置
	def, err := svc.AdminRedundantBackupSetting(admin)
	if err != nil {
		t.Fatal(err)
	}
	if !def.Enabled || def.IntervalHours != 24 {
		t.Errorf("unexpected default setting: %+v", def)
	}

	// 2. 更新周期为 6 小时并开启 WebDAV 同步
	updated, err := svc.UpdateRedundantBackupSetting(admin, RedundantBackupSetting{
		Enabled:        true,
		IntervalHours:  6,
		WebDAVEnabled:  true,
		WebDAVEndpoint: "http://127.0.0.1:5005",
		WebDAVUsername: "test",
		WebDAVPassword: "password123",
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.IntervalHours != 6 || !updated.WebDAVEnabled || !updated.HasWebDAVPassword {
		t.Errorf("unexpected updated setting: %+v", updated)
	}
}
