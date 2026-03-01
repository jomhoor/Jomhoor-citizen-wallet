import { useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'

import type { AppTabScreenProps } from '@/route-types'
import { useAppLanguage } from '@/store'
import { cn, useBottomBarOffset } from '@/theme'
import { UiIcon } from '@/ui'

import AppContainer from '../../components/AppContainer'

/**
 * Agora Hub URL.
 * In local dev the Quasar frontend runs on the Mac's LAN IP so the
 * phone/simulator can reach it.  In production this will be the
 * deployed agora.jomhoor.org URL.
 *
 * TODO: move to Config / .env once deployed
 */
const AGORA_ORIGIN = 'http://192.168.0.130:3200'

export default function HubScreen(_props: AppTabScreenProps<'Hub'>) {
  const insets = useSafeAreaInsets()
  const bottomOffset = useBottomBarOffset()
  const webViewRef = useRef<WebView>(null)
  const [webViewReady, setWebViewReady] = useState(false)
  const appLanguage = useAppLanguage()

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
