import { json, error } from '@sveltejs/kit'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  PRIVATE_SUPABASE_SERVICE_ROLE_KEY,
  PRIVATE_INTERNAL_API_KEY,
} from '$env/static/private'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { z } from 'zod'
import type { RequestEvent } from '@sveltejs/kit'

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  storeId: z.string().uuid('ID da loja inválido'),
})

function getAdminClient() {
  return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY)
}

export async function POST({ request }: RequestEvent) {
  try {
    const authHeader = request.headers.get('Authorization')
    const provided = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''
    const expected = PRIVATE_INTERNAL_API_KEY
    let authorized = false
    try {
      const a = Buffer.from(provided)
      const b = Buffer.from(expected)
      authorized = a.byteLength === b.byteLength && timingSafeEqual(a, b)
    } catch {
      authorized = false
    }
    if (!authorized) {
      throw error(401, 'Unauthorized')
    }

    const body = await request.json()

    const result = signupSchema.safeParse(body)
    if (!result.success) {
      throw error(400, 'Dados de cadastro inválidos')
    }

    const { email, password, storeId } = result.data

    const adminClient = getAdminClient()

    const { data: store, error: storeError } = await adminClient
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      throw error(400, 'Loja não encontrada')
    }

    const { data: userData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      throw error(400, 'Erro ao criar usuário')
    }

    if (!userData.user) {
      throw error(500, 'Erro ao criar usuário')
    }

    const { error: membershipError } = await adminClient
      .from('store_memberships')
      .insert({
        user_id: userData.user.id,
        store_id: storeId,
      })

    if (membershipError) {
      await adminClient.auth.admin.deleteUser(userData.user.id)
      throw error(500, 'Erro ao criar vínculo com a loja')
    }

    return json({
      success: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        storeId,
      },
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw error(500, 'Erro interno do servidor')
  }
}
