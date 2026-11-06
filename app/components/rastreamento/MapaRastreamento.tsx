"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADOS, type EstadoVeiculo } from "@/utils/autocarsat/formatar";

export type PontoMapa = {
  uuid: string;
  placa: string;
  modelo: string;
  lat: number;
  lng: number;
  estado: EstadoVeiculo;
  velocidade: number;
  ultimoSinal: string;
  endereco: string;
  tensao: number | null;
  hodometro: string;
  motorista: string;
  angulo: number | null;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function iconeHtml(p: PontoMapa, selecionado: boolean) {
  const cor = ESTADOS[p.estado].cor;
  const borda = selecionado ? "#f97316" : "#fff";
  const seta =
    p.angulo !== null && p.estado === "movimento"
      ? `<div style="position:absolute;left:50%;top:-9px;width:0;height:0;margin-left:-5px;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid ${cor};transform-origin:5px 24px;transform:rotate(${p.angulo}deg)"></div>`
      : "";
  return `<div style="position:relative;width:76px;height:48px;display:flex;flex-direction:column;align-items:center">
    <div style="position:relative;width:30px;height:30px">${seta}
      <div style="width:30px;height:30px;border-radius:9999px;background:${cor};border:3px solid ${borda};box-shadow:0 1px 4px rgba(0,0,0,.5);${selecionado ? "outline:3px solid rgba(249,115,22,.35);" : ""}"></div>
    </div>
    <div style="margin-top:3px;padding:1px 6px;border-radius:6px;background:rgba(17,24,39,.9);color:#fff;font:700 10px/14px system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap">${esc(p.placa)}</div>
  </div>`;
}

function popupHtml(p: PontoMapa) {
  const e = ESTADOS[p.estado];
  const linhas = [
    `<span style="color:${e.cor};font-weight:700">● ${esc(e.rotulo)}</span>`,
    esc(p.modelo),
    `${Math.round(p.velocidade)} km/h · último sinal ${esc(p.ultimoSinal)}`,
    p.motorista ? `Motorista: ${esc(p.motorista)}` : "",
    p.tensao !== null ? `Bateria: ${p.tensao.toFixed(1)} V` : "",
    p.hodometro ? `Hodômetro: ${esc(String(p.hodometro))}` : "",
    `<small style="color:#555">${esc(p.endereco)}</small>`,
    `<a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer" style="color:#ea580c;font-weight:700">Abrir no Google Maps ↗</a>`,
  ].filter(Boolean);
  return `<div style="min-width:190px;line-height:1.45"><strong style="font-size:15px">${esc(p.placa)}</strong><br>${linhas.join("<br>")}</div>`;
}

// Mapa com um marcador por veículo (cor = estado, placa embaixo, seta de
// direção quando em movimento), camadas Mapa / Satélite / Escuro e foco no
// veículo escolhido na lista. Leaflet mexe no DOM, então é importado dentro
// do efeito (só no navegador). A cada atualização dos dados os marcadores
// são refeitos, mas o enquadramento só acontece na primeira vez e quando
// `enquadrarChave` muda (filtro da lista) — pra não tirar o mapa de onde a
// pessoa deixou.
export function MapaRastreamento({
  pontos,
  selecionado,
  onSelecionar,
  enquadrarChave,
  className = "h-[420px] rounded-card border border-border",
}: {
  pontos: PontoMapa[];
  selecionado: string | null;
  onSelecionar: (uuid: string | null) => void;
  enquadrarChave: string;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const camadaRef = useRef<LayerGroup | null>(null);
  const marcadoresRef = useRef<Map<string, Marker>>(new Map());
  const chaveRef = useRef<string | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const selecionadoRef = useRef(selecionado);
  const onSelecionarRef = useRef(onSelecionar);

  useEffect(() => {
    onSelecionarRef.current = onSelecionar;
  });

  // Redesenha os marcadores quando os pontos (ou a seleção) mudam.
  useEffect(() => {
    let cancelado = false;
    selecionadoRef.current = selecionado;

    async function desenhar() {
      if (!elRef.current) return;
      const L = leafletRef.current ?? (await import("leaflet")).default;
      leafletRef.current = L;
      if (cancelado || !elRef.current) return;

      if (!mapaRef.current) {
        const mapa = L.map(elRef.current, { zoomControl: false }).setView([-15.8, -47.9], 4);
        L.control.zoom({ position: "topright" }).addTo(mapa);

        const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });
        const satelite = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Imagens &copy; Esri" },
        );
        // Tema escuro sem provedor pago: os mesmos tiles do OpenStreetMap com
        // filtro de cor (ver <style> abaixo). O CARTO dark passou a exigir
        // chave de API.
        const escuro = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          className: "mapa-tiles-escuro",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });
        const bases: Record<string, ReturnType<typeof L.tileLayer>> = {
          Mapa: osm,
          Satélite: satelite,
          Escuro: escuro,
        };
        let inicial = "Mapa";
        try {
          const salvo = localStorage.getItem("rastreamento-camada");
          if (salvo && bases[salvo]) inicial = salvo;
        } catch {}
        bases[inicial].addTo(mapa);
        L.control.layers(bases, undefined, { position: "topright", collapsed: true }).addTo(mapa);
        mapa.on("baselayerchange", (e: { name: string }) => {
          try {
            localStorage.setItem("rastreamento-camada", e.name);
          } catch {}
        });
        mapa.on("click", () => onSelecionarRef.current(null));

        camadaRef.current = L.layerGroup().addTo(mapa);
        mapaRef.current = mapa;
      }

      camadaRef.current!.clearLayers();
      marcadoresRef.current.clear();
      const coords: [number, number][] = [];
      for (const p of pontos) {
        const ativo = p.uuid === selecionadoRef.current;
        const icone = L.divIcon({
          className: "",
          iconSize: [76, 48],
          iconAnchor: [38, 15],
          popupAnchor: [0, -14],
          html: iconeHtml(p, ativo),
        });
        const m = L.marker([p.lat, p.lng], { icon: icone, zIndexOffset: ativo ? 1000 : 0 })
          .bindPopup(popupHtml(p), { closeButton: true })
          .on("click", () => onSelecionarRef.current(p.uuid))
          .addTo(camadaRef.current!);
        marcadoresRef.current.set(p.uuid, m);
        coords.push([p.lat, p.lng]);
      }

      if (chaveRef.current !== enquadrarChave && coords.length > 0) {
        chaveRef.current = enquadrarChave;
        mapaRef.current.fitBounds(coords, { padding: [60, 60], maxZoom: 15 });
      }
      // Mantém o balão aberto do veículo escolhido depois de uma atualização.
      if (selecionadoRef.current) marcadoresRef.current.get(selecionadoRef.current)?.openPopup();
    }

    desenhar();
    return () => {
      cancelado = true;
    };
  }, [pontos, selecionado, enquadrarChave]);

  // Escolheu um veículo (na lista ou no marcador): voa até ele.
  useEffect(() => {
    if (!selecionado || !mapaRef.current) return;
    const p = pontos.find((x) => x.uuid === selecionado);
    if (!p) return;
    mapaRef.current.flyTo([p.lat, p.lng], Math.max(mapaRef.current.getZoom(), 14), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  // Desmonta o mapa ao sair da página.
  useEffect(() => {
    const marcadores = marcadoresRef.current;
    return () => {
      mapaRef.current?.remove();
      mapaRef.current = null;
      camadaRef.current = null;
      marcadores.clear();
      chaveRef.current = null;
    };
  }, []);

  return (
    <>
      <style>{`.mapa-tiles-escuro{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.7)}`}</style>
      <div
        ref={elRef}
        role="region"
        aria-label="Mapa com a localização dos veículos"
        className={`w-full overflow-hidden ${className}`}
      />
    </>
  );
}
