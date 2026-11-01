package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/storage"
)

const redundantBackupSettingKey = "redundant_backup"

var (
	redundantBackupMu      sync.Mutex
	redundantBackupRunning bool
	redundantBackupError   string
	redundantBackupStatus  string
	redundantBackupNotify  = make(chan struct{}, 1)
)

type RedundantBackupSetting struct {
	Enabled           bool       `json:"enabled"`
	IntervalHours     int        `json:"intervalHours"`
	TargetDir         string     `json:"targetDir"`
	WebDAVEnabled     bool       `json:"webdavEnabled"`
	WebDAVEndpoint    string     `json:"webdavEndpoint"`
	WebDAVUsername    string     `json:"webdavUsername"`
	WebDAVPassword    string     `json:"webdavPassword,omitempty"`
	HasWebDAVPassword bool       `json:"hasWebdavPassword"`
	WebDAVPathPrefix  string     `json:"webdavPathPrefix"`
	UpdatedAt         *time.Time `json:"updatedAt,omitempty"`
}

type RedundantBackupManifest struct {
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

type RedundantBackupStatus struct {
	TargetDir          string `json:"targetDir"`
	Configured         bool   `json:"configured"`
	LastBackupTime     string `json:"lastBackupTime,omitempty"`
	NextBackupTime     string `json:"nextBackupTime,omitempty"`
	Version            string `json:"version"`
	SchemaVersion      int64  `json:"schemaVersion"`
	TotalResources     int64  `json:"totalResources"`
	TotalResourceBytes int64  `json:"totalResourceBytes"`
	DatabaseSqlBytes   int64  `json:"databaseSqlBytes"`
	IsRunning          bool   `json:"isRunning"`
	ProgressText       string `json:"progressText,omitempty"`
	LastError          string `json:"lastError,omitempty"`
	// 定时周期设置
	AutoBackupEnabled  bool   `json:"autoBackupEnabled"`
	IntervalHours      int    `json:"intervalHours"`
	WebDAVEnabled      bool   `json:"webdavEnabled"`
	WebDAVTarget       string `json:"webdavTarget,omitempty"`
}

func (s *Service) defaultRedundantBackupSetting() RedundantBackupSetting {
	setting := RedundantBackupSetting{
		Enabled:       true,
		IntervalHours: 24,
	}

	// 尝试从存储服务中继承已配置好的 WebDAV 参数作为备份备选项
	if _, ossVal, err := s.readOSSSetting(); err == nil {
		if ossVal.Provider == "webdav" && ossVal.Endpoint != "" {
			setting.WebDAVEndpoint = ossVal.Endpoint
			setting.WebDAVUsername = ossVal.AccessKeyID
			setting.WebDAVPassword = ossVal.AccessKeySecret
			setting.HasWebDAVPassword = ossVal.AccessKeySecret != ""
			setting.WebDAVPathPrefix = ossVal.PathPrefix
		}
	}
	return setting
}

func (s *Service) redundantBackupSetting() (RedundantBackupSetting, error) {
	setting, err := s.repo.SystemSetting(redundantBackupSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.defaultRedundantBackupSetting(), nil
	}
	if err != nil {
		return s.defaultRedundantBackupSetting(), err
	}
	value := s.defaultRedundantBackupSetting()
	if strings.TrimSpace(setting.ValueJSON) != "" {
		if json.Unmarshal([]byte(setting.ValueJSON), &value) != nil {
			return s.defaultRedundantBackupSetting(), errors.New("冗余备份配置格式无效")
		}
	}
	if value.IntervalHours <= 0 {
		value.IntervalHours = 24
	}

	value.HasWebDAVPassword = strings.TrimSpace(value.WebDAVPassword) != ""
	if decrypted, err := s.decryptSettingSecret(value.WebDAVPassword); err == nil && decrypted != "" {
		value.WebDAVPassword = decrypted
	}

	updatedAt := setting.UpdatedAt
	value.UpdatedAt = &updatedAt
	return value, nil
}

func (s *Service) AdminRedundantBackupSetting(actor *model.User) (RedundantBackupSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return RedundantBackupSetting{}, err
	}
	setting, err := s.redundantBackupSetting()
	if err != nil {
		return RedundantBackupSetting{}, err
	}
	// 不向前端暴露真实密码明文
	setting.WebDAVPassword = ""
	return setting, nil
}

