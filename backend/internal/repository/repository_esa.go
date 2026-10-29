package repository

import (
	"time"

	"yingce/backend/internal/model"

	"gorm.io/gorm/clause"
)

type ESADailyMetric struct {
	Date         string `json:"date"`
	TrafficBytes int64  `json:"trafficBytes"`
	RequestCount int64  `json:"requestCount"`
}

// UpsertESASiteMetrics 幂等保存或更新 ESA 站点指标切片
func (r *Repository) UpsertESASiteMetrics(metrics []model.ESASiteMetric) error {
	if len(metrics) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "site_id"}, {Name: "time_bucket"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"traffic_bytes",
			"request_count",
			"top_hosts_json",
			"updated_at",
		}),
	}).Create(&metrics).Error
}

// QueryESAMetricsBetween 查询某个站点在指定时间区间内的小时级指标记录
func (r *Repository) QueryESAMetricsBetween(siteID string, start, end time.Time) ([]model.ESASiteMetric, error) {
	var list []model.ESASiteMetric
	query := r.db.Model(&model.ESASiteMetric{}).
		Where("time_bucket >= ? AND time_bucket <= ?", start, end)
	if siteID != "" && siteID != "all" {
		query = query.Where("site_id = ?", siteID)
	}
	err := query.Order("time_bucket ASC").Find(&list).Error
	return list, err
}

// QueryESAEarliestMetricTime 查询本地库中记录的最早指标时间
func (r *Repository) QueryESAEarliestMetricTime(siteID string) (time.Time, error) {
	var metric model.ESASiteMetric
	query := r.db.Model(&model.ESASiteMetric{})
	if siteID != "" && siteID != "all" {
		query = query.Where("site_id = ?", siteID)
	}
	err := query.Order("time_bucket ASC").First(&metric).Error
	if err != nil {
		return time.Time{}, err
	}
	return metric.TimeBucket, nil
}
