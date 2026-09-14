import {clsx, type ClassValue} from 'clsx'
import {extendTailwindMerge} from 'tailwind-merge'

// 把 DESIGN.md 的自定义字号注册进 font-size 组，避免 tailwind-merge 将其误判为文字颜色而互相覆盖
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-hero',
            'display-product',
            'section-display',
            'heading-section',
            'heading-card',
            'heading-feature',
            'body-lg',
            'body',
            'caption',
            'mono-label',
            'micro',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
