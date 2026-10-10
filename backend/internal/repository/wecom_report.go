package repository

import (
	"strings"
	"time"

	"yingce/backend/internal/model"
)

type DailyTaskStats struct {
	TotalTasks   int64 `gorm:"column:total_tasks"`
	TotalImages  int64 `gorm:"column:total_images"`
	ImageSuccess int64 `gorm:"column:image_success"`
	ImageFailed  int64 `gorm:"column:image_failed"`
	TotalVideos  int64 `gorm:"column:total_videos"`
	VideoSuccess int64 `gorm:"column:video_success"`
	VideoFailed  int64 `gorm:"column:video_failed"`
	TotalSuccess int64 `gorm:"column:total_success"`
	TotalFailed  int64 `gorm:"column:total_failed"`
}

type CreatorStat struct {
	AccountName string `gorm:"column:account_name"`
	TaskCount   int64  `gorm:"column:task_count"`
}

func (r *Repository) DailyTaskStats(from, to time.Time) (DailyTaskStats, error) {
	var stats DailyTaskStats
	err := r.db.Model(&model.Task{}).
		Select(`
			COUNT(*) AS total_tasks,
			COALESCE(SUM(CASE WHEN type LIKE '%image%' OR type = 'image' THEN 1 ELSE 0 END), 0) AS total_images,
			COALESCE(SUM(CASE WHEN (type LIKE '%image%' OR type = 'image') AND status = 'succeeded' THEN 1 ELSE 0 END), 0) AS image_success,
			COALESCE(SUM(CASE WHEN (type LIKE '%image%' OR type = 'image') AND status = 'failed' THEN 1 ELSE 0 END), 0) AS image_failed,
			COALESCE(SUM(CASE WHEN type LIKE '%video%' OR type = 'video' THEN 1 ELSE 0 END), 0) AS total_videos,
			COALESCE(SUM(CASE WHEN (type LIKE '%video%' OR type = 'video') AND status = 'succeeded' THEN 1 ELSE 0 END), 0) AS video_success,
			COALESCE(SUM(CASE WHEN (type LIKE '%video%' OR type = 'video') AND status = 'failed' THEN 1 ELSE 0 END), 0) AS video_failed,
			COALESCE(SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END), 0) AS total_success,
			COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS total_failed
		`).
		Where("created_at >= ? AND created_at < ?", from, to).
		Scan(&stats).Error
	return stats, err
}

func (r *Repository) DailyActiveUserCount(from, to time.Time, day string) (int64, error) {
	var count int64
	if day != "" {
		err := r.db.Model(&model.UserDailyActivity{}).
			Where("day = ?", day).
			Distinct("user_id").
			Count(&count).Error
		if err == nil && count > 0 {
			return count, nil
		}
	}
	err := r.db.Model(&model.Task{}).
		Where("created_at >= ? AND created_at < ?", from, to).
		Distinct("user_id").
		Count(&count).Error
	return count, err
}

func (r *Repository) DailyTopCreators(from, to time.Time, limit int) ([]CreatorStat, error) {
	if limit <= 0 {
		limit = 3
	}
	var results []CreatorStat
	err := r.db.Table("tasks t").
		Select("COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), NULLIF(u.email, ''), u.id) AS account_name, COUNT(t.id) AS task_count").
		Joins("LEFT JOIN users u ON t.user_id = u.id").
		Where("t.created_at >= ? AND t.created_at < ?", from, to).
		Group("u.id, u.display_name, u.username, u.email").
		Order("task_count DESC").
		Limit(limit).
		Scan(&results).Error
	if err != nil {
		return nil, err
	}
	// 针对无用户名情况兜底
	for i := range results {
		if strings.TrimSpace(results[i].AccountName) == "" {
			results[i].AccountName = "匿名用户"
		}
	}
	return results, nil
}

type ModelTaskRow struct {
	Model        string `gorm:"column:model"`
	TaskCount    int64  `gorm:"column:task_count"`
	SuccessCount int64  `gorm:"column:success_count"`
	FailedCount  int64  `gorm:"column:failed_count"`
}

func (r *Repository) DailyModelTaskStats(from, to time.Time) ([]ModelTaskRow, error) {
	var rows []ModelTaskRow
	err := r.db.Model(&model.Task{}).
		Select(`
			model,
			COUNT(*) AS task_count,
			COALESCE(SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END), 0) AS success_count,
			COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count
		`).
		Where("created_at >= ? AND created_at < ? AND model != ''", from, to).
		Group("model").
		Order("task_count DESC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ChannelModelDisplayNames() (map[string]string, error) {
	var list []struct {
		ChannelID   string `gorm:"column:channel_id"`
		ModelKey    string `gorm:"column:model_key"`
		DisplayName string `gorm:"column:display_name"`
	}
	err := r.db.Model(&model.ChannelModel{}).
		Select("channel_id, model_key, display_name").
		Where("display_name != ''").
		Scan(&list).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(list)*2)
	for _, item := range list {
		cid := strings.TrimSpace(item.ChannelID)
		k := strings.TrimSpace(item.ModelKey)
		v := strings.TrimSpace(item.DisplayName)
		if k != "" && v != "" {
			if cid != "" {
				result[cid+"::"+k] = v
			}
			if _, exists := result[k]; !exists {
				result[k] = v
			}
		}
	}
	return result, nil
}

type ChannelMetaInfo struct {
	ID          string `gorm:"column:id"`
	Name        string `gorm:"column:name"`
	PublicAlias string `gorm:"column:public_alias"`
}

func (r *Repository) ChannelMetaMap() (map[string]ChannelMetaInfo, error) {
	var list []ChannelMetaInfo
	err := r.db.Model(&model.ModelChannel{}).
		Select("id, name, public_alias").
		Scan(&list).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]ChannelMetaInfo, len(list))
	for _, item := range list {
		result[strings.TrimSpace(item.ID)] = item
	}
	return result, nil
}
