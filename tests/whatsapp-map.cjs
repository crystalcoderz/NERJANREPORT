const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks = {}, globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    exports, require: name => mocks[name] ?? require(name), URL, URLSearchParams, Blob, FormData, AbortSignal,
    Buffer, console, process: { env: { GOOGLE_MAPS_API_KEY: 'private-google-key', WHATSAPP_ACCESS_TOKEN: 'meta-token' } },
    ...globals,
  })
  return exports
}

function mapService({ polyline = 'abc?|\\xyz', response = new Response(new Blob(['png'], { type: 'image/png' })), accepted = true } = {}) {
  const requests = [], sent = [], routes = []
  const api = load('lib/whatsapp-map.ts', {
    '@/lib/geocode': { geocodeCity: async label => ({ label, lat: label === 'A' ? 26 : 25, lng: 91 }) },
    '@/lib/route-compute': { computeDrivingRoute: async (...args) => { routes.push(args); return { distanceKm: 100, durationMin: 90, encodedPolyline: polyline } } },
    '@/lib/whatsapp': { sendWhatsAppImage: async (...args) => { sent.push(args); return accepted } },
  }, { fetch: async (url, options) => { requests.push({ url, options }); return response } })
  return { api, requests, sent, routes }
}

test('route map contains actual encoded path, both markers, and high-resolution sizing', async () => {
  const m = mapService()
  assert.equal(await m.api.sendRouteMap('recipient', 'A', 'B'), true)
  assert.equal(m.routes[0][2], true)
  const url = new URL(m.requests[0].url)
  assert.equal(url.searchParams.get('path'), 'color:0x2563ebff|weight:5|enc:abc?|\\xyz')
  assert.equal(url.searchParams.getAll('markers').length, 2)
  assert.equal(url.searchParams.get('scale'), '2')
  assert.equal(m.requests[0].options.cache, 'no-store')
  assert.ok(m.sent[0][1] instanceof Blob)
  assert.match(m.sent[0][2], /1h 30m/)
  assert.match(m.sent[0][2], /https:\/\/www.google.com\/maps\/dir/)
  assert.ok(!m.sent[0][2].includes('private-google-key'))
})

test('no polyline means no invented route or image request', async () => {
  const m = mapService({ polyline: '' })
  assert.equal(await m.api.sendRouteMap('recipient', 'A', 'B'), false)
  assert.equal(m.requests.length, 0)
  assert.equal(m.sent.length, 0)
})

test('Google API errors, partial maps, and non-images never reach WhatsApp', async () => {
  for (const response of [
    new Response('denied', { status: 403 }),
    new Response('html error', { headers: { 'content-type': 'text/html' } }),
    new Response(new Blob(['png'], { type: 'image/png' }), { headers: { 'x-staticmap-api-warning': 'Path omitted' } }),
  ]) {
    const m = mapService({ response })
    assert.equal(await m.api.sendRouteMap('recipient', 'A', 'B'), false)
    assert.equal(m.sent.length, 0)
  }
})

test('WhatsApp uploads binary media then sends the media ID', async () => {
  const requests = []
  const api = load('lib/whatsapp.ts', {}, { fetch: async (url, options) => {
    requests.push({ url, options })
    return Response.json(requests.length === 1 ? { id: 'uploaded-image' } : { messages: [{ id: 'message' }] })
  } })
  assert.equal(await api.sendWhatsAppImage('recipient', new Blob(['png'], { type: 'image/png' }), 'Route'), true)
  assert.match(requests[0].url, /\/media$/)
  assert.equal(requests[0].options.body.get('messaging_product'), 'whatsapp')
  const message = JSON.parse(requests[1].options.body)
  assert.deepEqual(message.image, { id: 'uploaded-image', caption: 'Route' })
  assert.equal(message.to, 'recipient')
  assert.equal(message.type, 'image')
  assert.equal(message.image.link, undefined)
})

test('failed uploads never send an image message', async () => {
  let calls = 0
  const api = load('lib/whatsapp.ts', {}, { fetch: async () => { calls++; return new Response('failed', { status: 500 }) } })
  assert.equal(await api.sendWhatsAppImage('recipient', new Blob(['png'], { type: 'image/png' }), 'Route'), false)
  assert.equal(calls, 1)
})

test('oversized or unsupported images are rejected before upload', async () => {
  const api = load('lib/whatsapp.ts', {}, { fetch: async () => assert.fail('must not upload') })
  assert.equal(await api.sendWhatsAppImage('recipient', new Blob(['html'], { type: 'text/html' }), 'Route'), false)
  assert.equal(await api.sendWhatsAppImage('recipient', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'Route'), false)
})
