package launcher

import (
	"bufio"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type LaunchOptions struct {
	JavaPath    string
	GameDir     string
	Username    string
	MaxRamMb    int
	MinRamMb    int
	Version     string
	Loader      string
	Fullscreen  bool
	WindowWidth int
	WindowHeight int
}

type ProcessManager struct {
	activeCmd *exec.Cmd
	isRunning bool
}

func NewProcessManager() *ProcessManager {
	return &ProcessManager{}
}

func (pm *ProcessManager) Launch(opts LaunchOptions, onLog func(level, msg string)) error {
	if pm.isRunning {
		return fmt.Errorf("o jogo já está em execução")
	}

	if opts.Username == "" {
		opts.Username = "ShadowSeeker"
	}
	if opts.MaxRamMb <= 0 {
		opts.MaxRamMb = 4096
	}
	if opts.MinRamMb <= 0 {
		opts.MinRamMb = 2048
	}

	onLog("INFO", "═══════════════════════════════════════════════════════════════")
	onLog("INFO", fmt.Sprintf("      FORBIDDEN LAUNCHER • INICIANDO %s (%s)      ", opts.Version, strings.ToUpper(opts.Loader)))
	onLog("INFO", "═══════════════════════════════════════════════════════════════")

	// 1. Gather Classpath
	librariesDir := filepath.Join(opts.GameDir, "libraries")
	versionsDir := filepath.Join(opts.GameDir, "versions", opts.Version)
	clientJar := filepath.Join(versionsDir, fmt.Sprintf("%s.jar", opts.Version))
	nativesDir := filepath.Join(opts.GameDir, "natives")

	var jarList []string
	_ = filepath.Walk(librariesDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() && strings.HasSuffix(info.Name(), ".jar") {
			jarList = append(jarList, path)
		}
		return nil
	})

	if fileExists(clientJar) {
		jarList = append(jarList, clientJar)
	}

	sep := ";"
	if runtime.GOOS != "windows" {
		sep = ":"
	}
	classpath := strings.Join(jarList, sep)

	// 2. JVM Arguments
	jvmArgs := []string{
		fmt.Sprintf("-Xms%dM", opts.MinRamMb),
		fmt.Sprintf("-Xmx%dM", opts.MaxRamMb),
		fmt.Sprintf("-Djava.library.path=%s", nativesDir),
		"-Dfml.ignoreInvalidMinecraftCertificates=true",
		"-Dfml.ignorePatchDiscrepancies=true",
		"-XX:+UseG1GC",
		"-Duser.language=pt",
		"-Duser.country=BR",
		"-cp", classpath,
	}

	// Main class
	var mainClass string
	var gameArgs []string

	uuid := generateOfflineUUID(opts.Username)

	if opts.Version == "1.7.10" {
		mainClass = "net.minecraft.launchwrapper.Launch"
		gameArgs = []string{
			"--username", opts.Username,
			"--version", opts.Version,
			"--gameDir", opts.GameDir,
			"--assetsDir", filepath.Join(opts.GameDir, "assets"),
			"--assetIndex", "1.7.10",
			"--uuid", uuid,
			"--accessToken", "00000000000000000000000000000000",
			"--userType", "legacy",
			"--tweakClass", "cpw.mods.fml.common.launcher.FMLTweaker",
		}
	} else {
		// Modern NeoForge 1.21+
		mainClass = "net.minecraft.client.main.Main"
		gameArgs = []string{
			"--username", opts.Username,
			"--version", opts.Version,
			"--gameDir", opts.GameDir,
			"--assetsDir", filepath.Join(opts.GameDir, "assets"),
			"--assetIndex", opts.Version,
			"--uuid", uuid,
			"--accessToken", "00000000000000000000000000000000",
			"--versionType", "release",
		}
	}

	if opts.Fullscreen {
		gameArgs = append(gameArgs, "--fullscreen")
	} else if opts.WindowWidth > 0 && opts.WindowHeight > 0 {
		gameArgs = append(gameArgs, "--width", strconv.Itoa(opts.WindowWidth), "--height", strconv.Itoa(opts.WindowHeight))
	}

	allArgs := append(jvmArgs, mainClass)
	allArgs = append(allArgs, gameArgs...)

	onLog("INFO", fmt.Sprintf("Java Executável: %s", opts.JavaPath))
	onLog("INFO", fmt.Sprintf("Jogador: %s (UUID: %s)", opts.Username, uuid))
	onLog("INFO", fmt.Sprintf("RAM: %d MB min / %d MB max", opts.MinRamMb, opts.MaxRamMb))

	cmd := exec.Command(opts.JavaPath, allArgs...)
	cmd.Dir = opts.GameDir
	cmd.Env = os.Environ()

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	pm.activeCmd = cmd
	pm.isRunning = true

	go pm.streamOutput(stdoutPipe, "GAME", onLog)
	go pm.streamOutput(stderrPipe, "WARN", onLog)

	go func() {
		_ = cmd.Wait()
		pm.isRunning = false
		pm.activeCmd = nil
		onLog("INFO", "Processo do Minecraft finalizado.")
	}()

	return nil
}

func (pm *ProcessManager) streamOutput(r io.Reader, defaultLevel string, onLog func(level, msg string)) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		level := defaultLevel
		if strings.Contains(line, "ERROR") || strings.Contains(line, "FATAL") || strings.Contains(line, "Exception") {
			level = "ERROR"
		} else if strings.Contains(line, "WARN") {
			level = "WARN"
		}
		if onLog != nil {
			onLog(level, line)
		}
	}
}

func (pm *ProcessManager) Kill() {
	if pm.activeCmd != nil && pm.isRunning {
		_ = pm.activeCmd.Process.Kill()
		pm.isRunning = false
	}
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func generateOfflineUUID(username string) string {
	h := md5.New()
	h.Write([]byte("OfflinePlayer:" + username))
	hexStr := hex.EncodeToString(h.Sum(nil))
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hexStr[0:8],
		hexStr[8:12],
		hexStr[12:16],
		hexStr[16:20],
		hexStr[20:32],
	)
}
