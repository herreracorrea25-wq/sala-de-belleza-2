const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET no está configurada; las sesiones actuales dejarán de ser válidas al reiniciar el backend.');
}

const Estilista = require('./models/estilista');
const Usuario = require('./models/usuario');
const Cliente = require('./models/cliente');
const Cita = require('./models/cita');
const Servicio = require('./models/servicio');

const servicios = [
  { id: '1', nombre: 'Corte y Estilizado de Cabello', precio: '45.000', duracionMinutos: 45 },
  { id: '2', nombre: 'Tintura y Balayage', precio: '120.000', duracionMinutos: 120 },
  { id: '3', nombre: 'Manicure y Pedicure Spa', precio: '50.000', duracionMinutos: 60 },
  { id: '4', nombre: 'Maquillaje Profesional', precio: '80.000', duracionMinutos: 50 },
  { id: '5', nombre: 'Tratamiento Capilar Keratina', precio: '150.000', duracionMinutos: 90 }
];

const DIAS_LABORALES = [1, 2, 3, 4, 5, 6];

function diasTrabajoDe(estilista) {
  return Array.isArray(estilista.diasTrabajo) && estilista.diasTrabajo.length > 0
    ? estilista.diasTrabajo
    : DIAS_LABORALES;
}

function minutosDeHora(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

function horaDeMinutos(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function fechaEsValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));
  return fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia;
}

function hoyEnBogota() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function diaSemana(fecha) {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

function citaActiva(cita) {
  return !['rechazada', 'cancelada'].includes(cita.estado);
}

function citaSeCruza(cita, inicio, fin) {
  return minutosDeHora(cita.horaInicio) < fin && minutosDeHora(cita.horaFin) > inicio;
}

function especialidadCoincide(estilista, servicio) {
  const normalizar = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
  const serviciosAsignados = Array.isArray(estilista.servicios) ? estilista.servicios : [];
  return serviciosAsignados.some((asignado) =>
    String(asignado) === String(servicio.id) || normalizar(asignado) === normalizar(servicio.nombre)
  ) || normalizar(estilista.especialidad) === normalizar(servicio.nombre);
}

async function buscarServicio(id) {
  const servicioBase = servicios.find((item) => item.id === String(id));
  if (servicioBase) return servicioBase;
  const servicioPersonalizado = await Servicio.findOne({ id: String(id) }).lean();
  return servicioPersonalizado || null;
}

function validarCodigoInvitacion(codigo) {
  const codigoConfigurado = process.env.STYLIST_INVITE_CODE;
  if (!codigoConfigurado || typeof codigo !== 'string') return false;
  const recibido = Buffer.from(codigo);
  const esperado = Buffer.from(codigoConfigurado);
  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

async function obtenerDisponibilidad({ fecha, servicio, estilista, cliente, excluirCitaId }) {
  const desde = minutosDeHora(estilista.horaInicioTrabajo || '09:00');
  const hasta = minutosDeHora(estilista.horaFinTrabajo || '18:00');
  const minutosTurno = Math.max(0, hasta - desde);
  const filtroCitas = {
    fecha,
    estado: { $nin: ['rechazada', 'cancelada'] },
    $or: [{ estilistaId: estilista._id }, { clienteId: cliente._id }]
  };
  if (excluirCitaId) filtroCitas._id = { $ne: excluirCitaId };
  const citas = await Cita.find(filtroCitas).select('clienteId estilistaId horaInicio horaFin duracionMinutos estado');
  const citasEstilista = citas.filter((cita) => cita.estilistaId?.toString() === estilista._id.toString());
  const citasCliente = citas.filter((cita) => cita.clienteId?.toString() === cliente._id.toString());
  const minutosReservados = citasEstilista.reduce(
    (total, cita) => total + (Number(cita.duracionMinutos) || minutosDeHora(cita.horaFin) - minutosDeHora(cita.horaInicio)),
    0
  );
  const porcentajeOcupacion = minutosTurno
    ? Math.min(100, Math.round((minutosReservados / minutosTurno) * 100))
    : 100;
  const fechaHoy = hoyEnBogota();
  const ahora = new Date();
  const horaActual = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(ahora);
  const minutosAhora = minutosDeHora(horaActual);
  const slots = [];

  for (let inicio = desde; inicio + servicio.duracionMinutos <= hasta; inicio += 30) {
    const fin = inicio + servicio.duracionMinutos;
    const conflictoEstilista = citasEstilista.some((cita) => citaSeCruza(cita, inicio, fin));
    const conflictoCliente = citasCliente.some((cita) => citaSeCruza(cita, inicio, fin));
    const horaPasada = fecha < fechaHoy || (fecha === fechaHoy && inicio <= minutosAhora);
    const motivos = [];
    if (conflictoEstilista) motivos.push('El estilista ya tiene una cita en ese horario.');
    if (conflictoCliente) motivos.push('El cliente ya tiene otra cita en ese horario.');
    if (horaPasada) motivos.push('Ese horario ya pasó.');
    slots.push({
      horaInicio: horaDeMinutos(inicio),
      horaFin: horaDeMinutos(fin),
      disponible: motivos.length === 0,
      motivos
    });
  }

  return {
    horario: {
      diasTrabajo: diasTrabajoDe(estilista),
      horaInicio: estilista.horaInicioTrabajo || '09:00',
      horaFin: estilista.horaFinTrabajo || '18:00'
    },
    ocupacion: {
      citas: citasEstilista.length,
      minutosReservados,
      minutosDisponibles: Math.max(0, minutosTurno - minutosReservados),
      porcentaje: porcentajeOcupacion,
      nivel: porcentajeOcupacion >= 80 ? 'muy_llena' : porcentajeOcupacion >= 50 ? 'ocupada' : 'disponible'
    },
    slots
  };
}

function autenticar(req, res, next) {
  const token = req.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'La sesión no es válida. Inicia sesión nuevamente.' });
  }
}

