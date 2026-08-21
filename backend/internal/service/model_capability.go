package service

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"infinite-canvas/backend/internal/model"
)

// ModelCapabilityConfig 是模型能力声明，不包含供应商字段名；协议适配器负责把统一参数映射到上游请求。
type ModelCapabilityConfig struct {
	Version int                    `json:"version"`
	Image   *ImageCapabilityConfig `json:"image,omitempty"`
	Video   *VideoCapabilityConfig `json:"video,omitempty"`
}

type ImageCapabilityConfig struct {
	References            ImageReferenceConfig `json:"references"`
	Size                  ImageSizeConfig      `json:"size"`
	Quality               ImageQualityConfig   `json:"quality"`
	TransparentBackground VideoBooleanConfig   `json:"transparentBackground"`
	ResponseFormat        ParameterSupport     `json:"responseFormat"`
	OutputFormat          ParameterSupport     `json:"outputFormat"`
	MaxOutputs            int                  `json:"maxOutputs"`
}

type ImageReferenceConfig struct {
	PromptMaxChars int   `json:"promptMaxChars"`
	MaxImages      int   `json:"maxImages"`
	MaxImageBytes  int64 `json:"maxImageBytes"`
	MaskSupported  bool  `json:"maskSupported"`
}

type ImageSizeConfig struct {
	Parameter   string   `json:"parameter"`
	Values      []string `json:"values"`
	Default     string   `json:"default"`
	AllowCustom bool     `json:"allowCustom"`
}

type ImageQualityConfig struct {
	Supported bool     `json:"supported"`
	Values    []string `json:"values"`
	Default   string   `json:"default"`
}

type ParameterSupport struct {
	Supported bool `json:"supported"`
}

type VideoCapabilityConfig struct {
	References        VideoReferenceConfig `json:"references"`
	Duration          VideoDurationConfig  `json:"duration"`
	Ratios            []string             `json:"ratios"`
	DefaultRatio      string               `json:"defaultRatio"`
	Resolutions       []string             `json:"resolutions"`
	DefaultResolution string               `json:"defaultResolution"`
	GenerateAudio     VideoBooleanConfig   `json:"generateAudio"`
	Watermark         VideoBooleanConfig   `json:"watermark"`
	Operations        []string             `json:"operations"`
	DefaultOperation  string               `json:"defaultOperation"`
	MaxOutputs        int                  `json:"maxOutputs"`
}

type VideoReferenceConfig struct {
	PromptMaxChars   int   `json:"promptMaxChars"`
	MaxImages        int   `json:"maxImages"`
	MaxImageBytes    int64 `json:"maxImageBytes"`
	MaxVideos        int   `json:"maxVideos"`
	MaxVideoBytes    int64 `json:"maxVideoBytes"`
	MaxVideoDuration int   `json:"maxVideoDurationSeconds"`
	MaxAudios        int   `json:"maxAudios"`
	MaxAudioBytes    int64 `json:"maxAudioBytes"`
	MaxAudioDuration int   `json:"maxAudioDurationSeconds"`
}

type VideoDurationConfig struct {
	Selection string `json:"selection"`
	Min       int    `json:"min,omitempty"`
	Max       int    `json:"max,omitempty"`
	Step      int    `json:"step,omitempty"`
	Values    []int  `json:"values,omitempty"`
	Default   int    `json:"default"`
}

type VideoBooleanConfig struct {
	Supported bool `json:"supported"`
	Default   bool `json:"default"`
}

func DefaultModelCapabilityConfig(protocol string) *ModelCapabilityConfig {
	return DefaultModelCapabilityConfigForModel(protocol, "")
}

