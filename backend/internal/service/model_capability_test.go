package service

import (
	"fmt"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/model"
)

func TestValidateImageTaskRejectsOversizedGrokPromptByUTF8Bytes(t *testing.T) {
	prompt := strings.Repeat("中", 4001)
	input := canvasGenerationInput{
		Mode:   "image",
		Prompt: prompt,
		Config: providerConfig{InterfaceType: "grok-image", Model: "grok-imagine-image-quality"},
	}

	err := validateImageTask(DefaultImageCapabilityConfig("grok-image", "grok-imagine-image-quality"), input)
	if err == nil {
		t.Fatal("validateImageTask() error = nil")
	}
	wantBytes := fmt.Sprintf("%d UTF-8 字节", len(prompt))
	if !strings.Contains(err.Error(), wantBytes) || !strings.Contains(err.Error(), "8000") || !strings.Contains(err.Error(), "连线文本") {
		t.Fatalf("validateImageTask() error = %q", err)
	}
}

func TestValidateImageTaskDoesNotApplyQualityPromptLimitToGrokLite(t *testing.T) {
	prompt := strings.Repeat("中", 4001)
	input := canvasGenerationInput{
		Mode:   "image",
		Prompt: prompt,
		Config: providerConfig{InterfaceType: "grok-image", Model: "grok-imagine-image"},
	}

	if err := validateImageTask(DefaultImageCapabilityConfig("grok-image", "grok-imagine-image"), input); err != nil {
		t.Fatalf("validateImageTask() error = %q", err)
	}
}

func TestValidateVideoTaskRejectsPromptAboveCapabilityLimit(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("autodl-comfyui", "MiniMax H3").Video
	profile.References.PromptMaxChars = 10_000
	input := canvasGenerationInput{
		Mode:   "video",
		Prompt: strings.Repeat("镜", 23_142),
		Config: providerConfig{Model: "MiniMax H3", VideoSeconds: "15", Size: "16:9", VQuality: "768p横"},
	}

	err := validateVideoTask(profile, input)
	if err == nil || !strings.Contains(err.Error(), "最多 10000 个字符") || !strings.Contains(err.Error(), "23142 个字符") || !strings.Contains(err.Error(), "不会自动截断") {
		t.Fatalf("validateVideoTask() error = %v", err)
	}
}

func TestValidateTaskCapabilityRejectsWorkflowPromptAboveConfiguredLimit(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("runninghub-workflow-video", "workflow-video")
	profile.Video.References.PromptMaxChars = 10_000
	input := map[string]any{
		"mode":   "video",
		"prompt": strings.Repeat("镜", 10_001),
		"config": map[string]any{
			"interfaceType":    "runninghub-workflow-video",
			"capabilityConfig": profile,
		},
	}

	err := (&Service{}).ValidateTaskCapability(input)
	if err == nil || !strings.Contains(err.Error(), "完整提示词为 10001 个字符") {
		t.Fatalf("ValidateTaskCapability() error = %v", err)
	}
}