func (s *Service) UpdateRedundantBackupSetting(actor *model.User, req RedundantBackupSetting) (RedundantBackupSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return RedundantBackupSetting{}, err
	}

	current, _ := s.redundantBackupSetting()

	if req.IntervalHours <= 0 {
		req.IntervalHours = 24
	} else if req.IntervalHours > 720 {
		req.IntervalHours = 720
	}

	passwordToStore := req.WebDAVPassword
	if passwordToStore == "" && current.HasWebDAVPassword {
		passwordToStore = current.WebDAVPassword
	}
	if passwordToStore != "" && !strings.HasPrefix(passwordToStore, encryptedSettingPrefix) {
		encrypted, err := s.encryptSettingSecret(passwordToStore)
		if err == nil {
			passwordToStore = encrypted
		}
	}

	targetDir := strings.TrimSpace(req.TargetDir)
	toStore := RedundantBackupSetting{
		Enabled:          req.Enabled,
		IntervalHours:    req.IntervalHours,
		TargetDir:        targetDir,
		WebDAVEnabled:    req.WebDAVEnabled,
		WebDAVEndpoint:   strings.TrimRight(strings.TrimSpace(req.WebDAVEndpoint), "/"),
		WebDAVUsername:   strings.TrimSpace(req.WebDAVUsername),
		WebDAVPassword:   passwordToStore,
		WebDAVPathPrefix: strings.Trim(strings.TrimSpace(req.WebDAVPathPrefix), "/"),
	}

	encoded, err := json.Marshal(toStore)
	if err != nil {
		return RedundantBackupSetting{}, err
	}

	setting := model.SystemSetting{Key: redundantBackupSettingKey, ValueJSON: string(encoded), UpdatedBy: actor.ID}
	dbSetting, err := s.repo.SystemSetting(redundantBackupSettingKey)
	if err == nil {
		setting.CreatedAt = dbSetting.CreatedAt
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return RedundantBackupSetting{}, err
	}

	if err := s.repo.SaveSystemSetting(&setting); err != nil {
		return RedundantBackupSetting{}, err
	}

	_ = s.appendAdminAudit(actor, "redundant_backup.update_setting", "system_setting", redundantBackupSettingKey, "更新冗余备份周期与目标设置", map[string]any{
		"enabled":       req.Enabled,
		"intervalHours": req.IntervalHours,
		"webdavEnabled": req.WebDAVEnabled,
		"targetDir":     targetDir,
	})

	select {
	case redundantBackupNotify <- struct{}{}:
	default:
	}

	return s.AdminRedundantBackupSetting(actor)
}

func (s *Service) getRedundantBackupTargetDir() string {
	setting, _ := s.redundantBackupSetting()
	if setting.TargetDir != "" {
		return setting.TargetDir
	}
	dir := strings.TrimSpace(os.Getenv("CANVAS_REDUNDANT_BACKUP_DIR"))
	if dir != "" {
		return dir
	}
	dir = strings.TrimSpace(os.Getenv("CANVAS_PORTABLE_BACKUP_DIR"))
	if dir != "" {
		return dir
	}
	return filepath.Join(s.dataDir, "backups", "redundant")
}

func (s *Service) GetRedundantBackupStatus(actor *model.User) (*RedundantBackupStatus, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	setting, _ := s.redundantBackupSetting()
	targetDir := s.getRedundantBackupTargetDir()
	manifestPath := filepath.Join(targetDir, "manifest.json")

	status := &RedundantBackupStatus{
		TargetDir:         targetDir,
		Configured:        true,
		AutoBackupEnabled: setting.Enabled,
		IntervalHours:     setting.IntervalHours,
		WebDAVEnabled:     setting.WebDAVEnabled,
	}
	if setting.WebDAVEnabled && setting.WebDAVEndpoint != "" {
		status.WebDAVTarget = setting.WebDAVEndpoint
		if setting.WebDAVPathPrefix != "" {
			status.WebDAVTarget += "/" + setting.WebDAVPathPrefix
		}
	}

	redundantBackupMu.Lock()
	status.IsRunning = redundantBackupRunning
	status.ProgressText = redundantBackupStatus
	status.LastError = redundantBackupError
	redundantBackupMu.Unlock()

	manifestData, err := os.ReadFile(manifestPath)
	if err == nil {
		var manifest RedundantBackupManifest
		if json.Unmarshal(manifestData, &manifest) == nil {
			status.LastBackupTime = manifest.BackupTime
			status.Version = manifest.Version
			status.SchemaVersion = manifest.SchemaVersion
			status.TotalResources = manifest.TotalResources
			status.TotalResourceBytes = manifest.TotalResourceBytes
			status.DatabaseSqlBytes = manifest.DatabaseSqlBytes

			if status.AutoBackupEnabled && status.LastBackupTime != "" {
				if lastT, parseErr := time.Parse(time.RFC3339, status.LastBackupTime); parseErr == nil {
					nextT := lastT.Add(time.Duration(status.IntervalHours) * time.Hour)
					status.NextBackupTime = nextT.Format(time.RFC3339)
				}
			}
		}
	}

	return status, nil
}