function responderConError(res, error, mensaje) {
  if (error.code === 11000) {
    return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  console.error(mensaje, error);
  return res.status(500).json({ error: mensaje });
}

function validarPresentacionServicio(body) {
  const descripcion = body.descripcion === undefined
    ? ''
    : typeof body.descripcion === 'string' ? body.descripcion.trim() : null;
  const detallesRecibidos = body.incluye === undefined ? [] : body.incluye;
  if (
    descripcion === null ||
    (descripcion && descripcion.length > 500) ||
    !Array.isArray(detallesRecibidos) ||
    detallesRecibidos.some((detalle) => typeof detalle !== 'string')
  ) {
    return { error: 'Revisa el detalle y los elementos incluidos en el servicio.' };
  }
  const incluye = detallesRecibidos.map((detalle) => detalle.trim()).filter(Boolean);
  if (incluye.length > 10 || incluye.some((detalle) => detalle.length > 120)) {
    return { error: 'Agrega hasta 10 elementos incluidos, con un máximo de 120 caracteres cada uno.' };
  }
  return {
    descripcion: descripcion || 'Servicio creado por el equipo de estilistas.',
    incluye
  };
}

async function registrarCuenta(req, res, rolForzado) {
  const {
    nombre,
    email,
    correo,
    password,
    contraseña,
    telefono,
    especialidad,
    servicios: serviciosSolicitados,
    codigoInvitacion
  } = req.body;
  const rol = rolForzado || req.body.rol || 'cliente';
  const nombreCompleto = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  const partesNombre = nombreCompleto.split(' ').filter(Boolean);
  const correoNormalizado = String(email || correo || '').trim().toLowerCase();
  const passwordPlano = password || contraseña;

  if (partesNombre.length < 2) {
    return res.status(400).json({ error: 'Escribe al menos un nombre y un apellido.' });
  }
  if (!correoNormalizado || typeof passwordPlano !== 'string' || !passwordPlano) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }
  if (passwordPlano.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (!['cliente', 'estilista'].includes(rol)) {
    return res.status(400).json({ error: 'El tipo de cuenta no es válido.' });
  }
  if (rol === 'cliente' && !telefono?.trim()) {
    return res.status(400).json({ error: 'El teléfono es obligatorio para crear una cuenta de cliente.' });
  }
  if (rol === 'estilista' && !validarCodigoInvitacion(codigoInvitacion)) {
    return res.status(403).json({ error: 'Se requiere un código de invitación válido para crear una cuenta de estilista.' });
  }
  const idsServicios = rol === 'estilista' && Array.isArray(serviciosSolicitados)
    ? [...new Set(serviciosSolicitados.map(String))]
    : [];
  if (rol === 'estilista' && !idsServicios.length && !especialidad?.trim()) {
    return res.status(400).json({ error: 'Selecciona al menos un servicio para tu perfil de estilista.' });
  }
  let serviciosEstilista = [];
  if (rol === 'estilista') {
    if (idsServicios.length) {
      serviciosEstilista = await Promise.all(idsServicios.map(buscarServicio));
    } else {
      const servicioLegado = servicios.find((item) =>
        item.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
        especialidad.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      );
      if (servicioLegado) serviciosEstilista = [servicioLegado];
    }
    if (!serviciosEstilista.length || serviciosEstilista.some((item) => !item)) {
      return res.status(400).json({ error: 'Uno o más servicios seleccionados no existen.' });
    }
  }
  const existente = await Usuario.findOne({
    $or: [{ email: correoNormalizado }, { correo: correoNormalizado }]
  });
  if (existente) {
    return res.status(409).json({ error: 'Ese correo ya tiene una cuenta registrada. Inicia sesión o usa otro correo.' });
  }

  if (rol === 'cliente') {
    const perfilExistente = await Cliente.findOne({ email: correoNormalizado }).select('_id');
    if (perfilExistente) {
      return res.status(409).json({ error: 'Ya existe un cliente con ese correo. Verifica sus datos antes de volver a registrarlo.' });
    }
  } else {
    const estilistaExistente = await Estilista.findOne({ email: correoNormalizado }).select('_id');
    if (estilistaExistente) {
      return res.status(409).json({ error: 'Ya existe un estilista registrado con ese correo.' });
    }
    const nombreExistente = await Estilista.findOne({ nombre: nombreCompleto })
      .collation({ locale: 'es', strength: 2 })
      .select('_id');
    if (nombreExistente) {
      return res.status(409).json({ error: 'Ya existe un estilista con ese nombre. Si es otra persona, agrega sus apellidos para diferenciarla.' });
    }
  }

  const sesion = await mongoose.startSession();
  let usuarioCreado;
  try {
    await sesion.withTransaction(async () => {
      const [usuario] = await Usuario.create([{
        nombre: nombreCompleto,
        email: correoNormalizado,
        correo: correoNormalizado,
        passwordHash: await bcrypt.hash(passwordPlano, 12),
        telefono: telefono?.trim(),
        rol
      }], { session: sesion });
      usuarioCreado = usuario;

      if (rol === 'cliente') {
        await Cliente.create([{
          userId: usuario._id,
          nombre: nombreCompleto,
          telefono: telefono.trim(),
          email: correoNormalizado
        }], { session: sesion });
      } else {
        await Estilista.create([{
          userId: usuario._id,
          nombre: nombreCompleto,
          email: correoNormalizado,
          telefono: telefono?.trim(),
          especialidad: serviciosEstilista.map((item) => item.nombre).join(', '),
          servicios: serviciosEstilista.map((item) => item.id),
          edad: 25,
          foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
        }], { session: sesion });
      }
    });
  } finally {
    await sesion.endSession();
  }

  const token = jwt.sign({ id: usuarioCreado._id.toString(), rol }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({
    mensaje: 'La cuenta y el perfil se guardaron correctamente.',
    usuario: usuarioCreado,
    token
  });
}

app.get('/api/estilistas', async (req, res) => {
  try {
    const estilistas = await Estilista.find({ userId: { $exists: true, $ne: null } })
      .select('nombre especialidad servicios diasTrabajo horaInicioTrabajo horaFinTrabajo edad foto')
      .sort({ nombre: 1 })
      .limit(1000);
    res.json(estilistas.map((estilista) => ({
      ...estilista.toJSON(),
      diasTrabajo: diasTrabajoDe(estilista)
    })));
  } catch (error) {
    responderConError(res, error, 'Error al obtener los estilistas.');
  }
});

app.get('/api/estilistas/mi-horario', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'Solo los estilistas pueden consultar su horario de trabajo.' });
    }
    const estilista = await Estilista.findOne({ userId: req.usuario.id })
      .select('diasTrabajo horaInicioTrabajo horaFinTrabajo');
    if (!estilista) return res.status(404).json({ error: 'No se encontró el perfil de estilista.' });
    res.json({
      diasTrabajo: diasTrabajoDe(estilista),
      horaInicioTrabajo: estilista.horaInicioTrabajo || '09:00',
      horaFinTrabajo: estilista.horaFinTrabajo || '18:00'
    });
  } catch (error) {
    responderConError(res, error, 'Error al consultar el horario de trabajo.');
  }
});

