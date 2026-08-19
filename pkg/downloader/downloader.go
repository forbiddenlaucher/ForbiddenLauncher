package downloader

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type ProgressCallback func(currentFile string, completedBytes, totalBytes int64, percentage float64, speedBytesPerSec float64)

type DownloadItem struct {
	URL            string
	DestPath       string
	ExpectedSHA256 string
	Size           int64
}

type Manager struct {
	client     *http.Client
	maxWorkers int
}

func NewManager(maxWorkers int) *Manager {
	if maxWorkers <= 0 {
		maxWorkers = 6
	}
	return &Manager{
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
		maxWorkers: maxWorkers,
	}
}

func CalculateSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func (m *Manager) DownloadFile(item DownloadItem, onProgress ProgressCallback) error {
	destDir := filepath.Dir(item.DestPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	tempPath := fmt.Sprintf("%s.part_%d", item.DestPath, time.Now().UnixNano())

	req, err := http.NewRequest("GET", item.URL, nil)
	if err != nil {
		return err
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		return fmt.Errorf("código HTTP inesperado: %d para %s", resp.StatusCode, item.URL)
	}

	totalBytes := item.Size
	if totalBytes <= 0 {
		totalBytes = resp.ContentLength
	}

	outFile, err := os.Create(tempPath)
	if err != nil {
		return err
	}

	hasher := sha256.New()
	multiWriter := io.MultiWriter(outFile, hasher)

	buf := make([]byte, 32*1024)
	var downloadedBytes int64 = 0
	lastTime := time.Now()
	var bytesSinceLast int64 = 0
	var currentSpeed float64 = 0

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := multiWriter.Write(buf[:n]); writeErr != nil {
				outFile.Close()
				_ = os.Remove(tempPath)
				return writeErr
			}

			downloadedBytes += int64(n)
			bytesSinceLast += int64(n)

			now := time.Now()
			elapsed := now.Sub(lastTime).Seconds()
			if elapsed >= 0.25 {
				currentSpeed = float64(bytesSinceLast) / elapsed
				lastTime = now
				bytesSinceLast = 0

				var percent float64 = 0
				if totalBytes > 0 {
					percent = (float64(downloadedBytes) / float64(totalBytes)) * 100
				}

				if onProgress != nil {
					onProgress(filepath.Base(item.DestPath), downloadedBytes, totalBytes, percent, currentSpeed)
				}
			}
		}

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			outFile.Close()
			_ = os.Remove(tempPath)
			return readErr
		}
	}

	outFile.Close()

	// Verify SHA-256
	if item.ExpectedSHA256 != "" {
		calculatedHash := hex.EncodeToString(hasher.Sum(nil))
		if !stringsEqualFold(calculatedHash, item.ExpectedSHA256) {
			_ = os.Remove(tempPath)
			return fmt.Errorf("inconsistência de SHA256 para %s. Esperado: %s, Calculado: %s", item.DestPath, item.ExpectedSHA256, calculatedHash)
		}
	}

	// Rename part to final destination
	_ = os.Remove(item.DestPath)
	if err := os.Rename(tempPath, item.DestPath); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	return nil
}

func stringsEqualFold(s1, s2 string) bool {
	return len(s1) == len(s2) && (s1 == s2 || (len(s1) > 0 && hexMatch(s1, s2)))
}

func hexMatch(a, b string) bool {
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'F' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'F' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}

func (m *Manager) DownloadBatch(items []DownloadItem, onOverallProgress func(completed, total int, percent float64, currentFile string, speed float64)) error {
	totalItems := len(items)
	if totalItems == 0 {
		return nil
	}

	var totalBytesSum int64 = 0
	for _, it := range items {
		totalBytesSum += it.Size
	}

	var completedCount int = 0
	var completedBytesSum int64 = 0
	var mu sync.Mutex
	var firstErr error

	itemChan := make(chan DownloadItem, totalItems)
	for _, it := range items {
		itemChan <- it
	}
	close(itemChan)

	var wg sync.WaitGroup
	workers := m.maxWorkers
	if workers > totalItems {
		workers = totalItems
	}

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for it := range itemChan {
				mu.Lock()
				if firstErr != nil {
					mu.Unlock()
					return
				}
				mu.Unlock()

				var lastItemBytes int64 = 0
				err := m.DownloadFile(it, func(currentFile string, completedBytes, totalBytes int64, percentage float64, speedBytesPerSec float64) {
					mu.Lock()
					delta := completedBytes - lastItemBytes
					lastItemBytes = completedBytes
					completedBytesSum += delta

					var overallPercent float64 = 0
					if totalBytesSum > 0 {
						overallPercent = (float64(completedBytesSum) / float64(totalBytesSum)) * 100
					} else {
						overallPercent = (float64(completedCount) / float64(totalItems)) * 100
					}

					if onOverallProgress != nil {
						onOverallProgress(completedCount, totalItems, overallPercent, currentFile, speedBytesPerSec)
					}
					mu.Unlock()
				})

				mu.Lock()
				if err != nil && firstErr == nil {
					firstErr = err
				} else {
					completedCount++
				}
				mu.Unlock()
			}
		}()
	}

	wg.Wait()
	return firstErr
}
