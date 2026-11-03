import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Só no `next dev`: deixa abrir o painel por túnel (ex.: webhook do Asaas via cloudflared).
  allowedDevOrigins: ['*.trycloudflare.com'],
  serverExternalPackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    // O otimizador da Vercel estourou a cota (402) e derrubou as fotos do site.
    // As fotos já são convertidas pra WebP no upload (utils/veiculos/foto-webp.ts),
    // então servimos direto do Firebase Storage.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tdnioxrmhfhfvlfvuand.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'grupo-liberty.firebasestorage.app',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;