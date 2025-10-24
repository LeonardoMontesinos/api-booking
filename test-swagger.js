#!/usr/bin/env node
// test-swagger.js - Script simple para probar la configuración de Swagger
import { swaggerSpec } from './src/docs/swagger.js';

console.log('=== SWAGGER TEST ===');
console.log('API:', swaggerSpec.info.title, 'v' + swaggerSpec.info.version);
console.log('Paths encontrados:', Object.keys(swaggerSpec.paths || {}).length);

if (Object.keys(swaggerSpec.paths || {}).length === 0) {
  console.error('❌ ERROR: No se encontraron rutas');
} else {
  console.log('✅ Swagger OK!');
  console.log('Endpoints:', Object.keys(swaggerSpec.paths || {}));
}
