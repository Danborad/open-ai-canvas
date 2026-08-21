package service

import (
	"encoding/json"
	"testing"
)

func TestValidateSyncedPayloadAllowsDataURLMentionInErrorMessage(t *testing.T) {
	raw, err := json.Marshal(map[string]interface{}{
		"nodes": []interface{}{
			map[string]interface{}{
				"metadata": map[string]interface{}{
					"errorDetails": "Expected a base64 image such as data:image/png;base64,aW1n, but received application/octet-stream",
				},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSyncedPayload(raw, "画布"); err != nil {
		t.Fatalf("validateSyncedPayload() error = %v", err)
	}
}

func TestValidateSyncedPayloadRejectsNestedInlineMedia(t *testing.T) {
	for _, content := range []string{
		"data:image/png;base64,aW1n",
		"  DATA:VIDEO/mp4;base64,dmlkZW8=",
		"data:audio/mpeg;base64,YXVkaW8=",
	} {
		raw, err := json.Marshal(map[string]interface{}{
			"nodes": []interface{}{
				map[string]interface{}{"metadata": map[string]interface{}{"content": content}},
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		if err := validateSyncedPayload(raw, "画布"); err == nil {
			t.Fatalf("validateSyncedPayload(%q) error = nil", content)
		}
	}
}

func TestCanvasStatsMediaKind(t *testing.T) {
	tests := []struct {
		taskType  string
		operation string
		want      string
	}{
		{taskType: "canvas_image", operation: "image", want: "image"},
		{taskType: "canvas_video", operation: "image_to_video", want: "video"},
		{taskType: "agent_storyboard", operation: "storyboard", want: ""},
	}
	for _, test := range tests {
		if got := canvasStatsMediaKind(test.taskType, test.operation); got != test.want {
			t.Fatalf("canvasStatsMediaKind(%q, %q) = %q, want %q", test.taskType, test.operation, got, test.want)
		}
	}
}
