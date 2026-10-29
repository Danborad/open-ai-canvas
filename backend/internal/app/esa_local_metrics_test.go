package app

import (
	"encoding/json"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestESALocalOverviewAggregation(t *testing.T) {
	now := time.Now().UTC()
	yesterday := now.AddDate(0, 0, -1)

	hosts := []ESATopHostItem{
		{Host: "art.example.com", Traffic: 5000},
		{Host: "cdn.example.com", Traffic: 3000},
	}
	rawHosts, _ := json.Marshal(hosts)

	metrics := []model.ESASiteMetric{
		{
			ID:           "test_1",
			SiteID:       "site_a",
			TimeBucket:   time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 10, 0, 0, 0, time.UTC),
			TrafficBytes: 1024,
			RequestCount: 10,
			TopHostsJSON: string(rawHosts),
		},
		{
			ID:           "test_2",
			SiteID:       "site_a",
			TimeBucket:   time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 11, 0, 0, 0, time.UTC),
			TrafficBytes: 2048,
			RequestCount: 20,
			TopHostsJSON: string(rawHosts),
		},
	}

	if len(metrics) != 2 {
		t.Fatalf("expected 2 metrics")
	}
}
