package app

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"

	"gorm.io/gorm"
)

const esaSettingKey = "esa_monitoring"
const esaEndpoint = "https://esa.cn-hangzhou.aliyuncs.com"
const esaApiVersion = "2024-09-10"

type ESASettingRequest struct {
	Enabled         bool   `json:"enabled"`
	AccessKeyID     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
}

type PublicESASetting struct {
	Enabled            bool      `json:"enabled"`
	AccessKeyID        string    `json:"accessKeyId"`
	HasAccessKeySecret bool      `json:"hasAccessKeySecret"`
	UpdatedBy          string    `json:"updatedBy"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type esaSettingValue struct {
	Enabled         bool   `json:"enabled"`
	AccessKeyID     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
}

type ESATopSite struct {
	SiteID   string `json:"siteId"`
	SiteName string `json:"siteName"`
	Traffic  int64  `json:"traffic"`
}

type ESATopHostItem struct {
	Host    string `json:"host"`
	Traffic int64  `json:"traffic"`
}

type ESATimePoint struct {
	Time     string `json:"time"`
	Traffic  int64  `json:"traffic"`
	Requests int64  `json:"requests"`
}

type ESASiteInfo struct {
	SiteID   string `json:"siteId"`
	SiteName string `json:"siteName"`
	Status   string `json:"status"`
}

type ESAOverviewResponse struct {
	Range            string         `json:"range"`
	SiteID           string         `json:"siteId"`
	Configured       bool           `json:"configured"`
	Traffic          int64          `json:"traffic"`
	Requests         int64          `json:"requests"`
	SecurityRequests int64          `json:"securityRequests"`
	PagesRequests    int64          `json:"pagesRequests"`
	TopSites         []ESATopSite   `json:"topSites"`
	Timeseries       []ESATimePoint `json:"timeseries"`
	UpdatedAt        string         `json:"updatedAt"`
	Error            string         `json:"error,omitempty"`
}

var (
	esaCacheMu sync.RWMutex
	esaCache   = make(map[string]esaCacheItem)
)

type esaCacheItem struct {
	data      ESAOverviewResponse
	expiresAt time.Time
}

func (s *Service) AdminESASetting(actor *model.User) (*PublicESASetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	setting, value, err := s.readESASetting()
	if err != nil {
		return nil, err
	}
	public := publicESASetting(setting, value)
	return &public, nil
}

func (s *Service) UpdateESASetting(actor *model.User, req ESASettingRequest) (*PublicESASetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	currentSetting, current, err := s.readESASetting()
	if err != nil {
		return nil, err
	}

	next := esaSettingValue{
		Enabled:     req.Enabled,
		AccessKeyID: strings.TrimSpace(req.AccessKeyID),
	}
	if strings.TrimSpace(req.AccessKeySecret) != "" {
		next.AccessKeySecret = strings.TrimSpace(req.AccessKeySecret)
	} else {
		next.AccessKeySecret = current.AccessKeySecret
	}

	if next.Enabled && (next.AccessKeyID == "" || next.AccessKeySecret == "") {
		return nil, BadAuthRequest("启用 ESA 监控必须填写 AccessKey ID 与 AccessKey Secret")
	}

	setting := &model.SystemSetting{Key: esaSettingKey, UpdatedBy: actor.ID}
	if currentSetting != nil {
		setting.CreatedAt = currentSetting.CreatedAt
	}
	if err := s.saveESASetting(setting, next); err != nil {
		return nil, err
	}

	// 清空旧缓存
	esaCacheMu.Lock()
	esaCache = make(map[string]esaCacheItem)
	esaCacheMu.Unlock()

	public := publicESASetting(setting, next)
	return &public, nil
}

func (s *Service) TestESAConnection(actor *model.User, req ESASettingRequest) (map[string]any, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	akID := strings.TrimSpace(req.AccessKeyID)
	akSecret := strings.TrimSpace(req.AccessKeySecret)

	if akID == "" || akSecret == "" {
		_, current, err := s.readESASetting()
		if err != nil {
			return nil, err
		}
		if akID == "" {
			akID = current.AccessKeyID
		}
		if akSecret == "" {
			akSecret = current.AccessKeySecret
		}
	}

	if akID == "" || akSecret == "" {
		return nil, BadAuthRequest("请填写 AccessKey ID 与 AccessKey Secret 后测试连接")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	sites, err := fetchESASiteList(ctx, akID, akSecret)
	if err != nil {
		return map[string]any{
			"success": false,
			"message": fmt.Sprintf("连接失败：%v", parseAliyunError(err)),
		}, nil
	}

	return map[string]any{
		"success":   true,
		"message":   "连接成功",
		"siteCount": len(sites),
		"sites":     sites,
	}, nil
}

func (s *Service) ESASites(actor *model.User) ([]ESASiteInfo, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	_, current, err := s.readESASetting()
	if err != nil {
		return nil, err
	}
	if current.AccessKeyID == "" || current.AccessKeySecret == "" {
		return []ESASiteInfo{}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	sites, err := fetchESASiteList(ctx, current.AccessKeyID, current.AccessKeySecret)
	if err != nil {
		return nil, BadAuthRequest(fmt.Sprintf("读取站点列表失败：%v", parseAliyunError(err)))
	}
	return sites, nil
}

func (s *Service) ESAOverview(actor *model.User, rangeKey string, siteID string, forceRefresh bool) (*ESAOverviewResponse, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	_, current, err := s.readESASetting()
	if err != nil {
		return nil, err
	}

	if rangeKey == "" {
		rangeKey = "today"
	}
	if siteID == "" {
		siteID = "all"
	}

	cacheKey := fmt.Sprintf("%s:%s", rangeKey, siteID)

	// 检查缓存
	if !forceRefresh {
		esaCacheMu.RLock()
		cached, exists := esaCache[cacheKey]
		esaCacheMu.RUnlock()
		if exists && time.Now().Before(cached.expiresAt) {
			return &cached.data, nil
		}
	}

	if current.AccessKeyID == "" || current.AccessKeySecret == "" {
		res := &ESAOverviewResponse{
			Range:      rangeKey,
			SiteID:     siteID,
			Configured: false,
			TopSites:   []ESATopSite{},
			Timeseries: []ESATimePoint{},
			UpdatedAt:  time.Now().Format(time.RFC3339),
		}
		return res, nil
	}

	// 7天与30天统计：阿里云免费/基础套餐不提供，从本地累积数据库中聚合查询
	if rangeKey == "7d" || rangeKey == "30d" {
		localOverview, localErr := s.queryESALocalOverview(siteID, rangeKey)
		if localErr == nil && localOverview != nil {
			esaCacheMu.Lock()
			esaCache[cacheKey] = esaCacheItem{
				data:      *localOverview,
				expiresAt: time.Now().Add(5 * time.Minute),
			}
			esaCacheMu.Unlock()
			return localOverview, nil
		}
	}

	// 带重试请求阿里云
	var overview *ESAOverviewResponse
	var fetchErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*2) * time.Second)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		overview, fetchErr = fetchESAOverviewFromAliyun(ctx, current.AccessKeyID, current.AccessKeySecret, rangeKey, siteID)
		cancel()
		if fetchErr == nil {
			break
		}
	}

	if fetchErr != nil {
		log.Printf("[ESA] Request failed: %v", fetchErr)
		// 如果有旧缓存，返回旧数据并带 error
		esaCacheMu.RLock()
		cached, exists := esaCache[cacheKey]
		esaCacheMu.RUnlock()
		if exists {
			data := cached.data
			data.Error = fmt.Sprintf("数据更新失败：%v（显示最后缓存）", parseAliyunError(fetchErr))
			return &data, nil
		}
		// 无缓存时返回默认空结构并附带清晰的错误提示，避免前端白屏
		return &ESAOverviewResponse{
			Range:      rangeKey,
			SiteID:     siteID,
			Configured: true,
			TopSites:   []ESATopSite{},
			Timeseries: []ESATimePoint{},
			UpdatedAt:  time.Now().Format(time.RFC3339),
			Error:      fmt.Sprintf("数据更新失败：%v", parseAliyunError(fetchErr)),
		}, nil
	}

	// 缓存 5 分钟
	esaCacheMu.Lock()
	esaCache[cacheKey] = esaCacheItem{
		data:      *overview,
		expiresAt: time.Now().Add(5 * time.Minute),
	}
	esaCacheMu.Unlock()

	// 每次从阿里云拉取数据成功后，异步将小时粒度数据与 Top Host 固化入库
	if rangeKey == "today" || rangeKey == "yesterday" {
		go s.archiveESATodayMetrics(current.AccessKeyID, current.AccessKeySecret, siteID)
	}

	return overview, nil
}

func (s *Service) readESASetting() (*model.SystemSetting, esaSettingValue, error) {
	setting, err := s.repo.SystemSetting(esaSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, defaultESASetting(), nil
	}
	if err != nil {
		return nil, esaSettingValue{}, err
	}
	value := defaultESASetting()
	if strings.TrimSpace(setting.ValueJSON) != "" {
		if err := json.Unmarshal([]byte(setting.ValueJSON), &value); err != nil {
			return nil, esaSettingValue{}, errors.New("ESA 监控配置格式无效")
		}
	}
	secret, err := s.decryptSettingSecret(value.AccessKeySecret)
	if err != nil {
		return nil, esaSettingValue{}, err
	}
	value.AccessKeySecret = secret
	return setting, value, nil
}

func (s *Service) saveESASetting(setting *model.SystemSetting, value esaSettingValue) error {
	stored := value
	if stored.AccessKeySecret != "" {
		encrypted, err := s.encryptSettingSecret(stored.AccessKeySecret)
		if err != nil {
			return err
		}
		stored.AccessKeySecret = encrypted
	}
	payload, err := json.Marshal(stored)
	if err != nil {
		return err
	}
	setting.ValueJSON = string(payload)
	return s.repo.SaveSystemSetting(setting)
}

func defaultESASetting() esaSettingValue {
	return esaSettingValue{
		Enabled: true,
	}
}

func calculatePopSignature(method string, params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var canonicalizedQuery strings.Builder
	for i, k := range keys {
		if i > 0 {
			canonicalizedQuery.WriteString("&")
		}
		canonicalizedQuery.WriteString(popPercentEncode(k))
		canonicalizedQuery.WriteString("=")
		canonicalizedQuery.WriteString(popPercentEncode(params[k]))
	}

	stringToSign := method + "&" + popPercentEncode("/") + "&" + popPercentEncode(canonicalizedQuery.String())

	mac := hmac.New(sha1.New, []byte(secret+"&"))
	mac.Write([]byte(stringToSign))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func popPercentEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}

func publicESASetting(setting *model.SystemSetting, value esaSettingValue) PublicESASetting {
	public := PublicESASetting{
		Enabled:            value.Enabled,
		AccessKeyID:        value.AccessKeyID,
		HasAccessKeySecret: strings.TrimSpace(value.AccessKeySecret) != "",
	}
	if setting != nil {
		public.UpdatedBy = setting.UpdatedBy
		public.CreatedAt = setting.CreatedAt
		public.UpdatedAt = setting.UpdatedAt
	}
	return public
}

// ---------------- 阿里云 OpenAPI 调用 ----------------

func fetchESASiteList(ctx context.Context, akID, akSecret string) ([]ESASiteInfo, error) {
	params := map[string]string{
		"Action":     "ListSites",
		"PageNumber": "1",
		"PageSize":   "500",
	}

	bodyBytes, err := doAliyunPopRequest(ctx, "GET", params, akID, akSecret)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Sites []struct {
			SiteID   int64  `json:"SiteId"`
			SiteName string `json:"SiteName"`
			Status   string `json:"Status"`
		} `json:"Sites"`
	}
	if err := json.Unmarshal(bodyBytes, &resp); err != nil {
		return nil, fmt.Errorf("解析站点列表响应失败: %w", err)
	}

	sites := make([]ESASiteInfo, 0, len(resp.Sites))
	for _, s := range resp.Sites {
		sid := fmt.Sprintf("%d", s.SiteID)
		sites = append(sites, ESASiteInfo{
			SiteID:   sid,
			SiteName: s.SiteName,
			Status:   s.Status,
		})
	}
	return sites, nil
}

func fetchESAOverviewFromAliyun(ctx context.Context, akID, akSecret, rangeKey, siteID string) (*ESAOverviewResponse, error) {
	allSites, err := fetchESASiteList(ctx, akID, akSecret)
	if err != nil {
		return nil, err
	}

	targetSites := make([]ESASiteInfo, 0)
	if siteID == "" || siteID == "all" {
		targetSites = allSites
	} else {
		for _, s := range allSites {
			if s.SiteID == siteID {
				targetSites = append(targetSites, s)
				break
			}
		}
		if len(targetSites) == 0 {
			targetSites = append(targetSites, ESASiteInfo{SiteID: siteID, SiteName: siteID})
		}
	}

	startTime, endTime, interval := calculateTimeRange(rangeKey)
	startStr := startTime.Format("2006-01-02T15:04:05Z")
	endStr := endTime.Format("2006-01-02T15:04:05Z")

	var totalTraffic int64
	var totalRequests int64
	timePointsMap := make(map[string]*ESATimePoint)
	timeKeys := make([]string, 0)

	topSitesMap := make(map[string]int64)

	for _, s := range targetSites {
		// 1. 获取站点时序数据
		tsParams := map[string]string{
			"Action":    "DescribeSiteTimeSeriesData",
			"SiteId":    s.SiteID,
			"StartTime": startStr,
			"EndTime":   endStr,
			"Interval":  interval,
			"Fields":    `[{"FieldName":"Traffic","Dimension":["SiteId"]},{"FieldName":"Requests","Dimension":["SiteId"]}]`,
		}
		tsBytes, tsErr := doAliyunPopRequest(ctx, "GET", tsParams, akID, akSecret)
		if tsErr == nil {
			var tsResp struct {
				SummarizedData []struct {
					FieldName string `json:"FieldName"`
					Value     int64  `json:"Value"`
				} `json:"SummarizedData"`
				Data []struct {
					FieldName  string `json:"FieldName"`
					DetailData []struct {
						TimeStamp string `json:"TimeStamp"`
						Value     int64  `json:"Value"`
					} `json:"DetailData"`
				} `json:"Data"`
			}
			if json.Unmarshal(tsBytes, &tsResp) == nil {
				for _, sumItem := range tsResp.SummarizedData {
					if sumItem.FieldName == "Traffic" {
						totalTraffic += sumItem.Value
					} else if sumItem.FieldName == "Requests" {
						totalRequests += sumItem.Value
					}
				}
				for _, dataItem := range tsResp.Data {
					for _, point := range dataItem.DetailData {
						if _, exists := timePointsMap[point.TimeStamp]; !exists {
							timePointsMap[point.TimeStamp] = &ESATimePoint{Time: point.TimeStamp}
							timeKeys = append(timeKeys, point.TimeStamp)
						}
						tp := timePointsMap[point.TimeStamp]
						if dataItem.FieldName == "Traffic" {
							tp.Traffic += point.Value
						} else if dataItem.FieldName == "Requests" {
							tp.Requests += point.Value
						}
					}
				}
			}
		}

		// 2. 获取 Top Host 数据
		topParams := map[string]string{
			"Action":    "DescribeSiteTopData",
			"SiteId":    s.SiteID,
			"StartTime": startStr,
			"EndTime":   endStr,
			"Limit":     "5",
			"Fields":    `[{"FieldName":"Traffic","Dimension":["ClientRequestHost"]}]`,
		}
		topBytes, topErr := doAliyunPopRequest(ctx, "GET", topParams, akID, akSecret)
		if topErr == nil {
			var topResp struct {
				Data []struct {
					FieldName  string `json:"FieldName"`
					DetailData []struct {
						DimensionValue string `json:"DimensionValue"`
						Value          int64  `json:"Value"`
					} `json:"DetailData"`
				} `json:"Data"`
			}
			if json.Unmarshal(topBytes, &topResp) == nil {
				for _, dataItem := range topResp.Data {
					for _, d := range dataItem.DetailData {
						if d.DimensionValue != "" {
							topSitesMap[d.DimensionValue] += d.Value
						}
					}
				}
			}
		}
	}

	// 排序时序点
	sort.Strings(timeKeys)
	timeseries := make([]ESATimePoint, 0, len(timeKeys))
	for _, k := range timeKeys {
		if pt, ok := timePointsMap[k]; ok {
			timeseries = append(timeseries, *pt)
		}
	}

	// 汇总并排序 Top 5 站点/Host
	topSitesList := make([]ESATopSite, 0, len(topSitesMap))
	for host, traf := range topSitesMap {
		topSitesList = append(topSitesList, ESATopSite{
			SiteID:   host,
			SiteName: host,
			Traffic:  traf,
		})
	}
	sort.Slice(topSitesList, func(i, j int) bool {
		return topSitesList[i].Traffic > topSitesList[j].Traffic
	})
	if len(topSitesList) > 5 {
		topSitesList = topSitesList[:5]
	}

	return &ESAOverviewResponse{
		Range:            rangeKey,
		SiteID:           siteID,
		Configured:       true,
		Traffic:          totalTraffic,
		Requests:         totalRequests,
		SecurityRequests: 0,
		PagesRequests:    0,
		TopSites:         topSitesList,
		Timeseries:       timeseries,
		UpdatedAt:        time.Now().Format(time.RFC3339),
	}, nil
}

func doAliyunPopRequest(ctx context.Context, method string, queryParams map[string]string, akID, akSecret string) ([]byte, error) {
	params := make(map[string]string)
	for k, v := range queryParams {
		params[k] = v
	}
	params["Format"] = "JSON"
	params["Version"] = esaApiVersion
	params["AccessKeyId"] = akID
	params["SignatureMethod"] = "HMAC-SHA1"
	params["Timestamp"] = time.Now().UTC().Format("2006-01-02T15:04:05Z")
	params["SignatureVersion"] = "1.0"
	params["SignatureNonce"] = fmt.Sprintf("%d%d", time.Now().UnixNano(), rand.Intn(100000))

	sig := calculatePopSignature(method, params, akSecret)
	params["Signature"] = sig

	var reqURL strings.Builder
	reqURL.WriteString(esaEndpoint)
	reqURL.WriteString("/?")

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for i, k := range keys {
		if i > 0 {
			reqURL.WriteString("&")
		}
		reqURL.WriteString(popPercentEncode(k))
		reqURL.WriteString("=")
		reqURL.WriteString(popPercentEncode(params[k]))
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, errors.New("请求阿里云 API 超时")
		}
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		var errPayload struct {
			Code    string `json:"Code"`
			Message string `json:"Message"`
		}
		_ = json.Unmarshal(bodyBytes, &errPayload)
		if errPayload.Message != "" {
			return nil, fmt.Errorf("aliyun error [%s]: %s", errPayload.Code, errPayload.Message)
		}
		return nil, fmt.Errorf("aliyun http error: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	return bodyBytes, nil
}

func calculateTimeRange(rangeKey string) (time.Time, time.Time, string) {
	now := time.Now().UTC()
	switch rangeKey {
	case "yesterday":
		// 昨天 00:00:00 - 昨天 23:59:59
		yesterday := now.AddDate(0, 0, -1)
		start := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, time.UTC)
		end := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 23, 59, 59, 0, time.UTC)
		return start, end, "3600"
	case "7d":
		// 近 7 天
		start := now.AddDate(0, 0, -7)
		return start, now, "3600"
	case "30d":
		// 近 30 天
		start := now.AddDate(0, 0, -30)
		return start, now, "86400"
	case "today":
		fallthrough
	default:
		// 今天 00:00:00 - 当前时间
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		return start, now, "300"
	}
}

func parseAliyunError(err error) error {
	if err == nil {
		return nil
	}
	str := err.Error()
	if strings.Contains(str, "InvalidAccessKeyId") || strings.Contains(str, "SignatureDoesNotMatch") {
		return errors.New("AccessKey ID 无效或 AccessKey Secret 错误")
	}
	if strings.Contains(str, "Forbidden") || strings.Contains(str, "Unauthorized") || strings.Contains(str, "NoPermission") || strings.Contains(str, "AuthFailed") {
		return errors.New("当前 AccessKey 没有 ESA 数据读取权限，请在阿里云 RAM 控制台授予 ESA 只读策略")
	}
	if strings.Contains(str, "timeout") || strings.Contains(str, "DeadlineExceeded") || strings.Contains(str, "超时") {
		return errors.New("请求阿里云 API 超时")
	}
	if strings.Contains(str, "no such host") || strings.Contains(str, "dial tcp") || strings.Contains(str, "connection refused") || strings.Contains(str, "network") {
		return errors.New("无法连接阿里云 ESA 接口服务，请检查网络连接或 DNS 解析")
	}
	if strings.Contains(str, "https://") {
		return errors.New("请求阿里云 ESA 服务异常，请检查凭证与网络")
	}
	return err
}

func findFirstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok {
				return s
			}
			return fmt.Sprintf("%v", v)
		}
	}
	return ""
}

func findFirstInt64(m map[string]any, keys ...string) int64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch n := v.(type) {
			case float64:
				return int64(n)
			case int64:
				return n
			case int:
				return int64(n)
			case string:
				if parsed, err := strconv.ParseInt(n, 10, 64); err == nil {
					return parsed
				}
				if parsedF, err := strconv.ParseFloat(n, 64); err == nil {
					return int64(parsedF)
				}
			}
		}
	}
	return 0
}

func (s *Service) FetchESADomainStats(ctx context.Context, targetDomain string, from, to time.Time) (traffic int64, requests int64, enabled bool, err error) {
	_, setting, err := s.readESASetting()
	if err != nil || setting.AccessKeyID == "" || setting.AccessKeySecret == "" {
		return 0, 0, false, nil
	}
	if !setting.Enabled {
		return 0, 0, false, nil
	}

	cleanDomain := strings.TrimSpace(targetDomain)
	if cleanDomain == "" {
		cleanDomain = "art.960916.xyz"
	}

	allSites, err := fetchESASiteList(ctx, setting.AccessKeyID, setting.AccessKeySecret)
	if err != nil {
		return 0, 0, true, err
	}

	var targetSite *ESASiteInfo
	for _, site := range allSites {
		if site.SiteName == cleanDomain || strings.HasSuffix(cleanDomain, "."+site.SiteName) || strings.HasSuffix(cleanDomain, site.SiteName) {
			targetSite = &site
			break
		}
	}
	if targetSite == nil && len(allSites) > 0 {
		targetSite = &allSites[0]
	}
	if targetSite == nil {
		return 0, 0, true, nil
	}

	startStr := from.UTC().Format("2006-01-02T15:04:05Z")
	endStr := to.UTC().Format("2006-01-02T15:04:05Z")

	topParams := map[string]string{
		"Action":    "DescribeSiteTopData",
		"SiteId":    targetSite.SiteID,
		"StartTime": startStr,
		"EndTime":   endStr,
		"Limit":     "10",
		"Fields":    `[{"FieldName":"Traffic","Dimension":["ClientRequestHost"]}]`,
	}
	topBytes, topErr := doAliyunPopRequest(ctx, "GET", topParams, setting.AccessKeyID, setting.AccessKeySecret)
	if topErr != nil {
		return 0, 0, true, topErr
	}
	var topResp struct {
		Data []struct {
			FieldName  string `json:"FieldName"`
			DetailData []struct {
				DimensionValue string `json:"DimensionValue"`
				Value          int64  `json:"Value"`
			} `json:"DetailData"`
		} `json:"Data"`
	}
	if err := json.Unmarshal(topBytes, &topResp); err != nil {
		return 0, 0, true, err
	}
	for _, dataItem := range topResp.Data {
		for _, d := range dataItem.DetailData {
			if strings.EqualFold(d.DimensionValue, cleanDomain) {
				traffic += d.Value
			}
		}
	}

	// 请求数
	reqTopParams := map[string]string{
		"Action":    "DescribeSiteTopData",
		"SiteId":    targetSite.SiteID,
		"StartTime": startStr,
		"EndTime":   endStr,
		"Limit":     "10",
		"Fields":    `[{"FieldName":"Requests","Dimension":["ClientRequestHost"]}]`,
	}
	reqTopBytes, reqTopErr := doAliyunPopRequest(ctx, "GET", reqTopParams, setting.AccessKeyID, setting.AccessKeySecret)
	if reqTopErr == nil {
		var reqTopResp struct {
			Data []struct {
				FieldName  string `json:"FieldName"`
				DetailData []struct {
					DimensionValue string `json:"DimensionValue"`
					Value          int64  `json:"Value"`
				} `json:"DetailData"`
			} `json:"Data"`
		}
		if json.Unmarshal(reqTopBytes, &reqTopResp) == nil {
			for _, dataItem := range reqTopResp.Data {
				for _, d := range dataItem.DetailData {
					if strings.EqualFold(d.DimensionValue, cleanDomain) {
						requests += d.Value
					}
				}
			}
		}
	}
	return traffic, requests, true, nil
}

func (s *Service) archiveESATodayMetrics(akID, akSecret, siteID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	sites, err := fetchESASiteList(ctx, akID, akSecret)
	if err != nil || len(sites) == 0 {
		return
	}

	targetSites := make([]ESASiteInfo, 0)
	if siteID == "" || siteID == "all" {
		targetSites = sites
	} else {
		for _, st := range sites {
			if st.SiteID == siteID {
				targetSites = append(targetSites, st)
				break
			}
		}
	}
	if len(targetSites) == 0 {
		return
	}

	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startStr := start.Format("2006-01-02T15:04:05Z")
	endStr := now.Format("2006-01-02T15:04:05Z")

	var allMetrics []model.ESASiteMetric

	for _, st := range targetSites {
		tsParams := map[string]string{
			"Action":    "DescribeSiteTimeSeriesData",
			"SiteId":    st.SiteID,
			"StartTime": startStr,
			"EndTime":   endStr,
			"Interval":  "3600",
			"Fields":    `[{"FieldName":"Traffic","Dimension":["SiteId"]},{"FieldName":"Requests","Dimension":["SiteId"]}]`,
		}
		tsBytes, tsErr := doAliyunPopRequest(ctx, "GET", tsParams, akID, akSecret)
		if tsErr != nil {
			continue
		}

		type tsPoint struct {
			TimeStamp string `json:"TimeStamp"`
			Value     int64  `json:"Value"`
		}
		var tsResp struct {
			Data []struct {
				FieldName  string    `json:"FieldName"`
				DetailData []tsPoint `json:"DetailData"`
			} `json:"Data"`
		}
		if err := json.Unmarshal(tsBytes, &tsResp); err != nil {
			continue
		}

		topHostsJSON := "[]"
		topParams := map[string]string{
			"Action":    "DescribeSiteTopData",
			"SiteId":    st.SiteID,
			"StartTime": startStr,
			"EndTime":   endStr,
			"Limit":     "10",
			"Fields":    `[{"FieldName":"Traffic","Dimension":["ClientRequestHost"]}]`,
		}
		topBytes, topErr := doAliyunPopRequest(ctx, "GET", topParams, akID, akSecret)
		if topErr == nil {
			var topResp struct {
				Data []struct {
					FieldName  string `json:"FieldName"`
					DetailData []struct {
						DimensionValue string `json:"DimensionValue"`
						Value          int64  `json:"Value"`
					} `json:"DetailData"`
				} `json:"Data"`
			}
			if json.Unmarshal(topBytes, &topResp) == nil {
				var hostItems []ESATopHostItem
				for _, dataItem := range topResp.Data {
					for _, d := range dataItem.DetailData {
						if d.DimensionValue != "" {
							hostItems = append(hostItems, ESATopHostItem{
								Host:    d.DimensionValue,
								Traffic: d.Value,
							})
						}
					}
				}
				if len(hostItems) > 0 {
					if b, err := json.Marshal(hostItems); err == nil {
						topHostsJSON = string(b)
					}
				}
			}
		}

		hourlyMap := make(map[time.Time]*model.ESASiteMetric)
		for _, dataItem := range tsResp.Data {
			for _, pt := range dataItem.DetailData {
				t, err := time.Parse("2006-01-02T15:04:05Z", pt.TimeStamp)
				if err != nil {
					continue
				}
				bucket := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, time.UTC)
				metric, exists := hourlyMap[bucket]
				if !exists {
					metric = &model.ESASiteMetric{
						ID:           fmt.Sprintf("esa_%s_%d", st.SiteID, bucket.Unix()),
						SiteID:       st.SiteID,
						TimeBucket:   bucket,
						TopHostsJSON: topHostsJSON,
					}
					hourlyMap[bucket] = metric
				}
				if dataItem.FieldName == "Traffic" {
					metric.TrafficBytes += pt.Value
				} else if dataItem.FieldName == "Requests" {
					metric.RequestCount += pt.Value
				}
			}
		}

		for _, m := range hourlyMap {
			allMetrics = append(allMetrics, *m)
		}
	}

	if len(allMetrics) > 0 {
		if err := s.repo.UpsertESASiteMetrics(allMetrics); err != nil {
			log.Printf("[ESA Archive] Upsert error: %v", err)
		}
	}
}

func (s *Service) queryESALocalOverview(siteID string, rangeKey string) (*ESAOverviewResponse, error) {
	now := time.Now().UTC()
	var start time.Time
	is30d := rangeKey == "30d"
	if is30d {
		start = now.AddDate(0, 0, -30)
	} else {
		start = now.AddDate(0, 0, -7)
	}

	metrics, err := s.repo.QueryESAMetricsBetween(siteID, start, now)
	if err != nil {
		return nil, err
	}

	var totalTraffic int64
	var totalRequests int64
	topHostsMap := make(map[string]int64)

	type timeSlot struct {
		Traffic  int64
		Requests int64
	}
	slots := make(map[string]*timeSlot)
	slotKeys := make([]string, 0)

	if is30d {
		for d := 30; d >= 0; d-- {
			dayT := now.AddDate(0, 0, -d)
			key := time.Date(dayT.Year(), dayT.Month(), dayT.Day(), 0, 0, 0, 0, time.UTC).Format("2006-01-02T15:04:05Z")
			slots[key] = &timeSlot{}
			slotKeys = append(slotKeys, key)
		}
	} else {
		for h := 7 * 24; h >= 0; h-- {
			hT := now.Add(-time.Duration(h) * time.Hour)
			key := time.Date(hT.Year(), hT.Month(), hT.Day(), hT.Hour(), 0, 0, 0, time.UTC).Format("2006-01-02T15:04:05Z")
			slots[key] = &timeSlot{}
			slotKeys = append(slotKeys, key)
		}
	}

	for _, m := range metrics {
		totalTraffic += m.TrafficBytes
		totalRequests += m.RequestCount

		var slotKey string
		if is30d {
			slotKey = time.Date(m.TimeBucket.Year(), m.TimeBucket.Month(), m.TimeBucket.Day(), 0, 0, 0, 0, time.UTC).Format("2006-01-02T15:04:05Z")
		} else {
			slotKey = time.Date(m.TimeBucket.Year(), m.TimeBucket.Month(), m.TimeBucket.Day(), m.TimeBucket.Hour(), 0, 0, 0, time.UTC).Format("2006-01-02T15:04:05Z")
		}

		if slot, ok := slots[slotKey]; ok {
			slot.Traffic += m.TrafficBytes
			slot.Requests += m.RequestCount
		}

		if m.TopHostsJSON != "" {
			var hosts []ESATopHostItem
			if json.Unmarshal([]byte(m.TopHostsJSON), &hosts) == nil {
				for _, h := range hosts {
					topHostsMap[h.Host] += h.Traffic
				}
			}
		}
	}

	timeseries := make([]ESATimePoint, 0, len(slotKeys))
	for _, k := range slotKeys {
		if slot, ok := slots[k]; ok {
			timeseries = append(timeseries, ESATimePoint{
				Time:     k,
				Traffic:  slot.Traffic,
				Requests: slot.Requests,
			})
		}
	}

	topSitesList := make([]ESATopSite, 0, len(topHostsMap))
	for host, traf := range topHostsMap {
		topSitesList = append(topSitesList, ESATopSite{
			SiteID:   host,
			SiteName: host,
			Traffic:  traf,
		})
	}
	sort.Slice(topSitesList, func(i, j int) bool {
		return topSitesList[i].Traffic > topSitesList[j].Traffic
	})
	if len(topSitesList) > 5 {
		topSitesList = topSitesList[:5]
	}

	earliest, _ := s.repo.QueryESAEarliestMetricTime(siteID)
	accumulatedDays := 1
	if !earliest.IsZero() {
		accumulatedDays = int(now.Sub(earliest).Hours()/24) + 1
	}

	return &ESAOverviewResponse{
		Range:            rangeKey,
		SiteID:           siteID,
		Configured:       true,
		Traffic:          totalTraffic,
		Requests:         totalRequests,
		SecurityRequests: 0,
		PagesRequests:    0,
		TopSites:         topSitesList,
		Timeseries:       timeseries,
		UpdatedAt:        fmt.Sprintf("本地自建统计（已累积 %d 天数据）", accumulatedDays),
	}, nil
}

func (s *Service) startESAMetricsCollector(ctx context.Context) {
	s.runWorkerLoop(func(ctx context.Context) {
		select {
		case <-ctx.Done():
			return
		case <-time.After(15 * time.Second):
			s.runESAMetricsCollection(ctx)
		}

		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.runESAMetricsCollection(ctx)
			}
		}
	})
}

func (s *Service) runESAMetricsCollection(ctx context.Context) {
	_, current, err := s.readESASetting()
	if err != nil || !current.Enabled || current.AccessKeyID == "" || current.AccessKeySecret == "" {
		return
	}
	s.archiveESATodayMetrics(current.AccessKeyID, current.AccessKeySecret, "all")
}