func TestValidateAutoDLComfyUIVideoCapability(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)

	rawJSON := `{"video": {"ratios": ["9:16", "16:9", "1:1"], "duration": {"max": 15, "min": 1, "step": 1, "default": 5, "selection": "range"}, "watermark": {"default": false, "supported": false}, "maxOutputs": 0, "operations": ["image_to_video", "audio_to_video"], "references": {"maxAudios": 3, "maxImages": 1, "maxVideos": 3, "minImages": 0, "maxAudioBytes": 15728640, "maxImageBytes": 31457280, "maxVideoBytes": 209715200, "promptMaxChars": 1000, "maxAudioDurationSeconds": 15, "maxVideoDurationSeconds": 15}, "resolutions": ["480p竖", "768p竖", "480p横", "768p横", "480p(1:1)", "768p(1:1)"], "defaultRatio": "16:9", "generateAudio": {"default": true, "supported": true}, "defaultOperation": "text_to_video", "defaultResolution": "768p竖"}, "version": 1}`
	channelModel := model.ChannelModel{
		ID:                   "cm-autodl-1",
		ChannelID:            "CHANNEL_AUTODL",
		ModelKey:             "minimax_h3_image_audio_to_video",
		Capability:           "video",
		Protocol:             "autodl-comfyui",
		Enabled:              true,
		CapabilityConfigJSON: rawJSON,
	}
	if err := db.Create(&channelModel).Error; err != nil {
		t.Fatal(err)
	}

	input := map[string]any{
		"mode":   "video",
		"prompt": "围绕同一主体设计多机位画面",
		"config": map[string]any{
			"channelId":     "CHANNEL_AUTODL",
			"model":         "minimax_h3_image_audio_to_video",
			"interfaceType": "autodl-comfyui",
			"videoSeconds":  "4",
			"size":          "16:9",
			"vquality":      "720p",
		},
		"metadata": map[string]any{
			"videoEditOperation": "image_to_video",
		},
		"referenceImages": []any{
			map[string]any{"id": "img1", "url": "https://example.com/test.png"},
		},
	}

	profile, _ := DecodeModelCapabilityConfig(rawJSON)
	_, normalizeErr := NormalizeModelCapabilityConfigForModel("video", "autodl-comfyui", "minimax_h3_image_audio_to_video", profile)
	if normalizeErr != nil {
		t.Fatalf("NormalizeModelCapabilityConfigForModel failed: %v", normalizeErr)
	}

	err := svc.ValidateTaskCapability(input)
	if err != nil {
		t.Fatalf("ValidateTaskCapability failed: %v", err)
	}
}

func TestAutoDLResolutionMappingForOrientations(t *testing.T) {
	profile := DefaultAutoDLVideoCapability("minimax_h3_lightx2v_v5").Video
	if res := videoResolutionNameRequestForInput(profile, "720p", "16:9"); res != "768p横" {
		t.Fatalf("expected 768p横, got %s", res)
	}
	if res := videoResolutionNameRequestForInput(profile, "720p", "9:16"); res != "768p竖" {
		t.Fatalf("expected 768p竖, got %s", res)
	}
	if res := videoResolutionNameRequestForInput(profile, "720p", "1:1"); res != "768p(1:1)" {
		t.Fatalf("expected 768p(1:1), got %s", res)
	}
	if res := videoResolutionNameRequestForInput(profile, "1080p", "16:9"); res != "1080p横" {
		t.Fatalf("expected 1080p横, got %s", res)
	}
	if res := videoResolutionNameRequestForInput(profile, "480p", "9:16"); res != "480p竖" {
		t.Fatalf("expected 480p竖, got %s", res)
	}

	motionProfile := DefaultAutoDLVideoCapability("wan2.2animate-v4-motion_retargeting").Video
	if res := videoResolutionNameRequestForInput(motionProfile, "auto", "9:16"); res != "464*832px(竖版)" {
		t.Fatalf("expected 464*832px(竖版), got %s", res)
	}
	if res := videoResolutionNameRequestForInput(motionProfile, "auto", "16:9"); res != "832*464px(横版)" {
		t.Fatalf("expected 832*464px(横版), got %s", res)
	}
}

func TestValidateImageTaskEnforcesGPTImage2CustomSizeLimits(t *testing.T) {
	profile := DefaultImageCapabilityConfig("openai-image", "gpt-image-2")
	profile.Size.AllowCustom = true

	valid := canvasGenerationInput{Mode: "image", Config: providerConfig{InterfaceType: "openai-image", Model: "gpt-image-2", Size: "3840x1920"}}
	if err := validateImageTask(profile, valid); err != nil {
		t.Fatalf("validateImageTask(valid) error = %v", err)
	}

	tests := map[string]string{
		"4096x2048": "最长边",
		"3840x2161": "16 的倍数",
		"3840x1024": "宽高比",
		"640x640":   "总像素",
	}
	for size, want := range tests {
		t.Run(size, func(t *testing.T) {
			input := canvasGenerationInput{Mode: "image", Config: providerConfig{InterfaceType: "openai-image", Model: "gpt-image-2", Size: size}}
			err := validateImageTask(profile, input)
			if err == nil || !strings.Contains(err.Error(), want) {
				t.Fatalf("validateImageTask(%s) error = %v, want %q", size, err, want)
			}
		})
	}
}

