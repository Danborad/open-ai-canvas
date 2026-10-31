package handler

import (
	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func registerAdminPortableBackupRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/admin/portable-backup/status", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		status, err := svc.GetPortableBackupStatus(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, status)
	})

	r.POST("/admin/portable-backup/run", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		status, err := svc.TriggerPortableBackup(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, status)
	})
}
