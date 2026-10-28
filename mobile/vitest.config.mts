import { defineConfig } from 'vitest/config'

// Chỉ kiểm thử phần logic thuần (không import react-native); chạy với múi giờ UTC để chứng minh không phụ thuộc máy.
process.env.TZ = 'UTC'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
