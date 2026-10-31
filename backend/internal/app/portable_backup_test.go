package app

import (
	"os"
	"path/filepath"
	"testing"

	"yingce/backend/internal/model"
)

func TestGetPortableBackupStatus(t *testing.T) {
	svc, _ := newSystemPerformanceTestService(t)
	admin := &model.User{ID: "admin-1", Role: "admin"}
	nonAdmin := &model.User{ID: "user-1", Role: "user"}

	// 1. 普通用户应被拦截
	if _, err := svc.GetPortableBackupStatus(nonAdmin); err == nil {
		t.Fatal("expected non-admin to be rejected")
	}

	// 2. 管理员可读取状态
	tmpDir := t.TempDir()
	t.Setenv("CANVAS_PORTABLE_BACKUP_DIR", tmpDir)

	status, err := svc.GetPortableBackupStatus(admin)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.TargetDir != tmpDir {
		t.Errorf("status.TargetDir = %q, want %q", status.TargetDir, tmpDir)
	}

	// 3. 写入测试 manifest 并验证读取解析
	manifestJSON := `{
		"type": "portable_stack_backup",
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

	statusWithManifest, err := svc.GetPortableBackupStatus(admin)
	if err != nil {
		t.Fatalf("unexpected error with manifest: %v", err)
	}
	if statusWithManifest.TotalResources != 100 || statusWithManifest.SchemaVersion != 80 {
		t.Errorf("unexpected manifest parsed: %+v", statusWithManifest)
	}
}
