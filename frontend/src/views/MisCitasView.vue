<template>
  <q-page class="appointments-page q-pa-xl">
    <div class="salon-background"></div>
    <main class="appointments-wrapper">
      <header class="appointments-title">
        <span class="sub-title-badge">✨ Tu espacio ✨</span>
        <h1 class="luxury-heading">Mis citas</h1>
        <p>Consulta y gestiona tus reservas en un solo lugar.</p>
      </header>

      <section class="appointments-card" aria-live="polite">
        <p v-if="cargando" class="status-message">Cargando tus citas...</p>
        <p v-else-if="errorCitas" class="form-error" role="alert">{{ errorCitas }}</p>
        <div v-else-if="misCitas.length" class="appointment-list">
          <article v-for="cita in misCitas" :key="cita._id" class="appointment-row">
            <header class="appointment-header">
              <div class="appointment-date">
                <span class="appointment-date-label">Fecha de tu cita</span>
                <strong>{{ formatearFecha(cita.fecha) }}</strong>
                <span class="appointment-time">{{ cita.horaInicio }}–{{ cita.horaFin }}</span>
              </div>
              <span class="status-badge" :class="`status-${cita.estado || 'pendiente'}`">{{ textoEstado(cita.estado) }}</span>
            </header>
            <div class="appointment-info">
              <div class="appointment-info-item">
                <span>Servicio</span>
                <strong>{{ cita.servicio }}</strong>
              </div>
              <div class="appointment-info-item">
                <span>Estilista</span>
                <strong>{{ cita.estilistaId?.nombre || 'Estilista' }}</strong>
              </div>
            </div>
            <div v-if="avisosCliente(cita).length" class="appointment-notices" role="status">
              <p v-for="(aviso, indice) in avisosCliente(cita)" :key="`${aviso.creadaEn}-${indice}`">{{ aviso.mensaje }}</p>
            </div>
            <div v-if="cita.propuestaCambio" class="change-proposal">
              <template v-if="cita.propuestaCambio.propuestoPor === 'estilista'">
                <strong>El estilista propone otro horario</strong>
                <span>{{ cita.propuestaCambio.fecha }} · {{ cita.propuestaCambio.horaInicio }}–{{ cita.propuestaCambio.horaFin }}</span>
                <div class="proposal-actions">
                  <AppButton type="button" class="accept-button" :disabled="gestionandoCita === cita._id" @click="gestionarCita(cita, 'responder', 'aceptar')">Aceptar cambio</AppButton>
                  <AppButton type="button" class="reject-button" :disabled="gestionandoCita === cita._id" @click="gestionarCita(cita, 'responder', 'rechazar')">Rechazar cambio</AppButton>
                </div>
              </template>
              <p v-else>Tu propuesta para cambiar la cita está pendiente de respuesta del estilista.</p>
            </div>
            <div v-if="!cita.propuestaCambio && ['pendiente', 'confirmada'].includes(cita.estado)" class="appointment-actions">
              <span class="actions-caption">¿Necesitas hacer un cambio?</span>
              <div class="actions-buttons">
                <AppButton type="button" class="change-button" @click="abrirPropuesta(cita)">Proponer otro horario</AppButton>
                <AppButton type="button" class="reject-button" :disabled="gestionandoCita === cita._id" @click="gestionarCita(cita, 'cancelar')">Cancelar cita</AppButton>
              </div>
            </div>
            <form v-if="citaAplazando === cita._id" class="proposal-form" @submit.prevent="gestionarCita(cita, 'proponer')">
              <FormField>Nueva fecha <input v-model="propuestaForm.fecha" type="date" :min="fechaMinima" required /></FormField>
              <FormField>Hora de inicio <input v-model="propuestaForm.horaInicio" type="time" step="1800" required /></FormField>
              <p class="status-help">El estilista deberá aceptar la propuesta. El horario se verificará antes de enviarla.</p>
              <div class="proposal-actions">
                <AppButton type="submit" class="accept-button" :disabled="gestionandoCita === cita._id">Enviar propuesta</AppButton>
                <AppButton type="button" class="change-button" @click="citaAplazando = ''">Cerrar</AppButton>
              </div>
            </form>
          </article>
        </div>
        <p v-else class="status-message">Todavía no tienes citas.</p>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config/api';
import AppButton from '../components/AppButton.vue';
import FormField from '../components/FormField.vue';