func TestDefaultVideoCapabilityUsesProtocolSpecificResolutionTiers(t *testing.T) {
	tests := map[string][]string{
		"newapi-channel-2":        {"480p", "720p", "1080p", "1440p", "2160p"},
		"volcengine-ark-video":    {"480p", "720p", "1080p"},
		"volcengine-jimeng-video": {"720p"},
		"gemini-veo":              {"720p", "1080p"},
	}
	for protocol, want := range tests {
		t.Run(protocol, func(t *testing.T) {
			profile := DefaultModelCapabilityConfigForModel(protocol, "")
			if profile == nil || profile.Video == nil {
				t.Fatalf("DefaultModelCapabilityConfigForModel(%q) video profile = nil", protocol)
			}
			if fmt.Sprint(profile.Video.Resolutions) != fmt.Sprint(want) {
				t.Fatalf("resolutions = %v, want %v", profile.Video.Resolutions, want)
			}
		})
	}
}

func TestDefaultMiniMaxVideoCapabilitySupportsReferenceGeneration(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("minimax-video", "MiniMax-H3")
	if profile == nil || profile.Video == nil {
		t.Fatal("MiniMax video profile = nil")
	}
	if !containsCapabilityString(profile.Video.Operations, "reference_to_video") {
		t.Fatalf("operations = %v, want reference_to_video", profile.Video.Operations)
	}
}

func TestAgnesVideo25CapabilityUsesOfficialLimits(t *testing.T) {
	standard := DefaultModelCapabilityConfigForModel("agnes-video", "agnes-video-2.5").Video
	if standard.Duration.Min != 4 || standard.Duration.Max != 12 || standard.Duration.Default != 5 {
		t.Fatalf("Agnes 2.5 duration = %#v", standard.Duration)
	}
	if fmt.Sprint(standard.Resolutions) != fmt.Sprint([]string{"720P", "960P", "2K"}) || standard.References.MaxVideos != 3 {
		t.Fatalf("Agnes 2.5 capability = %#v", standard)
	}
	flash := DefaultModelCapabilityConfigForModel("agnes-video", "agnes-video-2.5-flash").Video
	if fmt.Sprint(flash.Resolutions) != fmt.Sprint([]string{"720P"}) || flash.References.MaxImages != 5 || flash.References.MaxVideos != 0 {
		t.Fatalf("Agnes 2.5 Flash capability = %#v", flash)
	}
}

func TestNormalizeAgnesVideo25CapabilityRepairsLegacyStoredLimits(t *testing.T) {
	legacy := DefaultModelCapabilityConfigForModel("newapi", "legacy-video")
	normalized, err := NormalizeModelCapabilityConfigForModel("video", "agnes-video", "agnes-video-2.5", legacy)
	if err != nil {
		t.Fatalf("NormalizeModelCapabilityConfigForModel() error = %v", err)
	}
	if normalized.Video.Duration.Min != 4 || normalized.Video.Duration.Max != 12 || normalized.Video.Duration.Default != 5 {
		t.Fatalf("normalized duration = %#v", normalized.Video.Duration)
	}
	if fmt.Sprint(normalized.Video.Resolutions) != fmt.Sprint([]string{"720P", "960P", "2K"}) {
		t.Fatalf("normalized resolutions = %v", normalized.Video.Resolutions)
	}
	input := canvasGenerationInput{Config: providerConfig{InterfaceType: "agnes-video", Model: "agnes-video-2.5", VideoSeconds: "15", Size: "16:9", VQuality: "720P"}}
	if err := validateVideoTask(normalized.Video, input); err == nil {
		t.Fatalf("validateVideoTask(15 seconds) error = %v", err)
	}
}

