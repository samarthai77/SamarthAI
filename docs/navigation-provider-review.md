# GPS Navigation provider review — 22 October 2026

Baseline: `9c560b3b732a625105f987f2cde66f10ec99a154`.

## Release decision

**No external navigation integration is enabled.** No personal coordinates or
destination are sent to a map, geocoder, router, Render API, or Supabase by the
new destination-preparation UI. No SDK, public demo endpoint, map iframe,
external-app deep link, fallback route, distance, or estimated travel time is
included. The existing device GPS / permission / Stop implementation is unchanged.

The only addition is an explicitly labelled, in-memory destination draft and
Driving/Walking preference. This is not destination search or navigation. Drafts
are cleared on navigation away and fresh load. The navigation button remains
disabled. Family sharing and SOS are outside this change.

## Options and evidence

### 1. Mappls / MapmyIndia — candidate, not approved for integration

- [Official REST API documentation](https://developer.mappls.com/documentation/sdk/rest-apis/Readme/)
  states that data is stored on a server in India. This is a provider statement
  about storage, not proof that every SDK request, processing service, CDN, log,
  backup, support path or subprocessor is India-only for this account.
- [Routing documentation](https://about.mappls.com/api/routes-and-navigation/)
  describes passenger-vehicle and pedestrian routing.
- [Privacy policy](https://about.mappls.com/about/privacy-policy) describes location
  collection and potential partner sharing. Obtain product/account-specific
  written commitments before sending personal origin/destination data.
- [API product page](https://about.mappls.com/api/) offers an evaluation/contact
  path. A current numeric production tariff and this account's quotas could not
  be verified from the reviewed official pages. **Production cost: written quote
  required** for map loads, search/geocoding, driving, walking, and rerouting.
- Private/on-premise deployment is another vendor option, with licensing and
  infrastructure quoted separately. Nothing has been purchased or provisioned.

### 2. Ola Maps — public prices, not acceptable under current residency requirement

- Its [Maps privacy policy](https://maps.olakrutrim.com/legal-docs/platform-privacy-policy.pdf),
  section "International transfers", permits transfers to recipients outside
  India. India branding or availability is not an India-only processing guarantee.
- [Official pricing](https://maps.olakrutrim.com/pricing), effective 1 September
  2026, shows tier 2 (100K–5M) Directions at **INR 0.199/request**, Directions
  Basic **INR 0.099/request**, Geocoding **INR 0.099/request**, and Autocomplete
  **INR 0.056/request**. The calculator shows a free first tier up to 100K; confirm
  account-level allowance allocation and taxes with the provider.
- Example of paid requests at those tier-2 rates: 10,000 Directions plus 10,000
  Geocoding requests = **INR 2,980**, excluding search, maps, taxes, and other
  usage. This is arithmetic for billable calls, not a production plan quote.
- These rates are comparison information only. **Do not connect this provider**
  without an overriding, verified India-only agreement and endpoint assessment.

### 3. Self-host a restricted India navigation service

- Run a licensed map-tile stack, [Nominatim](https://nominatim.org/release-docs/latest/admin/Installation/)
  or another self-hosted geocoder, and [Valhalla](https://valhalla.github.io/valhalla/)
  routing in a verified India region. Use separate driving/pedestrian costing.
- Browser requests must go directly to the India service. Proxying coordinates
  through the current Render backend would violate the requested boundary.
- Host map styles, tiles, fonts, sprites, logs and backups within the approved
  region. Disable external analytics and public-provider fallbacks. Audit network
  egress; do not infer residency from a domain name, company headquarters or IP.
- As an infrastructure price reference only, [AWS Lightsail's public pricing](https://aws.amazon.com/lightsail/pricing/)
  lists Linux general-purpose IPv4 bundles at **USD 84/month for 16 GB RAM** and
  **USD 164/month for 32 GB RAM**. Mumbai has half the listed bundle transfer
  allowance. These are single-VM examples, **not a validated full-stack budget**.
- City/state coverage, full-India imports, route graphs, address indexes and
  expected traffic determine capacity. Add storage, backups, build/update jobs,
  transfer, monitoring, taxes and engineering/operations. Benchmark before
  quoting a production total; no infrastructure change is authorized here.
- Respect map data licences and attribution. Public OSM/Nominatim/OSRM demo
  servers are not substitutes for the approved India-hosted service.

## Preconditions for real navigation

1. Choose coverage, traffic volumes and an approved provider or self-hosted stack.
2. Verify India-only processing for origin, destination, route queries, tiles,
   logs, backups, analytics and subprocessors, including SDK/token endpoints.
3. Obtain a valid account/quote, domain-restricted browser credentials where
   applicable, and a secure India-hosted gateway when credentials require it.
   Keep secrets out of the frontend and repository.
4. Obtain separate explicit user consent for the named service and purpose.
   Permission for device GPS is not consent to send coordinates to a provider.
5. Validate actual geocoding results and user-selected destination, driving and
   walking route geometry, distance, duration and maneuvers. Never derive a road
   distance/ETA from a straight line or fixed speed and present it as a route.
6. Add Start/Stop with cancellation of in-flight requests; discard late responses,
   clear position watches on stop/background, rate-limit rerouting, label stale
   routes, and report unavailable routes honestly. Verify with actual provider
   responses and negative/privacy tests before production deployment.

Current Render/Supabase configuration, Family and SOS flows remain untouched.
