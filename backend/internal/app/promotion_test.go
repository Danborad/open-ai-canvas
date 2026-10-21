package app

import (
	"testing"
)

func TestPromotionPolicyDefaults(t *testing.T) {
	svc := newResourceTestService(t)
	policy, err := svc.promotionPolicy()
	if err != nil {
		t.Fatal(err)
	}
	if !policy.Enabled {
		t.Fatal("默认策略必须为启用")
	}
	if policy.InviterRewardCredits != 100 {
		t.Fatalf("默认邀请人奖励期望 100，实际 %d", policy.InviterRewardCredits)
	}
	if policy.InviteeRewardCredits != 50 {
		t.Fatalf("默认新人奖励期望 50，实际 %d", policy.InviteeRewardCredits)
	}
}