func TestDefaultVolcengineArkVideoCapabilitySupportsFullModalReference(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("volcengine-ark-video", "doubao-seedance-2-0-260128")
	if profile == nil || profile.Video == nil {
		t.Fatal("Volcengine Ark video profile = nil")
	}
	for _, operation := range []string{"reference_to_video", "audio_to_video"} {
		if !containsCapabilityString(profile.Video.Operations, operation) {
			t.Fatalf("operations = %v, want %s", profile.Video.Operations, operation)
		}
	}
	if profile.Video.References.MaxImages != 9 || profile.Video.References.MaxVideos != 3 || profile.Video.References.MaxAudios != 3 {
		t.Fatalf("reference limits = %#v", profile.Video.References)
	}
}

func TestValidateVolcengineArkFullModalReferenceRejectsTextAndAudioOnly(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("volcengine-ark-video", "doubao-seedance-2-0-260128").Video
	input := canvasGenerationInput{
		Prompt:          "follow the soundtrack",
		Config:          providerConfig{InterfaceType: "volcengine-ark-video", VideoSeconds: "6", Size: "16:9", VQuality: "720p"},
		ReferenceAudios: []providerMedia{{URL: "https://example.com/music.mp3"}},
		Metadata:        map[string]interface{}{"videoEditOperation": "audio_to_video"},
	}
	err := validateVideoTask(profile, input)
	if err == nil || !strings.Contains(err.Error(), "文本+音频") {
		t.Fatalf("validateVideoTask() error = %v", err)
	}

	input.ReferenceImages = []providerMedia{{URL: "https://example.com/subject.png"}}
	if err := validateVideoTask(profile, input); err != nil {
		t.Fatalf("validateVideoTask(full modal) error = %v", err)
	}
}

func TestCapabilitySpecFromModelCapabilityConfigRestoresLegacyWildcardImageSizes(t *testing.T) {
	config := &ModelCapabilityConfig{
		Version: 1,
		Image: &ImageCapabilityConfig{
			Size: ImageSizeConfig{Parameter: "size", Values: []string{"*"}, AllowCustom: true},
		},
	}

	spec, err := CapabilitySpecFromModelCapabilityConfig(config, "image")
	if err != nil {
		t.Fatalf("CapabilitySpecFromModelCapabilityConfig() error = %v", err)
	}
	constraint, ok := spec.Options["size"]
	if !ok {
		t.Fatal("size constraint is missing")
	}
	values := make(map[string]int)
	for _, value := range constraint.Values {
		values[fmt.Sprint(value)]++
	}
	for _, value := range legacyImageSizeValues() {
		if values[value] != 1 {
			t.Fatalf("size constraint missing %q: %v", value, constraint.Values)
		}
	}
	if values["*"] != 1 {
		t.Fatalf("size constraint wildcard count = %d, values = %v", values["*"], constraint.Values)
	}
}

