<template>
  <q-page class="esther-page q-pa-xl flex flex-center">
    <div class="salon-background"></div>

    <div class="content-wrapper">
      <div class="text-center q-mb-xl section-heading">
        <span class="sub-title-badge">✨ Tratamientos Exclusivos ✨</span>
        <h1 class="luxury-heading text-h3 text-weight-bold text-dark q-mt-sm q-mb-xs">Nuestros Servicios</h1>
        <p class="text-subtitle1 text-muted luxury-subtitle">Tratamientos diseñados para realzar tu belleza natural</p>
      </div>

      <section v-if="auth.usuario?.rol === 'estilista'" class="esther-card service-creator">
        <div class="creator-heading">
          <span class="creator-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <div>
            <span class="creator-eyebrow">Tu catálogo</span>
            <h2 class="luxury-heading text-pink">Crear un servicio</h2>
            <p class="text-muted">Añade una nueva experiencia a tu perfil para que tus clientes puedan reservarla.</p>
          </div>
        </div>
        <form class="service-form" @submit.prevent="crearServicio">
          <FormField class="service-field service-name-field">
            <span>Nombre del servicio</span>
            <input v-model.trim="nuevo.nombre" maxlength="80" placeholder="Ej. Manicure semipermanente" required />
          </FormField>
          <FormField class="service-field">
            <span>Precio</span>
            <span class="input-with-prefix">
              <span class="input-affix">COP</span>
              <input v-model.number="nuevo.precio" type="number" min="1" step="1" inputmode="numeric" placeholder="0" required />
            </span>
          </FormField>
          <FormField class="service-field">
            <span>Duración</span>
            <span class="input-with-suffix">
              <input v-model.number="nuevo.duracionMinutos" type="number" min="15" max="480" step="1" inputmode="numeric" placeholder="60" required />
              <span class="input-affix">min</span>
            </span>
          </FormField>
          <FormField class="service-field service-wide-field">
            <span>Detalle del servicio</span>
            <textarea v-model.trim="nuevo.descripcion" maxlength="500" rows="3" placeholder="Describe brevemente en qué consiste el servicio." />
          </FormField>
          <FormField class="service-field service-wide-field">
            <span>¿Qué incluye la experiencia?</span>
            <textarea v-model="nuevo.incluye" rows="4" placeholder="Escribe cada detalle en una línea.&#10;Ej. Asesoría personalizada&#10;Ej. Acabado profesional" />
            <small class="service-field-hint">Agrega cada elemento en una línea distinta (máximo 10).</small>
          </FormField>
          <div class="service-form-feedback" aria-live="polite">
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <p v-else-if="mensaje" class="form-success" role="status">{{ mensaje }}</p>
          </div>
          <AppButton class="btn-esther service-submit" type="submit" :disabled="guardando">
            <span>{{ guardando ? 'Guardando servicio...' : 'Agregar servicio' }}</span>
            <svg v-if="!guardando" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </AppButton>
        </form>
      </section>
      
      <div class="row q-col-gutter-lg justify-center">
        <div class="col-12 col-md-4" v-for="servicio in servicios" :key="servicio.id">
          <div class="esther-card">
            <!-- Imagen superior ajustada a la tarjeta -->
            <div class="card-image-container">
              <img :src="servicio.imagen" :alt="`Servicio de ${servicio.nombre}`" class="service-img" loading="lazy" />
            </div>

            <!-- Contenido de la tarjeta -->
            <div class="card-content flex column justify-between">
              <div>
                <div class="service-card-heading">
                  <span class="service-category">{{ servicio.categoria }}</span>
                  <AppButton
                    v-if="auth.usuario?.rol === 'estilista' && servicio.editable"
                    class="service-edit-trigger"
                    type="button"
                    :aria-label="`Editar ${servicio.nombre}`"
                    title="Editar servicio"
                    @click="abrirEdicion(servicio)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                  </AppButton>
                </div>
                <div class="text-h6 text-pink luxury-heading text-weight-bold q-mb-sm">{{ servicio.nombre }}</div>
                <p class="service-description">{{ servicio.descripcion }}</p>
                <h3 class="includes-title">Tu experiencia incluye</h3>
                <ul class="includes-list">
                  <li v-for="detalle in servicio.incluye" :key="detalle">{{ detalle }}</li>
                </ul>
                <p class="duration-line">Duración aproximada: {{ servicio.duracionMinutos }} minutos</p>
              </div>
              <div class="text-center">
                <span class="price-tag">{{ servicio.precio }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="mostrarEdicion" persistent>
      <div class="service-edit-dialog esther-card" role="dialog" aria-labelledby="edit-service-title">
        <div class="service-edit-heading">
          <div>
            <span class="creator-eyebrow">Tu catálogo</span>
            <h2 id="edit-service-title" class="luxury-heading text-pink">Editar servicio</h2>
          </div>
          <AppButton class="service-edit-close" type="button" aria-label="Cerrar edición" @click="mostrarEdicion = false">
            <span aria-hidden="true">×</span>
          </AppButton>
        </div>
        <form class="service-form service-edit-form" @submit.prevent="guardarEdicion">
          <FormField class="service-field service-name-field">
            <span>Nombre del servicio</span>
            <input v-model.trim="servicioEditado.nombre" maxlength="80" required />
          </FormField>
          <FormField class="service-field">
            <span>Precio</span>
            <span class="input-with-prefix">
              <span class="input-affix">COP</span>
              <input v-model.number="servicioEditado.precio" type="number" min="1" step="1" inputmode="numeric" required />
            </span>
          </FormField>
          <FormField class="service-field">
            <span>Duración</span>
            <span class="input-with-suffix">
              <input v-model.number="servicioEditado.duracionMinutos" type="number" min="15" max="480" step="1" inputmode="numeric" required />
              <span class="input-affix">min</span>
            </span>
          </FormField>
          <FormField class="service-field service-wide-field">
            <span>Detalle del servicio</span>
            <textarea v-model.trim="servicioEditado.descripcion" maxlength="500" rows="3" placeholder="Describe brevemente en qué consiste el servicio." />
          </FormField>
          <FormField class="service-field service-wide-field">
            <span>¿Qué incluye la experiencia?</span>
            <textarea v-model="servicioEditado.incluye" rows="4" placeholder="Escribe cada detalle en una línea." />
            <small class="service-field-hint">Agrega cada elemento en una línea distinta (máximo 10).</small>
          </FormField>
          <div class="service-form-feedback" aria-live="polite">
            <p v-if="errorEdicion" class="form-error" role="alert">{{ errorEdicion }}</p>
          </div>
          <div class="service-edit-actions">
            <AppButton class="service-cancel" type="button" :disabled="guardandoEdicion" @click="mostrarEdicion = false">Cancelar</AppButton>
            <AppButton class="btn-esther service-submit" type="submit" :disabled="guardandoEdicion">
              {{ guardandoEdicion ? 'Guardando...' : 'Guardar cambios' }}
            </AppButton>
          </div>
        </form>
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config/api';
import { presentarServicio } from '../config/servicios';
import AppButton from '../components/AppButton.vue';
import FormField from '../components/FormField.vue';

const servicios = ref([]);
const auth = useAuthStore();
const nuevo = reactive({ nombre: '', precio: '', duracionMinutos: 60, descripcion: '', incluye: '' });
const guardando = ref(false);
const error = ref('');
const mensaje = ref('');
const mostrarEdicion = ref(false);
const guardandoEdicion = ref(false);
const errorEdicion = ref('');
const servicioEditandoId = ref('');
const servicioEditado = reactive({ nombre: '', precio: '', duracionMinutos: 60, descripcion: '', incluye: '' });

function detallesEnLineas(texto) {
  return texto.split(/\r?\n/).map((detalle) => detalle.trim()).filter(Boolean);
}

function abrirEdicion(servicio) {
  servicioEditandoId.value = servicio.id;
  servicioEditado.nombre = servicio.nombre;
  servicioEditado.precio = Number(String(servicio.precio).replace(/\./g, '').replace(/[^\d]/g, ''));
  servicioEditado.duracionMinutos = servicio.duracionMinutos;
  servicioEditado.descripcion = servicio.descripcion || '';
  servicioEditado.incluye = (servicio.incluye || []).join('\n');
  errorEdicion.value = '';
  mostrarEdicion.value = true;
}

async function guardarEdicion() {
  if (guardandoEdicion.value) return;
  guardandoEdicion.value = true;
  errorEdicion.value = '';
  try {
    const response = await fetch(`${API_URL}/servicios/${encodeURIComponent(servicioEditandoId.value)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth.encabezadosAutenticados() },
      body: JSON.stringify({
        ...servicioEditado,
        incluye: detallesEnLineas(servicioEditado.incluye)
      })
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('El servidor no pudo procesar la edición. Verifica la URL configurada y reinicia el backend.');
    }
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudo actualizar el servicio.');
    const servicioActualizado = presentarServicio(resultado.servicio);
    servicios.value = servicios.value.map((servicio) =>
      servicio.id === servicioActualizado.id ? servicioActualizado : servicio
    );
    mostrarEdicion.value = false;
  } catch (err) {
    errorEdicion.value = err.message || 'No se pudo actualizar el servicio.';
  } finally {
    guardandoEdicion.value = false;
  }
}

onMounted(async () => {
  try {
    const response = await fetch(`${API_URL}/servicios`, {
      headers: auth.encabezadosAutenticados()
    });
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    const catalogo = await response.json();
    servicios.value = catalogo.map(presentarServicio);
  } catch (error) {
    console.error('Error al cargar servicios:', error);
  }
});

async function crearServicio() {
  if (guardando.value) return;
  guardando.value = true;
  error.value = '';
  mensaje.value = '';
  try {
    const response = await fetch(`${API_URL}/servicios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.encabezadosAutenticados() },
      body: JSON.stringify({
        ...nuevo,
        incluye: detallesEnLineas(nuevo.incluye)
      })
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('El servidor de API no tiene habilitada la creación de servicios. Revisa la URL configurada y reinicia el backend.');
    }
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudo crear el servicio.');
    servicios.value = [...servicios.value, presentarServicio({ ...resultado.servicio, editable: true })];
    Object.assign(nuevo, { nombre: '', precio: '', duracionMinutos: 60, descripcion: '', incluye: '' });
    mensaje.value = resultado.mensaje;
  } catch (err) {
    error.value = err.message || 'No se pudo crear el servicio.';
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.esther-page { 
  position: relative; 
  min-height: 100vh; 
  overflow: hidden; 
}

.salon-background {
  position: absolute; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%;
  background: linear-gradient(125deg, rgba(35, 35, 31, .65), rgba(105, 75, 69, .18)),
              url('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=85&w=1800') center/cover;
  z-index: 1;
}

.content-wrapper { 
  position: relative; 
  z-index: 2; 
  width: 100%; 
  max-width: 1100px; 
  padding: 20px 0; 
}

.sub-title-badge {
  display: inline-block; 
  font-size: 0.85rem; 
  letter-spacing: 2px; 
  color: #b3637e; 
  text-transform: uppercase; 
  font-weight: 600;
  background: rgba(216, 131, 158, 0.1); 
  padding: 4px 14px; 
  border-radius: 20px; 
  border: 1px solid rgba(216, 131, 158, 0.2);
}

.luxury-heading { 
  font-family: 'Playfair Display', serif; 
  letter-spacing: -0.5px; 
  color: #232023; 
}

.luxury-subtitle { 
  font-family: 'Playfair Display', serif; 
  font-style: italic; 
  color: #5c5559; 
}

.text-pink { 
  color: #b3637e !important; 
}

.text-muted { 
  color: #5c5559 !important; 
}
.service-creator { position: relative; display: grid; gap: 24px; margin-bottom: 32px; padding: clamp(22px, 4vw, 36px); border-color: rgba(179, 99, 126, .28); }
.service-creator::before { position: absolute; inset: 0 0 auto; height: 4px; background: linear-gradient(90deg, #d8839e, #a65370 65%, #e8cbd5); content: ''; }
.creator-heading { display: flex; align-items: center; gap: 16px; }
.creator-icon { display: grid; flex: 0 0 50px; width: 50px; height: 50px; place-items: center; border: 1px solid #efdce3; border-radius: 15px; background: linear-gradient(145deg, #fff4f7, #f8e8ee); color: #a65370; }
.creator-icon svg, .service-submit svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.creator-eyebrow { color: #a65370; font-size: .7rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.service-creator h2 { margin: 3px 0 4px; font-size: clamp(1.45rem, 3vw, 1.9rem); }
.service-creator .creator-heading p { margin: 0; color: #70656b !important; font-size: .88rem; line-height: 1.5; }
.service-form { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, .85fr) minmax(0, .85fr); gap: 16px; align-items: end; }
.service-field { display: grid; min-width: 0; gap: 8px; color: #554b4a; font-size: .82rem; font-weight: 700; }
.service-field > span:first-child { padding-left: 2px; }
.service-form input, .service-form textarea { width: 100%; min-width: 0; min-height: 48px; padding: 10px 13px; border: 1px solid #e8d7de; border-radius: 11px; outline: none; background: #fffafb; color: #352b30; font: inherit; font-size: .92rem; transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.service-form textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
.service-form textarea[rows="4"] { min-height: 108px; }
.service-form input::placeholder, .service-form textarea::placeholder { color: #b6a8ae; font-weight: 400; }
.service-form input:focus, .service-form textarea:focus { border-color: #b3637e; outline: none; background: #fff; box-shadow: 0 0 0 3px rgba(216, 131, 158, .15); }
.service-wide-field { grid-column: 1 / -1; }
.service-field-hint { color: #897a80; font-size: .75rem; font-weight: 400; }
.input-with-prefix, .input-with-suffix { display: flex; min-width: 0; align-items: center; overflow: hidden; border: 1px solid #e8d7de; border-radius: 11px; background: #fffafb; transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.input-with-prefix:focus-within, .input-with-suffix:focus-within { border-color: #b3637e; background: #fff; box-shadow: 0 0 0 3px rgba(216, 131, 158, .15); }
.service-form .input-with-prefix input, .service-form .input-with-suffix input { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.input-affix { padding: 0 11px; color: #9c6578; font-size: .75rem; font-weight: 700; white-space: nowrap; }
.input-with-prefix .input-affix { border-right: 1px solid #f0e2e8; }
.input-with-suffix .input-affix { color: #867980; }
.service-form-feedback { grid-column: 1 / -1; min-height: 0; }
.service-form-feedback:has(p) { margin-top: -6px; }
.form-error, .form-success { margin: 0; font-size: .86rem; line-height: 1.45; }
.form-error { color: #a32d3d; }
.form-success { color: #28764b; }
.service-submit { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; gap: 10px; padding: 11px 20px; border-radius: 11px; }
.service-submit svg { width: 18px; height: 18px; }
.service-submit:disabled { opacity: .7; cursor: wait; transform: none; }
@media (max-width: 700px) {
  .service-form { grid-template-columns: 1fr 1fr; gap: 14px; }
  .service-name-field, .service-wide-field, .service-form-feedback { grid-column: 1 / -1; }
  .service-submit { grid-column: 1 / -1; width: 100%; }
}
@media (max-width: 420px) {
  .creator-heading { align-items: flex-start; gap: 12px; }
  .creator-icon { flex-basis: 42px; width: 42px; height: 42px; border-radius: 13px; }
  .service-form { grid-template-columns: 1fr; }
  .service-name-field, .service-wide-field, .service-form-feedback, .service-submit { grid-column: auto; }
  .service-edit-form { grid-template-columns: 1fr; }
  .service-edit-form .service-name-field, .service-edit-form .service-wide-field, .service-edit-form .service-form-feedback, .service-edit-actions { grid-column: auto; }
  .service-edit-actions { flex-direction: column-reverse; }
  .service-edit-actions > button { width: 100%; }
}
.duration-line { color: #8f455e; font-size: 0.85rem; font-weight: 700; }
.service-category {
  display: inline-block;
  margin-bottom: 9px;
  color: #9a536a;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1.1px;
}
.service-card-heading { display: flex; min-height: 31px; align-items: flex-start; justify-content: space-between; gap: 12px; }
.service-edit-trigger { display: grid; flex: 0 0 34px; width: 34px; height: 34px; margin: -7px -7px 0 0; place-items: center; border: 1px solid rgba(179, 99, 126, .18); border-radius: 50%; background: rgba(255, 248, 250, .85); color: #9c6578; cursor: pointer; transition: background .2s ease, color .2s ease, border-color .2s ease, transform .2s ease; }
.service-edit-trigger:hover, .service-edit-trigger:focus-visible { transform: translateY(-1px); border-color: #d8839e; background: #fff0f4; color: #8e3f5b; outline: none; }
.service-edit-trigger svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.service-edit-dialog { display: grid; width: min(100%, 520px); max-height: 90vh; gap: 24px; overflow-y: auto; padding: clamp(22px, 4vw, 32px); }
.service-edit-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.service-edit-heading h2 { margin: 4px 0 0; font-size: 1.6rem; }
.service-edit-close { display: grid; flex: 0 0 36px; width: 36px; height: 36px; place-items: center; border: 1px solid #efdee4; border-radius: 50%; background: #fffafb; color: #725e66; cursor: pointer; font-size: 1.5rem; line-height: 1; }
.service-edit-close:hover { background: #fff0f4; color: #8e3f5b; }
.service-edit-form { grid-template-columns: 1fr 1fr; }
.service-edit-form .service-name-field, .service-edit-form .service-wide-field, .service-edit-form .service-form-feedback, .service-edit-actions { grid-column: 1 / -1; }
.service-edit-actions { display: flex; justify-content: flex-end; gap: 12px; }
.service-cancel { min-height: 48px; padding: 10px 18px; border: 1px solid #e8d7de; border-radius: 11px; background: #fff; color: #62545a; font: inherit; font-size: .9rem; font-weight: 700; cursor: pointer; }
.service-cancel:hover { background: #fff7f9; }
.service-cancel:disabled { opacity: .7; cursor: wait; }
.service-description { margin: 0 0 16px; color: #5c5559; font-size: .92rem; line-height: 1.65; }
.includes-title { margin: 0 0 8px; color: #393236; font-size: .9rem; font-weight: 700; }
.includes-list { display: grid; gap: 6px; margin: 0 0 16px; padding-left: 19px; color: #5c5559; font-size: .85rem; line-height: 1.45; }

/* Tarjeta principal */
.esther-card {
  background-color: rgba(255, 255, 255, 0.96); 
  backdrop-filter: blur(12px);
  border: 1px solid rgba(216, 131, 158, 0.25); 
  border-radius: 20px; 
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 15px 40px rgba(179, 99, 126, 0.08); 
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.esther-card:hover { 
  transform: translateY(-4px); 
  border-color: #d8839e; 
}

/* Contenedor de la imagen arriba para que cubra perfectamente sin deformarse */
.card-image-container {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background-color: #f7f0f3;
}

.service-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.esther-card:hover .service-img {
  transform: scale(1.05);
}

/* Contenido interno de la tarjeta */
.card-content {
  padding: 28px;
  flex-grow: 1;
}

.price-tag {
  display: inline-block; 
  background: rgba(216, 131, 158, 0.1); 
  color: #b3637e; 
  font-weight: 700;
  padding: 8px 24px; 
  border-radius: 20px; 
  border: 1px solid rgba(216, 131, 158, 0.25); 
  font-size: 1.05rem;
}
</style>