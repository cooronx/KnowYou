import {useState} from 'react'
import {X} from 'lucide-react'

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div className="relative bg-brand-black text-white">
      <div className="ky-shell flex h-9 items-center justify-center">
        <p className="text-micro">
          知乎黑客松 2026 · 校园新锐季　KnowYou 游客演示版
        </p>
        <button
          type="button"
          aria-label="关闭公告"
          onClick={() => setVisible(false)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
