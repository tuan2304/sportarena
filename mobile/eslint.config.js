const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // Ba luật dưới đây là phép kiểm tra của React Compiler, mà app chưa bật compiler. Mẫu "tải dữ liệu trong useEffect rồi setState"
      // và dùng Date.now() lúc render là chủ ý ở mọi màn hình, nên không coi là lỗi.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // src/shared/* được sao chép nguyên văn từ web (npm run sync:mobile), không sửa kiểu mảng ở một bên
      '@typescript-eslint/array-type': 'off',
    },
  },
])
