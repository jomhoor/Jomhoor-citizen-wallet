import { useCallback } from 'react'
import type { WebViewMessageEvent } from 'react-native-webview'

import { Config } from '@/config'
import type { AppTabScreenProps } from '@/route-types'
import { identityStore, useAppLanguage, walletStore } from '@/store'
import { UiDAppBrowser } from '@/ui'

const AGORA_ORIGIN = Config.AGORA_ORIGIN

type AgoraMessage =
  | { type: 'WALLET_CHALLENGE_REQUEST'; challenge: string; apiBaseUrl?: string }
  | { type: 'WALLET_AUTH_COMPLETE'; success: boolean }

export default function HubScreen(_props: AppTabScreenProps<'Hub'>) {
  const appLanguage = useAppLanguage()

  const publicKeyHash = walletStore.usePublicKeyHash()
  const identities = identityStore.useIdentityStore(s => s.identities)

  const walletAddress = publicKeyHash
    ? '0x' +
      Array.from(publicKeyHash)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    : null

  const nationality =
    identities.length > 0 ? identities[0].document.personDetails.nationality : null

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: AgoraMessage
      try {
        msg = JSON.parse(event.nativeEvent.data) as AgoraMessage
      } catch {
        return
      }

      if (msg.type === 'WALLET_CHALLENGE_REQUEST') {
        const { challenge, apiBaseUrl } = msg

        if (!walletAddress) {
          console.warn('[HubScreen] WALLET_CHALLENGE_REQUEST but no wallet address')
          return
        }

        const nat = nationality ?? 'IR'
        const submitUrl = apiBaseUrl
          ? `${apiBaseUrl}/api/v1/auth/wallet/submit`
          : `${AGORA_ORIGIN}/api/v1/auth/wallet/submit`

        console.log('[HubScreen] Submitting wallet challenge:', challenge.slice(0, 8) + '…')

        try {
          const res = await fetch(submitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challenge, walletAddress, nationality: nat }),
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

  const injectedScript = `
    (function() {
      window.__JOMHOOR__ = true;
      localStorage.setItem('displayLanguage', '${appLanguage}');
      true;
    })();
  `

  return (
    <UiDAppBrowser
      uri={AGORA_ORIGIN}
      origin={AGORA_ORIGIN}
      injectedJS={injectedScript}
      onMessage={handleMessage}
      loadingLabel='Loading Hub…'
    />
  )
}
