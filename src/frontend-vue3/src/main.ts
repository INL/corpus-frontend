import 'vite/modulepreload-polyfill' // usually imported in index.html, but we don't have one. (it's contained in the java code.)

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
