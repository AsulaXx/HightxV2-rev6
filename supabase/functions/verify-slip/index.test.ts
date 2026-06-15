import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callThunder, callRDCW, callSlip2Go, callPlernPay, pingProvider, type VerifyInput } from "./index.ts";

// Helper: build a mock fetch returning a fixed status + JSON body
function mockFetch(status: number, body: unknown): typeof fetch {
  return ((_url: any, _init?: any) =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )) as unknown as typeof fetch;
}

function networkErrorFetch(): typeof fetch {
  return (() => Promise.reject(new Error('boom'))) as unknown as typeof fetch;
}

const baseInput: VerifyInput = { type: 'bank', payload: 'TEST_PAYLOAD' };

Deno.test('Thunder: success normalizes to canonical shape', async () => {
  const f = mockFetch(200, {
    success: true,
    data: { isDuplicate: false, matchedAccount: '123', rawSlip: { transRef: 'TX1', amount: { amount: 100 } } },
  });
  const r = await callThunder(baseInput, 'k', f);
  assertEquals(r.success, true);
  assertEquals(r.data.rawSlip.transRef, 'TX1');
});

Deno.test('Thunder: error mapped to error object', async () => {
  const f = mockFetch(400, { success: false, error: { code: 'BAD', message: 'nope' } });
  const r = await callThunder(baseInput, 'k', f);
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'BAD');
});

Deno.test('Thunder: network failure returns NETWORK error', async () => {
  const r = await callThunder(baseInput, 'k', networkErrorFetch());
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'NETWORK');
});

Deno.test('RDCW: TrueWallet not supported', async () => {
  const r = await callRDCW({ type: 'truewallet' }, 'a', 'b');
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'NOT_SUPPORTED');
});

Deno.test('RDCW: 401 maps to AUTH_FAILED', async () => {
  const f = mockFetch(401, { code: 'AUTH', message: 'bad creds' });
  const r = await callRDCW(baseInput, 'a', 'b', f);
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'AUTH_FAILED');
});

Deno.test('RDCW: success normalizes to Thunder-like shape', async () => {
  const f = mockFetch(200, {
    data: {
      transRef: 'RDCWTX', transDate: '2025-01-01', transTime: '10:00:00',
      amount: 250, sendingBank: 'SCB', receivingBank: 'KBANK',
      sender: { account: { name: 'Alice', value: '111' } },
      receiver: { account: { name: 'Shop', value: '222', proxyValue: '0812345678' } },
    },
  });
  const r = await callRDCW(baseInput, 'a', 'b', f);
  assertEquals(r.success, true);
  assertEquals(r.data.rawSlip.transRef, 'RDCWTX');
  assertEquals(r.data.rawSlip.amount.amount, 250);
  assertEquals(r.data.rawSlip.receiver.account.bank.account, '222');
  assertEquals(r.data.rawSlip.receiver.account.proxy.account, '0812345678');
});

Deno.test('Slip2Go: missing payload returns NEEDS_PAYLOAD', async () => {
  const r = await callSlip2Go({ type: 'bank' }, 'k');
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'NEEDS_PAYLOAD');
});

Deno.test('Slip2Go: TrueWallet not supported', async () => {
  const r = await callSlip2Go({ type: 'truewallet', payload: 'x' }, 'k');
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'NOT_SUPPORTED');
});

Deno.test('Slip2Go: 401 maps to AUTH_FAILED', async () => {
  const f = mockFetch(401, { error: { message: 'bad key' } });
  const r = await callSlip2Go(baseInput, 'k', f);
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'AUTH_FAILED');
});

Deno.test('Slip2Go: success normalizes', async () => {
  const f = mockFetch(200, {
    data: {
      transRef: 'S2G1', dateTime: '2025-02-02T12:00:00Z', amount: 75,
      sender: { bankCode: 'SCB', bankName: 'SCB', accountNameTH: 'A', accountNumber: '123' },
      receiver: { bankCode: 'KBANK', bankName: 'KBANK', accountNameTH: 'Shop', accountNumber: '999' },
    },
  });
  const r = await callSlip2Go(baseInput, 'k', f);
  assertEquals(r.success, true);
  assertEquals(r.data.rawSlip.transRef, 'S2G1');
  assertEquals(r.data.rawSlip.amount.amount, 75);
  assertEquals(r.data.rawSlip.sender.account.bank.account, '123');
});

Deno.test('PlernPay: always returns NOT_SUPPORTED', async () => {
  const r = await callPlernPay(baseInput, 'a', 'b');
  assertEquals(r.success, false);
  assertEquals(r.error?.code, 'NOT_SUPPORTED');
});

Deno.test('pingProvider: thunder OK with 200', async () => {
  Deno.env.set('THUNDER_API_KEY', 'test');
  const f = mockFetch(200, { success: true, data: { credits: 99 } });
  const r = await pingProvider('thunder', f);
  assert(r.ok);
  assertEquals(r.provider, 'thunder');
});

Deno.test('pingProvider: thunder fails with 401', async () => {
  Deno.env.set('THUNDER_API_KEY', 'test');
  const f = mockFetch(401, { success: false, error: { message: 'invalid key' } });
  const r = await pingProvider('thunder', f);
  assertEquals(r.ok, false);
});

Deno.test('pingProvider: rdcw 400 means auth OK', async () => {
  Deno.env.set('RDCW_CLIENT_ID', 'id');
  Deno.env.set('RDCW_CLIENT_SECRET', 'sec');
  const f = mockFetch(400, { code: 'BAD_PAYLOAD' });
  const r = await pingProvider('rdcw', f);
  assert(r.ok);
});

Deno.test('pingProvider: rdcw 401 fails', async () => {
  Deno.env.set('RDCW_CLIENT_ID', 'id');
  Deno.env.set('RDCW_CLIENT_SECRET', 'sec');
  const f = mockFetch(401, { code: 'UNAUTH' });
  const r = await pingProvider('rdcw', f);
  assertEquals(r.ok, false);
});

Deno.test('pingProvider: slip2go 401 fails', async () => {
  Deno.env.set('SLIP2GO_API_KEY', 'k');
  const f = mockFetch(401, {});
  const r = await pingProvider('slip2go', f);
  assertEquals(r.ok, false);
});

Deno.test('pingProvider: unknown provider', async () => {
  const r = await pingProvider('foo');
  assertEquals(r.ok, false);
});