app.put('/api/estilistas/mi-horario', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'Solo los estilistas pueden cambiar su horario de trabajo.' });
    }
    const { diasTrabajo, horaInicioTrabajo, horaFinTrabajo } = req.body;
    if (
      !Array.isArray(diasTrabajo) ||
      diasTrabajo.length === 0 ||
      diasTrabajo.some((dia) => !DIAS_LABORALES.includes(dia)) ||
      new Set(diasTrabajo).size !== diasTrabajo.length ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaInicioTrabajo || '') ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaFinTrabajo || '') ||
      minutosDeHora(horaFinTrabajo) <= minutosDeHora(horaInicioTrabajo) ||
      minutosDeHora(horaInicioTrabajo) < 9 * 60 ||
      minutosDeHora(horaFinTrabajo) > 18 * 60
    ) {
      return res.status(400).json({ error: 'Elige al menos un día laboral y un horario válido entre 9:00 y 18:00.' });
    }
    const estilista = await Estilista.findOneAndUpdate(
      { userId: req.usuario.id },
      { diasTrabajo: [...diasTrabajo].sort(), horaInicioTrabajo, horaFinTrabajo },
      { new: true, runValidators: true, select: 'diasTrabajo horaInicioTrabajo horaFinTrabajo' }
    );
    if (!estilista) return res.status(404).json({ error: 'No se encontró el perfil de estilista.' });
    res.json({
      mensaje: 'Tu horario de trabajo quedó guardado.',
      horario: {
        diasTrabajo: estilista.diasTrabajo,
        horaInicioTrabajo: estilista.horaInicioTrabajo,
        horaFinTrabajo: estilista.horaFinTrabajo
      }
    });
  } catch (error) {
    responderConError(res, error, 'Error al guardar el horario de trabajo.');
  }
});

app.post('/api/estilistas', async (req, res) => {
  try {
    await registrarCuenta(req, res, 'estilista');
  } catch (error) {
    responderConError(res, error, 'Error al registrar el estilista.');
  }
});

app.get('/api/citas', autenticar, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.fecha) {
      filtro.fecha = req.query.fecha;
    } else if (req.query.desde || req.query.hasta) {
      const { desde, hasta } = req.query;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(desde || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '') ||
        desde > hasta
      ) {
        return res.status(400).json({ error: 'El rango de fechas no es válido.' });
      }
      filtro.fecha = { $gte: desde, $lte: hasta };
    }

    if (req.usuario.rol === 'cliente') {
      const cliente = await Cliente.findOne({ userId: req.usuario.id }).select('_id');
      if (!cliente) return res.json([]);
      filtro.clienteId = cliente._id;
    } else if (req.usuario.rol === 'estilista') {
      const estilista = await Estilista.findOne({ userId: req.usuario.id }).select('_id');
      if (!estilista) {
        return res.status(404).json({ error: 'No se encontró tu perfil de estilista. Vuelve a iniciar sesión o contacta al salón.' });
      }
      filtro.estilistaId = estilista._id;
    } else {
      return res.status(403).json({ error: 'No tienes permiso para ver las citas.' });
    }

    const citas = await Cita.find(filtro)
      .populate('clienteId', 'nombre telefono email')
      .populate('estilistaId', 'nombre especialidad')
      .sort({ fecha: 1, horaInicio: 1 })
      .limit(500);
    res.json(citas.map((cita) => {
      const datos = cita.toJSON();
      if (!datos.estado) datos.estado = 'confirmada';
      return datos;
    }));
  } catch (error) {
    responderConError(res, error, 'Error al obtener las citas.');
  }
});

app.get('/api/disponibilidad', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'cliente') {
      return res.status(403).json({ error: 'La disponibilidad para reservar solo está disponible para clientes.' });
    }
    const { fecha, servicioId, estilistaId } = req.query;
    const servicio = await buscarServicio(servicioId);
    if (!fechaEsValida(fecha) || fecha < hoyEnBogota()) {
      return res.status(400).json({ error: 'Selecciona una fecha válida desde hoy en adelante.' });
    }
    if (!servicio || !mongoose.isValidObjectId(estilistaId)) {
      return res.status(400).json({ error: 'Selecciona un servicio y un estilista válidos.' });
    }
    const [cliente, estilista] = await Promise.all([
      Cliente.findOne({ userId: req.usuario.id }).select('_id'),
      Estilista.findOne({ _id: estilistaId, userId: { $exists: true, $ne: null } })
        .select('especialidad servicios diasTrabajo horaInicioTrabajo horaFinTrabajo')
    ]);
    if (!cliente) return res.status(404).json({ error: 'No se encontró el perfil del cliente.' });
    if (!estilista) return res.status(404).json({ error: 'El estilista seleccionado no tiene una cuenta activa.' });
    if (!especialidadCoincide(estilista, servicio)) {
      return res.status(409).json({ error: 'La especialidad del estilista no corresponde al servicio seleccionado.' });
    }
    if (!diasTrabajoDe(estilista).includes(diaSemana(fecha))) {
      return res.json({
        fecha,
        horario: {
          diasTrabajo: diasTrabajoDe(estilista),
          horaInicioTrabajo: estilista.horaInicioTrabajo,
          horaFinTrabajo: estilista.horaFinTrabajo
        },
        ocupacion: { citas: 0, minutosReservados: 0, minutosDisponibles: 0, porcentaje: 0, nivel: 'disponible' },
        slots: []
      });
    }
    const disponibilidad = await obtenerDisponibilidad({ fecha, servicio, estilista, cliente });
    res.json({ fecha, ...disponibilidad });
  } catch (error) {
    responderConError(res, error, 'Error al consultar los horarios disponibles.');
  }
});

