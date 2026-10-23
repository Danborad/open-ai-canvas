// 管理端 ESA 监控与企微汇报设置接口。
//
// 这两组路由是本地定制能力，在官方按领域拆分 admin 路由时被遗漏，需单独注册，
// 否则前端调用会落到 SystemProxyNoRouteHandler 的短代理兜底并返回“请求不存在”。

package handler

import (
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func registerAdminEsaRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/admin/esa/settings", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		setting, err := svc.AdminESASetting(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})
	r.PATCH("/admin/esa/settings", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req service.ESASettingRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		setting, err := svc.UpdateESASetting(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})
	r.POST("/admin/esa/test-connection", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req service.ESASettingRequest
		_ = c.ShouldBindJSON(&req)
		result, err := svc.TestESAConnection(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.GET("/admin/esa/sites", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		sites, err := svc.ESASites(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"sites": sites})
	})
	r.GET("/admin/esa/overview", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		rangeKey := c.DefaultQuery("range", "today")
		siteID := c.DefaultQuery("siteId", "all")
		refresh := c.Query("refresh") == "true" || c.Query("refresh") == "1"
		overview, err := svc.ESAOverview(user, rangeKey, siteID, refresh)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, overview)
	})
}

func registerAdminWecomRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/admin/wecom/settings", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		setting, err := svc.AdminWecomNotificationSetting(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})
	r.PATCH("/admin/wecom/settings", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req service.WecomSettingRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		setting, err := svc.UpdateWecomNotificationSetting(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})
	r.POST("/admin/wecom/test", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.TestWecomNotification(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.POST("/admin/wecom/test-register-notice", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.TestWecomUserRegisterNotification(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.POST("/admin/wecom/test-payment-notice", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.TestWecomPaymentNotification(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.POST("/admin/wecom/test-circuit-breaker-notice", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.TestWecomCircuitBreakerNotification(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	r.GET("/admin/wecom/preview", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		data, content, err := svc.PreviewWecomDailyReport(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"data": data, "content": content})
	})
}
