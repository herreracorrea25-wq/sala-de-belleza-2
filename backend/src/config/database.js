const mongoose = require('mongoose');
const Estilista = require('../models/estilista');

async function inicializarDatosBase() {
  const totalEstilistas = await Estilista.countDocuments();
  if (totalEstilistas !== 0) return;

  await Estilista.create([
    {
      nombre: 'Sofía Martínez',
      especialidad: 'Corte y Coloración Avanzada',
      edad: 28,
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
    },
    {
      nombre: 'Carlos Gómez',
      especialidad: 'Barbería Moderna y Estilismo Masculino',
      edad: 32,
      foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
    },
    {
      nombre: 'Valentina Ríos',
      especialidad: 'Tratamientos Spa, Manicure y Cuidado Capilar',
      edad: 26,
      foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400'
    }
  ]);
  console.log('Estilistas iniciales creados en MongoDB Atlas.');
}

async function conectarBaseDeDatos() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Falta configurar MONGO_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  console.log('Conectado exitosamente a MongoDB Atlas.');
  await inicializarDatosBase();
}

module.exports = { conectarBaseDeDatos };
