# ⚔️ FORBIDDEN LAUNCHER • UNIVERSAL HUB

Um **Launcher de Minecraft de Alta Performance** com visual **Dark Fantasy & Cyberpunk**, desenvolvido em **Electron + Node.js**, otimizado para baixo consumo de memória RAM/CPU e com sistema **100% automatizado de atualizações para Launcher e Modpacks via GitHub**.

---

## 🌟 Principais Recursos

- ⚡ **Desempenho Extremo & Modo Eco**:
  - Consumo reduzido de RAM (~70MB em standby).
  - Suspensão automática de animações e partículas quando em segundo plano ou com o jogo rodando.
  - Otimizações de V8 e Chromium flags embutidas.

- 👑 **Identidade do Aventureiro (Duplo Modo)**:
  - **Modo Pirata / Offline**: Permite usar qualquer apelido customizado.
  - **Conta Original / Microsoft / Mojang**: Verificação instantânea de conta original com **Moldura Dourada Real com Coroa 👑** e skins oficiais de alta resolução.

- 🌐 **Monitoramento de Servidores em Tempo Real**:
  - Resolução automática de registros **DNS SRV** (`_minecraft._tcp`).
  - Medidor de latência (**ping ms**) com alerta visual de qualidade.
  - Contador de jogadores online em tempo real.
  - Botão de 1 clique para copiar o IP.

- 🔄 **Sistema de Atualizações Automáticas (Zero Esforço Manual)**:
  - **Modpacks**: O launcher sincroniza apenas mods modificados/adicionados diretamente pelo repositório GitHub sem apagar mundos, waypoints ou configurações do jogador.
  - **Launcher**: Verificação automática de novas versões pelo GitHub Releases com alerta e download em 1 clique.

- 📦 **Catálogo Completo de Modpacks**:
  - **Forbidden Requiem** (Minecraft 1.7.10 • Forge).
  - **All The Mods 10 / ATM Brasil** (Minecraft 1.21.1 • NeoForge 21.1.235).
  - Lista detalhada de todos os mods catalogados com filtros de busca instantâneos.

---

## 🚀 Como Fazer Atualizações do Modpack via GitHub

Quando você adicionar, remover ou atualizar mods em qualquer modpack, basta rodar o comando:

```bash
node tools/publish-modpack-update.js --pack atm10 --version 1.0.1
```

Em seguida, faça o push para o GitHub:
```bash
git add .
git commit -m "Atualização ATM10 v1.0.1"
git push
```

**Resultado:**
Todos os jogadores abrirão o Launcher e verão o botão **`[ATUALIZAR]`** automaticamente! Ao clicar, o launcher baixará apenas os novos arquivos necessários.

---

## 🛠️ Como Lançar uma Nova Versão do Launcher (.exe)

O repositório já inclui um **GitHub Actions CI/CD** (`.github/workflows/build.yml`).

1. Atualize a versão no `package.json` (ex: `"version": "1.0.1"`).
2. Crie uma tag do git e envie para o GitHub:
```bash
git tag v1.0.1
git push origin v1.0.1
```
3. O GitHub compilará o instalador `.exe` automaticamente e criará o Release para download!

---

## 💻 Como Rodar em Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar o Launcher
npm start
```

---

## 📁 Estrutura do Projeto

```
d:/Laucher/
├── .github/workflows/         # CI/CD de compilação automática no GitHub
├── src/
│   ├── main/                  # Processo Principal (Electron)
│   │   ├── index.js           # Janela, Tray, ciclo de vida
│   │   ├── gameLauncher.js    # Inicialização do Minecraft (Forge/NeoForge)
│   │   ├── manifestManager.js # Download, instalação e sincronização de modpacks
│   │   ├── javaManager.js     # Download e gestão automática do Adoptium Java
│   │   ├── serverPing.js      # Ping em tempo real com DNS SRV
│   │   ├── microsoftAuth.js   # Autenticação Microsoft & Mojang Original
│   │   ├── launcherUpdater.js # Auto-updater do Launcher via GitHub
│   │   └── ipcHandlers.js     # Comunicação IPC segura
│   ├── preload/               # Preload com Context Isolation
│   └── renderer/              # Interface do Usuário (HTML5, CSS3, JS)
├── tools/                     # Scripts de automação de releases e catálogos
├── catalog.json               # Catálogo mestre dos modpacks
└── package.json               # Configurações do projeto e electron-builder
```
