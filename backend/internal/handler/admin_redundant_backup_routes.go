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

	r.GET("/admin/redundant-backup/status", getStatus)
	r.POST("/admin/redundant-backup/run", triggerBackup)

	// 保持原路由兼容
	r.GET("/admin/portable-backup/status", getStatus)
	r.POST("/admin/portable-backup/run", triggerBackup)
}