app.post('/api/citas', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'cliente') {
      return res.status(403).json({ error: 'Solo los clientes pueden agendar citas.' });
    }

    const { servicioId, estilistaId, fecha, horaInicio } = req.body;
    const servicio = await buscarServicio(servicioId);
    if (!servicio || !mongoose.isValidObjectId(estilistaId)) {
      return res.status(400).json({ error: 'Selecciona un servicio y un estilista válidos.' });
    }
    if (!fechaEsValida(fecha) || fecha < hoyEnBogota() || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaInicio || '')) {
      return res.status(400).json({ error: 'La fecha o la hora de la cita no son válidas. Selecciona una fecha desde hoy.' });
    }

    const [cliente, estilista] = await Promise.all([
      Cliente.findOne({ userId: req.usuario.id }).select('_id'),
      Estilista.findOne({ _id: estilistaId, userId: { $exists: true, $ne: null } })
        .select('especialidad servicios diasTrabajo horaInicioTrabajo horaFinTrabajo')
    ]);
    if (!cliente) return res.status(404).json({ error: 'No se encontró el perfil del cliente.' });
    if (!estilista) return res.status(404).json({ error: 'No se encontró el estilista seleccionado.' });
    if (!especialidadCoincide(estilista, servicio)) {
      return res.status(409).json({ error: 'La especialidad del estilista no corresponde al servicio seleccionado.' });
    }
    if (!diasTrabajoDe(estilista).includes(diaSemana(fecha))) {
      return res.status(409).json({ error: 'El estilista no trabaja el día seleccionado.' });
    }
    const minutosInicio = minutosDeHora(horaInicio);
    const minutosFin = minutosInicio + servicio.duracionMinutos;
    const inicioTurno = minutosDeHora(estilista.horaInicioTrabajo);
    const finTurno = minutosDeHora(estilista.horaFinTrabajo);
    if (
      minutosInicio < inicioTurno ||
      minutosFin > finTurno ||
      (minutosInicio - inicioTurno) % 30 !== 0
    ) {
      return res.status(409).json({ error: 'La cita no cabe en el turno de trabajo del estilista. Elige un horario disponible.' });
    }
    const disponibilidad = await obtenerDisponibilidad({ fecha, servicio, estilista, cliente });
    const slot = disponibilidad.slots.find((opcion) => opcion.horaInicio === horaInicio);
    if (!slot?.disponible) {
      const motivo = slot?.motivos.join(' ') || 'Ese horario no está disponible para la duración del servicio.';
      return res.status(409).json({ error: motivo, ocupacion: disponibilidad.ocupacion });
    }

    const cita = await Cita.create({
      clienteId: cliente._id,
      estilistaId: estilista._id,
      servicioId: servicio.id,
      servicio: servicio.nombre,
      duracionMinutos: servicio.duracionMinutos,
      fecha,
      horaInicio,
      horaFin: slot.horaFin,
      estado: 'pendiente'
    });
    await cita.populate([
      { path: 'clienteId', select: 'nombre telefono email' },
      { path: 'estilistaId', select: 'nombre especialidad' }
    ]);
    res.status(201).json({
      mensaje: 'La solicitud de cita se guardó. Está pendiente de aceptación por el estilista.',
      cita
    });
  } catch (error) {
    responderConError(res, error, 'Error al registrar la cita.');
  }
});

app.patch('/api/citas/:id/estado', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'Solo un estilista puede responder a una solicitud de cita.' });
    }
    const { estado } = req.body;
    if (!['confirmada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'La respuesta debe ser aceptar o rechazar la cita.' });
    }
    const estilista = await Estilista.findOne({ userId: req.usuario.id })
      .select('_id diasTrabajo horaInicioTrabajo horaFinTrabajo');
    if (!estilista) return res.status(404).json({ error: 'No se encontró el perfil de estilista.' });
    const cita = await Cita.findById(req.params.id);
    if (!cita) return res.status(404).json({ error: 'No se encontró la cita solicitada.' });
    if (cita.estilistaId?.toString() !== estilista._id.toString()) {
      return res.status(403).json({ error: 'Esta solicitud fue enviada a otro estilista.' });
    }
    if (cita.propuestaCambio) {
      return res.status(409).json({ error: 'Hay una propuesta de cambio pendiente de respuesta.' });
    }
    if (cita.estado && cita.estado !== 'pendiente') {
      return res.status(409).json({ error: 'Esta cita ya recibió una respuesta.' });
    }

    if (estado === 'confirmada') {
      const dia = diaSemana(cita.fecha);
      const inicio = minutosDeHora(cita.horaInicio);
      const fin = minutosDeHora(cita.horaFin);
      const inicioTurno = minutosDeHora(estilista.horaInicioTrabajo || '09:00');
      const finTurno = minutosDeHora(estilista.horaFinTrabajo || '18:00');
      if (
        !diasTrabajoDe(estilista).includes(dia) ||
        inicio < inicioTurno ||
        fin > finTurno
      ) {
        return res.status(409).json({ error: 'La cita ya no coincide con tu horario laboral. Actualiza tu horario o rechaza la solicitud.' });
      }
      const conflictoEstilista = await Cita.findOne({
        _id: { $ne: cita._id },
        estilistaId: estilista._id,
        fecha: cita.fecha,
        estado: { $nin: ['rechazada', 'cancelada'] },
        horaInicio: { $lt: cita.horaFin },
        horaFin: { $gt: cita.horaInicio }
      }).select('_id');
      if (conflictoEstilista) {
        return res.status(409).json({ error: 'Ya tienes otra cita ocupando ese horario.' });
      }
      const conflictoCliente = await Cita.findOne({
        _id: { $ne: cita._id },
        clienteId: cita.clienteId,
        fecha: cita.fecha,
        estado: { $nin: ['rechazada', 'cancelada'] },
        horaInicio: { $lt: cita.horaFin },
        horaFin: { $gt: cita.horaInicio }
      }).select('_id');
      if (conflictoCliente) {
        return res.status(409).json({ error: 'El cliente tiene otra cita que se cruza con este horario.' });
      }
    }

    cita.estado = estado;
    await cita.save();
    await cita.populate([
      { path: 'clienteId', select: 'nombre telefono email' },
      { path: 'estilistaId', select: 'nombre especialidad' }
    ]);
    res.json({
      mensaje: estado === 'confirmada' ? 'Cita aceptada y confirmada.' : 'Solicitud de cita rechazada.',
      cita
    });
  } catch (error) {
    responderConError(res, error, 'Error al responder a la cita.');
  }
});

