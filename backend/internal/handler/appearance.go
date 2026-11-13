package handler

import (
	"net/http"
	"strings"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterAppearanceRoutes(r *gin.RouterGroup, svc *service.Service) {
	registerLive2DRoutes(r, svc)
	registerAgentAvatarBundleRoutes(r, svc)
	serveUpdateMedia := func(admin bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			var actor *model.User
			if admin {
				var err error
				actor, err = currentUser(c, svc)
				if err != nil {
					failService(c, err)
					return
				}
			}
			delivery, err := svc.PrepareUpdateAnnouncementDelivery(actor, c.Param("id"), resourceAccessOptions(c), c.GetHeader("Range"))
			if err != nil {
				failService(c, err)
				return
			}
			serveResourceDelivery(c, delivery, "private, no-store", "")
		}
	}
	r.GET("/public/appearance/updates/:id", serveUpdateMedia(false))
	r.GET("/admin/settings/appearance/updates/:id", serveUpdateMedia(true))
	r.GET("/public/appearance", func(c *gin.Context) {
		setting, err := svc.Appearance()
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, gin.H{"appearance": setting})
	})

	r.GET("/public/appearance/assets/:slot", func(c *gin.Context) {
		delivery, err := svc.PrepareAppearanceAssetDelivery(c.Param("slot"), resourceAccessOptions(c), c.GetHeader("Range"))
		if err != nil {
			failService(c, err)
			return
		}
		// 带有 ?v=<revision> 的外观素材内容随版本号变更，允许浏览器与 CDN 缓存，避免每次首屏重复回源下载。
		cacheControl := "public, no-cache"
		if strings.TrimSpace(c.Query("v")) != "" {
			cacheControl = "public, max-age=86400"
		}
		serveResourceDelivery(c, delivery, cacheControl, "")
	})

	r.GET("/admin/settings/appearance", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		setting, err := svc.AdminAppearance(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})

	r.PATCH("/admin/settings/appearance", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		current, err := svc.AdminAppearance(actor)
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512<<10)
		req := current.AppearanceSetting
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		setting, err := svc.UpdateAppearance(actor, req)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})

	r.DELETE("/admin/settings/appearance", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		setting, err := svc.ResetAppearance(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"setting": setting})
	})

	r.POST("/admin/settings/appearance/assets/:slot", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		policy, available := loadRuntimePolicy(c, svc)
		if !available || !enforceRateLimit(c, "admin-appearance-upload:"+actor.ID, policy.Request.ResourceUploadPerMinute, time.Minute) {
			return
		}
		maxBytes, err := service.AppearanceAssetMaxBytes(c.Param("slot"))
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes+(1<<20))
		file, err := c.FormFile("file")
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		resource, err := svc.UploadAppearanceAsset(actor, c.Param("slot"), file)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"resource": resource})
	})
}
