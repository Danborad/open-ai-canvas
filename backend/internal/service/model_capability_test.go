package service

import (
	"testing"

	"infinite-canvas/backend/internal/model"
)

func TestDefaultModelCapabilityConfigScopesSpecialVideoLimits(t *testing.T) {
	flow := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceFlow2APIVideo), "Omni Flash")
	if flow.Video == nil || flow.Video.MaxOutputs != 4 {
		t.Fatalf("Flow2API video maxOutputs = %#v, want 4", flow.Video)
	}
	if len(flow.Video.Duration.Values) != 4 || flow.Video.Resolutions[0] != "720p" {
		t.Fatalf("Flow2API video defaults = %#v", flow.Video)
	}

	grok := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceGrok2APIVideo), "grok-imagine-video")
	if grok.Video == nil || grok.Video.MaxOutputs != 1 || grok.Video.References.MaxImages != 1 {
		t.Fatalf("Grok2API video limits = %#v", grok.Video)
	}
	if len(grok.Video.Resolutions) != 2 || grok.Video.Resolutions[0] != "480p" || grok.Video.Resolutions[1] != "720p" {
		t.Fatalf("Grok2API video resolutions = %#v", grok.Video.Resolutions)
	}

	newGrok := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceGrok2APINewVideo), "Console/grok-imagine-video-1.5")
	if newGrok.Video == nil || newGrok.Video.References.MaxImages != 8 || newGrok.Video.Duration.Min != 1 || newGrok.Video.Duration.Max != 15 || len(newGrok.Video.Resolutions) != 3 {
		t.Fatalf("Grok2API New video limits = %#v", newGrok.Video)
	}

	generic := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceNewAPIChannel2), "seedance-2.0")
	if generic.Video == nil || generic.Video.MaxOutputs != 0 {
		t.Fatalf("generic video maxOutputs = %#v, want zero", generic.Video)
	}
	if generic.Video.Duration.Selection != "range" || len(generic.Video.Duration.Values) != 0 {
		t.Fatalf("generic video duration = %#v", generic.Video.Duration)
	}

	gemini := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceGeminiVeo), "veo-3")
	if gemini.Video == nil || len(gemini.Video.Duration.Values) != 3 || gemini.Video.Resolutions[1] != "1080p" {
		t.Fatalf("Gemini Veo defaults = %#v", gemini.Video)
	}
}

func TestValidateGrok2APIVideoNormalizesLegacySettings(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceGrok2APIVideo), "grok-imagine-video").Video
	if err := validateVideoTask(profile, canvasGenerationInput{
		Mode:   "video",
		Prompt: "make it move",
		Config: providerConfig{InterfaceType: string(model.ChannelInterfaceGrok2APIVideo), Count: "4", VideoSeconds: "7", Size: "1280x720", VQuality: "1080"},
	}); err != nil {
		t.Fatalf("validateVideoTask() rejected legacy Grok2API settings: %v", err)
	}
}

func TestDefaultImageCapabilityConfigScopesSpecialImageLimits(t *testing.T) {
	flow := DefaultImageCapabilityConfig(string(model.ChannelInterfaceFlow2APIImage), "Nano Banana 2")
	if flow.MaxOutputs != 4 || flow.Quality.Default != "1K" || flow.Size.Parameter != "aspect_ratio" {
		t.Fatalf("Flow2API image defaults = %#v", flow)
	}

	grok := DefaultImageCapabilityConfig(string(model.ChannelInterfaceGrok2APIImage), "grok-imagine-image")
	if grok.MaxOutputs != 4 || grok.References.MaxImages != 8 || !grok.Quality.Supported {
		t.Fatalf("Grok2API image defaults = %#v", grok)
	}

	newGrok := DefaultImageCapabilityConfig(string(model.ChannelInterfaceGrok2APINewImage), "Web/grok-imagine-image-quality-2.0")
	if newGrok.MaxOutputs != 10 || newGrok.References.MaxImages != 8 || newGrok.Quality.Default != "1k" || !containsCapabilityString(newGrok.Size.Values, "19.5:9") {
		t.Fatalf("Grok2API New image defaults = %#v", newGrok)
	}

	openAI := DefaultImageCapabilityConfig(string(model.ChannelInterfaceOpenAIImage), "gpt-image-2")
	if openAI.MaxOutputs != 15 || !openAI.TransparentBackground.Supported || !openAI.Size.AllowCustom {
		t.Fatalf("OpenAI image defaults = %#v", openAI)
	}

	zarkImg := DefaultImageCapabilityConfig(string(model.ChannelInterfaceZarkLabImage), "GPT Image 2")
	if zarkImg.MaxOutputs != 10 || zarkImg.References.MaxImages != 8 || !containsCapabilityString(zarkImg.Size.Values, "4:5") {
		t.Fatalf("ZarkLab image defaults = %#v", zarkImg)
	}

	zarkVid := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceZarkLabVideo), "Happy Horse")
	if zarkVid.Video == nil || zarkVid.Video.Duration.Min != 3 || !zarkVid.Video.GenerateAudio.Supported || !containsCapabilityString(zarkVid.Video.Ratios, "4:5") {
		t.Fatalf("ZarkLab video defaults = %#v", zarkVid.Video)
	}
}
