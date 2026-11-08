package app

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"

	"gorm.io/gorm"
)

const billingAutoRefundSettingKey = "billing_auto_refund"

// billingAutoRefundInterval 控制后台自动对账巡检频率：每 1 小时自动扫描一次。
const (
	billingAutoRefundInterval = time.Hour
	billingAutoRefundBatch    = 100
	billingAutoRefundNote     = "系统自动对账：未生成有效媒体文件，预扣积分已自动退还"
	billingAutoSettleNote     = "系统自动对账：媒体文件已确认成功生成，自动结算订单"
)

// BillingAutoRefundSetting 是积分运营页的“自动对账退还”开关。默认关闭：
// 开启后系统每小时自动对账巡检；未开启时管理员仍可随时一键手动触发对账。
type BillingAutoRefundSetting struct {
	Enabled   bool       `json:"enabled"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
}

// BillingReconcileStats 是单次对账执行的汇总结果。
type BillingReconcileStats struct {
	TotalChecked int `json:"totalChecked"`
	Refunded     int `json:"refunded"`
	Settled      int `json:"settled"`
	Skipped      int `json:"skipped"`
}

func (s *Service) billingAutoRefundSetting(ctx context.Context) (BillingAutoRefundSetting, error) {
	setting, err := s.repo.WithContext(ctx).SystemSetting(billingAutoRefundSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return BillingAutoRefundSetting{}, nil
	}
	if err != nil {
		return BillingAutoRefundSetting{}, err
	}
	var value BillingAutoRefundSetting
	if json.Unmarshal([]byte(setting.ValueJSON), &value) != nil {
		return BillingAutoRefundSetting{}, errors.New("自动退回配置格式无效")
	}
	updatedAt := setting.UpdatedAt
	value.UpdatedAt = &updatedAt
	return value, nil
}

func (s *Service) AdminBillingAutoRefundSetting(actor *model.User) (BillingAutoRefundSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return BillingAutoRefundSetting{}, err
	}
	return s.billingAutoRefundSetting(context.Background())
}

func (s *Service) UpdateBillingAutoRefundSetting(actor *model.User, req BillingAutoRefundSetting) (BillingAutoRefundSetting, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return BillingAutoRefundSetting{}, err
	}
	encoded, err := json.Marshal(BillingAutoRefundSetting{Enabled: req.Enabled})
	if err != nil {
		return BillingAutoRefundSetting{}, err
	}
	setting := model.SystemSetting{Key: billingAutoRefundSettingKey, ValueJSON: string(encoded), UpdatedBy: actor.ID}
	current, err := s.repo.SystemSetting(billingAutoRefundSettingKey)
	if err == nil {
		setting.CreatedAt = current.CreatedAt
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return BillingAutoRefundSetting{}, err
	}
	if err := s.repo.SaveSystemSetting(&setting); err != nil {
		return BillingAutoRefundSetting{}, err
	}
	summary := "关闭冻结积分自动退回"
	if req.Enabled {
		summary = "开启冻结积分自动退回"
	}
	if err := s.appendAdminAudit(actor, "billing_auto_refund.update", "system_setting", billingAutoRefundSettingKey, summary, map[string]any{"enabled": req.Enabled}); err != nil {
		return BillingAutoRefundSetting{}, err
	}
	if req.Enabled {
		// 开启后立即跑一轮，不必等下一个扫描周期。
		s.runWorkerLoop(func(ctx context.Context) { s.autoRefundReviewBilling(ctx) })
	}
	return s.billingAutoRefundSetting(context.Background())
}

// AdminRunBillingAutoReconciliation 供管理员在积分运营后台一键手动触发自动对账，
// 穿透核验用户是否真实获得有效文件，未出片全额退还，已出片自动结算。
func (s *Service) AdminRunBillingAutoReconciliation(actor *model.User) (*BillingReconcileStats, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	stats := s.reconcileReviewBilling(context.Background(), true)
	if err := s.appendAdminAudit(actor, "billing_auto_reconcile.execute", "billing_orders", "review_queue", "执行一键智能自动对账", map[string]any{
		"totalChecked": stats.TotalChecked,
		"refunded":     stats.Refunded,
		"settled":      stats.Settled,
		"skipped":      stats.Skipped,
	}); err != nil {
		slog.Warn("billing auto reconcile audit failed", "error", err)
	}
	return &stats, nil
}

func (s *Service) startBillingAutoRefundWorker() {
	s.runWorkerLoop(func(ctx context.Context) {
		ticker := time.NewTicker(billingAutoRefundInterval)
		defer ticker.Stop()
		for {
			s.autoRefundReviewBilling(ctx)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	})
}

type billingAutoRefundScan struct {
	mu       sync.Mutex
	cursor   *repository.BillingAutoRefundCursor
	failures map[string]billingAutoRefundFailure
}

type billingAutoRefundFailure struct {
	delay   time.Duration
	retryAt time.Time
}

// 退避仅为实例内减载，不作为账务事实源；容量满时淘汰最早可重试的条目。
func (scan *billingAutoRefundScan) recordFailure(id string, now time.Time) {
	if scan.failures == nil {
		scan.failures = make(map[string]billingAutoRefundFailure)
	}
	previous, exists := scan.failures[id]
	if !exists && len(scan.failures) >= billingAutoRefundBatch*10 {
		var oldestID string
		var oldest time.Time
		for key, failure := range scan.failures {
			if oldestID == "" || failure.retryAt.Before(oldest) {
				oldestID, oldest = key, failure.retryAt
			}
		}
		delete(scan.failures, oldestID)
	}
	delay := min(max(previous.delay*2, 2*time.Minute), time.Hour)
	scan.failures[id] = billingAutoRefundFailure{delay: delay, retryAt: now.Add(delay)}
}

// autoRefundReviewBilling 退回审核队列中可安全自动处理的冻结积分。
// 只处理通用任务已失败或取消且没有作品交付证据的订单；其余保留人工核对。
// 每轮重新读取开关，关闭后下一轮立即停止。
func (s *Service) autoRefundReviewBilling(ctx context.Context) int {
	scan := &s.billingAutoRefund
	// 管理员即时触发和定时扫描不叠加，也不堆积等待 goroutine。
	if !scan.mu.TryLock() {
		return 0
	}
	defer scan.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	setting, err := s.billingAutoRefundSetting(ctx)
	if err != nil {
		slog.Warn("billing auto refund setting load failed", "error", err)
		return 0
	}
	if !setting.Enabled {
		scan.cursor, scan.failures = nil, nil
		return 0
	}
	orders, err := s.repo.WithContext(ctx).AutoRefundableBillingOrders(billingAutoRefundBatch, scan.cursor)
	if err != nil {
		slog.Warn("billing auto refund query failed", "error", err)
		return 0
	}
	refunded := 0
	for _, order := range orders {
		if ctx.Err() != nil {
			return refunded
		}
		if failure := scan.failures[order.ID]; !time.Now().Before(failure.retryAt) {
			attemptCtx, cancelAttempt := context.WithTimeout(ctx, 5*time.Second)
			changed, err := s.repo.WithContext(attemptCtx).AutoRefundBillingOrder(order.ID, billingAutoRefundNote)
			cancelAttempt()
			if ctx.Err() != nil && err != nil {
				return refunded
			}
			if err != nil {
				scan.recordFailure(order.ID, time.Now())
				slog.Warn("billing auto refund failed", "orderId", order.ID, "error", err)
			} else {
				delete(scan.failures, order.ID)
				if changed {
					refunded++
				}
			}
		}
		// 失败和冷却条目也推进游标，不能让它们长期挡住下一页。
		scan.cursor = &repository.BillingAutoRefundCursor{CreatedAt: order.CreatedAt, ID: order.ID}
	}
	if len(orders) < billingAutoRefundBatch {
		scan.cursor = nil
	}
	return refunded
}

// taskHasEffectiveMedia 穿透核验任务是否产出了真实有效、可正常显示的媒体文件（图片/视频/音频/文本）。
// 只要能识别出有效可读文件则返回 true；空地址、未落盘或大小为 0 均返回 false。
func (s *Service) taskHasEffectiveMedia(task *model.Task) bool {
	if task == nil || strings.TrimSpace(task.ResultJSON) == "" {
		return false
	}
	previewURL, _ := taskMediaPreview(task.ResultJSON, task.Type)
	if strings.TrimSpace(previewURL) == "" {
		// 针对文本任务，判断 choices 或 text 是否有效
		if task.Type == "text" || task.Type == "chat" {
			var textResult struct {
				Choices []any  `json:"choices"`
				Text    string `json:"text"`
				Content string `json:"content"`
			}
			if json.Unmarshal([]byte(task.ResultJSON), &textResult) == nil {
				if len(textResult.Choices) > 0 || strings.TrimSpace(textResult.Text) != "" || strings.TrimSpace(textResult.Content) != "" {
					return true
				}
			}
		}
		return false
	}

	// 针对本地资源直链 (/api/resources/{id}/file)
	if isResourceFileURL(previewURL) {
		resourceID := resourceIDFromFileURL(previewURL)
		if resourceID == "" {
			resourceID = canvasResourceID(previewURL)
		}
		if resourceID != "" {
			res, err := s.repo.Resource(resourceID)
			if err == nil && res != nil {
				return res.Status == model.ResourceStatusReady && res.Size > 0
			}
		}
		return false
	}

	// 外部合规直链 (OSS / CDN / Data URL)
	return strings.HasPrefix(previewURL, "http://") || strings.HasPrefix(previewURL, "https://") || strings.HasPrefix(previewURL, "data:")
}

// reconcileReviewBilling 扫描待核对队列中的订单，进行客观实体核查分流。
// force 为 true 时表示管理员手动触发，无需等待 15/30 分钟缓冲期即可对异常单进行终态收敛。
func (s *Service) reconcileReviewBilling(ctx context.Context, force bool) BillingReconcileStats {
	var stats BillingReconcileStats
	orders, _, err := s.repo.AdminBillingOrders("review", "", billingAutoRefundBatch, 0)
	if err != nil {
		slog.Warn("billing auto reconcile query failed", "error", err)
		return stats
	}

	now := time.Now()
	for _, order := range orders {
		if ctx.Err() != nil {
			return stats
		}
		if order.Status != model.BillingStatusUncertain && order.Status != model.BillingStatusRunning && order.Status != model.BillingStatusReserved {
			stats.Skipped++
			continue
		}
		stats.TotalChecked++

		// 1. 无关联任务的孤儿订单处理
		if strings.TrimSpace(order.TaskID) == "" {
			if !force && now.Sub(order.CreatedAt) < 15*time.Minute {
				stats.Skipped++
				continue
			}
			note := "系统自动对账：无关联任务孤儿订单，预扣积分已自动退还"
			if err := s.RefundBilling(order.ID, note); err != nil {
				slog.Warn("billing auto refund orphan order failed", "orderId", order.ID, "error", err)
				stats.Skipped++
				continue
			}
			_ = s.repo.RecordBillingResolution(order.ID, "", note)
			stats.Refunded++
			continue
		}

		// 2. 有关联任务的实体文件穿透核验
		task, err := s.repo.Task(order.TaskID)
		if err != nil || task == nil {
			// 关联任务已被删除或丢失
			if !force && now.Sub(order.CreatedAt) < 15*time.Minute {
				stats.Skipped++
				continue
			}
			note := "系统自动对账：任务记录不存在，预扣积分已自动退还"
			if refundErr := s.RefundBilling(order.ID, note); refundErr != nil {
				slog.Warn("billing auto refund missing task failed", "orderId", order.ID, "error", refundErr)
				stats.Skipped++
				continue
			}
			_ = s.repo.RecordBillingResolution(order.ID, "", note)
			stats.Refunded++
			continue
		}

		// 穿透检查任务是否成功生成了可显示的文件
		hasMedia := s.taskHasEffectiveMedia(task)
		if hasMedia {
			// ✅ 实体文件完好，用户正常出片：执行正式结算，避免平台漏扣
			providerReqID := task.ProviderRequestID
			if providerReqID == "" {
				providerReqID = order.ProviderRequestID
			}
			if settleErr := s.SettleBilling(order.ID, providerReqID); settleErr != nil {
				slog.Warn("billing auto settle failed", "orderId", order.ID, "taskId", task.ID, "error", settleErr)
				stats.Skipped++
				continue
			}
			_ = s.repo.RecordBillingResolution(order.ID, providerReqID, billingAutoSettleNote)
			stats.Settled++
			continue
		}

		// ❌ 无有效文件产出时的分流逻辑
		// 如果任务还在排队或运行中：
		if task.Status == model.TaskStatusRunning || task.Status == model.TaskStatusQueued {
			if !force && now.Sub(task.CreatedAt) < 30*time.Minute {
				// 慢速生成任务（如长时间视频），给上游留出出片缓冲期，暂不打断
				stats.Skipped++
				continue
			}
			// 超时挂起，确认无文件出片：判定失败并退还积分
			_ = s.repo.MarkTaskTerminalFailed(task.ID, "任务响应超时且未产出文件，系统自动终止并退款")
		}

		// 未生成有效文件（含超时 524、空地址、失败、取消等），全额退还预扣积分
		refundNote := billingAutoRefundNote
		if strings.Contains(order.Error, "524") || strings.Contains(order.Error, "超时") || strings.Contains(order.Error, "timeout") {
			refundNote = "系统自动对账：上游响应超时且未生成有效文件，预扣积分已自动退还"
		} else if strings.Contains(order.Error, "媒体地址") || strings.Contains(order.Error, "空") {
			refundNote = "系统自动对账：上游未返回有效媒体文件，预扣积分已自动退还"
		}

		if refundErr := s.RefundBilling(order.ID, refundNote); refundErr != nil {
			slog.Warn("billing auto refund unproduced order failed", "orderId", order.ID, "taskId", task.ID, "error", refundErr)
			stats.Skipped++
			continue
		}
		_ = s.repo.RecordBillingResolution(order.ID, task.ProviderRequestID, refundNote)
		stats.Refunded++
	}

	return stats
}
