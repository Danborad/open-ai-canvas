package model

import "time"

// ESASiteMetric 存储小时粒度的 ESA 站点流量与请求快照，用于支持免费版没有的 7 天与 30 天历史统计。
type ESASiteMetric struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	SiteID       string    `gorm:"size:64;uniqueIndex:idx_esa_site_bucket,priority:1;not null" json:"siteId"`
	TimeBucket   time.Time `gorm:"uniqueIndex:idx_esa_site_bucket,priority:2;not null" json:"timeBucket"`
	TrafficBytes int64     `gorm:"not null;default:0" json:"trafficBytes"`
	RequestCount int64     `gorm:"not null;default:0" json:"requestCount"`
	TopHostsJSON string    `gorm:"type:text" json:"topHostsJson"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
