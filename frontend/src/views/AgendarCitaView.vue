<template>
  <q-page class="esther-page q-pa-xl flex flex-center">
    <div class="salon-background"></div>

    <div class="form-wrapper">
      <div class="text-center q-mb-xl section-heading">
        <span class="sub-title-badge">✨ Reservaciones ✨</span>
        <h1 class="luxury-heading text-h3 text-weight-bold text-dark q-mt-sm q-mb-xs">
          Agendar cita, {{ auth.usuario?.nombre }}
        </h1>
        <p class="text-subtitle1 text-muted luxury-subtitle">Consulta la agenda semanal de los estilistas y elige un horario disponible.</p>
      </div>

      <div class="esther-card">
        <p v-if="errorCarga" class="form-error" role="alert">{{ errorCarga }}</p>
        <form v-else class="esther-form" @submit.prevent="registrarCita">
          <FormField as="div" class="input-group">
            <label id="servicio-label" class="input-label">1. ¿Qué servicio quieres agendar?</label>
            <q-select
              v-model="form.servicioId"
              class="salon-select"
              :options="servicios"
              option-value="id"
              option-label="nombre"
              emit-value
              map-options
              outlined
              rounded
              behavior="menu"
              popup-content-class="salon-select-popup"
              aria-labelledby="servicio-label"
              placeholder="Seleccione un servicio..."
            >
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps" class="salon-select-option">
                  <q-item-section>
                    <q-item-label class="salon-option-name">{{ opt.nombre }}</q-item-label>
                    <q-item-label caption class="salon-option-detail">
                      ${{ opt.precio }} <span aria-hidden="true">·</span> {{ opt.duracionMinutos }} min
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-if="servicioSeleccionado" class="service-preview">
              <strong>{{ servicioSeleccionado.categoria }}</strong>
              <span>{{ servicioSeleccionado.descripcion }}</span>
              <span><b>Incluye:</b> {{ servicioSeleccionado.incluye.join(' · ') }}</span>
              <router-link to="/servicios">Ver todos los servicios y sus detalles</router-link>
            </div>
          </FormField>

          <FormField as="div" class="input-group">
            <label id="estilista-label" class="input-label">2. Elige el estilista</label>
            <q-select
              v-model="form.estilistaId"
              class="salon-select"
              :options="estilistasDisponibles"
              option-value="_id"
              option-label="nombre"
              emit-value
              map-options
              outlined
              rounded
              behavior="menu"
              popup-content-class="salon-select-popup"
              aria-labelledby="estilista-label"
              :disable="!servicioSeleccionado || !estilistasDisponibles.length"
              placeholder="Selecciona un estilista para consultar su turno..."
            >
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps" class="salon-select-option">
                  <q-item-section>
                    <q-item-label class="salon-option-name">{{ opt.nombre }}</q-item-label>
                    <q-item-label class="salon-option-detail">{{ opt.especialidad }}</q-item-label>
                    <q-item-label caption class="salon-option-schedule">
                      {{ diasTexto(opt.diasTrabajo || [1, 2, 3, 4, 5, 6]) }} ·
                      {{ opt.horaInicioTrabajo || '09:00' }}–{{ opt.horaFinTrabajo || '18:00' }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <span v-if="servicioSeleccionado && estilistasDisponibles.length === 0" class="form-error" role="status">
              Por ahora no hay un estilista con especialidad en {{ servicioSeleccionado.nombre }}. Elige otro servicio o consulta más tarde.
            </span>
            <span v-else-if="!form.estilistaId" class="status-help">
              Al elegirlo, podrás seleccionar un día y consultar sus horas disponibles.
            </span>
          </FormField>

          <section v-if="form.servicioId && form.estilistaId" class="weekly-agenda" aria-live="polite">
            <div class="weekly-agenda-heading">
              <div>
                <span class="agenda-step">3. Selecciona un día</span>
                <h2>Agenda de {{ estilistaSeleccionado?.nombre }}</h2>
                <p>Elige un día para consultar sus horas disponibles.</p>
              </div>
              <div class="week-navigation">
                <AppButton type="button" aria-label="Semana anterior" @click="moverSemana(-7)">‹</AppButton>
                <span>{{ rangoSemana }}</span>
                <AppButton type="button" aria-label="Semana siguiente" @click="moverSemana(7)">›</AppButton>
              </div>
            </div>
            <p v-if="cargandoAgendaSemanal" class="availability-message">Consultando la agenda de la semana...</p>
            <p v-else-if="errorAgendaSemanal" class="form-error" role="alert">{{ errorAgendaSemanal }}</p>
            <div v-else class="weekly-agenda-days">
              <AppButton
                v-for="dia in diasAgendaSemanal"
                :key="dia.fecha"
                type="button"
                class="weekly-agenda-day"
                :class="{ selected: form.fecha === dia.fecha }"
                :disabled="dia.pasado || !dia.horarios.length"
                :aria-pressed="form.fecha === dia.fecha"
                @click="form.fecha = dia.fecha"
              >
                <strong>{{ dia.nombre }}</strong>
                <span v-if="dia.pasado" class="weekly-agenda-empty">Pasado</span>
                <template v-else-if="dia.horarios.length">
                  <span class="weekly-agenda-count">{{ dia.horarios.length }} {{ dia.horarios.length === 1 ? 'hora disponible' : 'horas disponibles' }}</span>
                </template>
                <span v-else class="weekly-agenda-empty">{{ dia.consultado ? 'Sin disponibilidad' : 'No disponible' }}</span>
              </AppButton>
            </div>
          </section>

          <p v-if="avisoAgenda" class="busy-warning" role="status">{{ avisoAgenda }}</p>

          <section v-if="form.estilistaId && form.fecha" class="time-picker">
            <div class="time-picker-heading">
              <div>
                <span class="agenda-step">4. Elige tu horario</span>
                <p>Selecciona la hora que mejor te convenga.</p>
              </div>
              <span v-if="horariosDisponibles.length" class="time-count">
                {{ horariosDisponibles.length }} disponibles
              </span>
            </div>
            <div v-if="cargandoDisponibilidad" class="time-picker-state" role="status">
              Consultando horarios...
            </div>
            <div v-else-if="horariosDisponibles.length" class="time-slots" role="group" aria-label="Horas disponibles">
              <AppButton
                type="button"
                class="time-slot"
                :class="{ selected: form.horaInicio === slot.horaInicio }"
                v-for="slot in horariosDisponibles"
                :key="slot.horaInicio"
                :aria-pressed="form.horaInicio === slot.horaInicio"
                @click="form.horaInicio = slot.horaInicio"
              >
                <span class="time-slot-start">{{ slot.horaInicio }}</span>
                <span class="time-slot-end">hasta {{ slot.horaFin }}</span>
                <span v-if="form.horaInicio === slot.horaInicio" class="time-slot-check" aria-hidden="true">✓</span>
              </AppButton>
            </div>
            <p v-else-if="disponibilidad" class="time-picker-state" role="status">
              No hay horas disponibles este día. Prueba con otra fecha.
            </p>
          </section>

          <p v-if="slotSeleccionado?.disponible" class="availability-message success-message" role="status">
            {{ estilistaSeleccionado.nombre }} tiene libre de {{ slotSeleccionado.horaInicio }} a {{ slotSeleccionado.horaFin }},
            y tu agenda también está libre. La solicitud queda pendiente de aceptación del estilista.
          </p>
          <p v-else-if="form.horaInicio && slotSeleccionado" class="form-error" role="alert">
            {{ slotSeleccionado.motivos.join(' ') }}
          </p>
          <p v-if="availabilityError" class="form-error" role="alert">{{ availabilityError }}</p>
          <p v-if="errorReserva" class="form-error" role="alert">{{ errorReserva }}</p>

          <section v-if="slotSeleccionado?.disponible && servicioSeleccionado && estilistaSeleccionado" class="booking-summary" aria-live="polite">
            <h2>Resumen de tu cita</h2>
            <p><strong>Servicio:</strong> {{ servicioSeleccionado.nombre }} ({{ servicioSeleccionado.duracionMinutos }} min)</p>
            <p><strong>Fecha:</strong> {{ form.fecha }}</p>
            <p><strong>Horario:</strong> {{ slotSeleccionado.horaInicio }}–{{ slotSeleccionado.horaFin }}</p>
            <p><strong>Estilista:</strong> {{ estilistaSeleccionado.nombre }} · {{ estilistaSeleccionado.especialidad }}</p>
          </section>

          <div class="q-mt-xl">
            <AppButton
              type="submit"
              class="btn-esther full-width"
              :disabled="guardando || cargandoDisponibilidad || !slotSeleccionado?.disponible"
            >
              {{ guardando ? 'Enviando solicitud...' : 'Solicitar cita al estilista' }}
            </AppButton>
          </div>
        </form>
      </div>

    </div>
    <Teleport to="body">
      <div v-if="mensaje" class="booking-toast" role="status" aria-live="polite">
        <span class="booking-toast-icon" aria-hidden="true">✓</span>
        <span>
          <strong>¡Cita agendada correctamente!</strong>
          <small>{{ mensaje }}</small>
        </span>
      </div>
    </Teleport>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config/api';
import { normalizarEspecialidad, presentarServicio } from '../config/servicios';
import AppButton from '../components/AppButton.vue';
import FormField from '../components/FormField.vue';

const auth = useAuthStore();

const servicios = ref([]);
const estilistas = ref([]);
const disponibilidad = ref(null);
const errorCarga = ref('');
const availabilityError = ref('');
const errorReserva = ref('');
const mensaje = ref('');
const avisoAgenda = ref('');
const cargandoDisponibilidad = ref(false);
const agendaSemanal = ref([]);
const cargandoAgendaSemanal = ref(false);
const errorAgendaSemanal = ref('');
const guardando = ref(false);
let solicitudDisponibilidad = 0;
let solicitudAgendaSemanal = 0;
let mensajeTimer;
const hoy = new Date();
const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

const form = ref({ servicioId: '', estilistaId: '', fecha: fechaMinima, horaInicio: '' });

const servicioSeleccionado = computed(() => servicios.value.find((servicio) => servicio.id === form.value.servicioId));
const estilistasDisponibles = computed(() => {
  if (!servicioSeleccionado.value) return [];
  const servicio = servicioSeleccionado.value;
  const servicioNormalizado = normalizarEspecialidad(servicio.nombre);
  return estilistas.value.filter((estilista) => {
    const asignados = Array.isArray(estilista.servicios) ? estilista.servicios : [];
    return asignados.length
      ? asignados.some((asignado) =>
        String(asignado) === String(servicio.id) || normalizarEspecialidad(asignado) === servicioNormalizado
      )
      : String(estilista.especialidad || '')
        .split(',')
        .some((especialidad) => normalizarEspecialidad(especialidad) === servicioNormalizado);
  });
});
const estilistaSeleccionado = computed(() => estilistasDisponibles.value.find((estilista) => estilista._id === form.value.estilistaId));
const slotSeleccionado = computed(() => disponibilidad.value?.slots.find((slot) => slot.horaInicio === form.value.horaInicio));
const horariosDisponibles = computed(() => disponibilidad.value?.slots.filter((slot) => slot.disponible) || []);
const fechaInicioSemana = computed(() => {
  const [anio, mes, dia] = (form.value.fecha || fechaMinima).split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7));
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
});
const diasAgendaSemanal = computed(() => {
  const [anio, mes, dia] = fechaInicioSemana.value.split('-').map(Number);
  const lunes = new Date(anio, mes - 1, dia);
  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + indice);
    const fechaTexto = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    const datos = agendaSemanal.value.find((diaAgenda) => diaAgenda.fecha === fechaTexto);
    return {
      fecha: fechaTexto,
      nombre: new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(fecha),
      pasado: fechaTexto < fechaMinima,
      consultado: Boolean(datos),
      horarios: datos?.disponibilidad?.slots.filter((slot) => slot.disponible) || []
    };
  });
});
const rangoSemana = computed(() => {
  const primerDia = diasAgendaSemanal.value[0];
  const ultimoDia = diasAgendaSemanal.value[6];
  return `${primerDia.nombre} – ${ultimoDia.nombre}`;
});

