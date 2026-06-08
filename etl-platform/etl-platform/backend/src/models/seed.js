const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seedAdmin({ runAsync, getAsync }) {
    const email    = process.env.ADMIN_EMAIL    || 'admin@etlplatform.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const hash     = await bcrypt.hash(password, 12);
    const id       = uuidv4();

    await runAsync(
        `INSERT INTO etl.users (id,name,email,password_hash,role,status) VALUES (?,?,?,?,?,?)`,
        [id, 'Super Admin', email, hash, 'superadmin', 'active']
    );
    console.log(`✅ Admin criado: ${email} / ${password}`);
}

module.exports = { seedAdmin };