app.patch('/api/citas/:id/gestion', autenticar, async (req, res) => {
  try {
    if (!['cliente', 'estilista'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta cita.' });
    }
    const cita = await Cita.findById(req.params.id);
    if (!cita) return res.status(404).json({ error: 'No se encontró la cita.' });

    const perfil = req.usuario.rol === 'cliente'
      ? await Cliente.findOne({ userId: req.usuario.id }).select('_id')
      : await Estilista.findOne({ userId: req.usuario.id }).select('_id');
    if (!perfil) return res.status(404).json({ error: 'No se encontró tu perfil.' });
    const campoPropietario = req.usuario.rol === 'cliente' ? 'clienteId' : 'estilistaId';
    if (cita[campoPropietario]?.toString() !== perfil._id.toString()) {
      return res.status(403).json({ error: 'No puedes modificar una cita que no te pertenece.' });
    }

    const { accion, decision, fecha, horaInicio } = req.body;
    const otroRol = req.usuario.rol === 'cliente' ? 'estilista' : 'cliente';
    const citaActiva = !['rechazada', 'cancelada'].includes(cita.estado);
    const notificar = (paraRol, mensaje) => {
      cita.avisos.push({ paraRol, mensaje, creadaEn: new Date() });
      if (cita.avisos.length > 20) cita.avisos.shift();
    };

    if (accion === 'cancelar') {
      if (!citaActiva) return res.status(409).json({ error: 'Esta cita ya no se puede cancelar.' });
      cita.estado = 'cancelada';
      cita.propuestaCambio = undefined;
      notificar(otroRol, `La cita fue cancelada por ${req.usuario.rol === 'cliente' ? 'el cliente' : 'el estilista'}.`);
    } else if (accion === 'proponer') {
      if (!citaActiva) return res.status(409).json({ error: 'Solo puedes aplazar una cita pendiente o confirmada.' });
      if (cita.propuestaCambio) return res.status(409).json({ error: 'Esta cita ya tiene una propuesta de cambio pendiente.' });
      const servicio = await buscarServicio(cita.servicioId);
      if (!servicio || !fechaEsValida(fecha) || fecha < hoyEnBogota() || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaInicio || '')) {
        return res.status(400).json({ error: 'Selecciona una fecha y hora válidas desde hoy.' });
      }
      const [cliente, estilista] = await Promise.all([
        Cliente.findById(cita.clienteId).select('_id'),
        Estilista.findById(cita.estilistaId).select('especialidad servicios diasTrabajo horaInicioTrabajo horaFinTrabajo')
      ]);
      if (!cliente || !estilista) return res.status(404).json({ error: 'No se encontraron los perfiles de la cita.' });
      if (!diasTrabajoDe(estilista).includes(diaSemana(fecha))) {
        return res.status(409).json({ error: 'El estilista no trabaja el día seleccionado.' });
      }
      const minutosInicio = minutosDeHora(horaInicio);
      const minutosFin = minutosInicio + servicio.duracionMinutos;
      const inicioTurno = minutosDeHora(estilista.horaInicioTrabajo || '09:00');
      const finTurno = minutosDeHora(estilista.horaFinTrabajo || '18:00');
      if (minutosInicio < inicioTurno || minutosFin > finTurno || (minutosInicio - inicioTurno) % 30 !== 0) {
        return res.status(409).json({ error: 'El horario propuesto no cabe en el turno de trabajo del estilista.' });
      }
      const disponibilidad = await obtenerDisponibilidad({
        fecha,
        servicio,
        estilista,
        cliente,
        excluirCitaId: cita._id
      });
      const slot = disponibilidad.slots.find((opcion) => opcion.horaInicio === horaInicio);
      if (!slot?.disponible) {
        return res.status(409).json({
          error: slot?.motivos.join(' ') || 'El horario propuesto no está disponible.',
          ocupacion: disponibilidad.ocupacion
        });
      }
      cita.propuestaCambio = {
        fecha,
        horaInicio,
        horaFin: slot.horaFin,
        propuestoPor: req.usuario.rol,
        creadoEn: new Date()
      };
      notificar(otroRol, `El ${req.usuario.rol === 'cliente' ? 'cliente' : 'estilista'} propuso cambiar la cita al ${fecha}, de ${horaInicio} a ${slot.horaFin}.`);
    } else if (accion === 'responder') {
      if (!cita.propuestaCambio) return res.status(409).json({ error: 'No hay una propuesta pendiente para responder.' });
      if (cita.propuestaCambio.propuestoPor === req.usuario.rol) {
        return res.status(403).json({ error: 'La propuesta debe responderla la otra persona.' });
      }
      if (!['aceptar', 'rechazar'].includes(decision)) {
        return res.status(400).json({ error: 'La respuesta debe ser aceptar o rechazar la propuesta.' });
      }
      const propuesta = cita.propuestaCambio;
      if (decision === 'aceptar') {
        const servicio = await buscarServicio(cita.servicioId);
        const [cliente, estilista] = await Promise.all([
          Cliente.findById(cita.clienteId).select('_id'),
          Estilista.findById(cita.estilistaId).select('especialidad servicios diasTrabajo horaInicioTrabajo horaFinTrabajo')
        ]);
        if (!servicio || !cliente || !estilista) return res.status(404).json({ error: 'No se encontraron los datos para actualizar la cita.' });
        if (!diasTrabajoDe(estilista).includes(diaSemana(propuesta.fecha))) {
          return res.status(409).json({ error: 'El estilista ya no trabaja en el día propuesto. Solicita otro horario.' });
        }
        const disponibilidad = await obtenerDisponibilidad({
          fecha: propuesta.fecha,
          servicio,
          estilista,
          cliente,
          excluirCitaId: cita._id
        });
        const slot = disponibilidad.slots.find((opcion) => opcion.horaInicio === propuesta.horaInicio);
        if (!slot?.disponible) {
          return res.status(409).json({ error: 'El horario propuesto ya no está disponible. Solicita otro horario.' });
        }
        const proponente = propuesta.propuestoPor;
        cita.fecha = propuesta.fecha;
        cita.horaInicio = propuesta.horaInicio;
        cita.horaFin = slot.horaFin;
        cita.estado = 'confirmada';
        cita.propuestaCambio = undefined;
        notificar(proponente, `La propuesta de cambio fue aceptada. La cita quedó para el ${cita.fecha}, de ${cita.horaInicio} a ${cita.horaFin}.`);
      } else {
        const proponente = propuesta.propuestoPor;
        cita.propuestaCambio = undefined;
        notificar(proponente, 'La propuesta de cambio fue rechazada. La cita conserva su fecha y horario originales.');
      }
    } else {
      return res.status(400).json({ error: 'La acción debe ser cancelar, proponer o responder.' });
    }

    await cita.save();
    await cita.populate([
      { path: 'clienteId', select: 'nombre telefono email' },
      { path: 'estilistaId', select: 'nombre especialidad' }
    ]);
    res.json({ mensaje: 'La cita se actualizó correctamente.', cita });
  } catch (error) {
    responderConError(res, error, 'Error al gestionar la cita.');
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    await registrarCuenta(req, res);
  } catch (error) {
    responderConError(res, error, 'Error al registrar la cuenta.');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const rolSolicitado = req.body.rol;
    if (!['cliente', 'estilista'].includes(rolSolicitado)) {
      return res.status(400).json({ error: 'Selecciona si vas a iniciar sesión como cliente o estilista.' });
    }
    const correoNormalizado = String(req.body.email || req.body.correo || '').trim().toLowerCase();
    const passwordPlano = req.body.password || req.body.contraseña;
    if (!correoNormalizado || !passwordPlano) {
      return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
    }

    const usuario = await Usuario.findOne({
      $or: [{ email: correoNormalizado }, { correo: correoNormalizado }]
    }).select('+passwordHash +password +contraseña');
    let contraseñaValida = false;

    if (usuario?.passwordHash) {
      contraseñaValida = await bcrypt.compare(passwordPlano, usuario.passwordHash);
    } else if (usuario) {
      contraseñaValida = passwordPlano === usuario.password || passwordPlano === usuario.contraseña;
      if (contraseñaValida) {
        usuario.passwordHash = await bcrypt.hash(passwordPlano, 12);
        await usuario.save();
        await Usuario.updateOne(
          { _id: usuario._id },
          { $unset: { password: 1, contraseña: 1 } }
        );
      }
    }

    if (!usuario || !contraseñaValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    if (usuario.rol !== rolSolicitado) {
      return res.status(403).json({
        error: `Esta cuenta está registrada como ${usuario.rol}. No puedes iniciar sesión como ${rolSolicitado}.`
      });
    }
    const token = jwt.sign({ id: usuario._id.toString(), rol: usuario.rol }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ mensaje: 'Inicio de sesión exitoso.', usuario, token });
  } catch (error) {
    responderConError(res, error, 'Error al iniciar sesión.');
  }
});

