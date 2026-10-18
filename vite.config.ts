import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では https://<ユーザー名>.github.io/ClaudeGame006/ で公開されるため、
// base をリポジトリ名に合わせる。リポジトリ名を変えた場合はここも変更すること。
export default defineConfig({
  base: '/ClaudeGame006/',
  plugins: [react()],
});
