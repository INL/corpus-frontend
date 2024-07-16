import { createRouter, createWebHistory } from 'vue-router'
import CorporaView from '../views/CorporaView.vue'

/** Base url of the app on the client. Never ends in '/' */
declare const CONTEXT_URL: string;

const router = createRouter({
  history: createWebHistory(CONTEXT_URL),
  routes: [
    {
      path: '/',
      name: 'corpora',
      component: CorporaView
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router
