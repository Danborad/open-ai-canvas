package protocol

import (
	"context"
	"testing"
)

func TestKemeiVideoCreatePollAndCancel(t *testing.T) {
	adapter := officialPackageAdapter(t, "km-kemei-video.yingce-plugin", "km-kemei-video")
	create, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Model: "kling-v3-omni", Prompt: "推开欧式古典大门，展现奇幻云海城堡", Duration: 5,
		AspectRatio: "16:9", Resolution: "1080p", GenerateAudio: true, Watermark: false,
		Images: []MediaReference{{URL: "https://cdn.example/first.png", Role: "first_frame", Order: 1}, {URL: "https://cdn.example/last.png", Role: "last_frame", Order: 2}},
		Videos: []MediaReference{{URL: "https://cdn.example/ref.mp4", Role: "reference_video", Order: 1}},
		ProviderOptions: map[string]map[string]any{"km-kemei-video": {
			"negative_prompt": "模糊, 水印", "files": []any{"https://cdn.example/spec.pdf"}, "links": []any{"https://example.com/reference"},
			"ratio": "adaptive", "web_search": true, "seed": 42,
		}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if create.Method != "POST" || create.Path != "/v1/video/generations" || create.Auth.Type != "bearer" {
		t.Fatalf("create = %#v", create)
	}
	body := manifestTestBody(t, create)
	if body["model"] != "kling-v3-omni" || body["prompt"] != "推开欧式古典大门，展现奇幻云海城堡" || body["ratio"] != "adaptive" || body["seed"] != float64(42) {
		t.Fatalf("body = %#v", body)
	}
	images, _ := body["images"].([]any)
	if len(images) != 2 || images[0].(map[string]any)["role"] != "first_frame" || images[1].(map[string]any)["role"] != "last_frame" {
		t.Fatalf("images = %#v", images)
	}

	created, err := adapter.ParseCreate(context.Background(), []byte(`{"id":"video_task_abc123xyz789","status":"pending"}`))
	if err != nil || created.TaskID != "video_task_abc123xyz789" || created.Status != StatusPending {
		t.Fatalf("created = %#v err=%v", created, err)
	}
	poll, err := adapter.BuildPoll(context.Background(), PollContext{TaskID: created.TaskID})
	if err != nil || poll.Path != "/v1/video/generations/video_task_abc123xyz789" {
		t.Fatalf("poll = %#v err=%v", poll, err)
	}
	succeeded, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: created.TaskID}, []byte(`{"task_id":"video_task_abc123xyz789","status":"completed","data":[{"url":"https://example.com/output/generated_video.mp4"}]}`))
	if err != nil || succeeded.Status != StatusSucceeded || len(succeeded.Result.Videos) != 1 || succeeded.Result.Videos[0].URL != "https://example.com/output/generated_video.mp4" || !succeeded.Result.Videos[0].Ephemeral {
		t.Fatalf("succeeded = %#v err=%v", succeeded, err)
	}
	cancel, err := adapter.BuildCancel(context.Background(), PollContext{TaskID: created.TaskID})
	if err != nil || cancel.Method != "DELETE" || cancel.Path != "/v1/video/generations/video_task_abc123xyz789" {
		t.Fatalf("cancel = %#v err=%v", cancel, err)
	}
}

