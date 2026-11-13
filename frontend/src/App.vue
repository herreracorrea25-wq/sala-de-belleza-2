<template>
  <q-layout view="lHh Lpr lFf" class="esther-layout">
    <!-- Cabecera / Navbar -->
    <q-header v-if="auth.usuario" class="esther-header">
      <q-toolbar class="q-px-xl q-py-md">
        <!-- Logo / Nombre del Salón -->
        <q-toolbar-title class="brand-title">
          Salón de Belleza <span class="brand-span">Esther</span>
        </q-toolbar-title>
        <!-- Menú de Navegación -->
        <div class="nav-links">
          <router-link v-if="auth.usuario?.rol === 'estilista'" to="/" class="nav-item">Agenda</router-link>
          <router-link v-if="auth.usuario?.rol === 'cliente'" to="/agendar" class="nav-item">Agendar</router-link>
          <router-link v-if="auth.usuario?.rol === 'cliente'" to="/mis-citas" class="nav-item">Mis citas</router-link>
          <router-link v-if="auth.usuario?.rol === 'estilista'" to="/clientes" class="nav-item">Clientes</router-link>
          <router-link to="/servicios" class="nav-item">Servicios</router-link>
          <router-link to="/cuenta" class="nav-item">Mi cuenta</router-link>
          <router-link to="/nosotros" class="nav-item">Nosotros</router-link>
          <AppButton class="nav-action" type="button" :aria-label="`Cerrar sesión de ${auth.usuario.nombre}`" @click="salir">
            <svg class="logout-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
          </AppButton>
        </div>
      </q-toolbar>
    </q-header>

    <!-- Contenedor principal de vistas -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import AppButton from './components/AppButton.vue'

const auth = useAuthStore()
const router = useRouter()

function salir() {
  const rol = auth.usuario?.rol === 'estilista' ? 'estilista' : 'cliente'
  auth.cerrarSesion()
  router.replace({ name: 'Login', query: { rol } })
}
</script>

<style scoped>
.esther-layout {
  background-color: #fcfbf9;
  color: #2d2a2e;
}

.esther-header {
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #eae3e7;
}

.brand-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: #2d2a2e;
}

.brand-span {
  color: #d8839e;
}

.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-item {
  color: #6b656a;
  text-decoration: none;
  font-weight: 400;
  font-size: 0.95rem;
  transition: color 0.3s ease;
}

.nav-item:hover {
  color: #d8839e;
}

.router-link-active {
  color: #d8839e;
  font-weight: 600;
}

.nav-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #8f455e;
  font: inherit;
  font-size: .92rem;
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}

.nav-action:hover {
  border-color: #efdce3;
  background: #fff4f7;
  color: #a65370;
}

.logout-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@media (max-width: 800px) {
  .q-toolbar { flex-wrap: wrap; justify-content: center; }
  .nav-links { justify-content: center; gap: 12px 18px; }
}
</style>