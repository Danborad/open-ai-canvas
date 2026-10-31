package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
)

const defaultPortableBackupDir = "/vol02/1000-0-27047199/open-ai-canvas-portable"

var (
	portableBackupMu      sync.Mutex
	portableBackupRunning bool
	portableBackupError   string
)

type PortableBackupManifest struct {
	Type               string `json:"type"`
	Version            string `json:"version"`
	SchemaVersion      int64  `json:"schemaVersion"`
	BackupTime         string `json:"backupTime"`
	BackupTarget       string `json:"backupTarget"`
	TotalResources     int64  `json:"totalResources"`
	TotalResourceBytes int64  `json:"totalResourceBytes"`
	DatabaseSqlBytes   int64  `json:"databaseSqlBytes"`
	Status             string `json:"status"`
}

type PortableBackupStatus struct {
	TargetDir          string `json:"targetDir"`
	Configured         bool   `json:"configured"`
	LastBackupTime     string `json:"lastBackupTime,omitempty"`
	Version            string `json:"version"`
	SchemaVersion      int64  `json:"schemaVersion"`
	TotalResources     int64  `json:"totalResources"`
	TotalResourceBytes int64  `json:"totalResourceBytes"`
	DatabaseSqlBytes   int64  `json:"databaseSqlBytes"`
	IsRunning          bool   `json:"isRunning"`
	LastError          string `json:"lastError,omitempty"`
}

func getPortableBackupTargetDir() string {
	dir := strings.TrimSpace(os.Getenv("CANVAS_PORTABLE_BACKUP_DIR"))
	if dir != "" {
		return dir
	}
	return defaultPortableBackupDir
}

func (s *Service) GetPortableBackupStatus(actor *model.User) (*PortableBackupStatus, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	targetDir := getPortableBackupTargetDir()
	manifestPath := filepath.Join(targetDir, "manifest.json")

	status := &PortableBackupStatus{
		TargetDir:  targetDir,
		Configured: true,
	}

	portableBackupMu.Lock()
	status.IsRunning = portableBackupRunning
	status.LastError = portableBackupError
	portableBackupMu.Unlock()

	manifestData, err := os.ReadFile(manifestPath)
	if err == nil {
		var manifest PortableBackupManifest
		if json.Unmarshal(manifestData, &manifest) == nil {
			status.LastBackupTime = manifest.BackupTime
			status.Version = manifest.Version
			status.SchemaVersion = manifest.SchemaVersion
			status.TotalResources = manifest.TotalResources
			status.TotalResourceBytes = manifest.TotalResourceBytes
			status.DatabaseSqlBytes = manifest.DatabaseSqlBytes
		}
	}

	return status, nil
}

func (s *Service) TriggerPortableBackup(actor *model.User) (*PortableBackupStatus, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	portableBackupMu.Lock()
	if portableBackupRunning {
		portableBackupMu.Unlock()
		return nil, errors.New("已有便携灾备任务正在执行中，请稍候")
	}
	portableBackupRunning = true
	portableBackupError = ""
	portableBackupMu.Unlock()

	go func() {
		defer func() {
			portableBackupMu.Lock()
			portableBackupRunning = false
			portableBackupMu.Unlock()
		}()

		cmdPath := "/app/scripts/backup-portable-stack.sh"
		if _, err := os.Stat(cmdPath); err != nil {
			// 本地开发或宿主机执行兼容
			cmdPath = "./scripts/backup-portable-stack.sh"
		}

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx, cmdPath)
		cmd.Env = os.Environ()

		out, err := cmd.CombinedOutput()
		if err != nil {
			errStr := fmt.Sprintf("便携灾备执行失败：%v, 输出: %s", err, string(out))
			slog.Error("portable backup failed", "error", errStr)
			portableBackupMu.Lock()
			portableBackupError = errStr
			portableBackupMu.Unlock()
			return
		}
		slog.Info("portable backup succeeded", "output", string(out))
	}()

	return s.GetPortableBackupStatus(actor)
}

func (s *Service) startPortableBackupWorker(ctx context.Context) {
	s.runWorkerLoop(func(ctx context.Context) {
		select {
		case <-ctx.Done():
			return
		case <-time.After(30 * time.Second):
			s.runScheduledPortableBackup()
		}

		// 每天自动执行一次增量同步
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.runScheduledPortableBackup()
			}
		}
	})
}

func (s *Service) runScheduledPortableBackup() {
	portableBackupMu.Lock()
	if portableBackupRunning {
		portableBackupMu.Unlock()
		return
	}
	portableBackupRunning = true
	portableBackupError = ""
	portableBackupMu.Unlock()

	defer func() {
		portableBackupMu.Lock()
		portableBackupRunning = false
		portableBackupMu.Unlock()
	}()

	cmdPath := "/app/scripts/backup-portable-stack.sh"
	if _, err := os.Stat(cmdPath); err != nil {
		cmdPath = "./scripts/backup-portable-stack.sh"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, cmdPath)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		errStr := fmt.Sprintf("定时便携灾备执行失败：%v, 输出: %s", err, string(out))
		slog.Error("scheduled portable backup failed", "error", errStr)
		portableBackupMu.Lock()
		portableBackupError = errStr
		portableBackupMu.Unlock()
		return
	}
	slog.Info("scheduled portable backup finished successfully")
}
