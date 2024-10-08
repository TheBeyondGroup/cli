import {buildCookies} from './storefront-renderer.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {
  defineEventHandler,
  clearResponseHeaders,
  sendProxy,
  getProxyRequestHeaders,
  getRequestWebStream,
  getRequestIP,
  type H3Event,
  type H3Error,
  sendError,
  setResponseHeaders,
  setResponseHeader,
  removeResponseHeader,
  setResponseStatus,
} from 'h3'
import {extname} from '@shopify/cli-kit/node/path'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import type {DevServerContext} from './types.js'

const VANITY_CDN_PREFIX = '/cdn/'
const EXTENSION_CDN_PREFIX = '/ext/cdn/'
const IGNORED_ENDPOINTS = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/wpm',
  '/services/',
]

const SESSION_COOKIE_NAME = '_shopify_essential'
const SESSION_COOKIE_REGEXP = new RegExp(`${SESSION_COOKIE_NAME}=([^;]*)(;|$)`)

/**
 * Forwards non-HTML requests to the remote SFR instance,
 * or mocks the result for certain endpoints.
 */
export function getProxyHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))) {
      // Mock successful status 204 response
      return null
    }

    if (canProxyRequest(event)) {
      return proxyStorefrontRequest(event, ctx)
    }
  })
}

/**
 * Check if a request should be proxied to the remote SFR instance.
 *
 * Cases:
 *
 * | Path              | Accept header      | Action   |
 * |-------------------|--------------------|----------|
 * | /cdn/...          |                    | Proxy    |
 * | /ext/cdn/...      |                    | Proxy    |
 * | /.../file.js      |                    | Proxy    |
 * | /payments/config  | application/json   | Proxy    |
 * | /search/suggest   | * / *              | No proxy |
 * | /.../index.html   |                    | No Proxy |
 *
 */
function canProxyRequest(event: H3Event) {
  if (event.method !== 'GET') return true
  if (event.path.startsWith(VANITY_CDN_PREFIX)) return true
  if (event.path.startsWith(EXTENSION_CDN_PREFIX)) return true

  const [pathname] = event.path.split('?') as [string]
  const extension = extname(pathname)
  const acceptsType = event.headers.get('accept') ?? '*/*'

  if (extension === '.html' || acceptsType.includes('text/html')) return false

  return Boolean(extension) || acceptsType !== '*/*'
}

function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replaceAll('.', '\\.')
}

/**
 * Replaces every VanityCDN-like (...myshopify.com/cdn/...) URL to pass through the local server.
 * It also replaces MainCDN-like (cdn.shopify.com/...) URLs to files that are known local assets.
 * Other MainCDN matches are left unmodified.
 */
export function injectCdnProxy(originalContent: string, ctx: DevServerContext) {
  let content = originalContent

  // -- Redirect all usages to the vanity CDN to the local server:
  const vanityCdnRE = new RegExp(`(https?:)?//${getStoreFqdnForRegEx(ctx)}${VANITY_CDN_PREFIX}`, 'g')
  content = content.replace(vanityCdnRE, VANITY_CDN_PREFIX)

  // -- Only redirect usages of the main CDN for known local theme and theme extension assets to the local server:
  const mainCdnRE = /(?:https?:)?\/\/cdn\.shopify\.com\/(.*?\/(assets\/[^?">]+)(?:\?|"|>|$))/g
  const filterAssets = (key: string) => key.startsWith('assets')
  const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter(filterAssets))
  const existingExtAssets = new Set([...ctx.localThemeExtensionFileSystem.files.keys()].filter(filterAssets))

  content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
    const isLocalAsset = matchedAsset && existingAssets.has(matchedAsset)
    const isLocalExtAsset = matchedAsset && existingExtAssets.has(matchedAsset) && pathname.startsWith('extensions/')
    const isImage = lookupMimeType(matchedAsset).startsWith('image/')

    // Do not proxy images, they may require filters or other CDN features
    if (isImage) return matchedUrl

    // Proxy theme extension assets
    if (isLocalExtAsset) return `${EXTENSION_CDN_PREFIX}${pathname}`

    // Proxy theme assets
    if (isLocalAsset) return `${VANITY_CDN_PREFIX}${pathname}`

    return matchedUrl
  })

  return content
}

function patchBaseUrlAttributes(html: string, ctx: DevServerContext) {
  const newBaseUrl = `http://${ctx.options.host}:${ctx.options.port}`
  const dataBaseUrlRE = new RegExp(`data-base-url=["']((?:https?:)?//${getStoreFqdnForRegEx(ctx)})[^"']*?["']`, 'g')

  return html.replace(dataBaseUrlRE, (match, m1) => match.replace(m1, newBaseUrl))
}

function patchCookieDomains(cookieHeader: string[], ctx: DevServerContext) {
  // Domains are invalid for localhost:
  const domainRE = new RegExp(`Domain=${getStoreFqdnForRegEx(ctx)};\\s*`, 'gi')
  return cookieHeader.map((value) => value.replace(domainRE, ''))
}

