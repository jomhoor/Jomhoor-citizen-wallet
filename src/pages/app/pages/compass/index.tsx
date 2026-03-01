import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebViewMessageEvent } from 'react-native-webview'
import { WebView } from 'react-native-webview'

import { COMPASS_ORIGIN } from '@/helpers/civic-compass-auth'
import { useEvmAddress, useEvmWallet } from '@/helpers/evm-wallet'
import type { AppTabScreenProps } from '@/route-types'
import { cn, useBottomBarOffset } from '@/theme'
import { UiIcon } from '@/ui'

import AppContainer from '../../components/AppContainer'

export default function CompassScreen(_props: AppTabScreenProps<'Compass'>) {
  const wallet = useEvmWallet()
  const address = useEvmAddress()
  const insets = useSafeAreaInsets()
  const bottomOffset = useBottomBarOffset()
  const webViewRef = useRef<WebView>(null)
  const [webViewReady, setWebViewReady] = useState(false)

  /**
   * JavaScript injected before the page loads.
   * Sets `window.__JOMHOOR_WALLET__` so the web app's jomhoor-bridge.ts
   * detects the embedded context and auto-authenticates via postMessage
   * instead of showing the RainbowKit wallet picker.
   */
  const injectedScript = address
    ? `
      (function() {
        window.__JOMHOOR_WALLET__ = { address: '${address}' };
        true;
      })();
    `
    : 'true;'

  /**
   * Handle messages from the web app (signing requests).
   *
   * Security: Only SIWE (EIP-4361) messages scoped to compass.jomhoor.org
   * are signed. Arbitrary message signing is rejected to prevent abuse
   * if the web app were ever compromised (XSS / supply-chain attack).
   */
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string
          payload?: { message?: string }
        }

        if (data.type === 'SIGN_MESSAGE' && data.payload?.message && wallet) {
          const msg = data.payload.message

          // Only allow SIWE messages for our domain
          const isSiwe =
            msg.includes('wants you to sign in with your Ethereum account') &&
            msg.includes('compass.jomhoor.org')

          if (!isSiwe) {
            console.warn('[CompassScreen] Rejected non-SIWE signing request')
            webViewRef.current?.injectJavaScript(`
              if (window.__jomhoorSignReject) {
                window.__jomhoorSignReject('Only SIWE authentication signing is allowed');
              }
              true;
            `)
            return
          }

          try {
            const signature = await wallet.signMessage(msg)

            // Send signature back to the web app
            // Use JSON.stringify to safely escape the value and prevent
            // JS injection if the string ever contains unexpected chars.
            webViewRef.current?.injectJavaScript(`
              if (window.__jomhoorSignCallback) {
                window.__jomhoorSignCallback(${JSON.stringify(signature)});
              }
              true;
            `)
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Signing failed'

            webViewRef.current?.injectJavaScript(`
              if (window.__jomhoorSignReject) {
                window.__jomhoorSignReject(${JSON.stringify(errorMsg)});
              }
              true;
            `)
          }
        }
      } catch {
        // Not JSON or unknown message — ignore
      }
    },
    [wallet],
  )

  // No wallet — show placeholder instead of broken WebView
  if (!address) {
    return (
      <AppContainer>
        <View className={cn('flex flex-1 items-center justify-center gap-4 p-8')}>
          <UiIcon
            libIcon='Ionicons'
            name='compass-outline'
            size={48}
            className='text-textSecondary'
          />
          <Text className='typography-subtitle3 text-center text-textSecondary'>
            Create a profile first to use Civic Compass.
          </Text>
        </View>
      </AppContainer>
    )
  }

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
            <Text className='typography-body3 mt-3 text-textSecondary'>Loading Civic Compass…</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: `${COMPASS_ORIGIN}/connect` }}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          onMessage={handleMessage}
          onLoadEnd={() => setWebViewReady(true)}
          onError={syntheticEvent => {
            const { nativeEvent } = syntheticEvent
            console.warn('[CompassScreen] WebView error:', nativeEvent.description)
          }}
          // Lock navigation to compass.jomhoor.org — prevent phishing via link hijack
          onShouldStartLoadWithRequest={request => {
            return request.url.startsWith(COMPASS_ORIGIN)
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