func DefaultImageCapabilityConfig(protocol string, modelName string) *ImageCapabilityConfig {
	image := &ImageCapabilityConfig{
		References:            ImageReferenceConfig{PromptMaxChars: 32000, MaxImages: 16, MaxImageBytes: 30 * 1024 * 1024, MaskSupported: true},
		Size:                  ImageSizeConfig{Parameter: "size", Values: []string{"1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "21:9", "9:16", "2048x2048", "2048x1152", "1152x2048", "3840x2160", "2160x3840"}, Default: "1:1", AllowCustom: true},
		Quality:               ImageQualityConfig{Supported: true, Values: []string{"auto", "low", "medium", "high"}, Default: "auto"},
		TransparentBackground: VideoBooleanConfig{Supported: true, Default: false},
		ResponseFormat:        ParameterSupport{Supported: true},
		OutputFormat:          ParameterSupport{Supported: true},
		MaxOutputs:            15,
	}
	switch model.ChannelInterfaceType(protocol) {
	case model.ChannelInterfaceGrokImage, model.ChannelInterfaceGrok2APIImage, model.ChannelInterfaceGrok2APINewImage:
		image.References.MaxImages = 1
		image.References.MaskSupported = false
		if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceGrok2APIImage {
			image.References.MaxImages = 8
			image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: []string{"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"}, Default: "16:9", AllowCustom: false}
			image.Quality = ImageQualityConfig{Supported: true, Values: []string{"auto", "medium"}, Default: "auto"}
			image.MaxOutputs = 4
		} else if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceGrok2APINewImage {
			image.References.MaxImages = 8
			image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: []string{"auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"}, Default: "auto", AllowCustom: false}
			image.Quality = ImageQualityConfig{Supported: true, Values: []string{"1k", "2k"}, Default: "1k"}
			image.MaxOutputs = 10
			modelKey := strings.ToLower(strings.TrimSpace(modelName))
			if strings.HasPrefix(modelKey, "console/") {
				image.References.MaxImages = 3
				image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: []string{"auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"}, Default: "auto", AllowCustom: false}
			}
			if strings.HasPrefix(modelKey, "web/") && strings.HasSuffix(modelKey, "-lite") {
				image.References.MaxImages = 0
			}
			if modelKey == "web/grok-imagine-image-lite" {
				image.Size = ImageSizeConfig{Parameter: "none", Values: []string{}, Default: "auto", AllowCustom: false}
				image.Quality = ImageQualityConfig{Supported: false, Values: []string{}, Default: "auto"}
			}
			if modelKey == "web/grok-imagine-image-2.0" || modelKey == "web/grok-imagine-image-edit" {
				image.Quality = ImageQualityConfig{Supported: true, Values: []string{"1k"}, Default: "1k"}
			}
		} else {
			image.Size = ImageSizeConfig{Parameter: "none", Values: []string{}, Default: "auto", AllowCustom: false}
			image.Quality = ImageQualityConfig{Supported: false, Values: []string{}, Default: "auto"}
			image.MaxOutputs = 1
		}
		image.TransparentBackground = VideoBooleanConfig{Supported: false, Default: false}
		image.ResponseFormat = ParameterSupport{Supported: true}
		image.OutputFormat = ParameterSupport{Supported: false}
	case model.ChannelInterfaceZarkLabImage:
		image.References.MaxImages = 8
		image.References.MaskSupported = false
		cleanModel := strings.TrimPrefix(strings.TrimSpace(modelName), "models/")
		standardRatios := []string{"1:1", "4:5", "2:3", "3:2", "9:16", "16:9"}
		switch cleanModel {
		case "Nano Banana 2", "Nano Banana 2 Lite", "Nano Banana Lite":
			image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: append(standardRatios, "4:1", "1:4", "8:1", "1:8"), Default: "1:1", AllowCustom: false}
		case "Grok Image":
			image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: append(standardRatios, "4:3", "3:4"), Default: "1:1", AllowCustom: false}
		default:
			image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: standardRatios, Default: "1:1", AllowCustom: false}
		}
		image.Quality = ImageQualityConfig{Supported: true, Values: []string{"Standard", "High"}, Default: "High"}
		image.TransparentBackground = VideoBooleanConfig{Supported: false, Default: false}
		image.ResponseFormat = ParameterSupport{Supported: false}
		image.OutputFormat = ParameterSupport{Supported: false}
		image.MaxOutputs = 10
	case model.ChannelInterfaceVolcengineArkImage:
		image.References.MaskSupported = false
		image.Quality.Supported = false
		image.TransparentBackground.Supported = false
		image.ResponseFormat.Supported = false
		image.OutputFormat.Supported = false
	case model.ChannelInterfaceVolcengineJiMengImage:
		image.References.MaxImages = 14
		image.References.MaskSupported = false
		image.Quality.Supported = false
		image.TransparentBackground.Supported = false
		image.ResponseFormat.Supported = false
		image.OutputFormat.Supported = false
	}
	if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceFlow2APIImage {
		image.References.MaxImages = 8
		image.References.MaskSupported = false
		image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: []string{"1:1", "16:9", "9:16", "4:3", "3:4"}, Default: "16:9", AllowCustom: false}
		image.Quality = ImageQualityConfig{Supported: true, Values: []string{"1K", "2K"}, Default: "1K"}
		image.TransparentBackground = VideoBooleanConfig{Supported: false, Default: false}
		image.ResponseFormat = ParameterSupport{Supported: false}
		image.OutputFormat = ParameterSupport{Supported: false}
		image.MaxOutputs = 4
	}
	if model.ChannelInterfaceType(protocol) != model.ChannelInterfaceGrokImage && model.ChannelInterfaceType(protocol) != model.ChannelInterfaceGrok2APIImage && model.ChannelInterfaceType(protocol) != model.ChannelInterfaceGrok2APINewImage && strings.HasPrefix(strings.ToLower(strings.TrimSpace(modelName)), "grok-imagine-image") {
		image.References.MaxImages = 0
		image.References.MaskSupported = false
		image.Size = ImageSizeConfig{Parameter: "none", Values: []string{}, Default: "auto", AllowCustom: false}
		image.Quality = ImageQualityConfig{Supported: false, Values: []string{}, Default: "auto"}
		image.TransparentBackground = VideoBooleanConfig{Supported: false, Default: false}
		image.ResponseFormat = ParameterSupport{Supported: true}
		image.OutputFormat = ParameterSupport{Supported: false}
		image.MaxOutputs = 1
	}
	return image
}

