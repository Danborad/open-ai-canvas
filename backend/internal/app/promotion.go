package app

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"

	"gorm.io/gorm"
)

const promotionPolicySettingKey = "promotion_policy"

// PromotionPolicy 是推广注册送积分的业务策略配置。
type PromotionPolicy struct {
	Enabled              bool  `json:"enabled"`
	InviterRewardCredits int64 `json:"inviterRewardCredits"` // 邀请人获得积分（默认 100）
	InviteeRewardCredits int64 `json:"inviteeRewardCredits"` // 新人额外获得积分（默认 50）
}

func defaultPromotionPolicy() PromotionPolicy {
	return PromotionPolicy{
		Enabled:              true,
		InviterRewardCredits: 100,
		InviteeRewardCredits: 50,
	}
}

// PublicPromotionEnabled 供未登录的注册页判断推广邀请是否可用。
func (s *Service) PublicPromotionEnabled() (bool, error) {
	return s.promotionEnabled()
}

// PublicInviteCodeValid 供注册页在未登录状态校验邀请码是否真实存在。
func (s *Service) PublicInviteCodeValid(code string) (bool, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return false, nil
	}
	if _, err := s.repo.InviteCodeByCode(code); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// promotionEnabled 是推广中心的总开关：特性开关开启且策略开启。
func (s *Service) promotionEnabled() (bool, error) {
	features, err := s.FeatureAvailability()
	if err != nil {
		return false, err
	}
	if features == nil || !features.PromotionEnabled {
		return false, nil
	}
	policy, err := s.promotionPolicy()
	if err != nil {
		return false, err
	}
	return policy.Enabled, nil
}

func (s *Service) promotionPolicy() (PromotionPolicy, error) {
	setting, err := s.repo.SystemSetting(promotionPolicySettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaultPromotionPolicy(), nil
	}
	if err != nil {
		return PromotionPolicy{}, err
	}
	policy := defaultPromotionPolicy()
	if json.Unmarshal([]byte(setting.ValueJSON), &policy) != nil {
		return PromotionPolicy{}, errors.New("推广策略配置格式无效")
	}
	if policy.InviterRewardCredits < 0 {
		policy.InviterRewardCredits = 0
	}
	if policy.InviteeRewardCredits < 0 {
		policy.InviteeRewardCredits = 0
	}
	return policy, nil
}

func (s *Service) AdminPromotionPolicy(actor *model.User) (PromotionPolicy, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return PromotionPolicy{}, err
	}
	return s.promotionPolicy()
}

func (s *Service) UpdatePromotionPolicy(actor *model.User, policy PromotionPolicy) (PromotionPolicy, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return PromotionPolicy{}, err
	}
	if policy.InviterRewardCredits < 0 {
		policy.InviterRewardCredits = 0
	}
	if policy.InviteeRewardCredits < 0 {
		policy.InviteeRewardCredits = 0
	}
	encoded, err := json.Marshal(policy)
	if err != nil {
		return PromotionPolicy{}, err
	}
	setting := model.SystemSetting{Key: promotionPolicySettingKey, ValueJSON: string(encoded), UpdatedBy: actor.ID}
	current, err := s.repo.SystemSetting(promotionPolicySettingKey)
	if err == nil {
		setting.CreatedAt = current.CreatedAt
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return PromotionPolicy{}, err
	}
	if err := s.repo.SaveSystemSetting(&setting); err != nil {
		return PromotionPolicy{}, err
	}
	if err := s.appendAdminAudit(actor, "promotion.policy.update", "system", promotionPolicySettingKey, "更新推广注册送积分策略", map[string]any{
		"enabled":              policy.Enabled,
		"inviterRewardCredits": policy.InviterRewardCredits,
		"inviteeRewardCredits": policy.InviteeRewardCredits,
	}); err != nil {
		return PromotionPolicy{}, err
	}
	return s.promotionPolicy()
}

