import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebViewMessageEvent } from 'react-native-webview'
import { WebView } from 'react-native-webview'

import type { AppTabScreenProps } from '@/route-types'
import { identityStore, useAppLanguage, walletStore } from '@/store'
import { cn, useBottomBarOffset } from '@/theme'

import AppContainer from '../../components/AppContainer'

/**
 * Agora Hub URL.
 * In local dev the Quasar frontend runs on the Mac's LAN IP so the
 * phone/simulator can reach it.  In production this will be the
 * deployed agora.jomhoor.org URL.
 *
 * TODO: move to Config / .env once deployed
 */
const AGORA_ORIGIN = 'https://192.168.0.130:3200'

/**
 * PostMessage types exchanged between the Agora WebView and the
 * Jomhoor native app for wallet-based authentication.
 *
 * Flow:
 * 1. Agora frontend (step3-wallet) sends WALLET_CHALLENGE_REQUEST
 *    with the challenge token it received from the backend.
 * 2. This handler extracts the user's wallet address and nationality
 *    from local stores, then calls the Agora submit endpoint.
 * 3. The Agora frontend polls verify-status and completes auth.
 * 4. Once verified, Agora sends WALLET_AUTH_COMPLETE as confirmation.
 */
type AgoraMessage =
  | { type: 'WALLET_CHALLENGE_REQUEST'; challenge: string; apiBaseUrl?: string }
  | { type: 'WALLET_AUTH_COMPLETE'; success: boolean }

export default function HubScreen(_props: AppTabScreenProps<'Hub'>) {
  const insets = useSafeAreaInsets()
  const bottomOffset = useBottomBarOffset()
  const webViewRef = useRef<WebView>(null)
  const [webViewReady, setWebViewReady] = useState(false)
  const appLanguage = useAppLanguage()

  // ─── Wallet & Identity data for challenge submission ───────────────
  const publicKeyHash = walletStore.usePublicKeyHash()
  const identities = identityStore.useIdentityStore(s => s.identities)

  // Derive wallet address (hex string) from the Poseidon hash of the
  // BabyJubjub public key.  The hash is a 32-byte Uint8Array.
  const walletAddress = publicKeyHash
    ? '0x' +
      Array.from(publicKeyHash)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    : null

  // First registered identity's nationality (2-letter ISO code).
  const nationality =
    identities.length > 0 ? identities[0].document.personDetails.nationality : null

  // ─── PostMessage handler ───────────────────────────────────────────
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: AgoraMessage
      try {
        msg = JSON.parse(event.nativeEvent.data) as AgoraMessage
      } catch {
        return // ignore non-JSON messages
      }

      if (msg.type === 'WALLET_CHALLENGE_REQUEST') {
        const { challenge, apiBaseUrl } = msg

        if (!walletAddress) {
          console.warn(
            '[HubScreen] WALLET_CHALLENGE_REQUEST received but no wallet address available',
          )
          return
        }

        const nat = nationality ?? 'IR'

        // Auto-submit wallet credentials — no consent dialog needed since
        // the user explicitly opened the Hub tab inside their own app.
        // Only pseudonymous wallet ID + nationality are shared.

        // Use the API base URL sent by the Agora frontend.
        // In local dev the Quasar dev-server and the API run on different
        // ports, so we must POST to the API directly.
        // Falls back to AGORA_ORIGIN (works in production where nginx proxies).
        const submitUrl = apiBaseUrl
          ? `${apiBaseUrl}/api/v1/auth/wallet/submit`
          : `${AGORA_ORIGIN}/api/v1/auth/wallet/submit`

        console.log(
          '[HubScreen] Submitting wallet challenge:',
          challenge.slice(0, 8) + '…',
          'to',
          submitUrl,
        )

        try {
          const res = await fetch(submitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challenge,
              walletAddress,
              nationality: nat,
            }),
          })

          const body = await res.json()
          console.log('[HubScreen] Challenge submit response:', body)
        } catch (err) {
          console.error('[HubScreen] Failed to submit wallet challenge:', err)
        }
      } else if (msg.type === 'WALLET_AUTH_COMPLETE') {
        console.log('[HubScreen] Wallet auth complete, success:', msg.success)
      }
    },
    [walletAddress, nationality],
  )

  /**
   * Tell the Agora frontend it's running inside Jomhoor so the
   * embedded-browser guard is skipped, and sync the display language
   * from the app's language store.
   */
  const injectedScript = `
    (function() {
      window.__JOMHOOR__ = true;
      localStorage.setItem('displayLanguage', '${appLanguage}');
      true;
    })();
  `

  return (
    <AppContainer>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: bottomOffset,
        }}
      >
        {/* Loading overlay */}
        {!webViewReady && (
          <View
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center bg-backgroundPrimary',
            )}
          >
            <ActivityIndicator size='large' />
            <Text className='typography-body3 mt-3 text-textSecondary'>Loading Hub…</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: AGORA_ORIGIN }}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          onMessage={handleMessage}
          onLoadEnd={() => setWebViewReady(true)}
          onError={syntheticEvent => {
            const { nativeEvent } = syntheticEvent
            console.warn('[HubScreen] WebView error:', nativeEvent.description)
            setWebViewReady(true) // dismiss spinner even on error
          }}
          domStorageEnabled
          javaScriptEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: '#111111' }}
          allowsBackForwardNavigationGestures
        />
      </View>
    </AppContainer>
  )
}
