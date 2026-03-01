/**
 * Civic Compass SIWE (Sign-In With Ethereum) authentication helper.
 *
 * Uses the app's EVM wallet to authenticate with the Civic Compass backend,
 * returning a JWT that can be injected into the WebView's localStorage
 * so the user lands directly on the dashboard without manual sign-in.
 */
import type { Wallet } from 'ethers'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const COMPASS_ORIGIN = 'https://compass.jomhoor.org'
const COMPASS_API = `${COMPASS_ORIGIN}/api`
const COMPASS_DOMAIN = 'compass.jomhoor.org'
const SIWE_CHAIN_ID = 137 // Polygon

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompassUser {
  id: string
  walletAddress: string
  isSmartWallet: boolean
  isResearchParticipant: boolean
}

export interface CompassAuthResult {
  user: CompassUser
  token: string
}

/* ------------------------------------------------------------------ */
/*  SIWE message builder (EIP-4361, no external dep)                   */
/* ------------------------------------------------------------------ */

function buildSiweMessage(params: {
  domain: string
  address: string
  uri: string
  version: string
  chainId: number
  nonce: string
  statement: string
  issuedAt: string
}): string {
  // EIP-4361 canonical format
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    '',
    params.statement,
    '',
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Authenticate with the Civic Compass backend using SIWE.
 *
 * 1. GET  /api/auth/nonce          → { nonce }
 * 2. Build + sign EIP-4361 message
 * 3. POST /api/auth/verify         → { user, token }
 */
export async function authenticateWithCompass(wallet: Wallet): Promise<CompassAuthResult> {
  // 1. Fetch nonce
  const nonceRes = await fetch(`${COMPASS_API}/auth/nonce`)
  if (!nonceRes.ok) throw new Error(`Nonce request failed: ${nonceRes.status}`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }

  // 2. Build SIWE message
  const message = buildSiweMessage({
    domain: COMPASS_DOMAIN,
    address: wallet.address,
    uri: COMPASS_ORIGIN,
    version: '1',
    chainId: SIWE_CHAIN_ID,
    nonce,
    statement: 'Sign in to Civic Compass',
    issuedAt: new Date().toISOString(),
  })

  // 3. Sign
  const signature = await wallet.signMessage(message)

  // 4. Verify with backend
  const verifyRes = await fetch(`${COMPASS_API}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  })

  if (!verifyRes.ok) {
    const body = await verifyRes.text()
    throw new Error(`SIWE verify failed (${verifyRes.status}): ${body}`)
  }

  return (await verifyRes.json()) as CompassAuthResult
}

/**
 * Build the JavaScript to inject into the WebView that writes the
 * Civic Compass zustand state into localStorage **before** the page loads.
 *
 * The web app's zustand store is persisted under the key `civic-compass-store`
 * with a `state` wrapper. We write exactly what the web app expects so it
 * recognises the user as already authenticated and routes straight to /dashboard.
 */
export function buildAuthInjectionScript(auth: CompassAuthResult): string {
  const storeValue = JSON.stringify({
    state: {
      user: auth.user,
      token: auth.token,
      isGuest: false,
      theme: 'dark',
      language: 'fa',
      fontSize: 'normal',
      hasVisited: true,
      hasOnboarded: true,
    },
    version: 1,
  })

  // Escape for embedding inside a JS string literal
  const escaped = storeValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  return `
    (function() {
      try {
        localStorage.setItem('civic-compass-store', '${escaped}');
      } catch(e) {}
      true; // required by react-native-webview
    })();
  `
}
