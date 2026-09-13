# WhatsApp trip integration

Drivers can send a trip directly or type `hi` to open the menu. The bot collects missing cities, offers a vehicle list and quick departure buttons, then shows a review with Send route map, Confirm, and Edit. Type `cancel` to discard the draft. Free-text corrections remain supported. `help` preserves the draft; `menu` starts over. Times use Asia/Kolkata.

## Optional route images

At the review, the bot asks whether the driver wants a Google route image. Tapping **Send route map** or replying **yes** opts in. Replying **no** skips the image. Explicit `map` or `send map` also requests an image while reviewing. Map requests never confirm or create a trip. Buttons are tied to a review ID; old map buttons stop working after editing, declining, or cancelling. Repeated taps after a successful send do not resend it. Concurrent webhook deliveries still require deployment-level serialization for strict ordering.

After consent, the server geocodes both places, requests an overview driving polyline from Google Routes, and renders a 1280-by-960 PNG using Maps Static API. Green A and red B mark the endpoints; the blue line is the actual returned route. Google's original attribution remains visible. The caption includes distance, current estimated driving duration, and a key-free Google Maps directions link. These are ordinary driving estimates, not truck-specific navigation or departure-time forecasts.

The image is downloaded into memory and uploaded to WhatsApp's media endpoint, then sent using the returned media ID. No public image bucket or URL exposing Google credentials is needed. The app does not persist the image. Google API errors, missing polylines, partial-map warnings, invalid image responses, and upload failures return a retry option and directions link while retaining the draft.

### Google Cloud setup

- Enable **Routes API**, **Maps Static API**, and **Geocoding API** in the billed Google Cloud project used by this deployment. Geocoding is needed for places outside the built-in city list.
- Keep `GOOGLE_MAPS_API_KEY` configured for server-side Routes and Geocoding requests.
- Optionally configure a separate `GOOGLE_MAPS_STATIC_API_KEY` restricted to Maps Static API. If absent, image generation uses `GOOGLE_MAPS_API_KEY`. Use server-compatible key restrictions; browser HTTP-referrer restrictions cannot authenticate these server requests.
- Keep `WHATSAPP_ACCESS_TOKEN` configured with media-upload and messaging access for the existing sender.
- Run a live check: enter a trip, decline the map, then request it explicitly; verify the image, markers, attribution, and directions link arrive. Confirm the trip separately.

This repository change does not enable APIs, change billing, or deploy credentials. [Google Maps Static setup](https://developers.google.com/maps/documentation/maps-static/start), [Google Routes polylines](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), and [Meta media upload](https://www.postman.com/meta/whatsapp-business-platform/request/q3rsuse/upload-image) describe the provider configuration and request formats.

Known-city replies, vehicle choices, and quick departure choices bypass AI. Free-text parsing uses Kimi with a six-second timeout, then Gemini with a separate six-second timeout and no automatic SDK retries. Google and WhatsApp requests also have bounded timeouts. Route failures preserve the draft instead of creating a trip with zero distance. Each reviewed draft stores a UUID in session JSON, used as the trip ID to prevent duplicate inserts for the same draft.

The existing `profiles`, `whatsapp_sessions`, and `trips` tables are required. Session state still uses `idle` and `collecting`; confirmation metadata is stored in the existing JSON data field. Trips must accept UUID IDs with a unique primary key. No new database table is required.

Runtime credentials remain the existing WhatsApp access token and app secret, Supabase service-role credentials, Moonshot and AI Gateway credentials, and Google Maps credentials. The existing production WhatsApp sender ID is preserved. The settings shortcut uses its existing documented public number.

Run `npm run test:whatsapp` for mocked conversation-flow regression tests. These do not send messages or access a live database. Real-device delivery, provider latency, and database constraints need verification in the configured deployment. Webhook processing remains synchronous; this change does not add a durable message queue or cross-request session locking.

Protocol references: [Meta interactive messages](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/) and [AI SDK timeout settings](https://ai-sdk.dev/docs/ai-sdk-core/settings).
