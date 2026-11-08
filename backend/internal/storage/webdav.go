package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"yingce/backend/internal/outbound"
)

func buildWebDAVURL(endpoint, bucket, pathPrefix, objectKey string) (*url.URL, error) {
	raw := strings.TrimSpace(endpoint)
	if raw == "" {
		return nil, errors.New("WebDAV 服务地址不能为空")
	}
	base, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("WebDAV 服务地址无效：%w", err)
	}

	cleanBucket := strings.Trim(strings.TrimSpace(bucket), "/")
	cleanPrefix := strings.Trim(strings.TrimSpace(pathPrefix), "/")
	cleanKey := strings.Trim(strings.TrimSpace(objectKey), "/")

	parts := []string{base.Path}
	if cleanBucket != "" {
		parts = append(parts, cleanBucket)
	}
	if cleanPrefix != "" {
		parts = append(parts, cleanPrefix)
	}
	if cleanKey != "" {
		parts = append(parts, cleanKey)
	}

	joinedPath := path.Clean("/" + strings.Join(parts, "/"))
	base.Path = joinedPath
	return base, nil
}

func ensureWebDAVDirectory(ctx context.Context, client *http.Client, dirURL *url.URL, user, password string) error {
	trimmed := strings.Trim(dirURL.Path, "/")
	if trimmed == "" {
		return nil
	}

	segments := strings.Split(trimmed, "/")
	currentURL := *dirURL
	var currentPath string

	for _, seg := range segments {
		currentPath = currentPath + "/" + seg
		currentURL.Path = currentPath

		req, err := http.NewRequestWithContext(ctx, "MKCOL", currentURL.String(), nil)
		if err != nil {
			return err
		}
		if user != "" || password != "" {
			req.SetBasicAuth(user, password)
		}

		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
		}
	}
	return nil
}

func putWebDAVObject(ctx context.Context, setting Settings, objectKey, mimeType string, size int64, body io.Reader) (string, error) {
	targetURL, err := buildWebDAVURL(setting.Endpoint, setting.Bucket, setting.PathPrefix, objectKey)
	if err != nil {
		return "", err
	}

	client := outbound.OutboundHTTPClient(transferTimeout(setting))

	// 确保父级目录存在
	parentURL := *targetURL
	parentURL.Path = path.Dir(targetURL.Path)
	_ = ensureWebDAVDirectory(ctx, client, &parentURL, setting.AccessKeyID, setting.AccessKeySecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, targetURL.String(), body)
	if err != nil {
		return "", err
	}

	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	req.Header.Set("Content-Type", mimeType)
	if size > 0 {
		req.ContentLength = size
	}
	if setting.AccessKeyID != "" || setting.AccessKeySecret != "" {
		req.SetBasicAuth(setting.AccessKeyID, setting.AccessKeySecret)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("WebDAV 写入请求失败：%w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", fmt.Errorf("WebDAV 响应状态错误 [%d]: %s", resp.StatusCode, string(bodyBytes))
	}

	etag := strings.Trim(resp.Header.Get("ETag"), `"`)
	if etag == "" {
		etag = fmt.Sprintf("webdav-%d", time.Now().UnixNano())
	}
	return etag, nil
}

func GetWebDAVObjectRange(setting Settings, objectKey string, rangeHeader string) (*ObjectStream, error) {
	targetURL, err := buildWebDAVURL(setting.Endpoint, setting.Bucket, setting.PathPrefix, objectKey)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), transferTimeout(setting))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL.String(), nil)
	if err != nil {
		cancel()
		return nil, err
	}

	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	if setting.AccessKeyID != "" || setting.AccessKeySecret != "" {
		req.SetBasicAuth(setting.AccessKeyID, setting.AccessKeySecret)
	}

	client := outbound.OutboundHTTPClient(transferTimeout(setting))
	resp, err := client.Do(req)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("WebDAV 读取失败：%w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		cancel()
		return nil, fmt.Errorf("WebDAV 读取错误 [%d]", resp.StatusCode)
	}

	contentLength := resp.ContentLength
	if contentLength < 0 {
		if clStr := resp.Header.Get("Content-Length"); clStr != "" {
			if n, err := strconv.ParseInt(clStr, 10, 64); err == nil {
				contentLength = n
			}
		}
	}

	body := &responseWithCancel{
		ReadCloser: resp.Body,
		cancel:     cancel,
	}

	return &ObjectStream{
		Body:          body,
		StatusCode:    resp.StatusCode,
		ContentLength: contentLength,
		ContentRange:  resp.Header.Get("Content-Range"),
		AcceptRanges:  resp.Header.Get("Accept-Ranges"),
	}, nil
}

type responseWithCancel struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (r *responseWithCancel) Close() error {
	defer r.cancel()
	return r.ReadCloser.Close()
}

func deleteWebDAVObject(ctx context.Context, setting Settings, objectKey string) error {
	targetURL, err := buildWebDAVURL(setting.Endpoint, setting.Bucket, setting.PathPrefix, objectKey)
	if err != nil {
		return err
	}

	client := outbound.OutboundHTTPClient(transferTimeout(setting))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, targetURL.String(), nil)
	if err != nil {
		return err
	}

	if setting.AccessKeyID != "" || setting.AccessKeySecret != "" {
		req.SetBasicAuth(setting.AccessKeyID, setting.AccessKeySecret)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 || resp.StatusCode == http.StatusNotFound {
		return nil
	}
	return fmt.Errorf("WebDAV 删除返回异常状态码: %d", resp.StatusCode)
}

func PutWebDAVObject(setting Settings, objectKey, mimeType string, size int64, body io.Reader) (string, error) {
	return putWebDAVObject(context.Background(), setting, objectKey, mimeType, size, body)
}

func DeleteWebDAVObject(setting Settings, objectKey string) error {
	return deleteWebDAVObject(context.Background(), setting, objectKey)
}

func SignedWebDAVObjectURL(setting Settings, objectKey string, expiresAt time.Time) (string, error) {
	return signedWebDAVObjectURL(setting, objectKey, objectURLSigning{ExpiresAt: expiresAt})
}

func signedWebDAVObjectURL(setting Settings, objectKey string, signing objectURLSigning) (string, error) {
	if setting.CDNBaseURL != "" {
		return OssCDNObjectURL(setting.CDNBaseURL, objectKey)
	}
	targetURL, err := buildWebDAVURL(setting.Endpoint, setting.Bucket, setting.PathPrefix, objectKey)
	if err != nil {
		return "", err
	}
	return targetURL.String(), nil
}
