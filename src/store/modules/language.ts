import { create } from 'zustand'
import { combine, createJSONStorage, persist } from 'zustand/middleware'

import { zustandStorage } from '@/store/helpers'

/**
 * Supported display languages for the Jomhoor app.
 * This list will grow as more translations are added.
 */
export type AppLanguage = 'fa' | 'en'

export const APP_LANGUAGES: Record<AppLanguage, string> = {
  fa: 'فارسی',
  en: 'English',
}

const useLanguageStore = create(
  persist(
    combine(
      {
        /** Current display language. Defaults to Farsi. */
        language: 'fa' as AppLanguage,
      },
      set => ({
        setLanguage: (language: AppLanguage) => set({ language }),
      }),
    ),
    {
      name: 'language',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)

/** Read the current app language (reactive hook). */
export const useAppLanguage = () => useLanguageStore(s => s.language)

/** Set the app language (can be called from a future language selector). */
export const useSetAppLanguage = () => useLanguageStore(s => s.setLanguage)

export default useLanguageStore