func DefaultModelCapabilityConfigForModel(protocol string, modelName string) *ModelCapabilityConfig {
	video := &VideoCapabilityConfig{
		References:        VideoReferenceConfig{PromptMaxChars: 1000, MaxImages: 9, MaxImageBytes: 30 * 1024 * 1024, MaxVideos: 0, MaxVideoBytes: 0, MaxVideoDuration: 0, MaxAudios: 0, MaxAudioBytes: 0, MaxAudioDuration: 0},
		Duration:          VideoDurationConfig{Selection: "range", Min: 1, Max: 15, Step: 1, Default: 6},
		Ratios:            []string{"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"},
		DefaultRatio:      "16:9",
		Resolutions:       []string{"480p", "720p", "1080p", "2160p"},
		DefaultResolution: "720p",
		GenerateAudio:     VideoBooleanConfig{Supported: false, Default: false},
		Watermark:         VideoBooleanConfig{Supported: false, Default: false},
		Operations:        []string{"text_to_video", "image_to_video"},
		DefaultOperation:  "text_to_video",
	}
	switch model.ChannelInterfaceType(protocol) {
	case model.ChannelInterfaceVolcengineJiMengVideo:
		video.Duration = VideoDurationConfig{Selection: "enum", Values: []int{5, 10}, Default: 5}
		video.Resolutions = []string{"720p"}
	case model.ChannelInterfaceGeminiVeo:
		video.Duration = VideoDurationConfig{Selection: "enum", Values: []int{4, 6, 8}, Default: 6}
		video.Resolutions = []string{"720p", "1080p"}
	case model.ChannelInterfaceVolcengineArkVideo:
		video.References.MaxVideos, video.References.MaxAudios = 3, 3
		video.References.MaxVideoBytes, video.References.MaxAudioBytes = 200*1024*1024, 15*1024*1024
		video.References.MaxVideoDuration, video.References.MaxAudioDuration = 15, 15
		video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		video.Watermark = VideoBooleanConfig{Supported: true, Default: false}
	case model.ChannelInterfaceNewAPIChannel1, model.ChannelInterfaceNewAPIChannel2:
		video.References.MaxVideos, video.References.MaxAudios = 3, 3
		video.References.MaxVideoBytes, video.References.MaxAudioBytes = 200*1024*1024, 15*1024*1024
		video.References.MaxVideoDuration, video.References.MaxAudioDuration = 15, 15
		video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
	case model.ChannelInterfaceNewAPIVideo, model.ChannelInterfaceXAIVideo:
		video.GenerateAudio = VideoBooleanConfig{Supported: false, Default: false}
	}
	if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceFlow2APIVideo {
		video.Duration = VideoDurationConfig{Selection: "enum", Values: []int{4, 6, 8, 10}, Default: 6}
		video.Ratios = []string{"16:9", "9:16"}
		video.Resolutions = []string{"720p", "1080p"}
		video.MaxOutputs = 4
	}
	if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceGrok2APIVideo {
		video.Duration = VideoDurationConfig{Selection: "enum", Values: []int{6, 10, 15}, Default: 6}
		video.Ratios = []string{"16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"}
		video.Resolutions = []string{"480p", "720p"}
		video.References.MaxImages = 1
		video.MaxOutputs = 1
	}
	if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceGrok2APINewVideo {
		video.Duration = VideoDurationConfig{Selection: "range", Min: 1, Max: 15, Step: 1, Default: 8}
		video.Ratios = []string{"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"}
		video.Resolutions = []string{"480p", "720p", "1080p"}
		video.References.MaxImages = 8
		video.MaxOutputs = 0
		if strings.EqualFold(strings.TrimSpace(modelName), "Console/grok-imagine-video") {
			video.Resolutions = []string{"480p", "720p"}
		}
	}
	if model.ChannelInterfaceType(protocol) == model.ChannelInterfaceZarkLabVideo {
		video.Operations = []string{"text_to_video", "image_to_video"}
		video.References.MaxImages = 8
		video.MaxOutputs = 0
		cleanModel := strings.TrimPrefix(strings.TrimSpace(modelName), "models/")
		switch cleanModel {
		case "Gemini Omni Flash":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 10, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "9:16"}
			video.Resolutions = []string{"720p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: false, Default: false}
		case "Seedance 2.5":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 4, Max: 30, Step: 1, Default: 6}
			video.Ratios = []string{"auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"}
			video.Resolutions = []string{"480p", "720p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Seedance 2":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 4, Max: 15, Step: 1, Default: 6}
			video.Ratios = []string{"auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"}
			video.Resolutions = []string{"480p", "720p", "1080p", "4K"}
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Seedance 2 Lite", "Seedance 2 Mini":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 4, Max: 15, Step: 1, Default: 6}
			video.Ratios = []string{"auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"}
			video.Resolutions = []string{"480p", "720p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Kling O3 4K":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "1:1", "9:16"}
			video.Resolutions = []string{"4K"}
			video.DefaultResolution = "4K"
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Kling O3 Pro", "Kling 3.0 Turbo":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "1:1", "9:16"}
			video.Resolutions = []string{"1080p"}
			video.DefaultResolution = "1080p"
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Kling 3.0 Lite":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "1:1", "9:16"}
			video.Resolutions = []string{"720p", "1080p"}
			video.DefaultResolution = "720p"
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Veo 3.1", "Veo 3.1 Fast", "Veo 3.1 Lite":
			video.Duration = VideoDurationConfig{Selection: "enum", Values: []int{4, 6, 8}, Default: 6}
			video.Ratios = []string{"auto", "16:9", "9:16"}
			video.Resolutions = []string{"720p", "1080p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		case "Grok Video":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 4, Max: 10, Step: 1, Default: 6}
			video.Ratios = []string{"auto", "16:9", "4:3", "1:1", "3:4", "9:16"}
			video.Resolutions = []string{"480p", "720p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: false, Default: false}
		case "MiniMax H3":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 5, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "21:9", "4:3", "1:1", "3:4", "9:16"}
			video.Resolutions = []string{"768p", "2K", "4K"}
			video.DefaultResolution = "768p"
			video.GenerateAudio = VideoBooleanConfig{Supported: false, Default: false}
		case "Happy Horse":
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "21:9", "4:3", "1:1", "3:4", "4:5", "5:4", "9:16", "9:21"}
			video.Resolutions = []string{"720p", "1080p"}
			video.DefaultResolution = "720p"
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		default:
			video.Duration = VideoDurationConfig{Selection: "range", Min: 3, Max: 15, Step: 1, Default: 5}
			video.Ratios = []string{"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"}
			video.Resolutions = []string{"720p", "1080p"}
			video.GenerateAudio = VideoBooleanConfig{Supported: true, Default: true}
		}
	}
	return &ModelCapabilityConfig{Version: 1, Image: DefaultImageCapabilityConfig(protocol, modelName), Video: video}
}

