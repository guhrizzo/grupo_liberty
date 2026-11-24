# Rolagem suave do botão "Conhecer serviços" (home pública)

Data: 2026-11-24

## O que é
O botão do hero (`app/(public-home)/page.tsx`) aponta para `#pos-venda`. A rolagem suave é feita em `app/components/RolagemPublica.tsx` com GSAP ScrollSmoother.

## Mudança
- Todos os links âncora (`a[href^="#"]`) agora usam o mesmo tween: `gsap.to(suavizador, { scrollTop, ease: 'power2.inOut', duration: clamp(0.9, 1.8, distancia / 2000), overwrite: true })`.
- Antes só `#pos-venda` era animado com tween (`sine.inOut`, 0.75–2.4s); os outros usavam `suavizador.scrollTo`.
- Roda do mouse / toque interrompem a animação.

## Comportamento por dispositivo
- Desktop (mouse + sem reduced-motion): ScrollSmoother ativo.
- Touch / pointer coarse: `scroll-behavior: smooth` via CSS em `HeroLiberty.module.css`.
- `prefers-reduced-motion`: sem animação.

## Verificação
Testado no preview (porta 3000): o clique chega em `#pos-venda` (top ≈ 96px, abaixo do cabeçalho) sem erros no console. O painel do preview roda a ~2 fps, então a fluidez real precisa ser conferida no navegador.
