package runtime

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"forbidden-launcher/pkg/downloader"
)

type Manager struct {
	baseDir    string
	downloader *downloader.Manager
}

func NewManager(baseDir string, dl *downloader.Manager) *Manager {
	runtimesDir := filepath.Join(baseDir, "runtimes")
	_ = os.MkdirAll(runtimesDir, 0755)
	return &Manager{
		baseDir:    baseDir,
		downloader: dl,
	}
}

func (m *Manager) GetJavaExecutableName() string {
	if runtime.GOOS == "windows" {
		return "java.exe"
	}
	return "java"
}

func (m *Manager) GetRuntimePath(majorVersion int) string {
	folder := fmt.Sprintf("java-%d", majorVersion)
	return filepath.Join(m.baseDir, "runtimes", folder)
}

func (m *Manager) EnsureJava(majorVersion int, dlURL string, onProgress func(msg string, percent float64)) (string, error) {
	runtimeFolder := m.GetRuntimePath(majorVersion)
	exeName := m.GetJavaExecutableName()
	targetExe := filepath.Join(runtimeFolder, "bin", exeName)

	if _, err := os.Stat(targetExe); err == nil {
		return targetExe, nil
	}

	// Try finding system java of matching version
	systemJava := m.findSystemJava(majorVersion)
	if systemJava != "" {
		return systemJava, nil
	}

	// Download Temurin JRE
	if dlURL == "" {
		dlURL = fmt.Sprintf("https://api.adoptium.net/v3/binary/latest/%d/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk", majorVersion)
	}

	zipTemp := filepath.Join(m.baseDir, "runtimes", fmt.Sprintf("temp_java_%d.zip", majorVersion))
	if onProgress != nil {
		onProgress(fmt.Sprintf("Baixando Java %d (Adoptium Temurin 64-bit)...", majorVersion), 10)
	}

	item := downloader.DownloadItem{
		URL:      dlURL,
		DestPath: zipTemp,
	}

	err := m.downloader.DownloadFile(item, func(currentFile string, completedBytes, totalBytes int64, percentage float64, speed float64) {
		if onProgress != nil {
			onProgress(fmt.Sprintf("Baixando Java %d: %.1f MB / %.1f MB", majorVersion, float64(completedBytes)/(1024*1024), float64(totalBytes)/(1024*1024)), percentage*0.8)
		}
	})
	if err != nil {
		return "", err
	}

	if onProgress != nil {
		onProgress(fmt.Sprintf("Extraindo ambiente Java %d...", majorVersion), 85)
	}

	tempExtract := filepath.Join(m.baseDir, "runtimes", fmt.Sprintf("extract_%d", majorVersion))
	_ = os.RemoveAll(tempExtract)
	if err := unzip(zipTemp, tempExtract); err != nil {
		_ = os.Remove(zipTemp)
		return "", err
	}

	// Find the root folder inside zip (e.g. jdk-21.0.2+13-jre)
	entries, _ := os.ReadDir(tempExtract)
	var rootFolder string
	for _, e := range entries {
		if e.IsDir() && fileExists(filepath.Join(tempExtract, e.Name(), "bin", exeName)) {
			rootFolder = filepath.Join(tempExtract, e.Name())
			break
		}
	}
	if rootFolder == "" && len(entries) > 0 {
		rootFolder = filepath.Join(tempExtract, entries[0].Name())
	}

	_ = os.RemoveAll(runtimeFolder)
	_ = os.MkdirAll(filepath.Dir(runtimeFolder), 0755)

	if err := os.Rename(rootFolder, runtimeFolder); err != nil {
		// Fallback copy if rename across volumes fails
		_ = os.RemoveAll(tempExtract)
		_ = os.Remove(zipTemp)
		return "", err
	}

	_ = os.RemoveAll(tempExtract)
	_ = os.Remove(zipTemp)

	if onProgress != nil {
		onProgress(fmt.Sprintf("Java %d configurado com sucesso.", majorVersion), 100)
	}

	return targetExe, nil
}

func (m *Manager) findSystemJava(majorVersion int) string {
	exeName := m.GetJavaExecutableName()
	var candidates []string

	if runtime.GOOS == "windows" {
		candidates = append(candidates,
			fmt.Sprintf("C:\\Program Files\\Java\\jre1.8.0_351\\bin\\%s", exeName),
			fmt.Sprintf("C:\\Program Files\\Eclipse Adoptium\\jdk-%d-hotspot\\bin\\%s", majorVersion, exeName),
			fmt.Sprintf("C:\\Program Files\\Eclipse Adoptium\\jre-%d-hotspot\\bin\\%s", majorVersion, exeName),
		)
	}

	for _, cand := range candidates {
		if fileExists(cand) {
			return cand
		}
	}
	return ""
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			return errors.New("arquivo zip com caminho inválido")
		}

		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err = os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