func DecodeModelCapabilityConfig(raw string) (*ModelCapabilityConfig, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var value ModelCapabilityConfig
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func NormalizeModelCapabilityConfig(capability string, _ string, input *ModelCapabilityConfig) (*ModelCapabilityConfig, error) {
	if capability != "image" && capability != "video" {
		return nil, nil
	}
	if capability == "image" {
		if input == nil || input.Image == nil {
			return nil, BadAuthRequest("请配置图片模型能力参数")
		}
		value := &ModelCapabilityConfig{Version: 1, Image: input.Image}
		if err := validateImageCapabilityConfig(value.Image); err != nil {
			return nil, err
		}
		return value, nil
	}
	if input == nil || input.Video == nil {
		return nil, BadAuthRequest("请配置视频模型能力参数")
	}
	value := &ModelCapabilityConfig{Version: 1, Video: input.Video}
	if err := validateVideoCapabilityConfig(value.Video); err != nil {
		return nil, err
	}
	return value, nil
}

func validateImageCapabilityConfig(value *ImageCapabilityConfig) error {
	if value.References.PromptMaxChars < 1 || value.References.PromptMaxChars > 1000000 {
		return BadAuthRequest("提示词最大字符数必须在 1-1000000 之间")
	}
	if value.References.MaxImages < 0 || value.References.MaxImages > 100 || value.References.MaxImageBytes < 0 {
		return BadAuthRequest("图片引用限制无效")
	}
	if value.MaxOutputs < 1 || value.MaxOutputs > 100 {
		return BadAuthRequest("单次图片数量必须在 1-100 之间")
	}
	switch value.Size.Parameter {
	case "none":
		value.Size.Values = []string{}
		value.Size.Default = "auto"
		value.Size.AllowCustom = false
	case "size", "aspect_ratio":
		if strings.TrimSpace(value.Size.Default) == "" {
			return BadAuthRequest("请配置默认图片尺寸或比例")
		}
		if !value.Size.AllowCustom && !containsCapabilityString(value.Size.Values, value.Size.Default) {
			return BadAuthRequest("默认图片尺寸必须属于支持值")
		}
	default:
		return BadAuthRequest("尺寸参数仅支持不发送、size 或 aspect_ratio")
	}
	if value.Quality.Supported {
		if len(value.Quality.Values) == 0 || strings.TrimSpace(value.Quality.Default) == "" || !containsCapabilityString(value.Quality.Values, value.Quality.Default) {
			return BadAuthRequest("请配置图片质量支持值和默认值")
		}
	} else {
		value.Quality.Values = []string{}
		value.Quality.Default = "auto"
	}
	if !value.TransparentBackground.Supported {
		value.TransparentBackground.Default = false
	}
	return nil
}

func validateVideoCapabilityConfig(value *VideoCapabilityConfig) error {
	if value.References.PromptMaxChars < 1 || value.References.PromptMaxChars > 1000000 {
		return BadAuthRequest("提示词最大字符数必须在 1-1000000 之间")
	}
	for name, number := range map[string]int{"最大图片引用数": value.References.MaxImages, "最大视频引用数": value.References.MaxVideos, "最大音频引用数": value.References.MaxAudios} {
		if number < 0 || number > 100 {
			return BadAuthRequest(name + "必须在 0-100 之间")
		}
	}
	if value.References.MaxImageBytes < 0 || value.References.MaxVideoBytes < 0 || value.References.MaxAudioBytes < 0 || value.References.MaxVideoDuration < 0 || value.References.MaxAudioDuration < 0 {
		return BadAuthRequest("引用素材限制不能小于 0")
	}
	if err := validateVideoDuration(value.Duration); err != nil {
		return err
	}
	if len(value.Ratios) == 0 || strings.TrimSpace(value.DefaultRatio) == "" || !containsCapabilityString(value.Ratios, value.DefaultRatio) {
		return BadAuthRequest("请至少配置一个画面比例，并选择默认比例")
	}
	if len(value.Resolutions) == 0 || strings.TrimSpace(value.DefaultResolution) == "" || !containsCapabilityString(value.Resolutions, value.DefaultResolution) {
		return BadAuthRequest("请至少配置一个输出分辨率，并选择默认分辨率")
	}
	if len(value.Operations) == 0 || strings.TrimSpace(value.DefaultOperation) == "" || !containsCapabilityString(value.Operations, value.DefaultOperation) {
		return BadAuthRequest("请至少配置一个生成模式，并选择默认模式")
	}
	return nil
}

func validateVideoDuration(value VideoDurationConfig) error {
	switch value.Selection {
	case "range":
		if value.Min < 1 || value.Max < value.Min || value.Max > 3600 || value.Step < 1 || value.Default < value.Min || value.Default > value.Max || (value.Default-value.Min)%value.Step != 0 {
			return BadAuthRequest("视频时长范围或默认值无效")
		}
	case "enum":
		if len(value.Values) == 0 || len(value.Values) > 100 {
			return BadAuthRequest("视频固定时长至少需要一个选项")
		}
		values := append([]int(nil), value.Values...)
		sort.Ints(values)
		for index, item := range values {
			if item < 1 || item > 3600 || (index > 0 && values[index-1] == item) {
				return BadAuthRequest("视频固定时长选项无效或重复")
			}
		}
		if !containsInt(values, value.Default) {
			return BadAuthRequest("视频默认时长必须属于固定时长选项")
		}
	default:
		return BadAuthRequest("视频时长选择方式仅支持范围或固定值")
	}
	return nil
}

func (s *Service) ValidateTaskCapability(input map[string]any) error {
	encoded, err := json.Marshal(input)
	if err != nil {
		return BadAuthRequest("任务输入格式无效")
	}
	var taskInput canvasGenerationInput
	if err := json.Unmarshal(encoded, &taskInput); err != nil || (taskInput.Mode != "image" && taskInput.Mode != "video") {
		return nil
	}
	channelID := strings.TrimSpace(taskInput.Config.ChannelID)
	if channelID == "" {
		channelID = systemChannelIDFromBaseURL(taskInput.Config.BaseURL)
	}
	if channelID == "" {
		if taskInput.Mode == "image" {
			profile := DefaultImageCapabilityConfig(taskInput.Config.InterfaceType, taskInput.Config.Model)
			if taskInput.Config.CapabilityConfig != nil && taskInput.Config.CapabilityConfig.Image != nil {
				profile = taskInput.Config.CapabilityConfig.Image
			}
			return validateImageTask(profile, taskInput)
		}
		if taskInput.Config.CapabilityConfig == nil || taskInput.Config.CapabilityConfig.Video == nil {
			return nil
		}
		return validateVideoTask(taskInput.Config.CapabilityConfig.Video, taskInput)
	}
	item, err := s.repo.ChannelModelByKey(channelID, strings.TrimPrefix(strings.TrimSpace(taskInput.Config.Model), "models/"))
	if err != nil {
		return BadAuthRequest("当前系统渠道模型未配置或已停用")
	}
	profile, err := DecodeModelCapabilityConfig(item.CapabilityConfigJSON)
	if taskInput.Mode == "image" {
		if err != nil {
			return BadAuthRequest("当前图片模型能力参数无效")
		}
		imageProfile := DefaultImageCapabilityConfig(string(item.Protocol), item.ModelKey)
		if profile != nil && profile.Image != nil {
			imageProfile = profile.Image
		}
		return validateImageTask(imageProfile, taskInput)
	}
	if taskInput.Mode == "video" {
		videoProfile := DefaultModelCapabilityConfigForModel(string(item.Protocol), item.ModelKey).Video
		if item.Protocol == model.ChannelInterfaceFlow2APIVideo && !flow2APIVideoSupportsDuration(item.ModelKey) {
			videoProfile.Duration = VideoDurationConfig{Selection: "enum", Values: []int{}, Default: 6}
		}
		if item.Protocol == model.ChannelInterfaceFlow2APIVideo || item.Protocol == model.ChannelInterfaceGrok2APIVideo || item.Protocol == model.ChannelInterfaceGrok2APINewVideo {
			if profile != nil && profile.Video != nil {
				videoProfile = profile.Video
			}
			return validateVideoTask(videoProfile, taskInput)
		}
	}
	if err != nil || profile == nil || profile.Video == nil {
		return BadAuthRequest("当前视频模型尚未配置能力参数")
	}
	return validateVideoTask(profile.Video, taskInput)
}

func validateVideoTask(profile *VideoCapabilityConfig, input canvasGenerationInput) error {
	if utf8.RuneCountInString(input.Prompt) > profile.References.PromptMaxChars {
		return BadAuthRequest(fmt.Sprintf("提示词超过当前模型限制（最多 %d 字）", profile.References.PromptMaxChars))
	}
	if len(input.ReferenceImages) > profile.References.MaxImages || len(input.ReferenceVideos) > profile.References.MaxVideos || len(input.ReferenceAudios) > profile.References.MaxAudios {
		return BadAuthRequest("参考素材数量超过当前模型限制")
	}
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewVideo) && strings.EqualFold(strings.TrimSpace(input.Config.Model), "Console/grok-imagine-video") && len(input.ReferenceImages) > 0 {
		seconds, err := strconv.Atoi(strings.TrimSpace(input.Config.VideoSeconds))
		if err == nil && seconds > 10 {
			return BadAuthRequest("Console 基础视频使用参考图时最长支持 10 秒")
		}
	}
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewVideo) && strings.EqualFold(strings.TrimSpace(input.Config.Model), "Console/grok-imagine-video-1.5") && len(input.ReferenceImages) > 0 {
		seconds, err := strconv.Atoi(strings.TrimSpace(input.Config.VideoSeconds))
		if err == nil && seconds > 7 {
			return BadAuthRequest("Console Video 1.5 使用参考图时最长支持 7 秒")
		}
	}
	for _, media := range input.ReferenceImages {
		if profile.References.MaxImageBytes > 0 && media.Bytes > profile.References.MaxImageBytes {
			return BadAuthRequest("参考图片文件超过当前模型大小限制")
		}
	}
	for _, media := range input.ReferenceVideos {
		if profile.References.MaxVideoBytes > 0 && media.Bytes > profile.References.MaxVideoBytes {
			return BadAuthRequest("参考视频文件超过当前模型大小限制")
		}
		if profile.References.MaxVideoDuration > 0 && media.DurationMs > int64(profile.References.MaxVideoDuration)*1000 {
			return BadAuthRequest("参考视频时长超过当前模型限制")
		}
	}
	for _, media := range input.ReferenceAudios {
		if profile.References.MaxAudioBytes > 0 && media.Bytes > profile.References.MaxAudioBytes {
			return BadAuthRequest("参考音频文件超过当前模型大小限制")
		}
		if profile.References.MaxAudioDuration > 0 && media.DurationMs > int64(profile.References.MaxAudioDuration)*1000 {
			return BadAuthRequest("参考音频时长超过当前模型限制")
		}
	}
	if len(profile.Duration.Values) > 0 || profile.Duration.Selection != "enum" {
		secondsValue := strings.TrimSpace(input.Config.VideoSeconds)
		if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APIVideo) {
			seconds := normalizeGrok2APIVideoDuration(secondsValue)
			if !videoDurationAllowed(profile.Duration, seconds) {
				return BadAuthRequest("视频时长不在当前模型支持范围内")
			}
		} else if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewVideo) {
			seconds := normalizeGrok2APINewVideoDuration(secondsValue)
			if !videoDurationAllowed(profile.Duration, seconds) {
				return BadAuthRequest("视频时长不在当前模型支持范围内")
			}
		} else {
			seconds, err := strconv.Atoi(secondsValue)
			if err != nil || !videoDurationAllowed(profile.Duration, seconds) {
				return BadAuthRequest("视频时长不在当前模型支持范围内")
			}
		}
	}
	if profile.MaxOutputs > 0 && input.Config.InterfaceType != string(model.ChannelInterfaceGrok2APIVideo) && input.Config.InterfaceType != string(model.ChannelInterfaceGrok2APINewVideo) {
		count, err := strconv.Atoi(strings.TrimSpace(input.Config.Count))
		if err == nil && count > profile.MaxOutputs {
			return BadAuthRequest(fmt.Sprintf("当前视频模型单次最多生成 %d 个视频", profile.MaxOutputs))
		}
	}
	ratio := input.Config.Size
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APIVideo) || input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewVideo) {
		ratio = normalizeGrok2APIVideoAspect(ratio)
	}
	if ratio != "" && !videoRatioAllowed(profile.Ratios, ratio) {
		return BadAuthRequest("画面比例不在当前模型支持范围内")
	}
	resolution := normalizeResolution(input.Config.VQuality)
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APIVideo) {
		resolution = normalizeGrok2APIVideoResolution(input.Config.VQuality)
	} else if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewVideo) {
		resolution = normalizeGrok2APINewVideoResolution(input.Config.Model, input.Config.VQuality)
	}
	if input.Config.VQuality != "" && !containsCapabilityString(profile.Resolutions, resolution) {
		return BadAuthRequest("输出分辨率不在当前模型支持范围内")
	}
	operation := metadataString(input.Metadata, "videoEditOperation")
	if operation == "" {
		if len(input.ReferenceImages) > 0 {
			operation = "image_to_video"
		} else {
			operation = profile.DefaultOperation
		}
	}
	if !containsCapabilityString(profile.Operations, operation) {
		return BadAuthRequest("当前视频模型不支持该生成模式")
	}
	return nil
}

