const mongoose = require('mongoose');

const servicioSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nombre: { type: String, required: true, trim: true },
  precio: { type: String, required: true, trim: true },
  duracionMinutos: { type: Number, required: true, min: 15 },
  categoria: { type: String, default: 'TRATAMIENTO PERSONALIZADO', trim: true },
  descripcion: { type: String, default: 'Servicio creado por el equipo de estilistas.', trim: true },
  incluye: { type: [String], default: [] },
  imagen: { type: String, default: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=900' },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Estilista', required: true }
}, { timestamps: true, collection: 'Servicios' });

module.exports = mongoose.model('Servicio', servicioSchema);