func (s *Service) TriggerRedundantBackup(actor *model.User) (*RedundantBackupStatus, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	redundantBackupMu.Lock()
	if redundantBackupRunning {
		redundantBackupMu.Unlock()
		return nil, errors.New("已有冗余备份任务正在执行中，请稍候")
	}
	redundantBackupRunning = true
	redundantBackupError = ""
	redundantBackupStatus = "正在初始化备份..."
	redundantBackupMu.Unlock()

	targetDir := s.getRedundantBackupTargetDir()
	setting, _ := s.redundantBackupSetting()

	go func() {
		defer func() {
			redundantBackupMu.Lock()
			redundantBackupRunning = false
			redundantBackupStatus = ""
			redundantBackupMu.Unlock()
		}()

		if err := s.executeRedundantBackup(targetDir, setting); err != nil {
			errStr := fmt.Sprintf("冗余备份执行失败：%v", err)
			slog.Error("redundant backup failed", "error", errStr)
			redundantBackupMu.Lock()
			redundantBackupError = errStr
			redundantBackupMu.Unlock()
			return
		}
		slog.Info("redundant backup finished successfully", "targetDir", targetDir)
	}()

	return s.GetRedundantBackupStatus(actor)
}

func (s *Service) executeRedundantBackup(targetDir string, setting RedundantBackupSetting) error {
	initdbDir := filepath.Join(targetDir, "initdb")
	resourcesDir := filepath.Join(targetDir, "data", "resources")
	distDir := filepath.Join(targetDir, "dist")

	if err := os.MkdirAll(initdbDir, 0755); err != nil {
		return fmt.Errorf("创建 initdb 目录失败：%w", err)
	}
	if err := os.MkdirAll(resourcesDir, 0755); err != nil {
		return fmt.Errorf("创建 resources 目录失败：%w", err)
	}
	if err := os.MkdirAll(distDir, 0755); err != nil {
		return fmt.Errorf("创建 dist 目录失败：%w", err)
	}

	// 1. 导出数据库快照
	s.setBackupStatus("正在导出数据库完整快照 (PostgreSQL)...")
	if s.repo.Dialect() == "postgres" {
		dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dbURL == "" {
			return errors.New("未配置 DATABASE_URL，无法导出 PostgreSQL 数据库快照")
		}
		tmpSQL := filepath.Join(initdbDir, "01-restore-canvas.sql.tmp")
		finalSQL := filepath.Join(initdbDir, "01-restore-canvas.sql")

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx, "pg_dump", dbURL, "--clean", "--if-exists", "-f", tmpSQL)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("pg_dump 执行失败：%w, 输出: %s", err, string(out))
		}
		if err := os.Rename(tmpSQL, finalSQL); err != nil {
			return fmt.Errorf("重命名数据库快照文件失败：%w", err)
		}
	} else {
		dbPath := filepath.Join(initdbDir, "open_ai_canvas.db")
		if err := s.repo.BackupSQLite(dbPath); err != nil {
			return fmt.Errorf("导出 SQLite 数据库快照失败：%w", err)
		}
	}

	// 2. 本地增量同步媒体文件
	s.setBackupStatus("正在增量同步本地媒体资源库...")
	srcResources := filepath.Join(s.dataDir, "resources")
	if info, err := os.Stat(srcResources); err == nil && info.IsDir() {
		if _, err := exec.LookPath("rsync"); err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			cmd := exec.CommandContext(ctx, "rsync", "-av", "--update", srcResources+"/", resourcesDir+"/")
			if out, err := cmd.CombinedOutput(); err != nil {
				slog.Warn("rsync failed, falling back to go copy", "error", err, "out", string(out))
				if copyErr := syncDirectoryGo(srcResources, resourcesDir); copyErr != nil {
					return fmt.Errorf("媒体文件增量复制失败：%w", copyErr)
				}
			}
		} else {
			if copyErr := syncDirectoryGo(srcResources, resourcesDir); copyErr != nil {
				return fmt.Errorf("媒体文件增量复制失败：%w", copyErr)
			}
		}
	}

	// 3. 生成自包含启动编排与脚本
	writePortableConfigs(targetDir)

	// 4. 统计资源数与体积，生成 manifest.json
	version := "v1.7.3.2"
	if data, err := os.ReadFile("VERSION"); err == nil {
		version = strings.TrimSpace(string(data))
	} else if data, err := os.ReadFile("../VERSION"); err == nil {
		version = strings.TrimSpace(string(data))
	}
	writeRedundantManifest(targetDir, version)

	// 5. 如果启用了 WebDAV 远程备份，同步推送到 WebDAV
	if setting.WebDAVEnabled && setting.WebDAVEndpoint != "" {
		s.setBackupStatus("正在向 WebDAV 远程备份仓增量同步快照与媒体...")
		ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
		defer cancel()
		if err := s.syncToWebDAV(ctx, targetDir, setting); err != nil {
			return fmt.Errorf("WebDAV 远程同步失败：%w", err)
		}
	}

	return nil
}

