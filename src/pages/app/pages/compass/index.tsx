import { useCallback, useRef } from 'react'
import { Text, View } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import type WebView from 'react-native-webview'

import { COMPASS_ORIGIN } from '@/helpers/civic-compass-auth'
import { useEvmAddress, useEvmWallet } from '@/helpers/evm-wallet'
import type { AppTabScreenProps } from '@/route-types'
import { cn } from '@/theme'
import { UiDAppBrowser, UiIcon } from '@/ui'

import AppContainer from '../../components/AppContainer'

export default function CompassScreen(_props: AppTabScreenProps<'Compass'>) {
  const wallet = useEvmWallet()
  const address = useEvmAddress()
  const webViewRef = useRef<WebView>(null)

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
   * Only SIWE messages scoped to compass.jomhoor.org are signed.
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
    <UiDAppBrowser
      uri={`${COMPASS_ORIGIN}/connect`}
      origin={COMPASS_ORIGIN}
      injectedJS={injectedScript}
      onMessage={handleMessage}
      lockToOrigin
      loadingLabel='Loading Civic Compass…'
      webViewRef={webViewRef}
    />
  )
}
