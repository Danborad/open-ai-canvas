package handler

import (
	"net/http"
	"strings"
	"time"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterPromotionRoutes 注册推广注册送积分接口：用户侧查看专属邀请码与明细，管理侧配置赠送规则与查看记录。
func RegisterPromotionRoutes(r *gin.RouterGroup, svc *service.Service) {
	// 注册页公开接口：查询推广中心是否开放及校验邀请码
	r.GET("/public/promotion-status", func(c *gin.Context) {
		enabled, err := svc.PublicPromotionEnabled()
		if err != nil {
			failService(c, err)
			return
		}
		code := strings.TrimSpace(c.Query("code"))
		codeValid := false
		if code != "" {
			if !enforceRateLimit(c, "promotion-code-check:"+c.ClientIP(), 60, time.Hour) {
				return
			}
			codeValid, err = svc.PublicInviteCodeValid(code)
			if err != nil {
				failService(c, err)
				return
			}
		}
		ok(c, gin.H{"enabled": enabled, "inviteCodeValid": codeValid})
	})

	// 用户侧推广中心看板
	r.GET("/promotion/overview", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		overview, err := svc.PromotionOverview(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"overview": overview})
	})

	// 用户侧查看已邀请好友明细
	r.GET("/promotion/invitations", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		page, limit, err := parsePaginationQuery(c, 20)
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.PromotionInvitations(user, page, limit)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	// 管理侧读取推广赠送积分策略
	r.GET("/admin/promotion/policy", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		policy, err := svc.AdminPromotionPolicy(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"policy": policy})
	})

	// 管理侧更新推广赠送积分策略
	r.PATCH("/admin/promotion/policy", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req service.PromotionPolicy
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		policy, err := svc.UpdatePromotionPolicy(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"policy": policy})
	})

	// 管理侧分页查看全站邀请记录
	r.GET("/admin/promotion/invitations", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		page, limit, err := parsePaginationQuery(c, 20)
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.AdminPromotionInvitations(user, page, limit)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
}