async function cargarOpciones() {
  const [respuestaServicios, respuestaEstilistas] = await Promise.all([
    fetch(`${API_URL}/servicios`),
    fetch(`${API_URL}/estilistas`, { headers: auth.encabezadosAutenticados() })
  ]);
  if (!respuestaServicios.ok || !respuestaEstilistas.ok) {
    throw new Error('No se pudieron cargar los servicios y estilistas.');
  }
  servicios.value = (await respuestaServicios.json()).map(presentarServicio);
  estilistas.value = await respuestaEstilistas.json();
  if (!estilistas.value.length) throw new Error('Todavía no hay estilistas con una cuenta activa para recibir citas.');
}

watch(() => form.value.servicioId, () => {
  if (form.value.estilistaId && !estilistasDisponibles.value.some((estilista) => estilista._id === form.value.estilistaId)) {
    form.value.estilistaId = '';
  }
});

function moverSemana(dias) {
  const [anio, mes, dia] = fechaInicioSemana.value.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() + dias);
  form.value.fecha = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function diasTexto(dias) {
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return dias.map((dia) => nombres[dia]).join(', ');
}

async function cargarAgendaSemanal() {
  const numeroSolicitud = ++solicitudAgendaSemanal;
  errorAgendaSemanal.value = '';
  if (!form.value.servicioId || !form.value.estilistaId) {
    agendaSemanal.value = [];
    cargandoAgendaSemanal.value = false;
    return;
  }

  cargandoAgendaSemanal.value = true;
  try {
    const semana = await Promise.all(diasAgendaSemanal.value.map(async (dia) => {
      if (dia.pasado) return { fecha: dia.fecha, disponibilidad: null };
      const parametros = new URLSearchParams({
        fecha: dia.fecha,
        servicioId: form.value.servicioId,
        estilistaId: form.value.estilistaId
      });
      const response = await fetch(`${API_URL}/disponibilidad?${parametros}`, {
        headers: auth.encabezadosAutenticados()
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || 'No se pudo cargar la agenda semanal.');
      return { fecha: dia.fecha, disponibilidad: resultado };
    }));
    if (numeroSolicitud === solicitudAgendaSemanal) agendaSemanal.value = semana;
  } catch (error) {
    if (numeroSolicitud === solicitudAgendaSemanal) {
      errorAgendaSemanal.value = error.message || 'No se pudo cargar la agenda semanal.';
    }
  } finally {
    if (numeroSolicitud === solicitudAgendaSemanal) cargandoAgendaSemanal.value = false;
  }
}

async function consultarDisponibilidad() {
  const numeroSolicitud = ++solicitudDisponibilidad;
  form.value.horaInicio = '';
  disponibilidad.value = null;
  availabilityError.value = '';
  avisoAgenda.value = '';
  errorReserva.value = '';
  if (!form.value.servicioId || !form.value.estilistaId || !form.value.fecha) {
    cargandoDisponibilidad.value = false;
    return;
  }

  cargandoDisponibilidad.value = true;
  try {
    const parametros = new URLSearchParams({
      fecha: form.value.fecha,
      servicioId: form.value.servicioId,
      estilistaId: form.value.estilistaId
    });
    const response = await fetch(`${API_URL}/disponibilidad?${parametros}`, {
      headers: auth.encabezadosAutenticados()
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudo consultar la agenda.');
    if (numeroSolicitud !== solicitudDisponibilidad) return;
    disponibilidad.value = resultado;
    if (resultado.ocupacion.nivel === 'muy_llena') {
      avisoAgenda.value = `La agenda de ${estilistaSeleccionado.value?.nombre} está muy llena (${resultado.ocupacion.porcentaje}% ocupado). Solo podrás seleccionar los horarios que todavía estén libres.`;
    } else if (resultado.ocupacion.nivel === 'ocupada') {
      avisoAgenda.value = `La agenda está ocupada en un ${resultado.ocupacion.porcentaje}% del turno. Revisa los horarios libres antes de solicitar.`;
    } else if (!resultado.slots.some((slot) => slot.disponible)) {
      avisoAgenda.value = 'No quedan horarios que coincidan con la duración del servicio y la disponibilidad del cliente y el estilista.';
    }
  } catch (error) {
    if (numeroSolicitud === solicitudDisponibilidad) {
      availabilityError.value = error.message || 'No se pudo consultar la disponibilidad.';
    }
  } finally {
    if (numeroSolicitud === solicitudDisponibilidad) cargandoDisponibilidad.value = false;
  }
}

async function registrarCita() {
  if (guardando.value || !slotSeleccionado.value?.disponible) return;
  guardando.value = true;
  errorReserva.value = '';
  mensaje.value = '';
  if (mensajeTimer) clearTimeout(mensajeTimer);
  try {
    const response = await fetch(`${API_URL}/citas`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        ...(auth.encabezadosAutenticados ? auth.encabezadosAutenticados() : {}) 
      },
      body: JSON.stringify({
        servicioId: form.value.servicioId,
        estilistaId: form.value.estilistaId,
        fecha: form.value.fecha,
        horaInicio: form.value.horaInicio
      })
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("El backend no tiene configurada la ruta POST /api/citas o devuelve HTML.");
    }

    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.error || 'No se pudo agendar la cita');

    await consultarDisponibilidad();
    mensaje.value = 'Tu solicitud quedó pendiente de aceptación del estilista.';
    mensajeTimer = setTimeout(() => {
      mensaje.value = '';
      mensajeTimer = undefined;
    }, 4000);
  } catch (error) {
    await consultarDisponibilidad();
    errorReserva.value = error.message || 'No se pudo conectar con el servidor.';
  } finally {
    guardando.value = false;
  }
}

onUnmounted(() => {
  if (mensajeTimer) clearTimeout(mensajeTimer);
});

watch(
  () => [form.value.servicioId, form.value.estilistaId, form.value.fecha],
  consultarDisponibilidad
);

watch(
  () => [form.value.servicioId, form.value.estilistaId, fechaInicioSemana.value],
  cargarAgendaSemanal
);

onMounted(async () => {
  try {
    await cargarOpciones();
  } catch (error) {
    errorCarga.value = error.message || 'No se pudieron cargar los datos de reserva.';
  }
});
</script>

<style scoped>
.esther-page { position: relative; min-height: 100vh; overflow: hidden; }
.salon-background {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(125deg, rgba(35, 35, 31, .65), rgba(105, 75, 69, .18)),
              url('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=85&w=1800') center/cover;
  z-index: 1;
}
.form-wrapper { position: relative; z-index: 2; width: 100%; max-width: 1000px; padding: 20px 0; }
.sub-title-badge {
  display: inline-block; font-size: 0.85rem; letter-spacing: 2px; color: #b3637e; text-transform: uppercase; font-weight: 600;
  background: rgba(216, 131, 158, 0.1); padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(216, 131, 158, 0.2);
}
.luxury-heading { font-family: 'Playfair Display', serif; letter-spacing: -0.5px; color: #232023; }
.luxury-subtitle { font-family: 'Playfair Display', serif; font-style: italic; color: #5c5559; }
.esther-card {
  background-color: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px);
  border: 1px solid rgba(216, 131, 158, 0.25); border-radius: 20px; padding: 40px; box-shadow: 0 15px 40px rgba(179, 99, 126, 0.08);
}
.esther-form { display: flex; flex-direction: column; gap: 20px; }
.profile-note { padding: 12px 16px; border-left: 3px solid #b3637e; background: #fff4f7; color: #5c5559; }
.time-error { margin: -12px 0 0; color: #a32d3d; font-size: 0.9rem; }
.form-error { margin: 0; color: #a32d3d; font-size: .9rem; line-height: 1.5; }
.weekly-agenda { display: grid; gap: 16px; padding: 20px; border: 1px solid #ead5dd; border-radius: 14px; background: #fffafb; }
.weekly-agenda-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.weekly-agenda-heading h2 { margin: 0; color: #8f455e; font: 700 1.1rem 'Playfair Display', Georgia, serif; }
.weekly-agenda-heading p { margin: 5px 0 0; color: #766a6d; font-size: .82rem; }
.agenda-step { display: inline-block; margin-bottom: 5px; color: #b3637e; font-size: .76rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.week-navigation { display: flex; align-items: center; gap: 10px; color: #62585c; font-size: .82rem; white-space: nowrap; }
.week-navigation button { width: 32px; height: 32px; border: 1px solid #ead5dd; border-radius: 50%; background: white; color: #8f455e; font-size: 1.2rem; cursor: pointer; }
.weekly-agenda-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.weekly-agenda-day { display: grid; align-content: center; justify-items: center; gap: 8px; min-height: 88px; padding: 10px 6px; border: 1px solid #ead5dd; border-radius: 11px; background: white; color: #554b4a; text-align: center; cursor: pointer; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
.weekly-agenda-day:not(:disabled):hover { transform: translateY(-2px); border-color: #c47b93; }
.weekly-agenda-day:focus-visible { outline: 3px solid rgba(179, 99, 126, .3); outline-offset: 2px; }
.weekly-agenda-day.selected { border-color: #b3637e; box-shadow: 0 0 0 2px rgba(179, 99, 126, .12); }
.weekly-agenda-day:disabled { background: #f8f5f6; color: #958b8f; cursor: default; }
.weekly-agenda-day strong { font-size: .82rem; line-height: 1.35; text-transform: capitalize; }
.weekly-agenda-count { color: #28764b; font-size: .78rem; font-weight: 700; }
.weekly-agenda-empty { color: #766a6d; font-size: .78rem; }
.time-picker { display: grid; gap: 16px; padding: 20px; border: 1px solid #efdce3; border-radius: 16px; background: linear-gradient(135deg, #fffafb 0%, #fff 58%, #fcf3f6 100%); box-shadow: 0 10px 24px rgba(143, 69, 94, .06); }
.time-picker-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.time-picker-heading p { margin: 2px 0 0; color: #766a6d; font-size: .86rem; }
.time-count { padding: 7px 11px; border: 1px solid #d5eadb; border-radius: 999px; background: #f1faf3; color: #28764b; font-size: .77rem; font-weight: 700; white-space: nowrap; }
.time-slots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.time-slot { position: relative; display: grid; justify-items: start; gap: 5px; min-height: 78px; padding: 14px; border: 1px solid #ead5dd; border-radius: 12px; background: rgba(255, 255, 255, .9); color: #554b4a; text-align: left; cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease; }
.time-slot:hover { transform: translateY(-2px); border-color: #c47b93; box-shadow: 0 7px 16px rgba(143, 69, 94, .1); }
.time-slot:focus-visible { outline: 3px solid rgba(179, 99, 126, .3); outline-offset: 2px; }
.time-slot.selected { border-color: #a64e6b; background: linear-gradient(135deg, #b3637e, #96506a); color: #fff; box-shadow: 0 7px 16px rgba(143, 69, 94, .2); }
.time-slot-start { font-size: 1.08rem; font-weight: 700; letter-spacing: .01em; }
.time-slot-end { color: #80747a; font-size: .76rem; }
.time-slot.selected .time-slot-end { color: rgba(255, 255, 255, .82); }
.time-slot-check { position: absolute; top: 9px; right: 10px; display: grid; width: 20px; height: 20px; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, .2); color: white; font-size: .75rem; }
.time-picker-state { margin: 0; padding: 15px; border: 1px dashed #e2cbd4; border-radius: 11px; background: rgba(255, 255, 255, .65); color: #766a6d; font-size: .88rem; text-align: center; }
.availability-message { margin: 0; color: #62585c; font-size: .9rem; line-height: 1.5; }
.service-preview { display: grid; gap: 7px; padding: 13px 15px; border: 1px solid #ead5dd; border-radius: 11px; background: #fffafb; color: #5c5559; font-size: .87rem; line-height: 1.5; }
.service-preview strong { color: #8f455e; font-size: .74rem; letter-spacing: .8px; }
.service-preview a { color: #8f455e; font-weight: 700; }
.booking-summary { padding: 16px; border: 1px solid #d6eadc; border-radius: 12px; background: #f3fbf5; color: #365340; }
.booking-summary h2 { margin: 0 0 10px; font-size: 1rem; }
.booking-summary p { margin: 5px 0; font-size: .9rem; }
.booking-toast { position: fixed; z-index: 10000; top: 24px; right: 24px; display: flex; align-items: center; gap: 12px; width: min(380px, calc(100vw - 32px)); padding: 16px 18px; border: 1px solid #b9dfc5; border-radius: 12px; background: #f0faf3; color: #28764b; box-shadow: 0 12px 36px rgba(35, 70, 45, .2); animation: booking-toast-in .25s ease-out; }
.booking-toast > span:last-child { display: grid; gap: 4px; }
.booking-toast strong { font-size: .95rem; }
.booking-toast small { color: #456b51; font-size: .82rem; line-height: 1.4; }
.booking-toast-icon { display: grid; flex: 0 0 30px; width: 30px; height: 30px; place-items: center; border-radius: 50%; background: #28764b; color: white; font-weight: 700; }
@keyframes booking-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.busy-warning { margin: 0; padding: 12px 14px; border-radius: 10px; background: #fff2e4; color: #835415; font-size: .9rem; line-height: 1.5; }
.success-message { color: #28764b; line-height: 1.5; }
.my-appointments { margin-top: 22px; }
.appointments-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
.appointments-heading h2 { margin: 0; }
.status-help { color: #766a6d; font-size: .85rem; }
.my-appointment-list { display: grid; gap: 10px; }
.my-appointment-row { display: grid; grid-template-columns: 1fr 1.5fr auto; align-items: center; gap: 12px; padding: 13px; border: 1px solid #f0e1e7; border-radius: 11px; color: #4e4549; font-size: .88rem; }
.status-badge { display: inline-block; width: fit-content; padding: 6px 10px; border-radius: 20px; font-size: .75rem; font-weight: 700; }
.status-pendiente { background: #fff4dc; color: #78550a; }
.status-confirmada { background: #eaf7ee; color: #28764b; }
.status-rechazada { background: #f6e9ec; color: #954458; }
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-label { font-size: 0.9rem; color: #b3637e; font-weight: 600; letter-spacing: 0.5px; }
.luxury-input {
  background-color: #fff9fb; border: 1px solid rgba(216, 131, 158, 0.3); color: #232023;
  padding: 12px 16px; border-radius: 12px; outline: none; font-size: 0.95rem; transition: all 0.3s ease; width: 100%;
}
:deep(.salon-select .q-field__control) {
  min-height: 56px;
  border-radius: 16px;
  background: #fff9fb;
  box-shadow: 0 4px 12px rgba(143, 69, 94, .045);
  color: #352b30;
  transition: box-shadow .2s ease, background .2s ease;
}
:deep(.salon-select.q-field--outlined .q-field__control:before) {
  border: 1px solid #e8cbd5;
  border-radius: 16px;
}
:deep(.salon-select.q-field--outlined .q-field__control:hover:before) {
  border-color: #c47b93;
}
:deep(.salon-select.q-field--focused .q-field__control) {
  background: #fff;
  box-shadow: 0 0 0 4px rgba(216, 131, 158, .12), 0 6px 16px rgba(143, 69, 94, .08);
}
:deep(.salon-select.q-field--focused.q-field--outlined .q-field__control:after) {
  border-color: #a65370;
  border-radius: 16px;
}
:deep(.salon-select .q-field__native),
:deep(.salon-select .q-field__input) {
  color: #352b30;
  font-size: .95rem;
}
:deep(.salon-select .q-field__marginal) { color: #a65370; }
:deep(.salon-select.q-field--disabled .q-field__control) {
  background: #f7f1f3;
  opacity: .82;
}
:global(.salon-select-popup) {
  max-height: min(45vh, 360px) !important;
  overflow-y: auto;
  padding: 7px;
  border: 1px solid #ead5dd;
  border-radius: 16px;
  background: rgba(255, 255, 255, .99);
  box-shadow: 0 16px 36px rgba(72, 39, 51, .16);
  backdrop-filter: blur(12px);
}
:global(.salon-select-popup .q-item) {
  min-height: 58px;
  margin: 3px 0;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: #352b30;
  transition: background .16s ease, border-color .16s ease, color .16s ease;
}
:global(.salon-select-popup .q-item:hover),
:global(.salon-select-popup .q-item--active) {
  border-color: #f0dbe3;
  background: #fff4f7;
  color: #8f455e;
}
:global(.salon-select-popup .q-item--selected) {
  border-color: #ebcbd6;
  background: linear-gradient(100deg, #fff2f6, #fffafb);
  color: #8f455e;
}
:global(.salon-option-name) { font-size: .94rem; font-weight: 600; }
:global(.salon-option-detail) { color: #8f455e !important; font-size: .84rem; font-weight: 600; }
:global(.salon-option-schedule) { color: #766a6d !important; font-size: .77rem; line-height: 1.4; }
:deep(.salon-select .q-field__append .q-icon) {
  display: none;
}
:deep(.salon-select .q-field__append::after) {
  content: '';
  width: 10px;
  height: 10px;
  margin: 0 4px;
  border-right: 2px solid #a65370;
  border-bottom: 2px solid #a65370;
  transform: translateY(-2px) rotate(45deg);
  transition: transform .2s ease;
}
:deep(.salon-select.q-field--focused .q-field__append::after) {
  transform: translateY(3px) rotate(225deg);
}
.luxury-input:focus { border-color: #b3637e; box-shadow: 0 0 0 4px rgba(216, 131, 158, 0.15); background-color: #ffffff; }
.btn-esther {
  background: linear-gradient(135deg, #d8839e 0%, #b3637e 100%); color: white; border: none; padding: 14px;
  border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(216, 131, 158, 0.3);
}
.btn-esther:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(216, 131, 158, 0.4); }
.btn-esther:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.full-width { width: 100%; }
@media (max-width: 600px) {
  .booking-toast { top: 12px; right: 12px; }
  .esther-card { padding: 24px 18px; }
  .weekly-agenda-heading { align-items: flex-start; flex-direction: column; }
  .weekly-agenda-days { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .weekly-agenda-day { min-height: 76px; padding: 10px; }
  .time-picker { padding: 16px; }
  .time-slots { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .time-slot { min-height: 70px; padding: 12px; }
}
@media (min-width: 601px) and (max-width: 900px) {
  .weekly-agenda-days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .time-slots { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>