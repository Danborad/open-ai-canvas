package canvas

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/assets"
	"yingce/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

func TestShareOfficialResourceRequiresCanvasReferenceAndOfficialAccess(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "share.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.CanvasShare{}, &model.CanvasProject{}, &model.Resource{}, &model.OfficialAsset{}); err != nil {
		t.Fatal(err)
	}
	token := strings.Repeat("t", 40)
	now := time.Now()
	for _, value := range []any{
		&model.CanvasShare{ID: "share", UserID: "viewer", ProjectID: "canvas", TokenHash: canvasShareTokenHash(token), Enabled: true},
		&model.CanvasProject{ID: "canvas", UserID: "viewer", PayloadJSON: `{"nodes":[{"id":"a","type":"image","metadata":{"storageKey":"resource:shared"}},{"id":"b","type":"image","metadata":{"storageKey":"resource:private"}}]}`},
		&model.Resource{ID: "shared", UserID: "admin", Status: model.ResourceStatusReady},
		&model.Resource{ID: "private", UserID: "other", Status: model.ResourceStatusReady},
		&model.Resource{ID: "unreferenced", UserID: "admin", Status: model.ResourceStatusReady},
		&model.OfficialAsset{ID: "official", ResourceID: "shared", Status: model.OfficialAssetStatusPublished, PublishedAt: &now},
		&model.OfficialAsset{ID: "other-official", ResourceID: "unreferenced", Status: model.OfficialAssetStatusPublished},
	} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	svc := New(repository.New(db), nil)
	if _, _, _, err := svc.sharedCanvasResource(token, "shared"); err != nil {
		t.Fatalf("official resource rejected: %v", err)
	}
	for _, id := range []string{"private", "unreferenced"} {
		if _, _, _, err := svc.sharedCanvasResource(token, id); !errors.Is(err, gorm.ErrRecordNotFound) {
			t.Fatalf("unauthorized resource %s: %v", id, err)
		}
	}
	if err := db.Model(&model.OfficialAsset{}).Where("id = ?", "official").Update("status", model.OfficialAssetStatusUnpublished).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := svc.sharedCanvasResource(token, "shared"); err != nil {
		t.Fatalf("retained official resource rejected: %v", err)
	}
}

func TestCanvasShareTokenHashDoesNotExposeToken(t *testing.T) {
	token := "example-share-token"
	first := canvasShareTokenHash(token)
	if first == token || first != canvasShareTokenHash(token) || len(first) != 64 {
		t.Fatalf("unexpected token hash: %q", first)
	}
}

func TestPublicCharacterShareRewritesOnlyExplicitMediaAndSafeDefinition(t *testing.T) {
	payload := `{"nodes":[{"id":"role","type":"text","metadata":{"workflowKind":"character","officialAssetId":"official","characterName":"林初","characterCoverUrl":"/api/resources/cover/file","characterVoiceSampleResourceId":"voice","characterVoiceName":"声音","characterDefinition":{"appearance":"青年","apiKey":"secret","unknown":"private"}}}]}`
	public, allowed, err := publicCanvasProject(&model.CanvasProject{ID: "canvas", PayloadJSON: payload}, "share-token")
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(public)
	value := string(encoded)
	for _, expected := range []string{`"sharedCharacter":true`, "青年", "/api/public/canvas-shares/share-token/resources/cover/file", "/api/public/canvas-shares/share-token/resources/voice/file"} {
		if !strings.Contains(value, expected) {
			t.Fatalf("missing %s: %s", expected, value)
		}
	}
	for _, forbidden := range []string{"secret", "private", "officialAssetId", "characterVoiceSampleResourceId"} {
		if strings.Contains(value, forbidden) {
			t.Fatalf("leaked %s: %s", forbidden, value)
		}
	}
	if !allowed["cover"] || !allowed["voice"] || allowed["unrelated"] {
		t.Fatalf("unexpected allowed resources: %v", allowed)
	}
}

func TestPublicCanvasProjectScrubsSecretsAndRewritesResources(t *testing.T) {
	payload := map[string]any{
		"id": "project-1", "title": "公开画布", "chatSessions": []any{map[string]any{"secret": "chat"}},
		"nodes": []any{map[string]any{
			"id": "node-1", "type": "image", "title": "镜头", "position": map[string]any{"x": 1, "y": 2}, "width": 320, "height": 240,
			"metadata": map[string]any{
				"content": "data:image/png;base64,secret", "storageKey": "resource:resource_123", "prompt": "保留提示词",
				"apiKey": "secret", "taskId": "task-1", "skillSnapshot": map[string]any{"apiKey": "nested-secret", "name": "技能"},
			},
		}},
		"connections": []any{},
	}
	raw, _ := json.Marshal(payload)
	project := &model.CanvasProject{ID: "project-1", Title: "公开画布", PayloadJSON: string(raw)}
	public, resources, err := publicCanvasProject(project, "share-token")
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(public)
	text := string(encoded)
	for _, forbidden := range []string{"data:image", "secret", "task-1", `"secret":"chat"`} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("public payload leaked %q: %s", forbidden, text)
		}
	}
	if !strings.Contains(text, "保留提示词") || !strings.Contains(text, "/api/public/canvas-shares/share-token/resources/resource_123/file") {
		t.Fatalf("public payload lost expected data: %s", text)
	}
	if !resources["resource_123"] {
		t.Fatal("referenced resource was not authorized")
	}
}

