package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"

	"gorm.io/gorm"
)

type XkzhiConfig struct {
	Enabled     bool     `json:"enabled"`
	AppID       string   `json:"appId"`
	AppKey      string   `json:"appKey"`
	Types       []string `json:"types"`
	CallbackURL string   `json:"callbackUrl"`
}

func xkzhiConfig() XkzhiConfig {
	enabled := os.Getenv("CANVAS_XKZHI_ENABLED") == "true" || os.Getenv("CANVAS_XKZHI_ENABLED") == "1"
	appID := strings.TrimSpace(os.Getenv("CANVAS_XKZHI_APPID"))
	appKey := strings.TrimSpace(os.Getenv("CANVAS_XKZHI_APPKEY"))
	typesStr := strings.TrimSpace(os.Getenv("CANVAS_XKZHI_TYPES"))
	if typesStr == "" {
		typesStr = "qq,wx,github,gitee,sina"
	}
	var types []string
	for _, t := range strings.Split(typesStr, ",") {
		t = strings.TrimSpace(t)
		if t != "" {
			types = append(types, t)
		}
	}
	callbackURL := strings.TrimSpace(os.Getenv("CANVAS_XKZHI_CALLBACK_URL"))
	return XkzhiConfig{
		Enabled:     enabled && appID != "" && appKey != "",
		AppID:       appID,
		AppKey:      appKey,
		Types:       types,
		CallbackURL: callbackURL,
	}
}

func (s *Service) XkzhiEnabled() bool {
	return xkzhiConfig().Enabled
}

func (s *Service) XkzhiTypes() []string {
	return xkzhiConfig().Types
}