/**
 * Patches the result of an SFR HTML response to include the local proxies
 * and fix domain inconsistencies between remote instance and local dev.
 */
export async function patchRenderingResponse(ctx: DevServerContext, event: H3Event, response: NodeResponse) {
  setResponseStatus(event, response.status, response.statusText)
  setResponseHeaders(event, Object.fromEntries(response.headers.entries()))
  patchProxiedResponseHeaders(ctx, event, response)

  // We are decoding the payload here, remove the header:
  let html = await response.text()
  removeResponseHeader(event, 'content-encoding')

  html = injectCdnProxy(html, ctx)
  html = patchBaseUrlAttributes(html, ctx)

  return html
}

// These headers are meaningful only for a single transport-level connection,
// and must not be retransmitted by proxies or cached.
// https://tools.ietf.org/html/draft-ietf-httpbis-p1-messaging-14#section-7.1.3.1Acc
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-security-policy',
]

function patchProxiedResponseHeaders(ctx: DevServerContext, event: H3Event, response: Response | NodeResponse) {
  // Safari adds upgrade-insecure-requests to CSP and it needs to be removed:
  clearResponseHeaders(event, HOP_BY_HOP_HEADERS)

  // Link header preloads resources from global CDN, proxy it:
  const linkHeader = response.headers.get('Link')
  if (linkHeader) setResponseHeader(event, 'Link', injectCdnProxy(linkHeader, ctx))

  // Location header might contain the store domain, proxy it:
  const locationHeader = response.headers.get('Location')
  if (locationHeader) {
    const url = new URL(locationHeader, 'https://shopify.dev')
    url.searchParams.delete('_fd')
    url.searchParams.delete('pb')
    setResponseHeader(event, 'Location', url.href.replace(url.origin, ''))
  }

  // Cookies are set for the vanity domain, fix it for localhost:
  const setCookieHeader =
    'raw' in response.headers ? response.headers.raw()['set-cookie'] : response.headers.getSetCookie()
  if (setCookieHeader?.length) {
    setResponseHeader(event, 'Set-Cookie', patchCookieDomains(setCookieHeader, ctx))
    const latestShopifyEssential = setCookieHeader.join(',').match(SESSION_COOKIE_REGEXP)?.[1]
    if (latestShopifyEssential) {
      ctx.session.sessionCookies[SESSION_COOKIE_NAME] = latestShopifyEssential
    }
  }
}

/**
 * Filters headers to forward to SFR.
 */
export function getProxyStorefrontHeaders(event: H3Event) {
  const proxyRequestHeaders = getProxyRequestHeaders(event) as {[key: string]: string}

  // H3 already removes most hop-by-hop request headers:
  // https://github.com/unjs/h3/blob/ac6d83de2abe5411d4eaea8ecf2165ace16a65f3/src/utils/proxy.ts#L25
  for (const headerKey of HOP_BY_HOP_HEADERS) {
    delete proxyRequestHeaders[headerKey]
  }

  // Safari adds this by default. Remove it to prevent upgrading to HTTPS in localhost.
  // This header is however ignored by SFR and it always returns a CSP including it,
  // so we must also remove it from the response CSP.
  delete proxyRequestHeaders['upgrade-insecure-requests']

  const ipAddress = getRequestIP(event)
  if (ipAddress) proxyRequestHeaders['X-Forwarded-For'] = ipAddress

  return proxyRequestHeaders
}

function proxyStorefrontRequest(event: H3Event, ctx: DevServerContext) {
  const path = event.path.replaceAll(EXTENSION_CDN_PREFIX, '/')
  const host = event.path.startsWith(EXTENSION_CDN_PREFIX) ? 'cdn.shopify.com' : ctx.session.storeFqdn
  const url = new URL(path, `https://${host}`)
  url.searchParams.set('_fd', '0')
  url.searchParams.set('pb', '0')
  const headers = getProxyStorefrontHeaders(event)
  const body = getRequestWebStream(event)

  return sendProxy(event, url.toString(), {
    headers: {
      ...headers,
      // Required header for CDN requests
      referer: url.origin,
      // Update the cookie with the latest session
      cookie: buildCookies(ctx.session, {headers}),
    },
    fetchOptions: {
      ignoreResponseError: false,
      method: event.method,
      body,
      duplex: body ? 'half' : undefined,
      // Important to return 3xx responses to the client
      redirect: 'manual',
    },
    onResponse: patchProxiedResponseHeaders.bind(null, ctx),
  }).catch(async (error: H3Error) => {
    const pathname = event.path.split('?')[0]!
    if (error.statusCode >= 500 && !pathname.endsWith('.js.map')) {
      const cause = error.cause as undefined | Error
      renderWarning({
        headline: `Failed to proxy request to ${pathname} - ${error.statusCode} - ${error.statusMessage}`,
        body: cause?.stack ?? error.stack ?? error.message,
      })
    }

    await sendError(event, error)

    // Ensure other middlewares are not called:
    return null
  })
}
