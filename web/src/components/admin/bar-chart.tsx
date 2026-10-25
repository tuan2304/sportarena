import { useTranslations } from 'next-intl'
interface BarChartProps {
  title: string
  data: Array<{ label: string; value: number }>
  /** Định dạng giá trị trong chú thích khi rê chuột / đọc màn hình */
  format?: (value: number) => string
  barClassName?: string
}

/** Biểu đồ cột đơn giản bằng CSS: không cần thư viện, đọc được bằng trình đọc màn hình qua bảng ẩn. */
export function BarChart({ title, data, format = (v) => String(v), barClassName = 'bg-emerald-600' }: BarChartProps) {
  const t = useTranslations('admin.chart')
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  // Nhãn trục chỉ hiện ở đầu, giữa và cuối để không chồng chữ khi có 90 ngày
  const labelAt = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{t('total', { value: format(total) })}</span>
      </figcaption>
      <div className="flex items-end gap-px h-36" aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="flex-1 h-full flex items-end" title={`${d.label}: ${format(d.value)}`}>
            <div
              className={`w-full rounded-t-sm ${d.value > 0 ? barClassName : 'bg-muted'}`}
              style={{ height: d.value > 0 ? `${Math.max(4, (d.value / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-px text-xs text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 min-w-0 relative h-4">
            {labelAt.has(i) && (
              <span className={`absolute whitespace-nowrap ${i === 0 ? 'left-0' : i === data.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                {d.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
