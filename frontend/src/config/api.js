const apiUrlConfigurada = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
const apiUrlPredeterminada = import.meta.env.DEV
  ? 'http://localhost:4000/api'
  : 'https://sala-de-belleza-backend-gxpe.onrender.com/api'

export const API_URL = apiUrlConfigurada
  ? apiUrlConfigurada.endsWith('/api')
    ? apiUrlConfigurada
    : `${apiUrlConfigurada}/api`
  : apiUrlPredeterminada
