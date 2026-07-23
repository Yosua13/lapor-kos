import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PROPERTY_KEY } from '@/features/properties/storage';
import { TOKEN_KEY } from './auth';
import { apiBlob, apiFetch } from './api';

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('api client property scope', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(TOKEN_KEY, 'token-123');
    window.localStorage.setItem(ACTIVE_PROPERTY_KEY, 'property-a');
    vi.stubGlobal('fetch', fetchMock);
  });

  it('adds auth and active property headers to operational requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'room-1' }]));

    await apiFetch('/api/rooms');

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('X-Property-ID')).toBe('property-a');
  });

  it('does not scope auth and property bootstrap requests', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1' }))
      .mockResolvedValueOnce(jsonResponse({ properties: [] }));

    await apiFetch('/api/auth/me');
    await apiFetch('/api/properties');

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).has('X-Property-ID')).toBe(false);
    }
  });

  it('keeps multipart content type under browser control', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const body = new FormData();
    body.append('name', 'Kamar 1');

    await apiFetch('/api/rooms/with-tenant', { method: 'POST', body });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
    expect(new Headers(init?.headers).get('X-Property-ID')).toBe('property-a');
  });

  it('supports empty and binary responses', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('pdf-data', { status: 200, headers: { 'Content-Type': 'application/pdf' } }));

    await expect(apiFetch('/api/rooms/room-1', { method: 'DELETE' })).resolves.toBeUndefined();
    const blob = await apiBlob('/api/reports/financial.pdf');
    expect(await blob.text()).toBe('pdf-data');
  });

  it('shares concurrent reads for the same property-scoped resource', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));

    const first = apiFetch<{ id: string }[]>('/api/rooms');
    const second = apiFetch<{ id: string }[]>('/api/rooms');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.(jsonResponse([{ id: 'room-1' }]));
    await expect(first).resolves.toEqual([{ id: 'room-1' }]);
    await expect(second).resolves.toEqual([{ id: 'room-1' }]);
  });
});

