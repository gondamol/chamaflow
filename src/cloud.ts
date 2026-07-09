import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Chama } from './types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

let client: SupabaseClient | null = null;

export function isCloudConfigured(): boolean {
  return Boolean(url && anon && !url.includes('YOUR_PROJECT'));
}

export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured()) return null;
  if (!client) client = createClient(url, anon);
  return client;
}

export function cloudStatusLabel(): string {
  if (!isCloudConfigured()) return 'Cloud not configured (local only)';
  return 'Cloud ready';
}

/** Human-friendly 8-char share code (no ambiguous 0/O/1/I). */
export function generateShareCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += alphabet[arr[i]! % alphabet.length];
  return out;
}

export type CloudPushResult =
  | { ok: true; shareCode: string; rev: number }
  | { ok: false; error: string; conflict?: boolean };

export type CloudPullResult =
  | { ok: true; chama: Chama; rev: number; updatedAt: string }
  | { ok: false; error: string };

/** Strip nothing for now — full soft ledger for treasurer/secretary devices. */
export function chamaToCloudPayload(chama: Chama): Chama {
  return { ...chama };
}

export async function pushChamaToCloud(chama: Chama): Promise<CloudPushResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      error: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then run supabase/schema.sql',
    };
  }

  const shareCode = (chama.cloudShareCode || generateShareCode()).toUpperCase();
  const nextRev = (chama.cloudRev || 0) + 1;
  const payload = chamaToCloudPayload({
    ...chama,
    cloudShareCode: shareCode,
    cloudRev: nextRev,
    cloudSyncedAt: new Date().toISOString(),
  });

  // If new code: insert. If existing: update only when rev matches (or first push).
  const { data: existing, error: readErr } = await sb
    .from('cloud_chamas')
    .select('rev')
    .eq('share_code', shareCode)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };

  if (!existing) {
    const { error } = await sb.from('cloud_chamas').insert({
      share_code: shareCode,
      payload,
      rev: nextRev,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, shareCode, rev: nextRev };
  }

  const remoteRev = Number(existing.rev) || 0;
  if (remoteRev > (chama.cloudRev || 0) && remoteRev !== nextRev - 1) {
    // Remote is ahead — caller should pull first
    if (remoteRev > chama.cloudRev) {
      return {
        ok: false,
        error: `Remote is newer (rev ${remoteRev}). Pull first, then push.`,
        conflict: true,
      };
    }
  }

  const { error } = await sb
    .from('cloud_chamas')
    .update({
      payload,
      rev: nextRev,
      updated_at: new Date().toISOString(),
    })
    .eq('share_code', shareCode);

  if (error) return { ok: false, error: error.message };
  return { ok: true, shareCode, rev: nextRev };
}

export async function pullChamaFromCloud(shareCode: string): Promise<CloudPullResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      error: 'Cloud not configured on this device',
    };
  }

  const code = shareCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Enter a share code' };

  const { data, error } = await sb
    .from('cloud_chamas')
    .select('payload, rev, updated_at')
    .eq('share_code', code)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.payload) return { ok: false, error: 'No group found for that code' };

  const chama = data.payload as Chama;
  return {
    ok: true,
    chama: {
      ...chama,
      cloudShareCode: code,
      cloudRev: Number(data.rev) || chama.cloudRev || 1,
      cloudSyncedAt: data.updated_at || new Date().toISOString(),
    },
    rev: Number(data.rev) || 1,
    updatedAt: data.updated_at || '',
  };
}

/** Realtime subscription — returns unsubscribe. */
export function subscribeCloudChama(
  shareCode: string,
  onChange: (chama: Chama, rev: number) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const code = shareCode.trim().toUpperCase();
  const channel = sb
    .channel(`chama-${code}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cloud_chamas',
        filter: `share_code=eq.${code}`,
      },
      (payload) => {
        const row = payload.new as { payload?: Chama; rev?: number } | null;
        if (row?.payload) {
          onChange(
            {
              ...row.payload,
              cloudShareCode: code,
              cloudRev: Number(row.rev) || row.payload.cloudRev || 1,
              cloudSyncedAt: new Date().toISOString(),
            },
            Number(row.rev) || 1,
          );
        }
      },
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}

export function liveBoardUrl(shareCode: string, origin = window.location.origin): string {
  return `${origin}${window.location.pathname}#/live/${shareCode.trim().toUpperCase()}`;
}
