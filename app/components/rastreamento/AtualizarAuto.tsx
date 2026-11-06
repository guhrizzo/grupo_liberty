"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recarrega os dados do servidor (nova consulta ao Autocarsat) a cada
// `segundos`, só com a aba visível.
export function AtualizarAuto({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