func (s *Service) setBackupStatus(text string) {
	redundantBackupMu.Lock()
	redundantBackupStatus = text
	redundantBackupMu.Unlock()
}

func (s *Service) syncToWebDAV(ctx context.Context, targetDir string, setting RedundantBackupSetting) error {
	password := setting.WebDAVPassword
	if password == "" {
		return errors.New("WebDAV 密码为空，无法执行远程备份")
	}

	webdavSetting := storage.Settings{
		Provider:        "webdav",
		Endpoint:        setting.WebDAVEndpoint,
		Bucket:          "",
		PathPrefix:      setting.WebDAVPathPrefix,
		AccessKeyID:     setting.WebDAVUsername,
		AccessKeySecret: password,
	}

	// 1. 上传数据库快照
	sqlPath := filepath.Join(targetDir, "initdb", "01-restore-canvas.sql")
	if info, err := os.Stat(sqlPath); err == nil && !info.IsDir() {
		f, err := os.Open(sqlPath)
		if err == nil {
			defer f.Close()
			_, err = storage.PutWebDAVObject(webdavSetting, "initdb/01-restore-canvas.sql", "application/sql", info.Size(), f)
			if err != nil {
				return fmt.Errorf("上传数据库快照至 WebDAV 失败: %w", err)
			}
		}
	}

	// 2. 上传 docker-compose.yml 与 start.sh
	for _, fname := range []string{"docker-compose.yml", "start.sh"} {
		fpath := filepath.Join(targetDir, fname)
		if info, err := os.Stat(fpath); err == nil && !info.IsDir() {
			data, err := os.ReadFile(fpath)
			if err == nil {
				_, _ = storage.PutWebDAVObject(webdavSetting, fname, "text/plain", int64(len(data)), bytes.NewReader(data))
			}
		}
	}

	// 3. 增量上传媒体文件
	resourcesDir := filepath.Join(targetDir, "data", "resources")
	if info, err := os.Stat(resourcesDir); err == nil && info.IsDir() {
		_ = filepath.Walk(resourcesDir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info == nil || info.IsDir() {
				return nil
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			rel, err := filepath.Rel(resourcesDir, path)
			if err != nil {
				return nil
			}
			relSlash := filepath.ToSlash(rel)
			remoteKey := "data/resources/" + relSlash

			// 检查远端是否已存在（跳过已同步的媒体文件）
			stream, err := storage.GetWebDAVObjectRange(webdavSetting, remoteKey, "bytes=0-0")
			if err == nil && stream != nil {
				_ = stream.Body.Close()
				if stream.StatusCode == http.StatusOK || stream.StatusCode == http.StatusPartialContent {
					return nil
				}
			}

			// 上传新文件
			file, err := os.Open(path)
			if err != nil {
				return nil
			}
			defer file.Close()
			_, _ = storage.PutWebDAVObject(webdavSetting, remoteKey, "application/octet-stream", info.Size(), file)
			return nil
		})
	}

	// 4. 上传清单文件 manifest.json
	manifestPath := filepath.Join(targetDir, "manifest.json")
	if data, err := os.ReadFile(manifestPath); err == nil {
		_, _ = storage.PutWebDAVObject(webdavSetting, "manifest.json", "application/json", int64(len(data)), bytes.NewReader(data))
	}

	return nil
}