func (s *Service) BeginXkzhiLogin(loginType string, redirectURI string, nextPath string) (string, error) {
	cfg := xkzhiConfig()
	if !cfg.Enabled {
		return "", kernel.BadAuthRequest("聚合登录尚未启用")
	}
	loginType = strings.TrimSpace(strings.ToLower(loginType))
	if loginType == "" {
		loginType = "qq"
	}
	if redirectURI == "" {
		redirectURI = cfg.CallbackURL
	}
	if redirectURI == "" {
		return "", kernel.BadAuthRequest("缺少回调地址 redirect_uri")
	}

	apiURL := fmt.Sprintf("https://u.xkzhi.com/connect.php?act=login&appid=%s&appkey=%s&type=%s&redirect_uri=%s",
		url.QueryEscape(cfg.AppID), url.QueryEscape(cfg.AppKey), url.QueryEscape(loginType), url.QueryEscape(redirectURI))

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求聚合登录失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var res struct {
		Code   int    `json:"code"`
		Msg    string `json:"msg"`
		Type   string `json:"type"`
		URL    string `json:"url"`
		QRCode string `json:"qrcode"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return "", fmt.Errorf("解析聚合登录接口响应失败: %w", err)
	}
	if res.Code != 0 || res.URL == "" {
		return "", fmt.Errorf("聚合登录接口返回失败 [%d]: %s", res.Code, res.Msg)
	}

	return res.URL, nil
}

type XkzhiCallbackResult struct {
	Session    string     `json:"session"`
	MaxAgeSecs int        `json:"maxAgeSecs"`
	User       model.User `json:"user"`
	Next       string     `json:"next"`
}

type xkzhiUserInfoResponse struct {
	Code        int    `json:"code"`
	Msg         string `json:"msg"`
	Type        string `json:"type"`
	AccessToken string `json:"access_token"`
	SocialUID   string `json:"social_uid"`
	FaceImg     string `json:"faceimg"`
	Nickname    string `json:"nickname"`
	Location    string `json:"location"`
	Gender      string `json:"gender"`
	IP          string `json:"ip"`
}

func (s *Service) CompleteXkzhiLogin(loginType string, code string, bindActor *model.User, context LoginContext) (*XkzhiCallbackResult, error) {
	cfg := xkzhiConfig()
	if !cfg.Enabled {
		return nil, kernel.BadAuthRequest("聚合登录尚未启用")
	}
	code = strings.TrimSpace(code)
	loginType = strings.TrimSpace(strings.ToLower(loginType))
	if code == "" || loginType == "" {
		return nil, kernel.BadAuthRequest("缺少授权 code 或登录类型")
	}

	callbackURL := fmt.Sprintf("https://u.xkzhi.com/connect.php?act=callback&appid=%s&appkey=%s&type=%s&code=%s",
		url.QueryEscape(cfg.AppID), url.QueryEscape(cfg.AppKey), url.QueryEscape(loginType), url.QueryEscape(code))

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, callbackURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求聚合登录授权失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var res xkzhiUserInfoResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("解析聚合登录用户信息失败: %w", err)
	}
	if res.Code != 0 || res.SocialUID == "" {
		return nil, fmt.Errorf("聚合登录授权失败 [%d]: %s", res.Code, res.Msg)
	}

	provider := "xkzhi_" + loginType
	now := time.Now()

	// 场景 1: 绑定已有账号
	if bindActor != nil && bindActor.ID != "" {
		existing, err := s.repo.UserIdentity(provider, res.SocialUID)
		if err == nil && existing != nil && existing.UserID != bindActor.ID {
			return nil, kernel.BadAuthRequest("该第三方账号已绑定其他用户")
		}
		if existing == nil {
			identity := &model.UserIdentity{
				ID:               kernel.NewID(),
				UserID:           bindActor.ID,
				Provider:         provider,
				Subject:          res.SocialUID,
				ProviderUsername: res.Nickname,
				AvatarURL:        res.FaceImg,
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			if err := s.repo.Save(identity); err != nil {
				return nil, err
			}
		}
		return &XkzhiCallbackResult{Next: "/settings?section=profile&bind=success"}, nil
	}

	// 场景 2: 登录 / 注册
	identity, err := s.repo.UserIdentity(provider, res.SocialUID)
	var user *model.User
	if err == nil && identity != nil {
		user, err = s.repo.User(identity.UserID)
		if err != nil {
			return nil, err
		}
		if res.Nickname != "" || res.FaceImg != "" {
			identity.ProviderUsername = res.Nickname
			identity.AvatarURL = res.FaceImg
			identity.UpdatedAt = now
			_ = s.repo.Save(identity)
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) || identity == nil {
		shortUID := res.SocialUID
		if len(shortUID) > 8 {
			shortUID = shortUID[len(shortUID)-8:]
		}
		username := fmt.Sprintf("%s_%s", loginType, strings.ToLower(shortUID))
		displayName := res.Nickname
		if strings.TrimSpace(displayName) == "" {
			displayName = fmt.Sprintf("%s用户_%s", strings.ToUpper(loginType), shortUID)
		}

		role := model.UserRoleUser
		if count, err := s.repo.UserCount(); err == nil && count == 0 {
			role = model.UserRoleAdmin
		}

		newUser := &model.User{
			ID:          kernel.NewID(),
			Username:    username,
			DisplayName: displayName,
			Role:        role,
			Status:      model.UserStatusActive,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		newIdentity := &model.UserIdentity{
			ID:               kernel.NewID(),
			UserID:           newUser.ID,
			Provider:         provider,
			Subject:          res.SocialUID,
			ProviderUsername: res.Nickname,
			AvatarURL:        res.FaceImg,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		if err := s.repo.CreateOAuthUser(newUser, newIdentity); err != nil {
			return nil, fmt.Errorf("创建聚合登录用户失败: %w", err)
		}
		user = newUser
		s.host.NotifyUserRegistered(user)
		_ = s.host.EnsureSignupBonus(user.ID)
	} else {
		return nil, err
	}

	if user.Status != model.UserStatusActive {
		return nil, kernel.Forbidden("该账号已被禁用")
	}

	event := NewLoginLog("oauth", provider, context)
	loginLogUser(event, user)
	session, err := s.createAuthSession(user, event)
	if err != nil {
		return nil, err
	}

	return &XkzhiCallbackResult{
		Session:    session.Session,
		MaxAgeSecs: session.MaxAgeSecs,
		User:       *user,
		Next:       "/",
	}, nil
}