app.get('/api/clientes', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'No tienes permiso para ver el directorio de clientes.' });
    }
    const clientes = await Cliente.find().select('nombre telefono email').sort({ nombre: 1 });
    res.json(clientes);
  } catch (error) {
    responderConError(res, error, 'Error al obtener los clientes.');
  }
});

app.post('/api/clientes', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'No tienes permiso para registrar clientes.' });
    }
    const { nombre, telefono, email, password } = req.body;
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
    const telefonoLimpio = typeof telefono === 'string' ? telefono.trim() : '';
    const correoNormalizado = String(email || '').trim().toLowerCase();
    if (!nombreLimpio || !telefonoLimpio || !correoNormalizado || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Nombre, teléfono, correo y contraseña son obligatorios.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }
    if (
      await Cliente.findOne({ email: correoNormalizado }).select('_id') ||
      await Usuario.findOne({ $or: [{ email: correoNormalizado }, { correo: correoNormalizado }] }).select('_id')
    ) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }
    const clienteExistente = await Cliente.findOne({
      nombre: nombreLimpio,
      telefono: telefonoLimpio
    }).collation({ locale: 'es', strength: 2 }).select('_id');
    if (clienteExistente) {
      return res.status(409).json({ error: 'Ese cliente ya fue registrado con el mismo nombre y teléfono.' });
    }
    const sesion = await mongoose.startSession();
    let cliente;
    try {
      await sesion.withTransaction(async () => {
        const [usuario] = await Usuario.create([{
          nombre: nombreLimpio,
          email: correoNormalizado,
          correo: correoNormalizado,
          passwordHash: await bcrypt.hash(password, 12),
          telefono: telefonoLimpio,
          rol: 'cliente'
        }], { session: sesion });
        [cliente] = await Cliente.create([{
          userId: usuario._id,
          nombre: nombreLimpio,
          telefono: telefonoLimpio,
          email: correoNormalizado
        }], { session: sesion });
      });
    } finally {
      await sesion.endSession();
    }
    res.status(201).json({ mensaje: 'El cliente se guardó correctamente.', cliente });
  } catch (error) {
    responderConError(res, error, 'Error al registrar el cliente.');
  }
});

app.put('/api/clientes/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'No tienes permiso para editar clientes.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'El cliente seleccionado no es válido.' });
    }
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
    const telefono = typeof req.body.telefono === 'string' ? req.body.telefono.trim() : '';
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!nombre || !telefono || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresa un nombre, un teléfono y un correo válido.' });
    }

    const clienteActual = await Cliente.findById(req.params.id).select('userId');
    if (!clienteActual) return res.status(404).json({ error: 'No se encontró el cliente.' });
    if (await Cliente.findOne({ email, _id: { $ne: clienteActual._id } }).select('_id')) {
      return res.status(409).json({ error: 'Ya existe otro cliente con ese correo electrónico.' });
    }
    const filtroUsuario = { $or: [{ email }, { correo: email }] };
    if (clienteActual.userId) filtroUsuario._id = { $ne: clienteActual.userId };
    if (await Usuario.findOne(filtroUsuario).select('_id')) {
      return res.status(409).json({ error: 'Ese correo ya está asociado a otra cuenta.' });
    }

    const sesion = await mongoose.startSession();
    let clienteActualizado;
    try {
      await sesion.withTransaction(async () => {
        const cliente = await Cliente.findById(req.params.id).session(sesion);
        if (!cliente) throw new Error('No se encontró el cliente.');
        cliente.nombre = nombre;
        cliente.telefono = telefono;
        cliente.email = email;
        await cliente.save({ session: sesion });
        if (cliente.userId) {
          const usuario = await Usuario.findById(cliente.userId).session(sesion);
          if (usuario) {
            usuario.nombre = nombre;
            usuario.telefono = telefono;
            usuario.email = email;
            usuario.correo = email;
            await usuario.save({ session: sesion });
          }
        }
        clienteActualizado = cliente;
      });
    } finally {
      await sesion.endSession();
    }
    res.json({ mensaje: 'Los datos del cliente se actualizaron correctamente.', cliente: clienteActualizado });
  } catch (error) {
    responderConError(res, error, 'Error al editar el cliente.');
  }
});

