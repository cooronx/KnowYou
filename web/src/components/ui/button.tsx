import * as React from 'react'
import {Slot} from '@radix-ui/react-slot'
import {cva, type VariantProps} from 'class-variance-authority'
import {cn} from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        // DESIGN.md: button-primary，近黑 pill
        primary: 'rounded-pill bg-brand-near text-white hover:bg-brand-black',
        // 深色底上的白色 pill
        inverse: 'rounded-pill bg-white text-brand-near hover:bg-white/90',
        // 描边 pill，用于次级动作与筛选
        outline: 'rounded-xl border border-ink-hairline bg-transparent text-ink hover:border-brand-near',
        // 更轻的描边 pill，深色底上使用
        'outline-inverse': 'rounded-xl border border-white/30 bg-transparent text-white hover:border-white',
        // 文本动作，下划线
        link: 'text-ink underline decoration-ink-hairline underline-offset-4 hover:decoration-brand-near',
        ghost: 'rounded-pill text-ink hover:bg-surface-line',
        // 兼容旧命名
        default: 'rounded-pill bg-brand-near text-white hover:bg-brand-black',
        secondary: 'rounded-pill bg-surface-warm text-ink hover:bg-[#e4e1da]',
      },
      size: {
        sm: 'h-9 px-4 text-micro',
        default: 'h-11 px-6',
        lg: 'h-12 px-7 text-body',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, asChild = false, ...props}, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({variant, size, className}))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export {Button, buttonVariants}
