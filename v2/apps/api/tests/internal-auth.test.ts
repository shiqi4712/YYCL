import assert from 'node:assert/strict'
import test from 'node:test'
import { safeTokenEqual } from '../src/lib/site-session'
import { normalizeReturnTo, renderLoginUrl } from '../src/services/internal-auth.service'

test('normalizeReturnTo keeps only local paths', () => {
  assert.equal(normalizeReturnTo('/practice/chat?topic=1#reply'), '/practice/chat?topic=1#reply')
  assert.equal(normalizeReturnTo('https://example.com'), '/')
  assert.equal(normalizeReturnTo('//example.com'), '/')
  assert.equal(normalizeReturnTo('/\\example.com'), '/')
  assert.equal(normalizeReturnTo('/path\r\nLocation: https://example.com'), '/')
})

test('renderLoginUrl encodes configured protocol values', () => {
  const url = renderLoginUrl(
    'https://login.example.test?app={appId}&redirect={callbackUrl}&state={state}',
    {
      appId: 'yycl app',
      callbackUrl: 'https://yycl.example.com/api/auth/internal/callback',
      state: 'state/value',
    }
  )

  assert.equal(
    url,
    'https://login.example.test?app=yycl%20app&redirect=https%3A%2F%2Fyycl.example.com%2Fapi%2Fauth%2Finternal%2Fcallback&state=state%2Fvalue'
  )
})

test('safeTokenEqual rejects different values and lengths', () => {
  assert.equal(safeTokenEqual('same-token', 'same-token'), true)
  assert.equal(safeTokenEqual('same-token', 'other-token'), false)
  assert.equal(safeTokenEqual('', 'other-token'), false)
})
