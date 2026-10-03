import { NextResponse, type NextRequest } from 'next/server'
import { concluirConexao, lerState } from '@/utils/google-agenda'
import { sincronizarFuturosDe } from '@/app/dashboard/agenda/sincronia'

// Retorno do OAuth do Google Agenda. Não depende do cookie de sessão: no app
// desktop esta rota abre no navegador do sistema, onde a pessoa pode não estar
// logada no painel — quem identifica o usuário é o `state` assinado.

function voltar(request: NextRequest, status: 'ok' | 'erro', motivo?: string) {
  const url = new URL('/google-agenda/conectado', request.nextUrl.origin)
  url.searchParams.set('status', status)
  if (motivo) url.searchParams.set('motivo', motivo.slice(0, 200))
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const state = lerState(params.get('state') ?? '')
  if (!state) return voltar(request, 'erro', 'O link de conexão expirou. Tente conectar de novo.')

  const erroGoogle = params.get('error')
  if (erroGoogle) {
    return voltar(request, 'erro', erroGoogle === 'access_denied' ? 'Você não autorizou o acesso.' : erroGoogle)
  }

  const code = params.get('code')
  if (!code) return voltar(request, 'erro', 'O Google não devolveu a autorização.')

  try {
    await concluirConexao(state.uid, code, state.redirectUri)
  } catch (err) {
    console.error('[google-agenda/callback]', err)
    return voltar(request, 'erro', err instanceof Error ? err.message : 'Falha ao conectar.')
  }

  try {
    // Compromissos futuros em que a pessoa já é participante vão para o Google dela.
    await sincronizarFuturosDe(state.uid, new URL(state.redirectUri).origin)
  } catch (err) {
    console.error('[google-agenda/callback] sincronizar futuros', err)
  }
  return voltar(request, 'ok')
}