const auth = useAuthStore();
const misCitas = ref([]);
const errorCitas = ref('');
const cargando = ref(true);
const gestionandoCita = ref('');
const citaAplazando = ref('');
const hoy = new Date();
const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
const propuestaForm = ref({ fecha: fechaMinima, horaInicio: '09:00' });

function textoEstado(estado) {
  if (estado === 'pendiente') return 'Pendiente de aceptación';
  if (estado === 'rechazada') return 'Rechazada';
  if (estado === 'cancelada') return 'Cancelada';
  return 'Confirmada';
}

function formatearFecha(fechaTexto) {
  const [anio, mes, dia] = fechaTexto.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(anio, mes - 1, dia));
}

function avisosCliente(cita) {
  return (cita.avisos || []).filter((aviso) => aviso.paraRol === 'cliente');
}

function abrirPropuesta(cita) {
  citaAplazando.value = cita._id;
  propuestaForm.value = { fecha: fechaMinima, horaInicio: '09:00' };
}

async function cargarMisCitas() {
  cargando.value = true;
  try {
    const response = await fetch(`${API_URL}/citas`, { headers: auth.encabezadosAutenticados() });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudieron cargar tus citas.');
    misCitas.value = resultado;
    errorCitas.value = '';
  } catch (error) {
    errorCitas.value = error.message || 'No se pudieron cargar tus citas.';
  } finally {
    cargando.value = false;
  }
}

async function gestionarCita(cita, accion, decision) {
  gestionandoCita.value = cita._id;
  errorCitas.value = '';
  try {
    const body = accion === 'proponer'
      ? { accion, ...propuestaForm.value }
      : { accion, ...(decision ? { decision } : {}) };
    const response = await fetch(`${API_URL}/citas/${cita._id}/gestion`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth.encabezadosAutenticados() },
      body: JSON.stringify(body)
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudo actualizar la cita.');
    const indice = misCitas.value.findIndex((item) => item._id === cita._id);
    if (indice !== -1) misCitas.value[indice] = resultado.cita;
    citaAplazando.value = '';
  } catch (error) {
    errorCitas.value = error.message || 'No se pudo actualizar la cita.';
  } finally {
    gestionandoCita.value = '';
  }
}

onMounted(cargarMisCitas);
</script>

