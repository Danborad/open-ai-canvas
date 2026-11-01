package handler

import (
	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func registerAdminRedundantBackupRoutes(r *gin.RouterGroup, svc *service.Service) {
	getStatus := func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		status, err := svc.GetRedundantBackupStatus(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, status)
	}

	triggerBackup := func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		status, err := svc.TriggerRedundantBackup(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, status)
	}

	getSetting := func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		setting, err := svc.AdminRedundantBackupSetting(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, setting)
	}

	updateSetting := func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req service.RedundantBackupSetting
		if err := c.ShouldBindJSON(&req); err != nil {
			failService(c, service.BadAuthRequest("冗余备份配置格式无效"))
			return
		}
		setting, err := svc.UpdateRedundantBackupSetting(user, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, setting)
	}

	r.GET("/admin/redundant-backup/status", getStatus)
	r.POST("/admin/redundant-backup/run", triggerBackup)
	r.GET("/admin/redundant-backup/setting", getSetting)
	r.PATCH("/admin/redundant-backup/setting", updateSetting)

	// 保持原路由兼容
	r.GET("/admin/portable-backup/status", getStatus)
	r.POST("/admin/portable-backup/run", triggerBackup)
	r.GET("/admin/portable-backup/setting", getSetting)
	r.PATCH("/admin/portable-backup/setting", updateSetting)
}
