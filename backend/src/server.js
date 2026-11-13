const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');
const { conectarBaseDeDatos } = require('./config/database');
const PORT = process.env.PORT || 4000;

conectarBaseDeDatos()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error de conexión a MongoDB:', error.message);
    process.exit(1);
  });
