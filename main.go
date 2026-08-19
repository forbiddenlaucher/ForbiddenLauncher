package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"forbidden-launcher/pkg/catalog"
	"forbidden-launcher/pkg/downloader"
	"forbidden-launcher/pkg/instance"
	"forbidden-launcher/pkg/launcher"
	"forbidden-launcher/pkg/runtime"
	"forbidden-launcher/pkg/serverping"
)

func getBaseDir() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		home, _ := os.UserHomeDir()
		appData = filepath.Join(home, ".config")
	}
	return filepath.Join(appData, "ForbiddenLauncher")
}

func main() {
	modeFlag := flag.String("mode", "info", "Modo de execução: info, ping, sync")
	packFlag := flag.String("pack", "forbidden-requiem", "ID do modpack (forbidden-requiem ou atm10)")
	flag.Parse()

	baseDir := getBaseDir()
	_ = os.MkdirAll(baseDir, 0755)

	dl := downloader.NewManager(6)
	catSvc := catalog.NewService(baseDir)
	rtMgr := runtime.NewManager(baseDir, dl)
	instMgr := instance.NewManager(baseDir, dl)
	procMgr := launcher.NewProcessManager()

	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println("   FORBIDDEN LAUNCHER • UNIVERSAL HUB (Go Core Engine)")
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Printf("Diretório Base: %s\n\n", baseDir)

	cat, err := catSvc.Load("")
	if err != nil {
		fmt.Printf("Erro ao carregar catálogo: %v\n", err)
		return
	}

	fmt.Printf("✓ Catálogo carregado com %d modpacks:\n", len(cat.Modpacks))
	for _, m := range cat.Modpacks {
		fmt.Printf("  • %s (%s, %s)\n", m.Name, m.MinecraftVersion, m.Loader)
	}

	if *modeFlag == "ping" {
		fmt.Println("\nConsultando status dos reinos...")
		for _, m := range cat.Modpacks {
			st := serverping.Ping(m.Server.Address, m.Server.Port, 3*time.Second)
			if st.Online {
				fmt.Printf("  [ONLINE]  %s: %d/%d jogadores, %dms ping\n", m.Server.Address, st.Players.Online, st.Players.Max, st.PingMs)
			} else {
				fmt.Printf("  [OFFLINE] %s: %s\n", m.Server.Address, st.MOTD)
			}
		}
	} else if *modeFlag == "sync" {
		fmt.Printf("\nSincronizando modpack: %s...\n", *packFlag)
		// Ready for automated sync
		_ = instMgr
		_ = rtMgr
		_ = procMgr
	}

	fmt.Println("\nIniciando interface gráfica do Forbidden Launcher...")
}