app.get('/api/perfil', autenticar, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('nombre email correo telefono rol');
    if (!usuario) return res.status(404).json({ error: 'No se encontró tu cuenta.' });
    const perfil = req.usuario.rol === 'cliente'
      ? await Cliente.findOne({ userId: usuario._id }).select('nombre telefono email')
      : await Estilista.findOne({ userId: usuario._id }).select('nombre email telefono especialidad servicios');
    if (!perfil) return res.status(404).json({ error: 'No se encontró tu perfil.' });
    let serviciosPerfil = perfil.servicios || [];
    if (usuario.rol === 'estilista' && !serviciosPerfil.length && perfil.especialidad) {
      const catalogo = [...servicios, ...await Servicio.find().select('id nombre').lean()];
      serviciosPerfil = perfil.especialidad.split(',').map((nombre) => {
        const encontrado = catalogo.find((item) =>
          item.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
          nombre.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        );
        return encontrado?.id;
      }).filter(Boolean);
    }
    res.json({
      perfil: {
        nombre: usuario.nombre,
        email: usuario.email || usuario.correo,
        telefono: usuario.telefono || perfil.telefono || '',
        rol: usuario.rol,
        servicios: serviciosPerfil,
        especialidad: perfil.especialidad || ''
      }
    });
  } catch (error) {
    responderConError(res, error, 'Error al consultar tu perfil.');
  }
});

app.put('/api/perfil', autenticar, async (req, res) => {
  try {
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
    const email = String(req.body.email || '').trim().toLowerCase();
    const telefono = typeof req.body.telefono === 'string' ? req.body.telefono.trim() : '';
    const { currentPassword, newPassword } = req.body;
    if (nombre.split(' ').filter(Boolean).length < 2) {
      return res.status(400).json({ error: 'Escribe al menos un nombre y un apellido.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }
    if (!telefono) {
      return res.status(400).json({ error: 'El teléfono es obligatorio para tu cuenta.' });
    }
    if (newPassword && (typeof newPassword !== 'string' || newPassword.length < 8)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    if (newPassword && !currentPassword) {
      return res.status(400).json({ error: 'Escribe tu contraseña actual para poder cambiarla.' });
    }

    let serviciosNuevos = [];
    if (req.usuario.rol === 'estilista') {
      if (!Array.isArray(req.body.servicios) || !req.body.servicios.length) {
        return res.status(400).json({ error: 'Selecciona al menos un servicio para tu perfil.' });
      }
      const ids = [...new Set(req.body.servicios.map(String))];
      serviciosNuevos = await Promise.all(ids.map(buscarServicio));
      if (serviciosNuevos.some((servicio) => !servicio)) {
        return res.status(400).json({ error: 'Uno o más servicios seleccionados no existen.' });
      }
    }

    const filtroEmail = { _id: { $ne: req.usuario.id }, $or: [{ email }, { correo: email }] };
    if (await Usuario.findOne(filtroEmail).select('_id')) {
      return res.status(409).json({ error: 'Ese correo ya está asociado a otra cuenta.' });
    }
    const filtroPerfil = { email };
    if (req.usuario.rol === 'cliente') {
      const perfilActual = await Cliente.findOne({ userId: req.usuario.id }).select('_id');
      if (!perfilActual) return res.status(404).json({ error: 'No se encontró tu perfil de cliente.' });
      filtroPerfil._id = { $ne: perfilActual._id };
      if (await Cliente.findOne(filtroPerfil).select('_id')) {
        return res.status(409).json({ error: 'Ese correo ya está asociado a otro cliente.' });
      }
    } else {
      const perfilActual = await Estilista.findOne({ userId: req.usuario.id }).select('_id');
      if (!perfilActual) return res.status(404).json({ error: 'No se encontró tu perfil de estilista.' });
      filtroPerfil._id = { $ne: perfilActual._id };
      if (await Estilista.findOne(filtroPerfil).select('_id')) {
        return res.status(409).json({ error: 'Ese correo ya está asociado a otro estilista.' });
      }
    }

    const sesion = await mongoose.startSession();
    let perfilActualizado;
    try {
      await sesion.withTransaction(async () => {
        const usuario = await Usuario.findById(req.usuario.id)
          .select('+passwordHash +password +contraseña')
          .session(sesion);
        if (!usuario) throw new Error('No se encontró tu cuenta.');
        if (newPassword) {
          const valida = usuario.passwordHash
            ? await bcrypt.compare(currentPassword, usuario.passwordHash)
            : currentPassword === usuario.password || currentPassword === usuario.contraseña;
          if (!valida) throw new Error('La contraseña actual no es correcta.');
          usuario.passwordHash = await bcrypt.hash(newPassword, 12);
          usuario.password = undefined;
          usuario.contraseña = undefined;
        }
        usuario.nombre = nombre;
        usuario.email = email;
        usuario.correo = email;
        usuario.telefono = telefono;
        await usuario.save({ session: sesion });
        if (newPassword) {
          await Usuario.updateOne(
            { _id: usuario._id },
            { $unset: { password: 1, contraseña: 1 } },
            { session: sesion }
          );
        }

        if (req.usuario.rol === 'cliente') {
          const perfil = await Cliente.findOne({ userId: usuario._id }).session(sesion);
          if (!perfil) throw new Error('No se encontró tu perfil de cliente.');
          perfil.nombre = nombre;
          perfil.email = email;
          perfil.telefono = telefono;
          await perfil.save({ session: sesion });
          perfilActualizado = { nombre, email, telefono, rol: usuario.rol, servicios: [] };
        } else {
          const perfil = await Estilista.findOne({ userId: usuario._id }).session(sesion);
          if (!perfil) throw new Error('No se encontró tu perfil de estilista.');
          perfil.nombre = nombre;
          perfil.email = email;
          perfil.telefono = telefono;
          perfil.servicios = serviciosNuevos.map((servicio) => servicio.id);
          perfil.especialidad = serviciosNuevos.map((servicio) => servicio.nombre).join(', ');
          await perfil.save({ session: sesion });
          perfilActualizado = {
            nombre,
            email,
            telefono,
            rol: usuario.rol,
            servicios: perfil.servicios,
            especialidad: perfil.especialidad
          };
        }
      });
    } finally {
      await sesion.endSession();
    }
    res.json({ mensaje: 'Tu cuenta se actualizó correctamente.', perfil: perfilActualizado });
  } catch (error) {
    if (error.message === 'La contraseña actual no es correcta.') {
      return res.status(403).json({ error: error.message });
    }
    responderConError(res, error, 'Error al actualizar tu perfil.');
  }
});

app.get('/api/servicios', (req, res, next) => {
  if (!req.get('Authorization')) return next();
  return autenticar(req, res, next);
}, async (req, res) => {
  try {
    const serviciosPersonalizados = await Servicio.find().sort({ nombre: 1 }).lean();
    const estilista = req.usuario?.rol === 'estilista'
      ? await Estilista.findOne({ userId: req.usuario.id }).select('_id').lean()
      : null;
    res.json([
      ...servicios,
      ...serviciosPersonalizados.map((servicio) => ({
        ...servicio,
        editable: Boolean(estilista && servicio.creadoPor.toString() === estilista._id.toString())
      }))
    ]);
  } catch (error) {
    responderConError(res, error, 'Error al obtener los servicios.');
  }
});

app.post('/api/servicios', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'Solo los estilistas pueden crear servicios.' });
    }
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
    const precio = Number(req.body.precio);
    const duracionMinutos = Number(req.body.duracionMinutos);
    if (
      nombre.length < 3 ||
      nombre.length > 80 ||
      !Number.isFinite(precio) ||
      precio <= 0 ||
      !Number.isInteger(duracionMinutos) ||
      duracionMinutos < 15 ||
      duracionMinutos > 480
    ) {
      return res.status(400).json({ error: 'Ingresa un nombre, un precio mayor que cero y una duración entre 15 y 480 minutos.' });
    }
    const presentacion = validarPresentacionServicio(req.body);
    if (presentacion.error) return res.status(400).json({ error: presentacion.error });
    const normalizar = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es');
    const duplicadoBase = servicios.some((item) => normalizar(item.nombre) === normalizar(nombre));
    const duplicadoPersonalizado = await Servicio.findOne({ nombre })
      .collation({ locale: 'es', strength: 2 })
      .select('_id');
    if (duplicadoBase || duplicadoPersonalizado) {
      return res.status(409).json({ error: 'Ya existe un servicio con ese nombre.' });
    }

    const sesion = await mongoose.startSession();
    let servicioCreado;
    try {
      await sesion.withTransaction(async () => {
        const estilista = await Estilista.findOne({ userId: req.usuario.id }).session(sesion);
        if (!estilista) throw new Error('No se encontró el perfil de estilista.');
        const id = `custom_${new mongoose.Types.ObjectId().toString()}`;
        const [servicio] = await Servicio.create([{
          id,
          nombre,
          precio: new Intl.NumberFormat('es-CO').format(precio),
          duracionMinutos,
          descripcion: presentacion.descripcion,
          incluye: presentacion.incluye,
          creadoPor: estilista._id
        }], { session: sesion });
        estilista.servicios = [...new Set([...(estilista.servicios || []), id])];
        estilista.especialidad = [...new Set([...(estilista.especialidad || '').split(', '), nombre])].join(', ');
        await estilista.save({ session: sesion });
        servicioCreado = servicio;
      });
    } finally {
      await sesion.endSession();
    }
    res.status(201).json({ mensaje: 'El servicio se creó y quedó asignado a tu perfil.', servicio: servicioCreado });
  } catch (error) {
    responderConError(res, error, 'Error al crear el servicio.');
  }
});

