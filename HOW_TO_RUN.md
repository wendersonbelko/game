# BraainHot v2 — Como Buildar e Rodar

## Pré-requisitos

- **Node.js** v18 ou superior
- **npm** v8 ou superior

---

## Instalação

```bash
npm install
```

> Instala todas as dependências de produção e desenvolvimento (TypeScript, ts-node, @types/*).

---

## Modo Desenvolvimento

```bash
npm run dev
```

- Usa **ts-node** para executar TypeScript diretamente, sem compilar.
- Hot-reload **não** está incluído por padrão. Para reinicialização automática, instale `nodemon`:

```bash
npm install --save-dev nodemon
# Depois execute:
npx nodemon --exec ts-node src/main.ts --ext ts
```

---

## Build para Produção

```bash
npm run build
```

- Compila TypeScript → JavaScript via `tsc`.
- Output gerado em `./dist/`.
- Somente arquivos em `./src/` são compilados (frontend em `./public/` é servido como está).

---

## Iniciar em Produção

```bash
npm start
```

- Executa `node dist/main.js` (requer que `npm run build` tenha sido executado antes).

---

## Fluxo Completo de Deploy

```bash
# 1. Instalar dependências
npm install

# 2. Compilar TypeScript
npm run build

# 3. Iniciar o servidor
npm start
```

Servidor disponível em: **http://localhost:3000**

Para usar uma porta diferente, defina a variável de ambiente:

```bash
PORT=8080 npm start
# ou no Windows:
$env:PORT=8080; npm start
```

---

## Estrutura do Projeto

```
src/
├── domain/            ← Entidades puras e constantes (zero dependências externas)
│   ├── constants.ts
│   ├── enums/GamePhase.ts
│   └── entities/      ← IPlayer, IBox, IPickup, ICoin, IWall, ISpeedZone
│
├── shared/            ← Utilitários matemáticos puros
│   └── MathUtils.ts
│
├── application/       ← Regras de negócio (lógica do jogo)
│   ├── GameState.ts
│   ├── services/      ← MapService, PhysicsService, CombatService,
│   │                     PickupService, GameSessionService, BotAIService
│   └── usecases/      ← JoinPlayer, Shoot, GrabBox, ActivatePower,
│                         BuyItem, ChooseUpgrade, Chat
│
├── infrastructure/    ← Adaptadores externos (Express, WebSocket)
│   ├── GameBroadcaster.ts
│   ├── http/HttpServer.ts
│   └── websocket/     ← WsServer, MessageHandler
│
└── main.ts            ← Composition Root (ponto de entrada)

public/                ← Frontend estático (HTML, CSS, JS) — inalterado
dist/                  ← Output compilado pelo tsc (gerado pelo build)
```

---

## Princípios Aplicados

| Princípio | Aplicação |
|---|---|
| **Single Responsibility** | Cada service/use case tem uma única responsabilidade |
| **Open/Closed** | Use cases são extensíveis sem modificar serviços |
| **Liskov Substitution** | `IBroadcaster` permite substituição sem quebrar contratos |
| **Interface Segregation** | Interfaces pequenas e focadas (`IBroadcaster`, entidades) |
| **Dependency Inversion** | Serviços recebem `GameState` e `IBroadcaster` por injeção |
| **Clean Architecture** | Domain sem dependências externas, Infrastructure nas bordas |