// PromotionOverview 用户端推广中心概览。
type PromotionOverview struct {
	Enabled              bool   `json:"enabled"`
	InviteCode           string `json:"inviteCode"`
	InviterRewardCredits int64  `json:"inviterRewardCredits"`
	InviteeRewardCredits int64  `json:"inviteeRewardCredits"`
	InvitedCount         int64  `json:"invitedCount"`
	TotalRewardCredits   int64  `json:"totalRewardCredits"`
}

// PromotionInvitationItem 用户端查看的邀请好友记录。
type PromotionInvitationItem struct {
	ID             string    `json:"id"`
	InviteeID      string    `json:"inviteeId"`
	InviteeName    string    `json:"inviteeName"`
	InviteeContact string    `json:"inviteeContact"`
	RewardCredits  int64     `json:"rewardCredits"`
	CreatedAt      time.Time `json:"createdAt"`
}

type PromotionInvitationPageResult struct {
	Items []PromotionInvitationItem `json:"items"`
	Total int64                     `json:"total"`
	Page  int                       `json:"page"`
	Limit int                       `json:"limit"`
}

type AdminPromotionInvitationPageResult struct {
	Items []repository.AdminPromotionInvitationRow `json:"items"`
	Total int64                                   `json:"total"`
	Page  int                                     `json:"page"`
	Limit int                                     `json:"limit"`
}

func normalizePromotionPage(page int, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return page, limit
}

func newInviteCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var builder strings.Builder
	for index := 0; index < 8; index++ {
		value, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		builder.WriteByte(alphabet[value.Int64()])
	}
	return builder.String(), nil
}

// EnsureInviteCode 返回用户的专属邀请码，首次访问时生成。
func (s *Service) EnsureInviteCode(userID string) (string, error) {
	existing, err := s.repo.InviteCodeForUser(userID)
	if err == nil {
		return existing.Code, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}
	for attempt := 0; attempt < 5; attempt++ {
		code, generateErr := newInviteCode()
		if generateErr != nil {
			return "", generateErr
		}
		if err := s.repo.SaveInviteCode(&model.InviteCode{ID: kernel.NewID(), UserID: userID, Code: code}); err != nil {
			return "", err
		}
		saved, lookupErr := s.repo.InviteCodeForUser(userID)
		if lookupErr == nil {
			return saved.Code, nil
		}
		if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return "", lookupErr
		}
	}
	return "", errors.New("生成邀请码失败，请稍后重试")
}

// BindInvitation 新用户注册时绑定邀请关系并直接按策略发放送积分奖励。
func (s *Service) BindInvitation(inviteeID string, code string, source string) error {
	inviteeID = strings.TrimSpace(inviteeID)
	code = strings.ToUpper(strings.TrimSpace(code))
	if inviteeID == "" || code == "" {
		return nil
	}
	features, err := s.FeatureAvailability()
	if err != nil || features == nil || !features.PromotionEnabled {
		return nil
	}
	policy, err := s.promotionPolicy()
	if err != nil || !policy.Enabled {
		return nil
	}
	owner, err := s.repo.InviteCodeByCode(code)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return BadAuthRequest("邀请码不存在或已失效")
	}
	if err != nil {
		return err
	}
	if owner.UserID == inviteeID {
		return BadAuthRequest("不能绑定自己的邀请码")
	}
	if _, err := s.repo.InvitationForInvitee(inviteeID); err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	created, err := s.repo.SaveInvitation(&model.Invitation{
		ID: kernel.NewID(), InviterID: owner.UserID, InviteeID: inviteeID,
		Code: code, Source: source,
	})
	if err != nil || !created {
		return err
	}

	// 🎁 推广注册送积分核心逻辑：
	// 1. 给邀请人发放推广拉新奖励积分（可用积分）
	if policy.InviterRewardCredits > 0 {
		inviterMicrocredits := policy.InviterRewardCredits * CreditScale
		_, _, _ = s.repo.GrantCreditsOnce(
			owner.UserID,
			model.CreditLedgerPromotionReward,
			inviterMicrocredits,
			"promotion:inviter:"+inviteeID,
			"成功邀请新用户注册奖励",
		)
	}

	// 2. 给新注册用户发放专属新人奖励积分（可用积分）
	if policy.InviteeRewardCredits > 0 {
		inviteeMicrocredits := policy.InviteeRewardCredits * CreditScale
		_, _, _ = s.repo.GrantCreditsOnce(
			inviteeID,
			model.CreditLedgerPromotionSignupBonus,
			inviteeMicrocredits,
			"promotion:invitee:"+inviteeID,
			"填写邀请码注册专属奖励",
		)
	}

	return nil
}

