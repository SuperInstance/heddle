import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/web/components/ui/toast'
import { useToast } from '@/web/components/ui/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map((item) => (
        <Toast
          key={item.id}
          open={item.open}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(item.id)
            }
          }}
          variant={item.tone ?? 'info'}
        >
          <div>
            <ToastTitle>{item.title}</ToastTitle>
            {item.body ? <ToastDescription>{item.body}</ToastDescription> : null}
          </div>
          <ToastClose aria-label="Dismiss notification" />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