func validateImageTask(profile *ImageCapabilityConfig, input canvasGenerationInput) error {
	if profile == nil {
		return nil
	}
	if utf8.RuneCountInString(input.Prompt) > profile.References.PromptMaxChars {
		return BadAuthRequest(fmt.Sprintf("提示词超过当前模型限制（最多 %d 字）", profile.References.PromptMaxChars))
	}
	if len(input.ReferenceImages) > profile.References.MaxImages {
		return BadAuthRequest(fmt.Sprintf("当前图片模型最多支持 %d 张参考图", profile.References.MaxImages))
	}
	for _, media := range input.ReferenceImages {
		if profile.References.MaxImageBytes > 0 && media.Bytes > profile.References.MaxImageBytes {
			return BadAuthRequest("参考图片文件超过当前模型大小限制")
		}
	}
	if input.Mask != nil && !profile.References.MaskSupported {
		return BadAuthRequest("当前图片模型不支持蒙版编辑")
	}
	imageSize := strings.TrimSpace(input.Config.Size)
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewImage) {
		imageSize = normalizeGrok2APIImageAspectRatio(imageSize)
	}
	if profile.Size.Parameter != "none" && !profile.Size.AllowCustom && imageSize != "" && !containsCapabilityString(profile.Size.Values, imageSize) {
		return BadAuthRequest("图片尺寸不在当前模型支持范围内")
	}
	quality := strings.TrimSpace(input.Config.Quality)
	if input.Config.InterfaceType == string(model.ChannelInterfaceGrok2APINewImage) {
		quality = normalizeGrok2APINewImageResolution(input.Config.Model, quality, len(input.ReferenceImages) > 0)
	}
	if profile.Quality.Supported && quality != "" && !containsCapabilityString(profile.Quality.Values, quality) {
		return BadAuthRequest("图片质量不在当前模型支持范围内")
	}
	count, err := strconv.Atoi(strings.TrimSpace(input.Config.Count))
	if err == nil && count > profile.MaxOutputs {
		return BadAuthRequest(fmt.Sprintf("当前图片模型单次最多生成 %d 张", profile.MaxOutputs))
	}
	return nil
}

