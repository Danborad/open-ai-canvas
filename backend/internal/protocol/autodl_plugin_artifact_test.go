package protocol

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestAutoDLPluginArtifact(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "plugin-packages", "autodl-comfyui.yingce-plugin"))
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := ParsePluginPackage(data)
	if err != nil {
		t.Fatal(err)
	}
	adapters, err := LoadInstalledProviders(pkg.ManifestRaw, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(adapters) == 0 {
		t.Fatalf("loaded adapters = %d", len(adapters))
	}
	var adapter Adapter
	for _, a := range adapters {
		if a.Metadata().ID == "autodl-comfyui" {
			adapter = a
			break
		}
	}
	if adapter == nil {
		t.Fatal("autodl-comfyui provider adapter not found")
	}
	if adapter.Metadata().ID != "autodl-comfyui" || adapter.Metadata().Execution != "declarative" {
		t.Fatalf("metadata = %#v", adapter.Metadata())
	}
	if !adapter.Metadata().RequiresPublicMediaURLs {
		t.Fatal("AutoDL provider must request public reference media URLs")
	}

	create, err := adapter.BuildCreate(context.Background(), RequestContext{BaseURL: "https://autodl.art", Request: GenerationRequest{
		Model: "minimax_h3_lightx2v_no_pic", Prompt: "a cinematic test", Duration: 3, Resolution: "768P竖", Images: []MediaReference{{URL: "https://cdn.example/reference.png"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if create.Method != "POST" || create.Path != "/api/v1/comfyui/comfyui_workflow/minimax_h3_lightx2v_no_pic" || create.ContentType != "application/json" {
		t.Fatalf("create spec = %#v", create)
	}
	body, ok := create.Body.(map[string]any)
	if !ok || body["prompt"] != "a cinematic test" || body["duration"] != 3 || body["resolution"] != "768p竖" {
		t.Fatalf("create body = %#v", create.Body)
	}
	if _, exists := body["ref_image_0"]; exists {
		t.Fatalf("no_pic workflow must not send ref_image_0: %#v", body)
	}
	if _, exists := body["first_frame"]; exists {
		t.Fatalf("no_pic workflow must not send first_frame: %#v", body)
	}

	createV5, err := adapter.BuildCreate(context.Background(), RequestContext{BaseURL: "https://autodl.art", Request: GenerationRequest{
		Model: "minimax_h3_lightx2v_v5_15s", Prompt: "a cinematic test", Duration: 15, Resolution: "768p竖", Images: []MediaReference{{URL: "https://cdn.example/ref0.png"}, {URL: "https://cdn.example/ref1.png"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	bodyV5 := createV5.Body.(map[string]any)
	if bodyV5["ref_image_0"] != "https://cdn.example/ref0.png" || bodyV5["ref_image_1"] != "https://cdn.example/ref1.png" {
		t.Fatalf("v5 create body missing ref images = %#v", bodyV5)
	}
	if _, exists := bodyV5["first_frame"]; exists {
		t.Fatalf("v5 workflow must not send first_frame: %#v", bodyV5)
	}

	createLightX2V, err := adapter.BuildCreate(context.Background(), RequestContext{BaseURL: "https://autodl.art", Request: GenerationRequest{
		Model: "minimax_h3_lightx2v", Prompt: "a cinematic test", Duration: 5, Resolution: "768p竖", Images: []MediaReference{{URL: "https://cdn.example/first.png"}, {URL: "https://cdn.example/last.png"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	bodyLightX2V := createLightX2V.Body.(map[string]any)
	if bodyLightX2V["first_frame"] != "https://cdn.example/first.png" || bodyLightX2V["last_frame"] != "https://cdn.example/last.png" {
		t.Fatalf("lightx2v body = %#v", bodyLightX2V)
	}
	if _, exists := bodyLightX2V["ref_image_0"]; exists {
		t.Fatalf("lightx2v must not send ref_image_0: %#v", bodyLightX2V)
	}

	failed, err := adapter.ParseCreate(context.Background(), []byte(`{"code":"RequestParameterIsWrong","data":null,"msg":"参数: resolution 的值: 768P 不在 options 列表中"}`))
	if err != nil || failed.Status != StatusFailed || failed.Message == "" {
		t.Fatalf("failed = %#v, err = %v", failed, err)
	}

	created, err := adapter.ParseCreate(context.Background(), []byte(`{"code":0,"data":{"task_id":"task-auto-1","status":"QUEUED"}}`))
	if err != nil || created.TaskID != "task-auto-1" || created.Status != StatusPending {
		t.Fatalf("created = %#v, err = %v", created, err)
	}
	poll, err := adapter.BuildPoll(context.Background(), PollContext{BaseURL: "https://autodl.art", Model: "minimax_h3_lightx2v_no_pic", TaskID: created.TaskID})
	if err != nil || poll.Method != "GET" || poll.Path != "/api/v1/comfyui/comfyui_workflow/result/task-auto-1" {
		t.Fatalf("poll spec = %#v, err = %v", poll, err)
	}
	completed, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: created.TaskID}, []byte(`{"code":"Success","data":{"task_id":"task-auto-1","status":"completed","results":[{"url":"https://cdn.example/video.mp4","type":"video","file_type":"mp4"}]}}`))
	if err != nil || completed.Status != StatusSucceeded || completed.Result == nil || len(completed.Result.Videos) != 1 {
		t.Fatalf("completed = %#v, err = %v", completed, err)
	}
	video := completed.Result.Videos[0]
	if video.URL != "https://cdn.example/video.mp4" || video.Kind != "video" || !video.Ephemeral {
		t.Fatalf("video = %#v", video)
	}
	if _, err := json.Marshal(completed); err != nil {
		t.Fatal(err)
	}
}