func TestCanvasResourceIDRejectsInvalidValues(t *testing.T) {
	for _, value := range []string{"resource:", "resource:../secret", "/api/resources/a%2Fb/file", "resource:" + strings.Repeat("a", 81)} {
		if got := assets.ResourceID(value); got != "" {
			t.Fatalf("expected invalid resource id for %q, got %q", value, got)
		}
	}
	if got := assets.ResourceID("/api/resources/abc_123/file"); got != "abc_123" {
		t.Fatalf("unexpected resource id: %q", got)
	}
}

func TestPublicCanvasProjectDropsUnmanagedMediaURL(t *testing.T) {
	payload := `{"id":"p","nodes":[{"id":"n","type":"image","title":"image","position":{"x":0,"y":0},"width":10,"height":10,"metadata":{"content":"https://tracker.example/image.png","prompt":"public prompt"}}],"connections":[]}`
	public, _, err := publicCanvasProject(&model.CanvasProject{ID: "p", PayloadJSON: payload}, "share-token")
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(public)
	if strings.Contains(string(encoded), "tracker.example") || !strings.Contains(string(encoded), "public prompt") {
		t.Fatalf("unexpected public payload: %s", encoded)
	}
}

func TestForkPublicCanvasShare(t *testing.T) {
	svc := newCanvasOperationTestService(t)
	ownerID := "owner-1"
	targetUserID := "target-user-1"
	canvasID := "canvas-test-1"

	// 创建原项目和资源
	res := model.Resource{
		ID:        "res-1",
		UserID:    ownerID,
		Kind:      "image",
		Status:    model.ResourceStatusReady,
		ObjectKey: "res-1.png",
		MimeType:  "image/png",
		Size:      1024,
	}
	if err := svc.repo.CreateResource(&res); err != nil {
		t.Fatal(err)
	}
	asset := model.Asset{
		ID:          "asset-1",
		UserID:      ownerID,
		Kind:        "image",
		Title:       "素材1",
		PayloadJSON: `{"data":{"storageKey":"resource:res-1","url":"/api/resources/res-1/file"}}`,
	}
	if err := svc.repo.Create(&asset); err != nil {
		t.Fatal(err)
	}

	payload := `{"id":"canvas-test-1","title":"原项目","nodes":[{"id":"node-1","type":"image","metadata":{"content":"/api/resources/res-1/file","storageKey":"resource:res-1","assetId":"asset-1","prompt":"原提示词"}}],"connections":[]}`
	project := model.CanvasProject{
		ID:          canvasID,
		UserID:      ownerID,
		Title:       "原项目",
		PayloadJSON: payload,
	}
	if err := svc.repo.Create(&project); err != nil {
		t.Fatal(err)
	}

	// 1. 创建仅只读分享
	falseVal := false
	roStatus, err := svc.CreateCanvasShare(ownerID, canvasID, CanvasShareRequest{
		ExpiresDays: 7,
		AllowCopy:   &falseVal,
	})
	if err != nil {
		t.Fatal(err)
	}
	if roStatus.AllowCopy {
		t.Fatal("expected allowCopy = false")
	}

	// 尝试 Fork 只读分享，应被拒绝
	if _, err := svc.ForkPublicCanvasShare(targetUserID, roStatus.Token, ""); err == nil {
		t.Fatal("expected forbidden error for read-only share fork, got nil")
	}

	// 2. 更新为允许复制分享
	trueVal := true
	rwStatus, err := svc.CreateCanvasShare(ownerID, canvasID, CanvasShareRequest{
		ExpiresDays: 7,
		AllowCopy:   &trueVal,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !rwStatus.AllowCopy {
		t.Fatal("expected allowCopy = true")
	}

	// Fork 允许复制分享
	forkResult, err := svc.ForkPublicCanvasShare(targetUserID, rwStatus.Token, "我的克隆项目")
	if err != nil {
		t.Fatalf("fork failed: %v", err)
	}
	if forkResult.ID == "" || forkResult.Title != "我的克隆项目" {
		t.Fatalf("unexpected fork result: %+v", forkResult)
	}

	// 验证克隆后的项目存在于 targetUserID 下
	forkedProj, err := svc.repo.CanvasProjectForUser(targetUserID, forkResult.ID)
	if err != nil {
		t.Fatalf("cloned project not found for target user: %v", err)
	}
	if forkedProj.Title != "我的克隆项目" {
		t.Errorf("cloned title = %q, want '我的克隆项目'", forkedProj.Title)
	}

	// 验证克隆后的资源和资产已重新归属于 targetUserID
	if strings.Contains(forkedProj.PayloadJSON, "res-1") {
		t.Errorf("cloned payload still contains old resource id 'res-1': %s", forkedProj.PayloadJSON)
	}
}
