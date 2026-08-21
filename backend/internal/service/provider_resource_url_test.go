package service

import (
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"infinite-canvas/backend/internal/model"
)

func TestProviderResourceURLAllowsValidLocalResource(t *testing.T) {
	svc := newResourceTestService(t)
	t.Setenv("CANVAS_PUBLIC_BASE_URL", "https://art.example.com")
	resource := createProviderResourceTestFile(t, svc)
	expiresAt := time.Now().Add(time.Hour)
	value, err := svc.ProviderResourceURL(resource.UserID, resource.ID, expiresAt)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(value)
	if err != nil {
		t.Fatal(err)
	}
	expires, err := strconv.ParseInt(parsed.Query().Get("expires"), 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	stream, err := svc.OpenProviderResourceRange(resource.ID, parsed.Query().Get("user"), expires, parsed.Query().Get("signature"), "")
	if err != nil {
		t.Fatal(err)
	}
	_ = stream.Body.Close()
	if parsed.Scheme != "https" || parsed.Host != "art.example.com" || stream.Resource.ID != resource.ID {
		t.Fatalf("provider resource URL = %q, resource = %#v", value, stream.Resource)
	}
}

func TestProviderResourceURLExpiryStaysWithinPublicValidationWindow(t *testing.T) {
	t.Setenv("CANVAS_PUBLIC_BASE_URL", "https://art.example.com")
	svc := newResourceTestService(t)
	resource := createProviderResourceTestFile(t, svc)
	value, err := svc.ProviderResourceURL(resource.UserID, resource.ID, time.Now().Add(localProviderResourceURLTTL))
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(value)
	if err != nil {
		t.Fatal(err)
	}
	expires, err := strconv.ParseInt(parsed.Query().Get("expires"), 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	if time.Unix(expires, 0).After(time.Now().Add(providerResourceURLMaxTTL)) {
		t.Fatalf("provider resource URL expires beyond validation window: %d", expires)
	}
	if _, err := svc.OpenProviderResourceRange(resource.ID, parsed.Query().Get("user"), expires, parsed.Query().Get("signature"), ""); err != nil {
		t.Fatalf("generated provider resource URL was rejected: %v", err)
	}
}

func TestProviderResourceURLRejectsTamperedAndExpiredSignatures(t *testing.T) {
	svc := newResourceTestService(t)
	resource := createProviderResourceTestFile(t, svc)
	expires := time.Now().Add(time.Hour).Unix()
	signature, err := svc.providerResourceSignature(resource.UserID, resource.ID, expires)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.OpenProviderResourceRange(resource.ID, resource.UserID, expires, signature+"tampered", ""); err == nil {
		t.Fatal("tampered signature was accepted")
	}
	expired := time.Now().Add(-time.Minute).Unix()
	expiredSignature, err := svc.providerResourceSignature(resource.UserID, resource.ID, expired)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.OpenProviderResourceRange(resource.ID, resource.UserID, expired, expiredSignature, ""); err == nil {
		t.Fatal("expired signature was accepted")
	}
}

func TestHydrateProviderMediaUsesTemporaryURLForLocalResource(t *testing.T) {
	svc := newResourceTestService(t)
	t.Setenv("CANVAS_PUBLIC_BASE_URL", "https://art.example.com")
	resource := createProviderResourceTestFile(t, svc)
	media := providerMedia{StorageKey: "resource:" + resource.ID, DataURL: "data:image/png;base64,dGVzdA==", MimeType: "image/png"}
	if err := svc.hydrateProviderMedia(resource.UserID, &media, true); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(media.URL, "https://art.example.com/api/public/provider-resources/") || media.DataURL != "" {
		t.Fatalf("hydrated media = %#v", media)
	}
}

func createProviderResourceTestFile(t *testing.T, svc *Service) model.Resource {
	t.Helper()
	resource := model.Resource{ID: "resource-provider", UserID: "user-1", Kind: "image", Status: model.ResourceStatusReady, Provider: "local", ObjectKey: "users/user-1/image/provider.png", MimeType: "image/png", Size: 4}
	if err := svc.repo.CreateResource(&resource); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(svc.dataDir, "resources", filepath.FromSlash(resource.ObjectKey))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("test"), 0o640); err != nil {
		t.Fatal(err)
	}
	return resource
}
