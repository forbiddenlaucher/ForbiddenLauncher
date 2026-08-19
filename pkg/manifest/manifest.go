package manifest

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type LoaderInfo struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

type MinecraftInfo struct {
	Version string     `json:"version"`
	Loader  LoaderInfo `json:"loader"`
}

type JavaInfo struct {
	MajorVersion int    `json:"majorVersion"`
	Distribution string `json:"distribution"`
	URL          string `json:"url"`
	SHA256       string `json:"sha256"`
}

type MemoryInfo struct {
	RecommendedMb int `json:"recommendedMb"`
	MinimumMb     int `json:"minimumMb"`
}

type ServerInfo struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Port    int    `json:"port"`
}

type ManifestFile struct {
	Path   string `json:"path"`
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type InstanceManifest struct {
	SchemaVersion int            `json:"schemaVersion"`
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Version       string         `json:"version"`
	Minecraft     MinecraftInfo  `json:"minecraft"`
	Java          JavaInfo       `json:"java"`
	Memory        MemoryInfo     `json:"memory"`
	Server        ServerInfo     `json:"server"`
	Files         []ManifestFile `json:"files"`
}

func ValidateFilePath(relPath string) error {
	clean := filepath.Clean(relPath)
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) || strings.Contains(clean, ":") {
		return fmt.Errorf("caminho de arquivo inválido ou inseguro: %s", relPath)
	}
	return nil
}

func LoadRemote(url string) (*InstanceManifest, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("código HTTP %d ao buscar manifesto de %s", resp.StatusCode, url)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return Parse(data)
}

func LoadFile(filePath string) (*InstanceManifest, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	return Parse(data)
}

func Parse(data []byte) (*InstanceManifest, error) {
	var m InstanceManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}

	if m.ID == "" || m.Version == "" {
		return nil, errors.New("manifesto inválido: ID ou Version ausentes")
	}

	for _, f := range m.Files {
		if err := ValidateFilePath(f.Path); err != nil {
			return nil, err
		}
	}

	return &m, nil
}
