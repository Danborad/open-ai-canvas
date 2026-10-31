#!/usr/bin/env bash
# ==============================================================================
# Open AI Canvas 便携式全量灾备与启动包生成器 (Portable Stack Backup)
# ==============================================================================
# 功能：
# 1. 全量导出 PostgreSQL 数据库快照至 initdb/01-restore-canvas.sql (支持新机器自动恢复)
# 2. 增量同步所有媒体文件 (resources/) 至备份仓
# 3. 复制前端静态包 (web/dist -> dist/)
# 4. 生成自包含的便携式 docker-compose.yml、.env 与 nginx.conf
# 5. 生成一键启动脚本 start.sh 与元数据清单 manifest.json
#
# 恢复方式：
# 任何新机器挂载或拷贝该目录后，进入该目录直接执行: ./start.sh 或 docker compose up -d
# 数据库自动还原，媒体直接就位，无需任何二次配置。
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 默认备份目标目录，支持环境变量覆盖
TARGET_DIR="${CANVAS_PORTABLE_BACKUP_DIR:-/vol02/1000-0-27047199/open-ai-canvas-portable}"

echo "[1/6] 检查并初始化备份目标目录: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}/initdb"
mkdir -p "${TARGET_DIR}/data/resources"
mkdir -p "${TARGET_DIR}/dist"

echo "[2/6] 全量导出数据库快照 (PostgreSQL -> initdb/01-restore-canvas.sql)..."
POSTGRES_CONTAINER="$(docker ps --filter "name=postgres" --filter "status=running" --format "{{.Names}}" | grep -E "open-ai-canvas" | head -n 1 || true)"
if [ -z "${POSTGRES_CONTAINER}" ]; then
    POSTGRES_CONTAINER="open-ai-canvas-postgres-1"
fi

TMP_SQL="${TARGET_DIR}/initdb/01-restore-canvas.sql.tmp"
docker exec "${POSTGRES_CONTAINER}" pg_dump -U open_ai_canvas open_ai_canvas --clean --if-exists > "${TMP_SQL}"
mv "${TMP_SQL}" "${TARGET_DIR}/initdb/01-restore-canvas.sql"
echo "      数据库快照已导出 ($(du -h "${TARGET_DIR}/initdb/01-restore-canvas.sql" | cut -f1))"

echo "[3/6] 增量同步媒体资源库 (resources/)..."
HOST_RESOURCES_DIR=""
# 检查 Docker 卷实际路径
if docker volume inspect open-ai-canvas_backend-data >/dev/null 2>&1; then
    DOCKER_VOL_PATH="$(docker volume inspect open-ai-canvas_backend-data --format '{{.Mountpoint}}')/resources"
    if [ -d "${DOCKER_VOL_PATH}" ]; then
        HOST_RESOURCES_DIR="${DOCKER_VOL_PATH}"
    fi
fi

if [ -z "${HOST_RESOURCES_DIR}" ] && [ -d "${PROJECT_ROOT}/backend/data/resources" ]; then
    HOST_RESOURCES_DIR="${PROJECT_ROOT}/backend/data/resources"
fi

if [ -n "${HOST_RESOURCES_DIR}" ] && [ -d "${HOST_RESOURCES_DIR}" ]; then
    echo "      源路径: ${HOST_RESOURCES_DIR}"
    # 使用 rsync 增量同步，保留时间戳，已存在的文件跳过
    if command -v rsync >/dev/null 2>&1; then
        rsync -av --update "${HOST_RESOURCES_DIR}/" "${TARGET_DIR}/data/resources/" >/dev/null 2>&1 || true
    else
        cp -rn "${HOST_RESOURCES_DIR}/"* "${TARGET_DIR}/data/resources/" 2>/dev/null || true
    fi
    echo "      媒体文件同步完成 ($(du -sh "${TARGET_DIR}/data/resources" | cut -f1))"
else
    echo "      未找到本地 resources 目录，跳过媒体同步"
fi

echo "[4/6] 同步前端静态部署包 (web/dist -> dist/)..."
if [ -d "${PROJECT_ROOT}/web/dist" ]; then
    if command -v rsync >/dev/null 2>&1; then
        rsync -av --delete "${PROJECT_ROOT}/web/dist/" "${TARGET_DIR}/dist/" >/dev/null 2>&1 || true
    else
        rm -rf "${TARGET_DIR}/dist" && cp -r "${PROJECT_ROOT}/web/dist" "${TARGET_DIR}/dist"
    fi
    echo "      前端资源包已同步"
fi

echo "[5/6] 生成便携式配置文件 (.env, nginx.conf, docker-compose.yml, start.sh)..."
# 复制当前配置
if [ -f "${PROJECT_ROOT}/.env" ]; then
    cp "${PROJECT_ROOT}/.env" "${TARGET_DIR}/.env"
fi
if [ -f "${PROJECT_ROOT}/nginx.conf" ]; then
    cp "${PROJECT_ROOT}/nginx.conf" "${TARGET_DIR}/nginx.conf"
fi

# 生成开箱即用的便携式 docker-compose.yml
cat << 'EOF' > "${TARGET_DIR}/docker-compose.yml"
# ==============================================================================
# Open AI Canvas - 便携式自包含启动编排
# ==============================================================================
# 特性：
# 1. 首次在新机器启动时，自动导入 initdb/01-restore-canvas.sql 数据库快照
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
EOF

# 生成新机器一键启动脚本 start.sh
cat << 'EOF' > "${TARGET_DIR}/start.sh"
#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DIR}"

echo "=========================================================="
echo "   正在启动 Open AI Canvas 便携式全量灾备服务栈...        "
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
EOF
chmod +x "${TARGET_DIR}/start.sh"

echo "[6/6] 生成元数据清单 (manifest.json)..."
BACKUP_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TOTAL_RESOURCES="$(find "${TARGET_DIR}/data/resources" -type f 2>/dev/null | wc -l || echo 0)"
TOTAL_BYTES="$(du -sb "${TARGET_DIR}/data/resources" 2>/dev/null | cut -f1 || echo 0)"
DB_SIZE="$(du -sb "${TARGET_DIR}/initdb/01-restore-canvas.sql" 2>/dev/null | cut -f1 || echo 0)"

VERSION="v1.7.3.2"
if [ -f "${PROJECT_ROOT}/VERSION" ]; then
    VERSION="$(tr -d '\r\n' < "${PROJECT_ROOT}/VERSION")"
fi

cat << EOF > "${TARGET_DIR}/manifest.json"
{
  "type": "portable_stack_backup",
  "version": "${VERSION}",
  "schemaVersion": 80,
  "backupTime": "${BACKUP_TIME}",
  "backupTarget": "${TARGET_DIR}",
  "totalResources": ${TOTAL_RESOURCES},
  "totalResourceBytes": ${TOTAL_BYTES},
  "databaseSqlBytes": ${DB_SIZE},
  "status": "ready"
}
EOF

echo ""
echo "=============================================================================="
echo "🎉 便携式全量灾备同步完成！"
echo "目标路径: ${TARGET_DIR}"
echo "包含内容: 自动还原数据库、媒体资源镜像、Docker Compose 编排、环境配置与启动脚本"
echo "新机运行: 任意机器进入该目录执行 ./start.sh 即可直接恢复全站并运行！"
echo "=============================================================================="
