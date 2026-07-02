'use client'

import { useState } from 'react'
import type { ItemInput } from '@/domain/types'
import type { ThemeKey } from '@/design/themes'
import BoardEditor from './BoardEditor'
import SharePanel from './SharePanel'

interface Props {
  token: string
  initialTitle: string
  initialItems: ItemInput[]
  initialTheme: ThemeKey
}

// Owns the live (unsaved) theme so the editor preview and the share panel —
// a sibling of the editor — re-theme together. The share panel's `--grad`
// background resolves against the nearest `[data-theme]` ancestor; without
// this wrapper that was <html>'s default theme, so the panel never followed
// the editor's theme picker.
export default function BoardWorkspace({ token, initialTitle, initialItems, initialTheme }: Props) {
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)
  return (
    <div data-theme={theme}>
      <BoardEditor
        token={token}
        initialTitle={initialTitle}
        initialItems={initialItems}
        initialTheme={initialTheme}
        onThemeChange={setTheme}
      />
      <SharePanel token={token} />
    </div>
  )
}
