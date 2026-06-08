const crypto = require('crypto');

const KEY = (process.env.ENCRYPTION_KEY || 'etl_32char_encrypt_key_change_me!').slice(0, 32).padEnd(32, '0');
const ALG  = 'aes-256-cbc';

function encrypt(text) {
    const iv  = crypto.randomBytes(16);
    const c   = crypto.createCipheriv(ALG, KEY, iv);
    const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
    return iv.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(data) {
    const [ivHex, encHex] = String(data).split(':');
    const iv  = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const d   = crypto.createDecipheriv(ALG, KEY, iv);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