<style scoped>
.appointments-page { position: relative; min-height: 100vh; }
.salon-background {
  position: absolute; inset: 0;
  background: linear-gradient(125deg, rgba(35, 35, 31, .68), rgba(105, 75, 69, .2)),
              url('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=85&w=1800') center/cover;
}
.appointments-wrapper { position: relative; z-index: 1; width: min(100%, 1000px); margin: 0 auto; padding: 20px 0; }
.appointments-title { margin-bottom: 28px; padding: 24px 20px; border: 1px solid rgba(255, 255, 255, .72); border-radius: 18px; background: rgba(255, 255, 255, .94); box-shadow: 0 12px 32px rgba(35, 35, 31, .15); text-align: center; backdrop-filter: blur(8px); }
.appointments-title h1 { margin: 10px 0 6px; color: #352b30; font-size: clamp(2rem, 5vw, 2.7rem); text-shadow: 0 1px 0 rgba(255, 255, 255, .8); }
.appointments-title p { margin: 0; color: #5c5559; }
.sub-title-badge {
  display: inline-block; padding: 4px 14px; border: 1px solid rgba(216, 131, 158, .2); border-radius: 20px;
  background: rgba(216, 131, 158, .1); color: #b3637e; font-size: .85rem; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;
}
.luxury-heading { font-family: 'Playfair Display', serif; }
.appointments-card { padding: clamp(20px, 4vw, 36px); border: 1px solid rgba(216, 131, 158, .25); border-radius: 20px; background: rgba(255, 255, 255, .96); box-shadow: 0 15px 40px rgba(179, 99, 126, .08); }
.appointment-list { display: grid; gap: 18px; }
.appointment-row { position: relative; display: grid; gap: 18px; overflow: hidden; padding: 22px; border: 1px solid #eedce3; border-radius: 18px; background: linear-gradient(135deg, #fff 0%, #fffafb 100%); color: #554b4a; box-shadow: 0 8px 22px rgba(100, 54, 72, .055); }
.appointment-row::before { position: absolute; inset: 0 auto 0 0; width: 4px; background: linear-gradient(180deg, #d8839e, #a65370); content: ''; }
.appointment-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.appointment-date { display: grid; justify-items: start; gap: 6px; }
.appointment-date-label { color: #8f455e; font-size: .72rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.appointment-date > strong { color: #352b30; font: 600 clamp(1.05rem, 3vw, 1.28rem) 'Playfair Display', Georgia, serif; text-transform: capitalize; }
.appointment-time { display: inline-flex; align-items: center; padding: 5px 10px; border: 1px solid #efdce3; border-radius: 999px; background: #fff4f7; color: #704455; font-size: .84rem; font-weight: 600; }
.status-badge { display: inline-flex; align-items: center; width: fit-content; padding: 7px 12px; border: 1px solid transparent; border-radius: 999px; font-size: .74rem; font-weight: 700; white-space: nowrap; }
.status-pendiente { background: #fff4dc; color: #78550a; }
.status-confirmada { background: #eaf7ee; color: #28764b; }
.status-rechazada, .status-cancelada { background: #f6e9ec; color: #954458; }
.status-pendiente { border-color: #f1dfb8; }
.status-confirmada { border-color: #cde6d4; }
.status-rechazada, .status-cancelada { border-color: #ebd0d7; }
.appointment-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.appointment-info-item { display: grid; align-content: start; gap: 6px; min-width: 0; padding: 13px 15px; border: 1px solid #f0e4e9; border-radius: 12px; background: rgba(255, 255, 255, .8); }
.appointment-info-item > span { color: #867980; font-size: .72rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.appointment-info-item > strong { overflow-wrap: anywhere; color: #4b3b43; font-size: .92rem; font-weight: 600; }
.appointment-notices { display: grid; gap: 5px; padding: 10px 12px; border-left: 3px solid #b3637e; background: #fff4f7; color: #704455; font-size: .85rem; }
.appointment-notices p, .change-proposal p { margin: 0; }
.change-proposal, .proposal-form { display: grid; gap: 12px; padding: 16px; border: 1px solid #ead5dd; border-radius: 13px; background: #fff; }
.change-proposal > span { color: #62585c; }
.proposal-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.proposal-form label { display: grid; gap: 6px; color: #704455; font-size: .85rem; }
.proposal-form input { min-width: 0; padding: 10px; border: 1px solid #e5d5dc; border-radius: 8px; }
.proposal-form .status-help, .proposal-form .proposal-actions { grid-column: 1 / -1; }
.appointment-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 15px; border-top: 1px solid #f0e4e9; }
.actions-caption { color: #867980; font-size: .8rem; }
.actions-buttons, .proposal-actions { display: flex; flex-wrap: wrap; gap: 9px; }
.accept-button, .reject-button, .change-button { padding: 10px 14px; border: 1px solid transparent; border-radius: 10px; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
.accept-button:hover, .reject-button:hover, .change-button:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(72, 39, 51, .1); }
.accept-button { background: #e7f5eb; color: #28764b; }
.reject-button { background: #f8e9ed; color: #954458; }
.change-button { background: #f2edf0; color: #62585c; }
.accept-button { border-color: #cde6d4; }
.reject-button { border-color: #ebd0d7; }
.change-button { border-color: #e7dce1; }
.accept-button:disabled, .reject-button:disabled, .change-button:disabled { opacity: .6; cursor: wait; }
.status-message { margin: 0; color: #766a6d; text-align: center; }
.status-help { color: #766a6d; font-size: .85rem; }
.form-error { margin: 0; color: #a32d3d; font-size: .9rem; line-height: 1.5; }
@media (max-width: 600px) {
  .appointments-page { padding: 24px 16px; }
  .appointments-wrapper { padding: 10px 0; }
  .appointment-row { gap: 14px; padding: 18px 15px; }
  .appointment-header { align-items: flex-start; flex-direction: column-reverse; gap: 10px; }
  .appointment-info { grid-template-columns: 1fr; }
  .appointment-actions { align-items: stretch; flex-direction: column; }
  .actions-buttons { display: grid; grid-template-columns: 1fr; }
  .actions-buttons button { width: 100%; }
  .proposal-form { grid-template-columns: 1fr; }
  .proposal-form .status-help, .proposal-form .proposal-actions { grid-column: auto; }
}
</style>
