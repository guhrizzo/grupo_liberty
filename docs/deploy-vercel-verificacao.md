# Deploy na Vercel: push não é deploy

Data: 2026-11-24

## O que aconteceu
- O commit `740abd7` (edição de veículos em janela) chegou ao GitHub, mas a Vercel não criou deploy para ele.
- O status do commit no GitHub estava vazio (`pending`, sem nenhum item), enquanto os anteriores tinham o ✓ da Vercel.
- Um commit vazio (`cf249b3`) disparou o deploy normalmente.
- Eu (Claude) disse "subiu" só por ter feito o push, sem confirmar o deploy.

## Como conferir se subiu
1. Push feito: `git log origin/master` mostra o commit.
2. Deploy criado: ✓ verde ao lado do commit no GitHub, ou o commit listado em *Deployments* na Vercel.
3. Deploy ok: status *Ready* (se *Error*, ler o log do build).

## Se a Vercel ignorar um commit
- Forçar com commit vazio: `git commit --allow-empty -m "chore: disparar novo deploy" && git push`.
- Ou *Create Deployment* na branch `master` pelo painel.
- Se repetir: reconectar o repositório em *Settings > Git* e ver o limite diário de deploys do plano gratuito.

## Erro de build já resolvido
- `ff5b596`: erro de tipo (TS7053) em `ServicosLiberty.tsx` ao indexar `iconesPlano` com `quitacao`. Corrigido no `c3ca489` com um type guard no `filter`.
- Avisos de `fs.existsSync`/`readFileSync` nos PDFs são só warnings e não derrubam o build.

## Mudança relacionada
Veículos: o botão Editar agora abre o formulário como janela sobre a lista (Esc fecha, fundo travado), em vez de rolar para o topo. Arquivo: `app/dashboard/veiculos/VeiculosClient.tsx`.