func videoDurationAllowed(value VideoDurationConfig, seconds int) bool {
	if value.Selection == "enum" {
		return containsInt(value.Values, seconds)
	}
	return seconds >= value.Min && seconds <= value.Max && value.Step > 0 && (seconds-value.Min)%value.Step == 0
}

func videoRatioAllowed(options []string, value string) bool {
	value = strings.TrimSpace(strings.ToLower(strings.ReplaceAll(value, "×", "x")))
	if containsCapabilityString(options, value) {
		return true
	}
	parts := strings.Split(value, "x")
	if len(parts) != 2 {
		return false
	}
	width, widthErr := strconv.ParseFloat(parts[0], 64)
	height, heightErr := strconv.ParseFloat(parts[1], 64)
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return false
	}
	actual := width / height
	for _, option := range options {
		candidate := ratioValue(option)
		if candidate > 0 && absFloat(candidate-actual)/candidate < 0.01 {
			return true
		}
	}
	return false
}

func ratioValue(value string) float64 {
	parts := strings.Split(strings.TrimSpace(value), ":")
	if len(parts) != 2 {
		return 0
	}
	width, widthErr := strconv.ParseFloat(parts[0], 64)
	height, heightErr := strconv.ParseFloat(parts[1], 64)
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0
	}
	return width / height
}

func normalizeResolution(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.TrimSuffix(value, "p")
	if value == "4k" {
		return "2160p"
	}
	return value + "p"
}

func containsCapabilityString(values []string, target string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(target)) {
			return true
		}
	}
	return false
}

func containsInt(values []int, target int) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func absFloat(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}