// PromotionOverview 获取当前用户的推广数据看板。
func (s *Service) PromotionOverview(user *model.User) (*PromotionOverview, error) {
	enabled, err := s.promotionEnabled()
	if err != nil {
		return nil, err
	}
	policy, err := s.promotionPolicy()
	if err != nil {
		return nil, err
	}
	code, err := s.EnsureInviteCode(user.ID)
	if err != nil {
		return nil, err
	}
	invited, err := s.repo.CountInvitations(user.ID)
	if err != nil {
		return nil, err
	}
	rewardCredits, err := s.repo.PromotionRewardCredits(user.ID)
	if err != nil {
		return nil, err
	}
	return &PromotionOverview{
		Enabled:              enabled,
		InviteCode:           code,
		InviterRewardCredits: policy.InviterRewardCredits,
		InviteeRewardCredits: policy.InviteeRewardCredits,
		InvitedCount:         invited,
		TotalRewardCredits:   rewardCredits,
	}, nil
}

// PromotionInvitations 分页查询当前用户邀请的好友记录。
func (s *Service) PromotionInvitations(user *model.User, page int, limit int) (*PromotionInvitationPageResult, error) {
	page, limit = normalizePromotionPage(page, limit)
	rows, total, err := s.repo.PromotionInvitationPage(user.ID, (page-1)*limit, limit)
	if err != nil {
		return nil, err
	}
	policy, _ := s.promotionPolicy()
	items := make([]PromotionInvitationItem, 0, len(rows))
	for _, row := range rows {
		reward := row.CommissionMicrocredits
		if reward <= 0 && policy.InviterRewardCredits > 0 {
			reward = policy.InviterRewardCredits
		}
		items = append(items, PromotionInvitationItem{
			ID:             row.ID,
			InviteeID:      row.InviteeID,
			InviteeName:    row.InviteeName,
			InviteeContact: maskContact(row.InviteeContact),
			RewardCredits:  reward,
			CreatedAt:      row.CreatedAt,
		})
	}
	return &PromotionInvitationPageResult{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// AdminPromotionInvitations 管理员分页查询全站邀请记录。
func (s *Service) AdminPromotionInvitations(actor *model.User, page int, limit int) (*AdminPromotionInvitationPageResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	page, limit = normalizePromotionPage(page, limit)
	rows, total, err := s.repo.AdminPromotionInvitationPage((page-1)*limit, limit)
	if err != nil {
		return nil, err
	}
	policy, _ := s.promotionPolicy()
	for i := range rows {
		if rows[i].RewardCredits <= 0 && policy.InviterRewardCredits > 0 {
			rows[i].RewardCredits = policy.InviterRewardCredits
		}
	}
	return &AdminPromotionInvitationPageResult{Items: rows, Total: total, Page: page, Limit: limit}, nil
}

func maskContact(contact string) string {
	contact = strings.TrimSpace(contact)
	if contact == "" {
		return "未知"
	}
	if strings.Contains(contact, "@") {
		parts := strings.SplitN(contact, "@", 2)
		if len(parts[0]) <= 2 {
			return parts[0] + "***@" + parts[1]
		}
		return parts[0][:2] + "***@" + parts[1]
	}
	if len(contact) >= 7 {
		return contact[:3] + "****" + contact[len(contact)-4:]
	}
	return contact
}

func (s *Service) startPromotionWorker(ctx context.Context) {
	// 推广注册送积分直接发放至可用积分，无需定时解冻。
}
