package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const localProviderResourceURLTTL = time.Hour
const providerResourceURLMaxTTL = 2 * time.Hour

func (s *Service) ProviderResourceURL(userID string, resourceID string, expiresAt time.Time) (string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("CANVAS_PUBLIC_BASE_URL")), "/")
	if baseURL == "" {
		return "", errors.New("本地参考素材需要配置 CANVAS_PUBLIC_BASE_URL")
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", errors.New("CANVAS_PUBLIC_BASE_URL 必须是公网 HTTPS 地址")
	}
	if _, err := s.repo.ResourceForUser(userID, resourceID); err != nil {
		return "", err
	}
	expires := expiresAt.UTC().Unix()
	signature, err := s.providerResourceSignature(userID, resourceID, expires)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/api/public/provider-resources/%s/file?user=%s&expires=%d&signature=%s", baseURL, url.PathEscape(resourceID), url.QueryEscape(userID), expires, url.QueryEscape(signature)), nil
}

func (s *Service) OpenProviderResourceRange(resourceID string, userID string, expires int64, signature string, rangeHeader string) (*ResourceStream, error) {
	now := time.Now().UTC()
	expiresAt := time.Unix(expires, 0).UTC()
	if expires <= 0 || !expiresAt.After(now) || expiresAt.After(now.Add(providerResourceURLMaxTTL)) {
		return nil, errors.New("临时资源地址已过期")
	}
	expected, err := s.providerResourceSignature(userID, resourceID, expires)
	if err != nil {
		return nil, err
	}
	if !hmac.Equal([]byte(expected), []byte(strings.TrimSpace(signature))) {
		return nil, errors.New("临时资源地址签名无效")
	}
	return s.OpenResourceRange(userID, resourceID, rangeHeader)
}

func (s *Service) providerResourceSignature(userID string, resourceID string, expires int64) (string, error) {
	key, err := s.settingsEncryptionKey()
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(userID + "\n" + resourceID + "\n" + strconv.FormatInt(expires, 10)))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}
