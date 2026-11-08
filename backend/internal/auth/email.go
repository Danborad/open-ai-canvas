package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"math/big"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"yingce/backend/internal/emailtpl"
	"yingce/backend/internal/kernel"

	"yingce/backend/internal/model"

	"gorm.io/gorm"
)

const emailSettingKey = "email"
const registrationEmailPurpose = "registration"
const registrationCodeTTL = 10 * time.Minute

var defaultRegistrationEmailDomains = []string{
	"gmail.com",
	"163.com",
	"126.com",
	"qq.com",
	"outlook.com",
	"hotmail.com",
	"icloud.com",
	"yahoo.com",
	"foxmail.com",
}

type EmailSender struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Encryption string `json:"encryption"`
	FromEmail  string `json:"fromEmail"`
	FromName   string `json:"fromName"`
	Enabled    bool   `json:"enabled"`
}

type PublicEmailSender struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Host              string `json:"host"`
	Port              int    `json:"port"`
	Username          string `json:"username"`
	Encryption        string `json:"encryption"`
	FromEmail         string `json:"fromEmail"`
	FromName          string `json:"fromName"`
	FromNameInherited bool   `json:"fromNameInherited"`
	HasPassword       bool   `json:"hasPassword"`
	Enabled           bool   `json:"enabled"`
}

type EmailSenderRequest struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Encryption string `json:"encryption"`
	FromEmail  string `json:"fromEmail"`
	FromName   string `json:"fromName"`
	Enabled    bool   `json:"enabled"`
}

type EmailSettingRequest struct {
	Enabled                    bool                 `json:"enabled"`
	DispatchMode               string               `json:"dispatchMode"`
	ActiveSenderID             string               `json:"activeSenderId"`
	Senders                    []EmailSenderRequest `json:"senders"`
	RegistrationAllowedDomains []string             `json:"registrationAllowedDomains"`

	// Legacy fields
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Encryption string `json:"encryption"`
	FromEmail  string `json:"fromEmail"`
	FromName   string `json:"fromName"`
}

type PublicEmailSetting struct {
	Enabled                    bool                `json:"enabled"`
	DispatchMode               string              `json:"dispatchMode"`
	ActiveSenderID             string              `json:"activeSenderId"`
	Senders                    []PublicEmailSender `json:"senders"`
	RegistrationAllowedDomains []string            `json:"registrationAllowedDomains"`
	UpdatedBy                  string              `json:"updatedBy"`
	CreatedAt                  time.Time           `json:"createdAt"`
	UpdatedAt                  time.Time           `json:"updatedAt"`

	// Legacy fields
	Host              string `json:"host"`
	Port              int    `json:"port"`
	Username          string `json:"username"`
	Encryption        string `json:"encryption"`
	FromEmail         string `json:"fromEmail"`
	FromName          string `json:"fromName"`
	FromNameInherited bool   `json:"fromNameInherited"`
	HasPassword       bool   `json:"hasPassword"`
}

type EmailSettingValue struct {
	Enabled                    bool          `json:"enabled"`
	DispatchMode               string        `json:"dispatchMode"`
	ActiveSenderID             string        `json:"activeSenderId"`
	Senders                    []EmailSender `json:"senders"`
	RegistrationAllowedDomains []string      `json:"registrationAllowedDomains"`

	// Legacy fields
	Host       string `json:"host,omitempty"`
	Port       int    `json:"port,omitempty"`
	Username   string `json:"username,omitempty"`
	Password   string `json:"password,omitempty"`
	Encryption string `json:"encryption,omitempty"`
	FromEmail  string `json:"fromEmail,omitempty"`
	FromName   string `json:"fromName,omitempty"`
}

