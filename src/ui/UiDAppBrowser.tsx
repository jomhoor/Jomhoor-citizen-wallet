import { useNavigation } from '@react-navigation/native'
import { type ReactNode, type RefObject, useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview'
import { WebView } from 'react-native-webview'

import UiIcon from './UiIcon'

interface Props {
  /** Initial URL to load. */
  uri: string
  /** Origin URL used for domain display and (optionally) navigation locking. */
  origin: string
  /** JavaScript to inject before page load. */
  injectedJS?: string
  /** Handler for postMessage events from the web content. */
  onMessage?: (event: WebViewMessageEvent) => void
  /** Lock navigation to only URLs starting with this origin. */
  lockToOrigin?: boolean
  /** Loading label shown while the page loads. */
  loadingLabel?: string
  /** Placeholder shown when the WebView can't render (e.g. no wallet). */
  placeholder?: ReactNode
  /** Optional external ref to access the WebView (e.g. for injectJavaScript). */
  webViewRef?: RefObject<WebView>
}

/** Extract display domain from a URL string. */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * In-app dApp browser shell — mimics the X (Twitter) in-app browser UX:
 * - Full-screen WebView
 * - Bottom toolbar with close button and current domain
 * - Safe area handling
 */
export function UiDAppBrowser({
  uri,
  origin,
  injectedJS,
  onMessage,
  lockToOrigin = false,
  loadingLabel = 'Loading…',
  placeholder,
  webViewRef: externalRef,
}: Props) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const internalRef = useRef<WebView>(null)
  const webViewRef = externalRef ?? (internalRef as RefObject<WebView>)
  const [ready, setReady] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(uri)

  const handleNavigationChange = useCallback((navState: WebViewNavigation) => {
    if (navState.url) setCurrentUrl(navState.url)
  }, [])

  if (placeholder) return <>{placeholder}</>

  return (
    <View style={{ flex: 1, backgroundColor: '#111111' }}>
      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: '#111111' }} />

      {/* WebView */}
      <View style={{ flex: 1 }}>
        {!ready && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#111111',
            }}
          >
            <ActivityIndicator size='large' color='#888' />
            <Text style={{ color: '#888', marginTop: 12, fontSize: 14 }}>{loadingLabel}</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri }}
          injectedJavaScriptBeforeContentLoaded={injectedJS}
          onMessage={onMessage}
          onLoadEnd={() => setReady(true)}
          onNavigationStateChange={handleNavigationChange}
          onError={() => setReady(true)}
          onShouldStartLoadWithRequest={
            lockToOrigin ? request => request.url.startsWith(origin) : undefined
          }
          domStorageEnabled
          javaScriptEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: '#111111' }}
          allowsBackForwardNavigationGestures
        />
      </View>

      {/* Bottom toolbar — X-style */}
      <View
        style={{
          backgroundColor: '#1a1a1a',
          borderTopWidth: 0.5,
          borderTopColor: '#333',
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 48,
            paddingHorizontal: 16,
          }}
        >
          {/* Close button */}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#333',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <UiIcon libIcon='Ionicons' name='close' size={18} color='#fff' />
          </Pressable>

          {/* Domain label */}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#2a2a2a',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#aaa', fontSize: 13 }}>{extractDomain(currentUrl)}</Text>
            </View>
          </View>

          {/* Spacer to balance the close button */}
          <View style={{ width: 32 }} />
        </View>
      </View>
    </View>
  )
}
