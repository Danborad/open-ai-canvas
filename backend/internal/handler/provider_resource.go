package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"infinite-canvas/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterProviderResourceRoutes(r *gin.RouterGroup, svc *service.Service) {
	handle := func(c *gin.Context) {
		if !enforceRateLimit(c, "provider-resource:"+c.ClientIP(), 600, time.Minute) {
			return
		}
		expires, err := strconv.ParseInt(c.Query("expires"), 10, 64)
		if err != nil {
			fail(c, http.StatusForbidden, errors.New("临时资源地址无效"))
			return
		}
		stream, err := svc.OpenProviderResourceRange(c.Param("resourceId"), c.Query("user"), expires, c.Query("signature"), c.GetHeader("Range"))
		if err != nil {
			fail(c, http.StatusForbidden, errors.New("临时资源地址无效或已过期"))
			return
		}
		defer stream.Body.Close()
		resource := stream.Resource
		mimeType := resource.MimeType
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		c.Header("Cache-Control", "private, no-store")
		c.Header("Content-Security-Policy", "sandbox")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Robots-Tag", "noindex, nofollow")
		c.Header("Accept-Ranges", "bytes")
		if resource.Provider == "local" {
			if seeker, ok := stream.Body.(io.ReadSeeker); ok {
				c.Header("Content-Type", mimeType)
				http.ServeContent(c.Writer, c.Request, resource.ID, resource.UpdatedAt, seeker)
				return
			}
		}
		if stream.ContentRange != "" {
			c.Header("Content-Range", stream.ContentRange)
		}
		c.DataFromReader(stream.StatusCode, stream.ContentLength, mimeType, stream.Body, nil)
	}
	r.GET("/public/provider-resources/:resourceId/file", handle)
	r.HEAD("/public/provider-resources/:resourceId/file", handle)
}
