<template>
  <q-page class="esther-page q-pa-xl flex flex-center">
    <div class="salon-background"></div>
    <section class="profile-card">
      <span class="sub-title-badge">Tu espacio personal</span>
      <h1 class="luxury-heading">Mi cuenta</h1>
      <p class="profile-intro">Actualiza tus datos y mantén segura tu contraseña.</p>

      <form class="profile-form" @submit.prevent="guardarPerfil">
        <FormField>
          Nombre y apellido
          <input v-model.trim="form.nombre" autocomplete="name" required />
        </FormField>
        <FormField>
          Correo electrónico
          <input v-model.trim="form.email" type="email" autocomplete="email" required />
        </FormField>
        <FormField>
          Teléfono
          <input v-model.trim="form.telefono" type="tel" autocomplete="tel" required />
        </FormField>
        <fieldset v-if="form.rol === 'estilista'" class="service-options">
          <legend>Servicios que realizas</legend>
          <label v-for="servicio in servicios" :key="servicio.id" class="service-option">
            <input v-model="form.servicios" type="checkbox" :value="servicio.id" />
            {{ servicio.nombre }}
          </label>
        </fieldset>

        <div class="password-section">
          <h2>Cambiar contraseña</h2>
          <p>Déjalo en blanco si no deseas cambiarla.</p>
          <FormField>
            Contraseña actual
            <input v-model="form.currentPassword" type="password" autocomplete="current-password" />
          </FormField>
          <FormField>
            Nueva contraseña
            <input v-model="form.newPassword" type="password" minlength="8" autocomplete="new-password" />
          </FormField>
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="mensaje" class="form-success" role="status">{{ mensaje }}</p>
        <AppButton class="save-button" type="submit" :disabled="cargando || guardando">
          {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
        </AppButton>
      </form>
    </section>
  </q-page>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { API_URL } from '../config/api'
import AppButton from '../components/AppButton.vue'
import FormField from '../components/FormField.vue'

const auth = useAuthStore()
const servicios = ref([])
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const mensaje = ref('')
const form = reactive({
  nombre: '',
  email: '',
  telefono: '',
  rol: auth.usuario?.rol || 'cliente',
  servicios: [],
  currentPassword: '',
  newPassword: ''
})

onMounted(async () => {
  try {
    const solicitudes = [
      fetch(`${API_URL}/perfil`, { headers: auth.encabezadosAutenticados() })
    ]
    if (form.rol === 'estilista') solicitudes.push(fetch(`${API_URL}/servicios`))
    const [respuestaPerfil, respuestaServicios] = await Promise.all(solicitudes)
    const resultadoPerfil = await respuestaPerfil.json()
    if (!respuestaPerfil.ok) throw new Error(resultadoPerfil.error || 'No se pudo cargar tu cuenta.')
    Object.assign(form, resultadoPerfil.perfil)
    if (respuestaServicios) {
      if (!respuestaServicios.ok) throw new Error('No se pudieron cargar los servicios de tu perfil.')
      servicios.value = await respuestaServicios.json()
    }
  } catch (err) {
    error.value = err.message || 'No se pudo cargar tu cuenta.'
  } finally {
    cargando.value = false
  }
})

async function guardarPerfil() {
  if (guardando.value) return
  guardando.value = true
  error.value = ''
  mensaje.value = ''
  try {
    const body = {
      nombre: form.nombre,
      email: form.email,
      telefono: form.telefono,
      servicios: form.servicios,
      currentPassword: form.currentPassword,
      newPassword: form.newPassword
    }
    const response = await fetch(`${API_URL}/perfil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth.encabezadosAutenticados() },
      body: JSON.stringify(body)
    })
    const resultado = await response.json()
    if (!response.ok) throw new Error(resultado.error || 'No se pudo actualizar tu cuenta.')
    Object.assign(form, resultado.perfil, { currentPassword: '', newPassword: '' })
    Object.assign(auth.usuario, {
      nombre: resultado.perfil.nombre,
      email: resultado.perfil.email,
      telefono: resultado.perfil.telefono
    })
    mensaje.value = resultado.mensaje
  } catch (err) {
    error.value = err.message || 'No se pudo actualizar tu cuenta.'
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.esther-page { position: relative; min-height: 100vh; overflow-x: hidden; }
.salon-background { position: absolute; inset: 0; background: linear-gradient(125deg, rgba(35, 35, 31, .65), rgba(105, 75, 69, .18)), url('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=85&w=1800') center/cover; }
.profile-card { position: relative; z-index: 1; width: min(100%, 620px); padding: 34px; border-radius: 18px; background: rgba(255, 255, 255, .97); box-shadow: 0 15px 40px rgba(30, 20, 25, .2); }
.sub-title-badge { color: #a2546c; font-size: .78rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
h1 { margin: 8px 0; color: #292525; font-size: 2rem; }
.profile-intro, .password-section p { color: #6e6463; }
.profile-form { display: grid; gap: 16px; margin-top: 24px; }
.profile-form > label, .password-section label { display: grid; gap: 7px; color: #554b4a; font-size: .88rem; font-weight: 600; }
.profile-form input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #d8cdca; border-radius: 4px; background: #fff; font: inherit; }
.service-options { display: grid; gap: 10px; border: 1px solid #e4d8dc; border-radius: 8px; padding: 14px; }
.service-options legend { padding: 0 6px; color: #8f455e; font-weight: 700; }
.service-option { display: flex; align-items: center; gap: 8px; color: #554b4a; }
.service-option input { width: 18px; min-height: 18px; accent-color: #8f455e; }
.password-section { display: grid; gap: 12px; border-top: 1px solid #e9dfe2; padding-top: 18px; }
.password-section h2 { margin: 0; color: #8f455e; font-size: 1.1rem; }
.password-section p { margin: -8px 0 0; font-size: .88rem; }
.form-error { margin: 0; color: #a32d3d; }
.form-success { margin: 0; color: #28764b; }
.save-button { min-height: 46px; border: 0; border-radius: 5px; background: #8f455e; color: white; font-weight: 700; cursor: pointer; }
.save-button:disabled { opacity: .65; cursor: wait; }
@media (max-width: 520px) { .profile-card { padding: 24px 20px; } }
</style>