func syncDirectoryGo(srcDir, dstDir string) error {
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		targetPath := filepath.Join(dstDir, rel)
		if info.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}
		if targetInfo, err := os.Stat(targetPath); err == nil {
			if targetInfo.Size() == info.Size() {
				return nil
			}
		}
		return copyFile(path, targetPath)
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func writePortableConfigs(targetDir string) {
	composeContent := `# ==============================================================================
# Open AI Canvas - 冗余备份自包含启动编排
# ==============================================================================
# 特性：
# 1. 首次在新环境启动时，自动导入 initdb/01-restore-canvas.sql 数据库快照
# 2. 媒体库直接读取并写入 ./data/resources 目录
# 3. 前端静态包直接从 ./dist 托管
# ==============================================================================

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-open_ai_canvas}
      POSTGRES_USER: ${POSTGRES_USER:-open_ai_canvas}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?请先配置数据库密码}
    volumes:
      - ./initdb:/docker-entrypoint-initdb.d:ro
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7.4-alpine
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  backend:
    image: open-ai-canvas-backend:deploy
    environment:
      CANVAS_BACKEND_ADDR: ":8080"
      CANVAS_BACKEND_DATA_DIR: /data
      CANVAS_DATABASE_DRIVER: postgres
      DATABASE_URL: ${DATABASE_URL:?请先配置数据库连接}
      REDIS_URL: redis://redis:6379/0
      CANVAS_WORKER_CONCURRENCY: ${CANVAS_WORKER_CONCURRENCY:-999}
      CANVAS_CHANNEL_CONCURRENCY: ${CANVAS_CHANNEL_CONCURRENCY:-999}
      CANVAS_REGISTRATION_ENABLED: ${CANVAS_REGISTRATION_ENABLED:-false}
      CANVAS_ALLOW_PRIVATE_UPSTREAMS: ${CANVAS_ALLOW_PRIVATE_UPSTREAMS:-true}
      CANVAS_CORS_ORIGINS: ${CANVAS_CORS_ORIGINS:-*}
      CANVAS_COOKIE_SECURE: ${CANVAS_COOKIE_SECURE:-false}
      CANVAS_PUBLIC_BASE_URL: ${CANVAS_PUBLIC_BASE_URL:-}
      CANVAS_WECHAT_LOGIN_ENABLED: ${CANVAS_WECHAT_LOGIN_ENABLED:-true}
      CANVAS_WECHAT_APPID: ${CANVAS_WECHAT_APPID:-wx7423e3ed710143ab}
      CANVAS_WECHAT_SECRET: ${CANVAS_WECHAT_SECRET:-0177296ba6aa1f41f3e20e568d4b13f0}
      CANVAS_WECHAT_QR_PAGE: ${CANVAS_WECHAT_QR_PAGE:-pages/login/login}
      CANVAS_WECHAT_QR_ENV_VERSION: ${CANVAS_WECHAT_QR_ENV_VERSION:-release}
      CANVAS_WECHAT_QR_MANUAL: ${CANVAS_WECHAT_QR_MANUAL:-false}
      GIN_MODE: release
    volumes:
      - ./data:/data
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/api/health"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s
    restart: unless-stopped

  web:
    image: nginx:1.27-alpine
    ports:
      - "${CANVAS_HTTP_PORT:-3000}:3000"
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
`
	_ = os.WriteFile(filepath.Join(targetDir, "docker-compose.yml"), []byte(composeContent), 0644)

	startScript := `#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DIR}"

echo "=========================================================="
echo "   正在启动 Open AI Canvas 冗余备份服务栈...              "
echo "=========================================================="

if ! command -v docker >/dev/null 2>&1; then
    echo "错误：未检测到 Docker 环境，请先安装 Docker！"
    exit 1
fi

docker compose up -d

PORT="3000"
if [ -f ".env" ]; then
    CONFIG_PORT="$(grep -E "^CANVAS_HTTP_PORT=" .env | cut -d '=' -f2 | tr -d '\r\n' || true)"
    if [ -n "${CONFIG_PORT}" ]; then
        PORT="${CONFIG_PORT}"
    fi
fi

echo ""
echo "=========================================================="
echo "   启动成功！数据与画布已完全就绪。"
echo "   请在浏览器中打开: http://localhost:${PORT}"
echo "=========================================================="
`
	startPath := filepath.Join(targetDir, "start.sh")
	_ = os.WriteFile(startPath, []byte(startScript), 0755)
}

