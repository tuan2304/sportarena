/**
 * Quy tắc tải ảnh lên Supabase Storage: ảnh cụm sân (chủ sân) và ảnh đại diện (mỗi người).
 *
 * Trình duyệt tải thẳng lên Storage; quyền ghi do chính sách của bucket quyết định (xem migration 20261031):
 *   club-images/<club_id>/<uuid>.<ext>   chỉ chủ cụm sân
 *   avatars/<user_id>/<uuid>.<ext>       chỉ chính người đó
 * Sau khi tải, Server Action chỉ lưu những URL thật sự nằm trong thư mục của chủ thể đó. Phần kiểm tra ở đây
 * là lớp thứ hai: ngay cả khi ai đó gọi thẳng Server Action với URL tự chế, URL ngoài kho của mình bị từ chối.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const MAX_CLUB_IMAGES = 8

export type ImageBucket = 'club-images' | 'avatars'

const EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Lỗi nếu file không hợp lệ, null nếu được. Chỉ tin MIME khai báo cho thông báo sớm; bucket tự kiểm tra lại ở server. */
export function validateImageFile(file: { type: string; size: number }, maxBytes: number): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Chỉ nhận ảnh JPG, PNG hoặc WebP'
  }
  if (file.size <= 0) return 'File ảnh trống'
  if (file.size > maxBytes) return `Ảnh quá lớn, tối đa ${Math.round(maxBytes / 1024 / 1024)} MB`
  return null
}

/** Đuôi file lấy từ loại ảnh, không từ tên file người dùng đặt (tên có thể giả, chứa ký tự lạ hay ..). */
export function imageExtension(type: string): string | null {
  return (EXTENSIONS as Record<string, string>)[type] ?? null
}

export function imagePath(ownerId: string, uuid: string, type: string): string | null {
  const ext = imageExtension(type)
  return ext ? `${ownerId}/${uuid}.${ext}` : null
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE = new RegExp(`^(${UUID})\\.(jpg|png|webp)$`)

function publicPrefix(bucket: ImageBucket, supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/`
}

export function publicImageUrl(bucket: ImageBucket, path: string, supabaseUrl: string): string {
  return `${publicPrefix(bucket, supabaseUrl)}${path}`
}

/**
 * Tách đường dẫn trong bucket từ URL công khai nếu URL thuộc đúng kho của chủ thể (clubId hay userId).
 * Trả null với mọi URL khác: sai bucket, sai thư mục, sai tên file, có ..., có query hay fragment.
 */
export function ownImagePath(bucket: ImageBucket, ownerId: string, url: string, supabaseUrl: string): string | null {
  const prefix = publicPrefix(bucket, supabaseUrl)
  if (!url.startsWith(prefix)) return null
  const rest = url.slice(prefix.length)
  const [folder, file, ...extra] = rest.split('/')
  if (extra.length > 0 || folder !== ownerId || !file || !FILE.test(file)) return null
  return `${folder}/${file}`
}

export function isOwnImageUrl(bucket: ImageBucket, ownerId: string, url: string, supabaseUrl: string): boolean {
  return ownImagePath(bucket, ownerId, url, supabaseUrl) !== null
}

export type ClubImagesResult = { ok: true; images: string[] } | { ok: false; error: string }

/**
 * Danh sách ảnh mới của cụm sân: mỗi ảnh phải là ảnh trong kho của chính cụm sân, hoặc đã có sẵn trong danh sách cũ
 * (ví dụ ảnh mặc định, ảnh dán link từ trước). Không trùng lặp, tối đa MAX_CLUB_IMAGES.
 */
export function validateClubImages(
  clubId: string,
  next: unknown,
  current: readonly string[],
  supabaseUrl: string
): ClubImagesResult {
  if (!Array.isArray(next) || next.some((u) => typeof u !== 'string')) {
    return { ok: false, error: 'Danh sách ảnh không hợp lệ' }
  }
  const unique = [...new Set(next as string[])]
  if (unique.length > MAX_CLUB_IMAGES) return { ok: false, error: `Mỗi cụm sân tối đa ${MAX_CLUB_IMAGES} ảnh` }

  const known = new Set(current)
  for (const url of unique) {
    if (!known.has(url) && !isOwnImageUrl('club-images', clubId, url, supabaseUrl)) {
      return { ok: false, error: 'Có ảnh không thuộc kho ảnh của cụm sân này' }
    }
  }
  return { ok: true, images: unique }
}