app.patch('/api/servicios/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.rol !== 'estilista') {
      return res.status(403).json({ error: 'Solo los estilistas pueden editar servicios.' });
    }

    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
    const precio = Number(req.body.precio);
    const duracionMinutos = Number(req.body.duracionMinutos);
    if (
      nombre.length < 3 ||
      nombre.length > 80 ||
      !Number.isFinite(precio) ||
      precio <= 0 ||
      !Number.isInteger(duracionMinutos) ||
      duracionMinutos < 15 ||
      duracionMinutos > 480
    ) {
      return res.status(400).json({ error: 'Ingresa un nombre, un precio mayor que cero y una duración entre 15 y 480 minutos.' });
    }
    const presentacion = validarPresentacionServicio(req.body);
    if (presentacion.error) return res.status(400).json({ error: presentacion.error });

    const normalizar = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es');
    const duplicadoBase = servicios.some((item) => normalizar(item.nombre) === normalizar(nombre));
    const duplicadoPersonalizado = await Servicio.findOne({
      nombre,
      id: { $ne: req.params.id }
    }).collation({ locale: 'es', strength: 2 }).select('_id');
    if (duplicadoBase || duplicadoPersonalizado) {
      return res.status(409).json({ error: 'Ya existe un servicio con ese nombre.' });
    }

    const sesion = await mongoose.startSession();
    let servicioActualizado;
    try {
      await sesion.withTransaction(async () => {
        const estilista = await Estilista.findOne({ userId: req.usuario.id }).session(sesion);
        if (!estilista) throw new Error('No se encontró el perfil de estilista.');

        const servicio = await Servicio.findOne({
          id: req.params.id,
          creadoPor: estilista._id
        }).session(sesion);
        if (!servicio) {
          const error = new Error('No puedes editar este servicio o ya no existe.');
          error.status = 404;
          throw error;
        }

        const nombreAnterior = servicio.nombre;
        servicio.nombre = nombre;
        servicio.precio = new Intl.NumberFormat('es-CO').format(precio);
        servicio.duracionMinutos = duracionMinutos;
        servicio.descripcion = presentacion.descripcion;
        servicio.incluye = presentacion.incluye;
        await servicio.save({ session: sesion });

        estilista.especialidad = (estilista.especialidad || '')
          .split(', ')
          .map((especialidad) => especialidad === nombreAnterior ? nombre : especialidad)
          .join(', ');
        await estilista.save({ session: sesion });
        servicioActualizado = servicio;
      });
    } finally {
      await sesion.endSession();
    }
    res.json({ mensaje: 'El servicio se actualizó correctamente.', servicio: servicioActualizado });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    responderConError(res, error, 'Error al actualizar el servicio.');
  }
});

module.exports = app;