type TestEmailRequest struct {
	Recipient  string `json:"recipient"`
	SenderID   string `json:"senderId"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Encryption string `json:"encryption"`
	FromEmail  string `json:"fromEmail"`
	FromName   string `json:"fromName"`
}

type TestEmailResult struct {
	Recipient  string `json:"recipient"`
	DurationMs int64  `json:"durationMs"`
}

func (s EmailSettingValue) activeSenders() []EmailSender {
	var enabled []EmailSender
	for _, sender := range s.Senders {
		if sender.Enabled && sender.Host != "" && sender.FromEmail != "" {
			enabled = append(enabled, sender)
		}
	}
	if len(enabled) == 0 {
		return nil
	}
	if s.DispatchMode == "single" {
		if s.ActiveSenderID != "" {
			for _, item := range enabled {
				if item.ID == s.ActiveSenderID {
					return []EmailSender{item}
				}
			}
		}
		return []EmailSender{enabled[0]}
	}
	return enabled
}

func (s *Service) AdminEmailSetting(actor *model.User) (*PublicEmailSetting, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	setting, value, err := s.readEmailSetting()
	if err != nil {
		return nil, err
	}
	return s.publicEmailSetting(setting, value), nil
}

func (s *Service) UpdateEmailSetting(actor *model.User, req EmailSettingRequest) (*PublicEmailSetting, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	currentSetting, current, err := s.readEmailSetting()
	if err != nil {
		return nil, err
	}
	allowedDomains := req.RegistrationAllowedDomains
	if allowedDomains == nil {
		allowedDomains = current.RegistrationAllowedDomains
	}

	var nextSenders []EmailSender
	if len(req.Senders) > 0 {
		currentByID := make(map[string]EmailSender)
		for _, s := range current.Senders {
			currentByID[s.ID] = s
		}
		for index, r := range req.Senders {
			id := strings.TrimSpace(r.ID)
			if id == "" {
				id = fmt.Sprintf("sender_%s_%d", kernel.NewID()[:8], index+1)
			}
			pwd := strings.TrimSpace(r.Password)
			if pwd == "" && currentByID[id].Password != "" {
				pwd = currentByID[id].Password
			}
			name := strings.TrimSpace(r.Name)
			if name == "" {
				name = r.FromEmail
			}
			nextSenders = append(nextSenders, EmailSender{
				ID:         id,
				Name:       name,
				Host:       strings.TrimSpace(r.Host),
				Port:       r.Port,
				Username:   strings.TrimSpace(r.Username),
				Password:   pwd,
				Encryption: strings.TrimSpace(r.Encryption),
				FromEmail:  NormalizeEmail(r.FromEmail),
				FromName:   strings.TrimSpace(r.FromName),
				Enabled:    r.Enabled,
			})
		}
	} else if req.Host != "" && req.FromEmail != "" {
		pwd := req.Password
		if pwd == "" {
			pwd = current.Password
		}
		nextSenders = []EmailSender{{
			ID:         "default",
			Name:       "默认发信邮箱",
			Host:       req.Host,
			Port:       req.Port,
			Username:   req.Username,
			Password:   pwd,
			Encryption: req.Encryption,
			FromEmail:  req.FromEmail,
			FromName:   req.FromName,
			Enabled:    req.Enabled,
		}}
	}

	dispatchMode := req.DispatchMode
	if dispatchMode != "round_robin" {
		dispatchMode = "single"
	}
	activeSenderID := strings.TrimSpace(req.ActiveSenderID)
	if activeSenderID == "" && len(nextSenders) > 0 {
		activeSenderID = nextSenders[0].ID
	}

	next := normalizeEmailSetting(EmailSettingValue{
		Enabled:                    req.Enabled,
		DispatchMode:               dispatchMode,
		ActiveSenderID:             activeSenderID,
		Senders:                    nextSenders,
		RegistrationAllowedDomains: allowedDomains,
	})

	var activeSender *EmailSender
	for i := range next.Senders {
		if next.Senders[i].ID == next.ActiveSenderID {
			activeSender = &next.Senders[i]
			break
		}
	}
	if activeSender == nil && len(next.Senders) > 0 {
		activeSender = &next.Senders[0]
	}
	if activeSender != nil {
		next.Host = activeSender.Host
		next.Port = activeSender.Port
		next.Username = activeSender.Username
		next.Password = activeSender.Password
		next.Encryption = activeSender.Encryption
		next.FromEmail = activeSender.FromEmail
		next.FromName = activeSender.FromName
	}

	if err := validateEmailSetting(next); err != nil {
		return nil, err
	}

	stored := next
	if stored.Password != "" {
		stored.Password, err = s.host.EncryptSecret(stored.Password)
		if err != nil {
			return nil, err
		}
	}
	for i := range stored.Senders {
		if stored.Senders[i].Password != "" {
			stored.Senders[i].Password, err = s.host.EncryptSecret(stored.Senders[i].Password)
			if err != nil {
				return nil, err
			}
		}
	}

	encoded, err := json.Marshal(stored)
	if err != nil {
		return nil, err
	}
	setting := model.SystemSetting{Key: emailSettingKey, ValueJSON: string(encoded), UpdatedBy: actor.ID}
	if currentSetting != nil {
		setting.CreatedAt = currentSetting.CreatedAt
	}
	if err := s.repo.SaveSystemSetting(&setting); err != nil {
		return nil, err
	}
	return s.publicEmailSetting(&setting, next), nil
}

func (s *Service) EmailEnabled() (bool, error) {
	_, value, err := s.readEmailSetting()
	if err != nil {
		return false, err
	}
	return value.Enabled && value.Host != "" && value.Port > 0 && value.FromEmail != "", nil
}

func (s *Service) SendRegistrationEmailCode(rawEmail string) error {
	p, err := s.verificationPolicy()
	if err != nil {
		return err
	}
	if !p.allows("register", "email") {
		return kernel.Forbidden("邮箱单独验证注册未开启")
	}
	email := NormalizeEmail(rawEmail)
	if err := ValidateEmail(email); err != nil {
		return err
	}
	count, err := s.repo.UserCount()
	if err != nil {
		return err
	}
	if count == 0 {
		return kernel.BadAuthRequest("首个管理员账号不需要邮箱验证码")
	}
	registrationEnabled, err := s.RegistrationEnabled()
	if err != nil {
		return err
	}
	if !registrationEnabled {
		return kernel.Forbidden("管理员未开放新用户注册")
	}
	if err := s.repo.CheckEmailAvailable(email, ""); err != nil {
		return err
	}
	_, setting, err := s.readEmailSetting()
	if err != nil {
		return err
	}
	if err := validateRegistrationEmailDomain(email, setting.RegistrationAllowedDomains); err != nil {
		return err
	}
	if !setting.Enabled {
		return kernel.Forbidden("平台尚未启用注册邮件，请联系管理员")
	}
	s.emailCodeMu.Lock()
	defer s.emailCodeMu.Unlock()
	if latest, err := s.repo.LatestEmailVerificationCode(email, registrationEmailPurpose); err == nil && time.Since(latest.CreatedAt) < time.Minute {
		seconds := max(1, int((time.Until(latest.CreatedAt.Add(time.Minute))+time.Second-1)/time.Second))
		return &EmailCodeCooldownError{Seconds: seconds}
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	code, err := randomNumericCode(6)
	if err != nil {
		return err
	}
	codeHash, err := s.emailVerificationCodeHash(registrationEmailPurpose, email, code)
	if err != nil {
		return err
	}
	now := time.Now()
	record := model.EmailVerificationCode{ID: kernel.NewID(), Email: email, CodeHash: codeHash, Purpose: registrationEmailPurpose, ExpiresAt: now.Add(registrationCodeTTL), CreatedAt: now}
	if err := s.repo.Create(&record); err != nil {
		return err
	}
	setting = resolveEmailSender(setting, s.host.BrandName())
	rendered, err := registrationEmail(setting.FromName, email, code)
	if err != nil {
		return err
	}
	if err := s.deliverEmail(setting, EmailDelivery{Purpose: EmailPurposeRegistration, Recipient: email, Mail: rendered}); err != nil {
		cleanupErr := s.repo.DeleteEmailVerificationCode(record.ID)
		if cleanupErr != nil {
			return errors.Join(
				fmt.Errorf("发送注册邮件失败：%w", err),
				fmt.Errorf("清理失效验证码失败：%w", cleanupErr),
			)
		}
		return fmt.Errorf("发送注册邮件失败：%w", err)
	}
	if cleanupErr := s.repo.DeleteExpiredEmailVerificationCodes(now.Add(-24 * time.Hour)); cleanupErr != nil {
		log.Printf("expired registration code cleanup failed: error=%v", cleanupErr)
	}
	return nil
}

func (s *Service) VerifyRegistrationEmailCode(email string, rawCode string) (*model.EmailVerificationCode, error) {
	p, err := s.verificationPolicy()
	if err != nil {
		return nil, err
	}
	if !p.allows("register", "email") {
		return nil, kernel.Forbidden("邮箱单独验证注册未开启")
	}
	emailEnabled, err := s.EmailEnabled()
	if err != nil {
		return nil, err
	}
	if !emailEnabled {
		return nil, kernel.Forbidden("平台尚未启用注册邮件，请联系管理员")
	}
	code := strings.TrimSpace(rawCode)
	if len(code) != 6 {
		return nil, kernel.BadAuthRequest("请输入 6 位邮箱验证码")
	}
	record, err := s.repo.LatestEmailVerificationCode(email, registrationEmailPurpose)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, kernel.BadAuthRequest("请先获取邮箱验证码")
	}
	if err != nil {
		return nil, err
	}
	if time.Now().After(record.ExpiresAt) {
		return nil, kernel.BadAuthRequest("邮箱验证码已过期，请重新获取")
	}
	if err := s.repo.AttemptLegacyEmailVerification(record.ID); err != nil {
		return nil, invalidVerification()
	}
	hash, err := s.emailVerificationCodeHash(registrationEmailPurpose, email, code)
	if err != nil {
		return nil, err
	}
	if !hmac.Equal([]byte(hash), []byte(record.CodeHash)) {
		return nil, kernel.BadAuthRequest("邮箱验证码不正确")
	}
	return record, nil
}

func (s *Service) emailVerificationCodeHash(purpose string, email string, code string) (string, error) {
	key, err := s.host.SettingsEncryptionKey()
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(strings.TrimSpace(purpose) + ":" + NormalizeEmail(email) + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

func (s *Service) readEmailSetting() (*model.SystemSetting, EmailSettingValue, error) {
	setting, err := s.repo.SystemSetting(emailSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, normalizeEmailSetting(EmailSettingValue{}), nil
	}
	if err != nil {
		return nil, EmailSettingValue{}, err
	}
	value := EmailSettingValue{}
	if err := json.Unmarshal([]byte(setting.ValueJSON), &value); err != nil {
		return nil, EmailSettingValue{}, errors.New("邮件配置格式无效")
	}
	// 将历史单一配置平滑迁移至 Senders 列表
	if len(value.Senders) == 0 && value.Host != "" && value.FromEmail != "" {
		value.Senders = []EmailSender{{
			ID:         "default",
			Name:       "默认发信邮箱",
			Host:       value.Host,
			Port:       value.Port,
			Username:   value.Username,
			Password:   value.Password,
			Encryption: value.Encryption,
			FromEmail:  value.FromEmail,
			FromName:   value.FromName,
			Enabled:    value.Enabled,
		}}
		if value.ActiveSenderID == "" {
			value.ActiveSenderID = "default"
		}
		if value.DispatchMode == "" {
			value.DispatchMode = "single"
		}
	}
	if value.Password != "" {
		decrypted, err := s.host.DecryptSecret(value.Password)
		if err == nil {
			value.Password = decrypted
		} else {
			// 密钥发生变更或迁移时，保留原始加密密文以防覆盖，但不阻断读取其它非敏感设置。
			value.Password = ""
		}
	}
	for i := range value.Senders {
		if value.Senders[i].Password != "" {
			decrypted, err := s.host.DecryptSecret(value.Senders[i].Password)
			if err == nil {
				value.Senders[i].Password = decrypted
			} else {
				value.Senders[i].Password = ""
			}
		}
	}
	return setting, normalizeEmailSetting(value), nil
}

func validateEmailSender(sender EmailSender) error {
	name := sender.Name
	if name == "" {
		name = sender.FromEmail
	}
	if sender.Host == "" || sender.Port < 1 || sender.Port > 65535 || sender.FromEmail == "" {
		return kernel.BadAuthRequest(fmt.Sprintf("邮箱[%s]请完整填写 SMTP 主机、端口和发件邮箱", name))
	}
	if err := ValidateEmail(sender.FromEmail); err != nil {
		return kernel.BadAuthRequest(fmt.Sprintf("邮箱[%s]发件邮箱格式不正确", name))
	}
	if sender.Username != "" && sender.Password == "" {
		return kernel.BadAuthRequest(fmt.Sprintf("邮箱[%s]已填写用户名，请同时填写密码", name))
	}
	if strings.ContainsAny(sender.FromName, "\r\n") {
		return kernel.BadAuthRequest(fmt.Sprintf("邮箱[%s]发件人名称不能包含换行", name))
	}
	return nil
}

func validateEmailSetting(value EmailSettingValue) error {
	if err := validateRegistrationEmailDomains(value.RegistrationAllowedDomains); err != nil {
		return err
	}
	if !value.Enabled {
		return nil
	}
	if len(value.Senders) > 0 {
		hasEnabled := false
		for _, sender := range value.Senders {
			if sender.Enabled {
				hasEnabled = true
				if err := validateEmailSender(sender); err != nil {
					return err
				}
			}
		}
		if !hasEnabled {
			return kernel.BadAuthRequest("启用邮件前请至少启用一个有效的发信邮箱")
		}
		return nil
	}
	if value.Host == "" || value.Port < 1 || value.Port > 65535 || value.FromEmail == "" {
		return kernel.BadAuthRequest("启用邮件前请完整填写 SMTP 主机、端口和发件邮箱")
	}
	if err := ValidateEmail(value.FromEmail); err != nil {
		return kernel.BadAuthRequest("发件邮箱格式不正确")
	}
	if value.Username != "" && value.Password == "" {
		return kernel.BadAuthRequest("SMTP 用户名已填写，请同时填写密码")
	}
	if strings.ContainsAny(value.FromName, "\r\n") {
		return kernel.BadAuthRequest("发件人名称不能包含换行")
	}
	return nil
}

func normalizeEmailSetting(value EmailSettingValue) EmailSettingValue {
	value.Host = strings.TrimSpace(value.Host)
	value.Username = strings.TrimSpace(value.Username)
	value.Password = strings.TrimSpace(value.Password)
	value.FromEmail = NormalizeEmail(value.FromEmail)
	value.FromName = strings.TrimSpace(value.FromName)
	if value.RegistrationAllowedDomains == nil {
		value.RegistrationAllowedDomains = append([]string(nil), defaultRegistrationEmailDomains...)
	}
	value.RegistrationAllowedDomains = normalizeEmailDomains(value.RegistrationAllowedDomains)
	if value.Port == 0 {
		value.Port = 587
	}
	switch value.Encryption {
	case "tls", "none":
	default:
		value.Encryption = "starttls"
	}
	if value.DispatchMode != "round_robin" {
		value.DispatchMode = "single"
	}
	if value.FromName != "" && len(value.Senders) == 1 && (value.Senders[0].FromName == "" || value.Senders[0].FromName == DefaultBrandName || value.Senders[0].ID == "default") {
		value.Senders[0].FromName = value.FromName
	}
	for i := range value.Senders {
		value.Senders[i].ID = strings.TrimSpace(value.Senders[i].ID)
		value.Senders[i].Name = strings.TrimSpace(value.Senders[i].Name)
		value.Senders[i].Host = strings.TrimSpace(value.Senders[i].Host)
		value.Senders[i].Username = strings.TrimSpace(value.Senders[i].Username)
		value.Senders[i].Password = strings.TrimSpace(value.Senders[i].Password)
		value.Senders[i].FromEmail = NormalizeEmail(value.Senders[i].FromEmail)
		value.Senders[i].FromName = strings.TrimSpace(value.Senders[i].FromName)
		if value.Senders[i].Port == 0 {
			value.Senders[i].Port = 587
		}
		switch value.Senders[i].Encryption {
		case "tls", "none":
		default:
			value.Senders[i].Encryption = "starttls"
		}
	}
	return value
}

func (s *Service) publicEmailSetting(setting *model.SystemSetting, value EmailSettingValue) *PublicEmailSetting {
	inherited := value.FromName == "" || value.FromName == DefaultBrandName
	value = resolveEmailSender(value, s.host.BrandName())
	publicSenders := make([]PublicEmailSender, 0, len(value.Senders))
	for _, sender := range value.Senders {
		sInherited := sender.FromName == "" || sender.FromName == DefaultBrandName
		fromName := sender.FromName
		if sInherited {
			fromName = s.host.BrandName()
		}
		publicSenders = append(publicSenders, PublicEmailSender{
			ID:                sender.ID,
			Name:              sender.Name,
			Host:              sender.Host,
			Port:              sender.Port,
			Username:          sender.Username,
			Encryption:        sender.Encryption,
			FromEmail:         sender.FromEmail,
			FromName:          fromName,
			FromNameInherited: sInherited,
			HasPassword:       sender.Password != "",
			Enabled:           sender.Enabled,
		})
	}
	result := &PublicEmailSetting{
		Enabled:                    value.Enabled,
		DispatchMode:               value.DispatchMode,
		ActiveSenderID:             value.ActiveSenderID,
		Senders:                    publicSenders,
		Host:                       value.Host,
		Port:                       value.Port,
		Username:                   value.Username,
		Encryption:                 value.Encryption,
		FromEmail:                  value.FromEmail,
		FromName:                   value.FromName,
		FromNameInherited:          inherited,
		HasPassword:                value.Password != "",
		RegistrationAllowedDomains: value.RegistrationAllowedDomains,
	}
	if setting != nil {
		result.UpdatedBy = setting.UpdatedBy
		result.CreatedAt = setting.CreatedAt
		result.UpdatedAt = setting.UpdatedAt
	}
	return result
}

func normalizeEmailDomains(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, raw := range values {
		value := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(raw), "@")))
		value = strings.TrimSuffix(value, ".")
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func validateRegistrationEmailDomains(allowed []string) error {
	if len(allowed) > 100 {
		return kernel.BadAuthRequest("电子邮件域名白名单最多填写 100 项")
	}
	for _, domain := range allowed {
		if !validEmailDomain(domain) {
			return kernel.BadAuthRequest("电子邮件域名格式不正确：" + domain)
		}
	}
	return nil
}

func validEmailDomain(value string) bool {
	if len(value) > 253 || !strings.Contains(value, ".") || strings.HasPrefix(value, ".") || strings.HasSuffix(value, ".") {
		return false
	}
	for _, label := range strings.Split(value, ".") {
		if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return false
		}
		for _, char := range label {
			if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '-' {
				return false
			}
		}
	}
	return true
}

func (s *Service) validateRegistrationEmailDomain(email string) error {
	_, setting, err := s.readEmailSetting()
	if err != nil {
		return err
	}
	return validateRegistrationEmailDomain(email, setting.RegistrationAllowedDomains)
}

func validateRegistrationEmailDomain(email string, allowedDomains []string) error {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return kernel.BadAuthRequest("邮箱格式不正确")
	}
	domain := strings.ToLower(parts[1])
	if len(allowedDomains) == 0 {
		return nil
	}
	for _, allowed := range allowedDomains {
		if domain == allowed {
			return nil
		}
	}
	return kernel.BadAuthRequest("该邮箱域名不在管理员设置的白名单内")
}

func resolveEmailSender(value EmailSettingValue, brandName string) EmailSettingValue {
	if value.FromName == "" || value.FromName == DefaultBrandName {
		value.FromName = brandName
	}
	for i := range value.Senders {
		if value.Senders[i].FromName == "" || value.Senders[i].FromName == DefaultBrandName {
			value.Senders[i].FromName = value.FromName
		}
	}
	return value
}

// smtpSessionTimeout 限制一次投递的总时长；没有读写期限时，465 端口误配 STARTTLS 会一直等欢迎语，
// 期间持有 emailCodeMu，后续所有验证码发送都会被卡住。
const smtpSessionTimeout = 45 * time.Second

// OutgoingMail 是一封待发送的系统邮件；Text 必须完整可读，HTML 可为空。
type OutgoingMail struct {
	Subject string
	Text    string
	HTML    string
}

type smtpStageError struct {
	stage string
	err   error
}

func (e *smtpStageError) Error() string { return "smtp " + e.stage + ": " + e.err.Error() }
func (e *smtpStageError) Unwrap() error { return e.err }

func smtpEncryption(setting EmailSettingValue) string {
	// 465 是隐式 TLS 端口，按 STARTTLS 连接只会超时；这里按端口纠正，其余端口尊重配置。
	if setting.Port == 465 && setting.Encryption != "none" {
		return "tls"
	}
	return setting.Encryption
}

func sendSMTPMail(setting EmailSettingValue, recipient string, mailItem OutgoingMail) (err error) {
	stage := "connect"
	defer func() {
		if err != nil {
			err = &smtpStageError{stage: stage, err: err}
		}
	}()
	address := net.JoinHostPort(setting.Host, strconv.Itoa(setting.Port))
	tlsConfig := &tls.Config{ServerName: setting.Host, MinVersion: tls.VersionTLS12}
	dialer := &net.Dialer{Timeout: 12 * time.Second}
	deadline := time.Now().Add(smtpSessionTimeout)
	encryption := smtpEncryption(setting)
	var connection net.Conn
	if encryption == "tls" {
		stage = "connect_tls"
		connection, err = tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
	} else {
		connection, err = dialer.Dial("tcp", address)
	}
	if err != nil {
		return err
	}
	if err := connection.SetDeadline(deadline); err != nil {
		_ = connection.Close()
		return err
	}
	stage = "greeting"
	client, err := smtp.NewClient(connection, setting.Host)
	if err != nil {
		_ = connection.Close()
		return err
	}
	defer client.Close()
	if encryption == "starttls" {
		stage = "starttls"
		if err := client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if setting.Username != "" {
		stage = "auth"
		if err := client.Auth(smtp.PlainAuth("", setting.Username, setting.Password, setting.Host)); err != nil {
			return err
		}
	}
	stage = "mail_from"
	if err := client.Mail(setting.FromEmail); err != nil {
		return err
	}
	stage = "rcpt_to"
	if err := client.Rcpt(recipient); err != nil {
		return err
	}
	stage = "data"
	wc, err := client.Data()
	if err != nil {
		return err
	}
	stage = "write_body"
	if _, err := wc.Write(buildMIMEMessage(setting, recipient, mailItem, time.Now())); err != nil {
		_ = wc.Close()
		return err
	}
	stage = "finish_data"
	if err := wc.Close(); err != nil {
		return err
	}
	stage = "quit"
	return client.Quit()
}

// buildMIMEMessage 生成 multipart/alternative 邮件。Date 与 Message-ID 是 RFC 5322 必填头，
// 缺失时 QQ 邮箱、Gmail 等会提高垃圾邮件评分。
func buildMIMEMessage(setting EmailSettingValue, recipient string, mailItem OutgoingMail, now time.Time) []byte {
	from := mail.Address{Name: setting.FromName, Address: setting.FromEmail}
	domain := setting.Host
	if _, after, ok := strings.Cut(setting.FromEmail, "@"); ok && after != "" {
		domain = after
	}
	var b strings.Builder
	header := func(key, value string) { b.WriteString(key + ": " + value + "\r\n") }
	header("From", from.String())
	header("To", recipient)
	header("Subject", mime.QEncoding.Encode("UTF-8", mailItem.Subject))
	header("Date", now.Format(time.RFC1123Z))
	header("Message-ID", "<"+kernel.NewID()+"@"+domain+">")
	header("MIME-Version", "1.0")
	header("Auto-Submitted", "auto-generated")
	header("X-Auto-Response-Suppress", "All")
	if strings.TrimSpace(mailItem.HTML) == "" {
		header("Content-Type", "text/plain; charset=UTF-8")
		header("Content-Transfer-Encoding", "base64")
		b.WriteString("\r\n")
		b.WriteString(wrapBase64(mailItem.Text))
		return []byte(b.String())
	}
	boundary := "=_yc_" + kernel.NewID()
	header("Content-Type", `multipart/alternative; boundary="`+boundary+`"`)
	b.WriteString("\r\n")
	for _, part := range []struct{ kind, body string }{{"text/plain", mailItem.Text}, {"text/html", mailItem.HTML}} {
		b.WriteString("--" + boundary + "\r\n")
		b.WriteString("Content-Type: " + part.kind + "; charset=UTF-8\r\n")
		b.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
		b.WriteString(wrapBase64(part.body))
	}
	b.WriteString("--" + boundary + "--\r\n")
	return []byte(b.String())
}

func wrapBase64(value string) string {
	encoded := base64.StdEncoding.EncodeToString([]byte(value))
	var b strings.Builder
	for len(encoded) > 76 {
		b.WriteString(encoded[:76] + "\r\n")
		encoded = encoded[76:]
	}
	b.WriteString(encoded + "\r\n")
	return b.String()
}

// 邮件用途，写入 email_logs.purpose。
const (
	EmailPurposeRegistration      = "registration"
	EmailPurposePasswordReset     = "password_reset"
	EmailPurposeVerification      = "verification"
	EmailPurposeProfileEmail      = "profile_email"
	EmailPurposeEmailChanged      = "email_changed"
	EmailPurposeTest              = "test"
	EmailPurposeConsumptionReport = "consumption_report"
	emailLogStatusSent            = "sent"
	emailLogStatusFailed          = "failed"
	emailLogStatusSkipped         = "skipped"
)

// EmailDelivery 描述一次投递的业务上下文，用于发送记录。
type EmailDelivery struct {
	Purpose   string
	UserID    string
	Recipient string
	Mail      OutgoingMail
}

func (s *Service) deliverEmail(setting EmailSettingValue, delivery EmailDelivery) error {
	senders := setting.activeSenders()
	if len(senders) == 0 {
		if setting.Host != "" && setting.FromEmail != "" {
			senders = []EmailSender{{
				ID: "default", Name: "默认发信通道",
				Host: setting.Host, Port: setting.Port, Username: setting.Username,
				Password: setting.Password, Encryption: setting.Encryption,
				FromEmail: setting.FromEmail, FromName: setting.FromName,
				Enabled: setting.Enabled,
			}}
		}
	}
	if len(senders) == 0 {
		return errors.New("未配置可用的发信邮箱")
	}

	var orderedSenders []EmailSender
	if setting.DispatchMode == "round_robin" && len(senders) > 1 {
		startIdx := int((atomic.AddUint64(&s.emailCursor, 1) - 1) % uint64(len(senders)))
		for i := 0; i < len(senders); i++ {
			orderedSenders = append(orderedSenders, senders[(startIdx+i)%len(senders)])
		}
	} else {
		orderedSenders = senders
	}

	var lastErr error
	started := time.Now()

	for _, sender := range orderedSenders {
		senderSetting := setting
		senderSetting.Host = sender.Host
		senderSetting.Port = sender.Port
		senderSetting.Username = sender.Username
		senderSetting.Password = sender.Password
		senderSetting.Encryption = sender.Encryption
		senderSetting.FromEmail = sender.FromEmail
		if sender.FromName != "" {
			senderSetting.FromName = sender.FromName
		}

		var err error
		if s.mailSender != nil {
			err = s.mailSender(senderSetting, delivery.Recipient, delivery.Mail.Subject, delivery.Mail.Text)
		} else {
			err = sendSMTPMail(senderSetting, delivery.Recipient, delivery.Mail)
		}

		entry := model.EmailLog{ID: kernel.NewID(), UserID: delivery.UserID, Purpose: delivery.Purpose, Recipient: delivery.Recipient, Subject: logSubject(delivery.Mail.Subject), Status: emailLogStatusSent, SMTPHost: senderSetting.Host, DurationMS: time.Since(started).Milliseconds(), CreatedAt: started}
		if err == nil {
			s.appendEmailLog(&entry)
			return nil
		}

		lastErr = err
		reason := smtpLogError(err, senderSetting, delivery.Recipient, delivery.Mail.Subject, delivery.Mail.Text)
		slog.Error("smtp email delivery failed",
			"host", senderSetting.Host, "port", senderSetting.Port, "encryption", senderSetting.Encryption,
			"recipient", maskedEmail(delivery.Recipient), "error", reason)
		entry.Status = emailLogStatusFailed
		entry.Reason = truncateRunes(reason, 500)
		var stageErr *smtpStageError
		if errors.As(err, &stageErr) {
			entry.Stage = stageErr.stage
		}
		s.appendEmailLog(&entry)
	}

	return lastErr
}

func (s *Service) TestEmail(actor *model.User, req TestEmailRequest) (*TestEmailResult, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	req.Recipient = strings.TrimSpace(req.Recipient)
	if req.Recipient == "" {
		return nil, kernel.BadAuthRequest("请输入测试收件邮箱地址")
	}
	if err := ValidateEmail(req.Recipient); err != nil {
		return nil, kernel.BadAuthRequest("收件邮箱格式不正确")
	}

	_, currentSetting, err := s.readEmailSetting()
	if err != nil {
		return nil, err
	}

	target := EmailSender{
		Host:       strings.TrimSpace(req.Host),
		Port:       req.Port,
		Username:   strings.TrimSpace(req.Username),
		Password:   strings.TrimSpace(req.Password),
		Encryption: strings.TrimSpace(req.Encryption),
		FromEmail:  NormalizeEmail(req.FromEmail),
		FromName:   strings.TrimSpace(req.FromName),
	}

	if target.Host == "" && req.SenderID != "" {
		for _, sender := range currentSetting.Senders {
			if sender.ID == req.SenderID {
				target = sender
				if req.Password != "" {
					target.Password = req.Password
				}
				break
			}
		}
	} else if target.Host != "" && req.SenderID != "" && target.Password == "" {
		for _, sender := range currentSetting.Senders {
			if sender.ID == req.SenderID {
				target.Password = sender.Password
				break
			}
		}
	} else if target.Host == "" && currentSetting.Host != "" {
		target = EmailSender{
			Host:       currentSetting.Host,
			Port:       currentSetting.Port,
			Username:   currentSetting.Username,
			Password:   currentSetting.Password,
			Encryption: currentSetting.Encryption,
			FromEmail:  currentSetting.FromEmail,
			FromName:   currentSetting.FromName,
		}
	}

	if target.Host == "" || target.FromEmail == "" {
		return nil, kernel.BadAuthRequest("未找到要测试的发信配置，请完整填写 SMTP 参数")
	}
	if err := validateEmailSender(target); err != nil {
		return nil, err
	}

	senderSetting := EmailSettingValue{
		Host:       target.Host,
		Port:       target.Port,
		Username:   target.Username,
		Password:   target.Password,
		Encryption: target.Encryption,
		FromEmail:  target.FromEmail,
		FromName:   target.FromName,
	}
	senderSetting = resolveEmailSender(senderSetting, s.host.BrandName())

	start := time.Now()
	subject := fmt.Sprintf("【%s】发信服务测试邮件", senderSetting.FromName)
	body := fmt.Sprintf("您好！\n\n这是一封来自 %s（%s）的测试邮件。\n发送时间：%s\n\n如果您收到这封邮件，说明该发信邮箱的 SMTP 配置完全正常！",
		senderSetting.FromName, senderSetting.FromEmail, time.Now().Format("2006-01-02 15:04:05"))

	if err := sendSMTPMail(senderSetting, req.Recipient, OutgoingMail{Subject: subject, Text: body}); err != nil {
		return nil, kernel.NewAppError(500, fmt.Sprintf("邮件发送失败：%v", err))
	}

	return &TestEmailResult{
		Recipient:  req.Recipient,
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

// recordSkippedEmail 记录按规则未投递的请求（如找回密码时账号不存在），方便管理员排查“收不到邮件”。
func (s *Service) recordSkippedEmail(purpose, userID, recipient, reason string) {
	s.appendEmailLog(&model.EmailLog{ID: kernel.NewID(), UserID: userID, Purpose: purpose, Recipient: recipient, Status: emailLogStatusSkipped, Reason: reason, CreatedAt: time.Now()})
}

func (s *Service) appendEmailLog(entry *model.EmailLog) {
	if s.repo == nil {
		return
	}
	if err := s.repo.AppendEmailLog(entry); err != nil {
		slog.Warn("email log write failed", "purpose", entry.Purpose, "recipient", maskedEmail(entry.Recipient), "error", err)
	}
}

// logSubject 去掉标题里的验证码，发送记录不保存验证码明文。
func logSubject(subject string) string {
	return truncateRunes(strings.TrimSpace(emailCodeLogPattern.ReplaceAllString(subject, "******")), 200)
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

// SendSystemEmail 供其他业务域（如消费日报）复用平台 SMTP 配置与发送记录。
func (s *Service) SendSystemEmail(delivery EmailDelivery) error {
	_, setting, err := s.readEmailSetting()
	if err != nil {
		return err
	}
	if !setting.Enabled || setting.Host == "" || setting.Port < 1 || setting.FromEmail == "" {
		return kernel.Forbidden("邮件服务未启用")
	}
	setting = resolveEmailSender(setting, s.host.BrandName())
	return s.deliverEmail(setting, delivery)
}

// EmailBrandName 是邮件里显示的品牌名：发件人名称优先，其次是外观设置的品牌名。
func (s *Service) EmailBrandName() string {
	_, setting, err := s.readEmailSetting()
	if err != nil {
		return s.host.BrandName()
	}
	return resolveEmailSender(setting, s.host.BrandName()).FromName
}

var emailCodeLogPattern = regexp.MustCompile(`[0-9]{6}`)

func smtpLogError(err error, setting EmailSettingValue, recipient, subject, body string) string {
	// SMTP replies can echo credentials, addresses or message content. Redact
	// those values before logging while preserving the status and failure detail.
	secrets := []string{setting.Password, setting.Username, setting.FromEmail, recipient, subject, body,
		"\x00" + setting.Username + "\x00" + setting.Password}
	secrets = append(secrets, emailCodeLogPattern.FindAllString(body, -1)...)
	values := make([]string, 0, len(secrets)*2)
	for _, secret := range secrets {
		if secret != "" {
			values = append(values, secret, base64.StdEncoding.EncodeToString([]byte(secret)))
		}
	}
	sort.Slice(values, func(i, j int) bool { return len(values[i]) > len(values[j]) })
	pairs := make([]string, 0, len(values)*2)
	for _, value := range values {
		pairs = append(pairs, value, "[redacted]")
	}
	return strings.NewReplacer(pairs...).Replace(err.Error())
}

func randomNumericCode(length int) (string, error) {
	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(length)), nil)
	value, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", length, value.Int64()), nil
}

func registrationEmail(brandName, recipient, code string) (OutgoingMail, error) {
	return codeMail(emailtpl.CodeEmail{Brand: brandName, Heading: "注册", Intro: "你正在注册" + brandName + "。请在注册页面输入下方验证码，完成邮箱验证。", Code: code, TTLMinutes: 10, Recipient: recipient})
}

func codeMail(item emailtpl.CodeEmail) (OutgoingMail, error) {
	rendered, err := emailtpl.RenderCode(item)
	if err != nil {
		return OutgoingMail{}, err
	}
	return OutgoingMail{Subject: rendered.Subject, Text: rendered.Text, HTML: rendered.HTML}, nil
}

func noticeMail(item emailtpl.NoticeEmail) (OutgoingMail, error) {
	rendered, err := emailtpl.RenderNotice(item)
	if err != nil {
		return OutgoingMail{}, err
	}
	return OutgoingMail{Subject: rendered.Subject, Text: rendered.Text, HTML: rendered.HTML}, nil
}
