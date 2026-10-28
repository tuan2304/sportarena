import type { Instrumentation } from 'next'

/**
 * Next gọi hàm này cho mọi lỗi không bắt được ở máy chủ (render trang, Server Action, Route Handler). Gửi lên Sentry
 * nếu có SENTRY_DSN. Chỉ gửi đường dẫn đã bỏ query (query có thể mang token) và loại lỗi, không gửi header hay body.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureErrorNow } = await import('@/lib/monitoring')
  await captureErrorNow('next.request', err, {
    method: request.method,
    path: request.path.split('?')[0],
    routePath: context.routePath,
    routeType: context.routeType,
    digest: typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined,
  })
}
