package instance

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"forbidden-launcher/pkg/downloader"
	"forbidden-launcher/pkg/manifest"
)

type InstanceState struct {
	ID             string   `json:"id"`
	InstalledVersion string `json:"installedVersion"`
	LastPlayedAt   string   `json:"lastPlayedAt"`
	TrackedFiles   []string `json:"trackedFiles"`
}

type Manager struct {
	baseDir    string
	downloader *downloader.Manager
}

func NewManager(baseDir string, dl *downloader.Manager) *Manager {
	instancesDir := filepath.Join(baseDir, "instances")
	_ = os.MkdirAll(instancesDir, 0755)
	return &Manager{
		baseDir:    baseDir,
		downloader: dl,
	}
}

func (m *Manager) GetInstanceDir(id string) string {
	return filepath.Join(m.baseDir, "instances", id)
}

func (m *Manager) GetGameDir(id string) string {
	return filepath.Join(m.GetInstanceDir(id), ".minecraft")
}

func (m *Manager) GetState(id string) (*InstanceState, error) {
	statePath := filepath.Join(m.GetInstanceDir(id), "instance.json")
	data, err := os.ReadFile(statePath)
	if err != nil {
		return nil, err
	}
	var state InstanceState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (m *Manager) SaveState(id string, state *InstanceState) error {
	instDir := m.GetInstanceDir(id)
	_ = os.MkdirAll(instDir, 0755)
	statePath := filepath.Join(instDir, "instance.json")
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(statePath, data, 0644)
}

func (m *Manager) CheckStatus(id string, remoteManifest *manifest.InstanceManifest) (bool, bool, []manifest.ManifestFile) {
	state, err := m.GetState(id)
	if err != nil || state == nil || state.InstalledVersion == "" {
		return false, false, remoteManifest.Files
	}

	gameDir := m.GetGameDir(id)
	var deltaFiles []manifest.ManifestFile

	for _, f := range remoteManifest.Files {
		localPath := filepath.Join(gameDir, f.Path)
		stat, err := os.Stat(localPath)
		if err != nil || stat.Size() != f.Size {
			deltaFiles = append(deltaFiles, f)
			continue
		}

		if f.SHA256 != "" {
			hash, err := downloader.CalculateSHA256(localPath)
			if err != nil || !strings.EqualFold(hash, f.SHA256) {
				deltaFiles = append(deltaFiles, f)
			}
		}
	}

	isUpToDate := len(deltaFiles) == 0 && state.InstalledVersion == remoteManifest.Version
	return true, !isUpToDate, deltaFiles
}

func (m *Manager) SyncFiles(id string, targetManifest *manifest.InstanceManifest, onProgress func(msg string, percent float64, speed float64)) error {
	gameDir := m.GetGameDir(id)
	_ = os.MkdirAll(gameDir, 0755)

	var downloadQueue []downloader.DownloadItem
	var newTrackedFiles []string

	for _, f := range targetManifest.Files {
		localPath := filepath.Join(gameDir, f.Path)
		newTrackedFiles = append(newTrackedFiles, f.Path)

		needsDownload := true
		if stat, err := os.Stat(localPath); err == nil && stat.Size() == f.Size {
			if f.SHA256 != "" {
				hash, hashErr := downloader.CalculateSHA256(localPath)
				if hashErr == nil && strings.EqualFold(hash, f.SHA256) {
					needsDownload = false
				}
			}
		}

		if needsDownload {
			downloadQueue = append(downloadQueue, downloader.DownloadItem{
				URL:            f.URL,
				DestPath:       localPath,
				ExpectedSHA256: f.SHA256,
				Size:           f.Size,
			})
		}
	}

	if len(downloadQueue) > 0 {
		if onProgress != nil {
			onProgress(fmt.Sprintf("Baixando %d arquivos atualizados...", len(downloadQueue)), 0, 0)
		}

		err := m.downloader.DownloadBatch(downloadQueue, func(completed, total int, percent float64, currentFile string, speed float64) {
			if onProgress != nil {
				onProgress(fmt.Sprintf("Baixando %s (%d/%d)", currentFile, completed+1, total), percent, speed)
			}
		})
		if err != nil {
			return err
		}
	}

	// Save updated state
	state := &InstanceState{
		ID:               id,
		InstalledVersion: targetManifest.Version,
		TrackedFiles:     newTrackedFiles,
	}
	_ = m.SaveState(id, state)

	// Save copy of manifest
	manifestCopyPath := filepath.Join(m.GetInstanceDir(id), "manifest.json")
	if manifestData, err := json.MarshalIndent(targetManifest, "", "  "); err == nil {
		_ = os.WriteFile(manifestCopyPath, manifestData, 0644)
	}

	return nil
}
