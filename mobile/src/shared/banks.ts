/** Ngân hàng cho phép chọn khi khai báo tài khoản nhận cọc: mã BIN (chuẩn VietQR) và tên hiển thị. */
export const BANKS: ReadonlyArray<{ bin: string; name: string }> = [
  { bin: '970422', name: 'MB Bank' },
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970440', name: 'SeABank' },
  { bin: '970449', name: 'LPBank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970428', name: 'Nam A Bank' },
  { bin: '970409', name: 'BAC A BANK' },
]

const BANK_NAMES: Record<string, string> = Object.fromEntries(BANKS.map((b) => [b.bin, b.name]))

export function bankNameFromBin(bin: string | undefined | null): string | null {
  if (!bin) return null
  return BANK_NAMES[bin] ?? `Ngân hàng (BIN ${bin})`
}
