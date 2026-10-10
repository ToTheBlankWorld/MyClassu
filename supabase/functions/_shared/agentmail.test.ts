import { sendViaAgentMail, type FetchLike } from './agentmail';

/** AgentMail sender: success, network faults, provider rejections. */
describe('sendViaAgentMail', () => {
  const email = {
    from: 'reports@myclassu.app',
    to: 'student@example.com',
    subject: 'MyClassu: daily report',
    text: 'Attendance for today',
  };

  it('returns the provider message id on success', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg-123' }),
    });
    await expect(sendViaAgentMail(fetchImpl, 'key', email)).resolves.toEqual({
      ok: true,
      messageId: 'msg-123',
    });
  });

  it('succeeds without a message id when the provider omits it', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const result = await sendViaAgentMail(fetchImpl, 'key', email);
    expect(result.ok).toBe(true);
    expect(result.messageId).toBeUndefined();
  });

  it('reports network failures without throwing', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('connection reset');
    };
    const result = await sendViaAgentMail(fetchImpl, 'key', email);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network');
  });

  it('reports provider rejections with the status only (no bodies, no keys)', async () => {
    const seen: Array<{ headers: Record<string, string>; body: string }> = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      seen.push({ headers: init.headers, body: init.body });
      return {
        ok: false,
        status: 401,
        json: async () => ({ detail: 'bad key' }),
      };
    };
    const result = await sendViaAgentMail(fetchImpl, 'secret-key', email);
    expect(result).toEqual({ ok: false, error: 'provider 401' });
    // The key travels only in the Authorization header, never in the body.
    expect(seen[0].body).not.toContain('secret-key');
    expect(seen[0].headers.Authorization).toBe('Bearer secret-key');
  });

  it('treats an unreadable response body as a rejection when not ok', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(sendViaAgentMail(fetchImpl, 'key', email)).resolves.toEqual({
      ok: false,
      error: 'provider 502',
    });
  });
});
