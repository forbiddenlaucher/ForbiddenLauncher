package catalog

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type MemoryConfig struct {
	RecommendedMb int `json:"recommendedMb"`
	MinimumMb     int `json:"minimumMb"`
}

type ServerConfig struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Port    int    `json:"port"`
}

type FeaturedMod struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

type ModpackEntry struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	MinecraftVersion string        `json:"minecraftVersion"`
	Loader           string        `json:"loader"`
	LoaderVersion    string        `json:"loaderVersion"`
	LatestVersion    string        `json:"latestVersion"`
	TotalModsCount   int           `json:"totalModsCount"`
	Tagline          string        `json:"tagline"`
	Theme            string        `json:"theme"`
	JavaMajorVersion int           `json:"javaMajorVersion"`
	Memory           MemoryConfig  `json:"memory"`
	Server           ServerConfig  `json:"server"`
	ManifestURL      string        `json:"manifestUrl"`
	FeaturedMods     []FeaturedMod `json:"featuredMods"`
}

type Catalog struct {
	SchemaVersion int            `json:"schemaVersion"`
	GeneratedAt   string         `json:"generatedAt"`
	Modpacks      []ModpackEntry `json:"modpacks"`
}

type Service struct {
	cachePath string
}

func NewService(baseDir string) *Service {
	cacheDir := filepath.Join(baseDir, "cache")
	_ = os.MkdirAll(cacheDir, 0755)
	return &Service{
		cachePath: filepath.Join(cacheDir, "catalog.json"),
	}
}

func (s *Service) Load(remoteURL string) (*Catalog, error) {
	// Try fetching remote catalog
	if remoteURL != "" {
		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Get(remoteURL)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			data, readErr := io.ReadAll(resp.Body)
			if readErr == nil {
				var cat Catalog
				if jsonErr := json.Unmarshal(data, &cat); jsonErr == nil {
					_ = os.WriteFile(s.cachePath, data, 0644)
					return &cat, nil
				}
			}
		}
	}

	// Fallback to local cache
	if data, err := os.ReadFile(s.cachePath); err == nil {
		var cat Catalog
		if err := json.Unmarshal(data, &cat); err == nil {
			return &cat, nil
		}
	}

	// Fallback embedded default
	return s.getDefaultCatalog(), nil
}

func (s *Service) getDefaultCatalog() *Catalog {
	return &Catalog{
		SchemaVersion: 1,
		GeneratedAt:   time.Now().Format(time.RFC3339),
		Modpacks: []ModpackEntry{
			{
				ID:               "forbidden-requiem",
				Name:             "Forbidden Requiem",
				MinecraftVersion: "1.7.10",
				Loader:           "forge",
				LoaderVersion:    "10.13.4.1614",
				LatestVersion:    "1.0.0",
				TotalModsCount:   84,
				Tagline:          "Comece sua jornada em uma terra de dark fantasy, com os grandes mods da era de ouro do Minecraft 1.7.10.",
				Theme:            "dark-fantasy",
				JavaMajorVersion: 8,
				Memory:           MemoryConfig{RecommendedMb: 4096, MinimumMb: 2048},
				Server:           ServerConfig{Name: "Forbidden Requiem", Address: "play.forbiddenrequiem.com", Port: 25565},
			},
			{
				ID:               "atm10",
				Name:             "All the Mods 10 (ATM10)",
				MinecraftVersion: "1.21.1",
				Loader:           "neoforge",
				LoaderVersion:    "21.1.65",
				LatestVersion:    "10.0.0",
				TotalModsCount:   380,
				Tagline:          "Explore, automatize e avance até conquistar a ATM Star — um objetivo que exige dominar quase todos os mods.",
				Theme:            "atm10",
				JavaMajorVersion: 21,
				Memory:           MemoryConfig{RecommendedMb: 8192, MinimumMb: 6144},
				Server:           ServerConfig{Name: "ATM 10 Server", Address: "atm.forbiddenrequiem.com", Port: 25565},
			},
		},
	}
}