func writeRedundantManifest(targetDir, version string) {
	resourcesDir := filepath.Join(targetDir, "data", "resources")
	sqlPath := filepath.Join(targetDir, "initdb", "01-restore-canvas.sql")

	var totalFiles int64
	var totalBytes int64
	_ = filepath.Walk(resourcesDir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && info != nil && !info.IsDir() {
			totalFiles++
			totalBytes += info.Size()
		}
		return nil
	})

	var sqlBytes int64
	if info, err := os.Stat(sqlPath); err == nil {
		sqlBytes = info.Size()
	}

	manifest := RedundantBackupManifest{
		Type:               "redundant_stack_backup",
		Version:            version,
		SchemaVersion:      80,
		BackupTime:         time.Now().UTC().Format(time.RFC3339),
		BackupTarget:       targetDir,
		TotalResources:     totalFiles,
		TotalResourceBytes: totalBytes,
		DatabaseSqlBytes:   sqlBytes,
		Status:             "ready",
	}

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(targetDir, "manifest.json"), data, 0644)
	}
}

func (s *Service) getLastBackupTime() time.Time {
	targetDir := s.getRedundantBackupTargetDir()
	manifestPath := filepath.Join(targetDir, "manifest.json")
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		return time.Time{}
	}
	var manifest RedundantBackupManifest
	if json.Unmarshal(manifestData, &manifest) != nil || manifest.BackupTime == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, manifest.BackupTime)
	if err != nil {
		return time.Time{}
	}
	return t
}

func (s *Service) startRedundantBackupWorker(ctx context.Context) {
	s.runWorkerLoop(func(ctx context.Context) {
		select {
		case <-ctx.Done():
			return
		case <-time.After(15 * time.Second):
		}

		for {
			setting, _ := s.redundantBackupSetting()
			if !setting.Enabled {
				select {
				case <-ctx.Done():
					return
				case <-redundantBackupNotify:
					continue
				case <-time.After(time.Minute):
					continue
				}
			}

			interval := time.Duration(setting.IntervalHours) * time.Hour
			if interval < time.Hour {
				interval = 24 * time.Hour
			}

			lastTime := s.getLastBackupTime()
			var waitDuration time.Duration

			if lastTime.IsZero() {
				waitDuration = 0
			} else {
				nextRun := lastTime.Add(interval)
				now := time.Now()
				if now.After(nextRun) {
					waitDuration = 0
				} else {
					waitDuration = nextRun.Sub(now)
				}
			}

			if waitDuration > 0 {
				select {
				case <-ctx.Done():
					return
				case <-redundantBackupNotify:
					continue
				case <-time.After(waitDuration):
				}
			}

			s.runScheduledRedundantBackup()

			select {
			case <-ctx.Done():
				return
			case <-redundantBackupNotify:
				continue
			case <-time.After(10 * time.Second):
			}
		}
	})
}

func (s *Service) runScheduledRedundantBackup() {
	redundantBackupMu.Lock()
	if redundantBackupRunning {
		redundantBackupMu.Unlock()
		return
	}
	redundantBackupRunning = true
	redundantBackupError = ""
	redundantBackupStatus = "定时备份执行中..."
	redundantBackupMu.Unlock()

	defer func() {
		redundantBackupMu.Lock()
		redundantBackupRunning = false
		redundantBackupStatus = ""
		redundantBackupMu.Unlock()
	}()

	targetDir := s.getRedundantBackupTargetDir()
	setting, _ := s.redundantBackupSetting()
	if err := s.executeRedundantBackup(targetDir, setting); err != nil {
		errStr := fmt.Sprintf("定时冗余备份执行失败：%v", err)
		slog.Error("scheduled redundant backup failed", "error", errStr)
		redundantBackupMu.Lock()
		redundantBackupError = errStr
		redundantBackupMu.Unlock()
		return
	}
	slog.Info("scheduled redundant backup finished successfully", "targetDir", targetDir)
}

// 保持旧接口方法别名兼容
func (s *Service) GetPortableBackupStatus(actor *model.User) (*RedundantBackupStatus, error) {
	return s.GetRedundantBackupStatus(actor)
}

func (s *Service) TriggerPortableBackup(actor *model.User) (*RedundantBackupStatus, error) {
	return s.TriggerRedundantBackup(actor)
}
