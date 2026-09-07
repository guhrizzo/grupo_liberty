# Liberty Car — App desktop

Casca **Electron** que empacota o sistema Liberty Car (Next.js, publicado na
Vercel) como um aplicativo instalável no Windows, com janela própria, atalho no
Menu Iniciar e atualização automática.

O backend continua 100% na nuvem (Firebase). Este app **não** roda o
Next.js localmente — ele abre `https://grupolibertycar.com.br/dashboard` numa
janela nativa. É **só o sistema interno**: sem sessão cai na tela de login; a
vitrine pública (`/`, `/veiculos`) não aparece dentro do app (é redirecionada
pro sistema). O site público segue acessível pelo navegador, normal.

> Spec e plano: `../docs/superpowers/specs/2026-09-07-app-desktop-design.md` ·
> `../docs/superpowers/plans/2026-09-07-app-desktop-plan.md`

## Rodar em desenvolvimento

```bash
# 1. na RAIZ do repo, suba o site
npm run dev

# 2. em outro terminal
cd desktop
npm install
npm run dev        # abre o Electron apontando pra http://localhost:3000
```

`Ctrl+Shift+I` abre o DevTools (só em dev).

## Gerar o instalador

```bash
cd desktop
npm install
npm run build      # gera build/Liberty-Car-Setup-<versão>.exe
```

O `.exe` fica em `desktop/build/`. Instalação por usuário (não pede admin).

## Publicar uma atualização

O feed de atualização são as **Releases do GitHub** do repo público
`guhrizzo/grupo_liberty` (sem limite de tamanho; download sem token porque o repo
é público).

1. Suba o número em `package.json` (`version`).
2. Crie `desktop/electron-builder.env` (gitignored) com:
   ```
   GH_TOKEN=<Personal Access Token — escopo public_repo>
   ```
   Token em https://github.com/settings/tokens
3. `npm run release` — builda o `.exe` e publica uma release (rascunho) no GitHub
   com `latest.yml` + `.exe` + `.blockmap`.
4. No GitHub, **publica a release** (sai de "Draft"). Só então os apps enxergam.

Apps já instalados detectam a nova versão em até 6h (ou na hora, via
**Ajuda › Procurar atualizações**), baixam em segundo plano e pedem pra
reiniciar.

## Ícone

`assets/icon.png` / `assets/icon.ico` são gerados por `scripts/make-icon.mjs` a
partir do wordmark da marca — é **provisório**. Para o ícone oficial, coloque um
`assets/icon.source.png` quadrado (≥ 1024×1024) e rode `npm run prebuild`.

## Login

Só **e-mail e senha** dentro do app. O botão "Continuar com Google" some quando a
página roda no Electron (`window.libertyDesktop`) — o popup OAuth do Firebase não
fecha o fluxo de forma confiável fora de um navegador. No site continua normal.

No Firebase (Authentication → Settings → Authorized domains) basta ter
`grupolibertycar.com.br` e `www.grupolibertycar.com.br` — o app carrega a página
do domínio real, não existe "domínio do exe".

## Limitações conhecidas

1. **Sem assinatura de código.** Na primeira instalação o Windows SmartScreen
   mostra "o Windows protegeu o computador" → *Mais informações* → *Executar
   assim mesmo*. Resolver exige um certificado Authenticode (pago). Follow-up.
2. **Precisa de internet.** Sem conexão, o app mostra uma tela de "sem conexão"
   com botão para tentar de novo — não abre o sistema offline.
3. **Só Windows x64.**
4. O cron de cobrança segue na Vercel (`vercel.json`) — o desktop não muda nada
   nisso.
