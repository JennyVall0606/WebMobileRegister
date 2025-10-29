const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const passwords = {
  admin: 'admin123',
  user: 'user123',
  viewer: 'viewer123'
};

async function generarHashes() {
  console.log('\n🔐 Generando contraseñas hasheadas...\n');
  console.log('='.repeat(80));
  
  const hashes = {};
  
  for (const [role, password] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    hashes[role] = hash;
    
    console.log(`\n${role.toUpperCase()}:`);
    console.log(`  Contraseña: ${password}`);
    console.log(`  Hash: ${hash}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Script SQL para insertar usuarios:\n');
  
  console.log(`INSERT INTO usuarios (correo, contraseña, rol) VALUES`);
  console.log(`('admin@agrogestor.com', '${hashes.admin}', 'admin'),`);
  console.log(`('user@agrogestor.com', '${hashes.user}', 'user'),`);
  console.log(`('viewer@agrogestor.com', '${hashes.viewer}', 'viewer');`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Contraseñas generadas exitosamente!\n');
}

generarHashes();