package protocol

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestCheckAllManifests(t *testing.T) {
	candidateDirs := []string{"../../plugin-packages", "../../../plugin-packages"}
	for _, dir := range candidateDirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			p := filepath.Join(dir, e.Name(), "manifest.json")
			data, err := os.ReadFile(p)
			if err != nil {
				t.Log("read err", p, err)
				continue
			}
			pkg, err := LoadInstalledProviders(data, nil)
			if err != nil {
				t.Errorf("LOAD ERR for %s: %v", p, err)
			} else {
				fmt.Printf("SUCCESS for %s: %d providers\n", p, len(pkg))
				for _, prov := range pkg {
					fmt.Printf("  - provider: %s (%s)\n", prov.Metadata().ID, prov.Metadata().Name)
				}
			}
		}
		return
	}
}