func TestKemeiWan3VideoCreatePollAndBuiltin(t *testing.T) {
	for _, providerID := range []string{"km-kemei-wan3-video", "km-kemei-video"} {
		adapter := officialPackageAdapter(t, "km-kemei-video.yingce-plugin", providerID)
		create, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
			Model: "wan3.0-video", Prompt: "一只金毛寻回犬在金色秋叶中奔跑，电影感慢镜头，阳光穿透树林", Duration: 5,
			AspectRatio: "16:9", Resolution: "720p", GenerateAudio: false, Watermark: false,
			Images: []MediaReference{
				{URL: "https://example.com/first.png", Role: "first_frame", Order: 1},
				{URL: "https://example.com/last.png", Role: "last_frame", Order: 2},
			},
			Videos: []MediaReference{{URL: "https://example.com/motion_ref.mp4", Role: "reference_video", Order: 1}},
			Audios: []MediaReference{{URL: "https://example.com/voice_ref.mp3", Role: "reference_audio", Order: 1}},
			ProviderOptions: map[string]map[string]any{"km-kemei-video": {
				"negative_prompt": "低画质, 杂乱",
				"files":           []any{"https://example.com/brief.pdf"},
				"links":           []any{"https://example.com/product-page"},
			}},
		}})
		if err != nil {
			t.Fatalf("%s BuildCreate error: %v", providerID, err)
		}
		body := manifestTestBody(t, create)
		if body["model"] != "wan3.0-video" {
			t.Fatalf("%s model = %v, want wan3.0-video", providerID, body["model"])
		}
		if body["resolution"] != "720P" {
			t.Fatalf("%s resolution = %v, want 720P (uppercase)", providerID, body["resolution"])
		}
		if body["duration"] != float64(5) {
			t.Fatalf("%s duration = %v, want 5", providerID, body["duration"])
		}
		images, _ := body["images"].([]any)
		if len(images) != 2 || images[0].(map[string]any)["role"] != "first_frame" {
			t.Fatalf("%s images = %#v", providerID, images)
		}

		succeeded, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "task_wan3_01"}, []byte(`{"id":"task_wan3_01","status":"completed","data":[{"url":"https://example.com/output/wan_video.mp4"}]}`))
		if err != nil || succeeded.Status != StatusSucceeded || len(succeeded.Result.Videos) != 1 || succeeded.Result.Videos[0].URL != "https://example.com/output/wan_video.mp4" {
			t.Fatalf("%s succeeded = %#v err=%v", providerID, succeeded, err)
		}
	}

	builtinAdapter, ok := Builtins().Resolve("km-kemei-wan3-video")
	if !ok {
		t.Fatal("Builtin km-kemei-wan3-video not found")
	}
	builtinCreate, err := builtinAdapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Model: "wan3.0-video", Prompt: "秋日金毛犬奔跑", Resolution: "1080p", Duration: 5, AspectRatio: "16:9",
		Images: []MediaReference{{URL: "https://example.com/ref.png", Role: "first_frame"}},
	}})
	if err != nil {
		t.Fatalf("builtin buildCreate err: %v", err)
	}
	builtinBody, ok := builtinCreate.Body.(map[string]any)
	if !ok || builtinBody["resolution"] != "1080P" || builtinBody["model"] != "wan3.0-video" {
		t.Fatalf("builtin body = %#v", builtinCreate.Body)
	}
}

func TestKemeiSeedreamImageCreateAndParse(t *testing.T) {
	// 1. 验证插件包
	adapter := officialPackageAdapter(t, "km-kemei-seedream-image.yingce-plugin", "km-kemei-seedream-image")
	createPro, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Model: "doubao-seedream-5-0-pro-260628", Prompt: "一只柴犬，透明背景", Resolution: "2K",
		Images: []MediaReference{{URL: "https://example.com/ref1.png", Order: 1}, {URL: "https://example.com/ref2.png", Order: 2}},
		ImageCount: 4, // Pro 模型应当忽略 >1 的数量
		Watermark:  false,
		ProviderOptions: map[string]map[string]any{"km-kemei-seedream-image": {
			"background": "transparent",
			"layer_decomposition": false,
		}},
	}})
	if err != nil {
		t.Fatalf("BuildCreate error: %v", err)
	}
	if createPro.Method != "POST" || createPro.Path != "/v1/images/generations" {
		t.Fatalf("createPro = %#v", createPro)
	}
	bodyPro := manifestTestBody(t, createPro)
	if bodyPro["model"] != "doubao-seedream-5-0-pro-260628" {
		t.Fatalf("model = %v", bodyPro["model"])
	}
	if bodyPro["n"] != nil {
		t.Fatalf("Pro model must not have 'n' > 1, got %v", bodyPro["n"])
	}
	if bodyPro["size"] != "2K" {
		t.Fatalf("size = %v", bodyPro["size"])
	}
	if bodyPro["background"] != "transparent" || bodyPro["output_format"] != "png" {
		t.Fatalf("background=%v output_format=%v", bodyPro["background"], bodyPro["output_format"])
	}
	imgUrls, _ := bodyPro["image_urls"].([]any)
	if len(imgUrls) != 2 || imgUrls[0] != "https://example.com/ref1.png" {
		t.Fatalf("image_urls = %#v", imgUrls)
	}

	// 2. 验证解析响应
	res, err := adapter.ParseCreate(context.Background(), []byte(`{
		"created": 1719441600,
		"data": [{"url": "https://example.com/output/result.png", "size": "2048x2048"}]
	}`))
	if err != nil || res.Status != StatusSucceeded || len(res.Result.Images) != 1 || res.Result.Images[0].URL != "https://example.com/output/result.png" {
		t.Fatalf("ParseCreate err=%v res=%#v", err, res)
	}

	// 3. 验证内置协议
	builtinAdapter, ok := Builtins().Resolve("km-kemei-seedream-image")
	if !ok {
		t.Fatal("Builtin km-kemei-seedream-image not found")
	}
	builtinCreate, err := builtinAdapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Model: "doubao-seedream-5-0-260128", Prompt: "多格漫画", Resolution: "2K", ImageCount: 4,
	}})
	if err != nil {
		t.Fatalf("builtin buildCreate err: %v", err)
	}
	builtinBody, ok := builtinCreate.Body.(map[string]any)
	if !ok || builtinBody["n"] != 4 || builtinBody["model"] != "doubao-seedream-5-0-260128" {
		t.Fatalf("builtin body = %#v", builtinCreate.Body)
	}
}