func TestNormalizeResolutionSupportsCommonAliases(t *testing.T) {
	tests := map[string]string{
		"1440":  "1440p",
		"1440p": "1440p",
		"2K":    "1440p",
		"4K":    "2160p",
		"768P":  "768p",
	}
	for input, want := range tests {
		if got := normalizeResolution(input); got != want {
			t.Fatalf("normalizeResolution(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestFlow2APIPresetCapabilitiesFollowModelAliases(t *testing.T) {
	tests := []struct {
		name           string
		image          bool
		qualities      []string
		videoDurations []int
		resolutions    []string
	}{
		{name: "Nano Banana Pro", image: true, qualities: []string{"1k", "2k", "4k"}},
		{name: "Nano Banana 2", image: true, qualities: []string{"1k", "2k", "4k"}},
		{name: "Imagen 4", image: true},
		{name: "Omni 1.1 Flash", videoDurations: []int{4, 6, 8, 10}},
		{name: "Omni Flash", videoDurations: []int{4, 6, 8, 10}},
		{name: "Veo 3.1 - Lite"},
		{name: "Veo 3.1 - Fast"},
		{name: "Veo 3.1 - Quality", resolutions: []string{"1080p", "4k"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			profile := DefaultModelCapabilityConfigForModel("flow2api-image", test.name)
			if !test.image {
				profile = DefaultModelCapabilityConfigForModel("flow2api-video", test.name)
			}
			if profile.Image == nil || profile.Video == nil {
				t.Fatal("expected complete capability profile")
			}
			if test.image {
				if got := profile.Image.Size.Values; len(got) != 5 && test.name != "Imagen 4" {
					t.Fatalf("image ratios = %v", got)
				}
				if len(test.qualities) > 0 && !containsCapabilityString(profile.Image.Quality.Values, "4k") {
					t.Fatalf("image qualities = %v", profile.Image.Quality.Values)
				}
				if test.name == "Imagen 4" && profile.Image.Quality.Supported {
					t.Fatal("Imagen 4 must omit imageSize")
				}
				return
			}
			if len(profile.Video.Ratios) != 2 || profile.Video.Ratios[0] != "16:9" || profile.Video.Ratios[1] != "9:16" {
				t.Fatalf("video ratios = %v", profile.Video.Ratios)
			}
			if len(test.videoDurations) > 0 && len(profile.Video.Duration.Values) != 4 {
				t.Fatalf("video durations = %v", profile.Video.Duration.Values)
			}
			if len(test.resolutions) > 0 && len(profile.Video.Resolutions) != 2 {
				t.Fatalf("video resolutions = %v", profile.Video.Resolutions)
			}
		})
	}
}

func TestSenseNovaPresetCapabilitiesFollowDocument(t *testing.T) {
	u15 := DefaultModelCapabilityConfigForModel("sensenova-image", "sensenova-u1.5-lite")
	if u15.Image == nil || u15.Image.Size.Default != "2048x2048" || !u15.Image.Size.AllowCustom || u15.Image.References.MaxImages != 1 {
		t.Fatalf("sensenova-u1.5-lite image profile = %#v", u15.Image)
	}

	fast := DefaultModelCapabilityConfigForModel("sensenova-image", "sensenova-u1-fast")
	if fast.Image == nil || fast.Image.Size.Default != "2752x1536" || fast.Image.Size.AllowCustom || fast.Image.References.MaxImages != 0 || len(fast.Image.Size.Values) != 11 {
		t.Fatalf("sensenova-u1-fast image profile = %#v", fast.Image)
	}
}

func TestValidateVideoTaskIgnoresGlobalResolutionWhenCatalogDeclaresNone(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("newapi", "omni").Video
	profile.Duration = VideoDurationConfig{Selection: "enum", Values: []int{8, 10}, Default: 10}
	profile.Ratios = []string{"16:9", "9:16"}
	profile.DefaultRatio = "16:9"
	profile.Resolutions = nil
	profile.DefaultResolution = ""
	profile.References.MaxImages = 0
	profile.Operations = []string{"text_to_video"}
	profile.DefaultOperation = "text_to_video"

	err := validateVideoTask(profile, canvasGenerationInput{
		Config: providerConfig{Model: "omni", VideoSeconds: "10", Size: "16:9", VQuality: "720"},
	})
	if err != nil {
		t.Fatalf("validateVideoTask() error = %v", err)
	}
}

func TestNormalizeVideoCapabilityAllowsOmittedResolution(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("newapi-channel-2", "endpoint-video").Video
	profile.Resolutions = nil
	profile.DefaultResolution = ""

	result, err := NormalizeModelCapabilityConfig("video", "newapi-channel-2", &ModelCapabilityConfig{Version: 1, Video: profile})
	if err != nil {
		t.Fatalf("NormalizeModelCapabilityConfig() error = %v", err)
	}
	if result.Video == nil || len(result.Video.Resolutions) != 0 || result.Video.DefaultResolution != "" {
		t.Fatalf("normalized video resolution = %#v", result.Video)
	}
}

func TestNormalizeVideoCapabilityAllowsOmittedRatio(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("autodl-comfyui", "minimax_h3_lightx2v_no_pic").Video
	profile.Ratios = nil
	profile.DefaultRatio = ""
	profile.Resolutions = []string{"480p竖", "480p横"}
	profile.DefaultResolution = "480p竖"

	result, err := NormalizeModelCapabilityConfig("video", "autodl-comfyui", &ModelCapabilityConfig{Version: 1, Video: profile})
	if err != nil {
		t.Fatalf("NormalizeModelCapabilityConfig() error = %v", err)
	}
	if result.Video == nil || len(result.Video.Ratios) != 0 || result.Video.DefaultRatio != "" {
		t.Fatalf("normalized video ratios = %#v", result.Video)
	}
	if err := validateVideoTask(result.Video, canvasGenerationInput{Config: providerConfig{Model: "minimax_h3_lightx2v_no_pic", VideoSeconds: "6", VQuality: "480p竖"}}); err != nil {
		t.Fatalf("validateVideoTask() error = %v", err)
	}
}

func TestCapabilitySpecFromModelCapabilityConfigProjectsImageSizeOnce(t *testing.T) {
	config := &ModelCapabilityConfig{
		Version: 1,
		Image: &ImageCapabilityConfig{
			References: ImageReferenceConfig{MaxImages: 3, MaskSupported: false},
			Size:       ImageSizeConfig{Parameter: "size", Values: []string{"1:1", "16:9"}, AllowCustom: true},
			MaxOutputs: 4,
		},
	}

	spec, err := CapabilitySpecFromModelCapabilityConfig(config, "image")
	if err != nil {
		t.Fatalf("CapabilitySpecFromModelCapabilityConfig() error = %v", err)
	}
	if got := spec.Options["size"].Values; len(got) != 3 || got[0] != "1:1" || got[1] != "16:9" || got[2] != "*" {
		t.Fatalf("size projection = %#v, want configured values plus wildcard", got)
	}
	if got := spec.Inputs["image"].Max; got != 3 {
		t.Fatalf("image input max = %d, want 3", got)
	}
	if got := spec.Options["count"].Max; got == nil || *got != 4 {
		t.Fatalf("count max = %v, want 4", got)
	}
}

func TestCapabilitySpecFromModelCapabilityConfigProjectsCustomImageSizeAsWildcard(t *testing.T) {
	config := &ModelCapabilityConfig{
		Version: 1,
		Image: &ImageCapabilityConfig{
			Size:       ImageSizeConfig{Parameter: "size", Values: []string{"1:1"}, AllowCustom: true},
			MaxOutputs: 1,
		},
	}

	spec, err := CapabilitySpecFromModelCapabilityConfig(config, "image")
	if err != nil {
		t.Fatalf("CapabilitySpecFromModelCapabilityConfig() error = %v", err)
	}
	if got := spec.Options["size"].Values; len(got) != 2 || got[0] != "1:1" || got[1] != "*" {
		t.Fatalf("custom size projection = %#v, want configured value plus wildcard", got)
	}
}

func TestCapabilitySpecFromModelCapabilityConfigAllowsAudioWithoutConfig(t *testing.T) {
	spec, err := CapabilitySpecFromModelCapabilityConfig(nil, "audio")
	if err != nil {
		t.Fatalf("audio projection error = %v", err)
	}
	if spec.Capability != "audio" || len(spec.Inputs) != 0 || len(spec.Options) != 0 {
		t.Fatalf("audio projection = %#v", spec)
	}
}

func TestValidateVideoTaskRequiresDeclaredMinimumImages(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("newapi-channel-2", "image-required-video").Video
	profile.References.MinImages = 1
	profile.References.MaxImages = 2
	profile.Operations = []string{"image_to_video"}
	profile.DefaultOperation = "image_to_video"

	err := validateVideoTask(profile, canvasGenerationInput{
		Config: providerConfig{Model: "image-required-video", VideoSeconds: "6", Size: "16:9", VQuality: "720"},
	})
	if err == nil || !strings.Contains(err.Error(), "至少需要 1 张参考图") {
		t.Fatalf("validateVideoTask() error = %v", err)
	}
}
