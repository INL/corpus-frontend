
// if (import.meta.env.DEV) {
// import '@vite/client'
// }


import './assets/main.css'
import 'vite/modulepreload-polyfill' // usually in builtin index.html, but we disabled that.

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
