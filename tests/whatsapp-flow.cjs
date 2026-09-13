const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function bot() {
  let session = null
  let parses = 0
  let routeAvailable = true
  let mapAvailable = true
  const maps = []
  const sent = [], trips = []
  const db = { from(table) {
    const query = {
      select() { return this }, eq() { return this },
      async maybeSingle() { return { data: table === 'profiles' ? { user_id: 'u', full_name: 'Driver' } : session } },
      async upsert(value) { session = structuredClone(value); return {} },
      async insert(value) { trips.push(value); return {} },
      then(resolve) { resolve({ data: [] }) },
    }
    return query
  } }
  const mocks = {
    'next/server': { NextResponse: class { static json(value) { return value } } },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/whatsapp': {
      normalizePhoneNumber: x => x, verifyWhatsAppSignature: () => true,
      sendWhatsAppText: async (...args) => sent.push(args),
      sendWhatsAppButtons: async (...args) => sent.push(args),
      sendWhatsAppList: async (...args) => sent.push(args),
    },
    '@/lib/whatsapp-ai': { extractTripDetails: async () => { parses++; return { details: { origin: 'Guwahati', destination: 'Shillong', mode: null, departureTimeIso: null } } } },
    '@/lib/geocode': { geocodeCity: async name => ({ label: name, lat: 1, lng: 2 }) },
    '@/lib/route-compute': { computeDrivingRoute: async () => routeAvailable ? { distanceKm: 100, durationMin: 90 } : null },
    '@/lib/whatsapp-map': {
      directionsLink: () => 'https://www.google.com/maps/dir/?api=1',
      sendRouteMap: async (...args) => { maps.push(args); return mapAvailable },
    },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/whatsapp/webhook/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => mocks[name] ?? require(name), process, console, Buffer })
  return {
    sent, trips, maps, get session() { return session }, get parses() { return parses },
    failMap() { mapAvailable = false },
    failRoute() { routeAvailable = false },
    async send(text, button) {
      await exports.POST({ headers: { get: () => null }, text: async () => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '919999999999', text: text ? { body: text } : undefined, interactive: button ? { list_reply: { id: button } } : undefined }] } }] }] }) })
    },
  }
}

test('direct trip, vehicle list, departure shortcut, review, and confirmation', async () => {
  const b = bot()
  await b.send('Guwahati to Shillong')
  assert.equal(b.sent.at(-1)[2].length, 4)
  await b.send(null, 'mode_truck')
  await b.send(null, 'depart_hour')
  assert.equal(b.parses, 1)
  assert.equal(b.trips.length, 0)
  assert.equal(b.session.data.awaitingConfirmation, true)
  const tripId = b.session.data.tripId
  await b.send(null, 'confirm_trip')
  assert.equal(b.trips.length, 1)
  assert.equal(b.trips[0].id, tripId)
  assert.equal(b.session.state, 'idle')
  assert.match(b.sent.at(-1)[1], /1h 30m/)
  await b.send(null, 'confirm_trip')
  assert.equal(b.trips.length, 1)
})

async function reviewedBot() {
  const b = bot()
  await b.send('route')
  await b.send(null, 'mode_truck')
  await b.send(null, 'depart_hour')
  return b
}

test('maps require consent and never create a trip', async () => {
  const b = await reviewedBot()
  assert.equal(b.maps.length, 0)
  await b.send(null, `map_${b.session.data.mapOfferId}`)
  assert.equal(b.maps.length, 1)
  assert.deepEqual(b.maps[0], ['919999999999', 'Guwahati', 'Shillong'])
  assert.equal(b.trips.length, 0)
  assert.equal(b.session.data.mapSent, true)
  await b.send('yes')
  assert.equal(b.maps.length, 1)
})

test('decline and stale buttons do not send maps', async () => {
  const b = await reviewedBot()
  const oldButton = `map_${b.session.data.mapOfferId}`
  await b.send('no thanks')
  await b.send(null, oldButton)
  assert.equal(b.maps.length, 0)
  assert.equal(b.trips.length, 0)
  await b.send('bike')
  await b.send(null, oldButton)
  assert.equal(b.maps.length, 0)
  await b.send('yes please')
  assert.equal(b.maps.length, 1)
})

test('failed maps retain the draft and offer retry and directions', async () => {
  const b = await reviewedBot()
  b.failMap()
  await b.send('yes')
  assert.equal(b.session.data.awaitingConfirmation, true)
  assert.equal(b.session.data.mapSent, undefined)
  assert.equal(b.trips.length, 0)
  assert.match(b.sent.at(-1)[1], /https:\/\/www.google.com\/maps/)
  assert.equal(b.sent.at(-1)[2][0].title, 'Retry route map')
})

test('map consent expires when a trip is cancelled', async () => {
  const b = await reviewedBot()
  const button = `map_${b.session.data.mapOfferId}`
  await b.send('cancel')
  await b.send(null, button)
  assert.equal(b.maps.length, 0)
})

test('help preserves a draft and cancel discards it', async () => {
  const b = bot()
  await b.send('route')
  await b.send('help')
  assert.equal(b.session.data.origin, 'Guwahati')
  await b.send('cancel')
  assert.equal(b.session.state, 'idle')
  assert.equal(b.trips.length, 0)
})

test('route outage retains confirmation and never creates a zero-distance trip', async () => {
  const b = bot()
  await b.send('route')
  await b.send(null, 'mode_van')
  await b.send(null, 'depart_now')
  b.failRoute()
  await b.send(null, 'confirm_trip')
  assert.equal(b.trips.length, 0)
  assert.equal(b.session.data.awaitingConfirmation, true)
  assert.match(b.sent.at(-1)[1], /unavailable/)
})

test('edit keeps the draft and requires another review', async () => {
  const b = bot()
  await b.send('route')
  await b.send(null, 'mode_truck')
  await b.send(null, 'depart_hour')
  await b.send(null, 'edit_trip')
  assert.equal(b.trips.length, 0)
  await b.send('bike')
  assert.equal(b.session.data.mode, 'bike')
  assert.equal(b.session.data.awaitingConfirmation, true)
  assert.equal(b.trips.length, 0)
})
