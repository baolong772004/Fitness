import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PayOS = require('@payos/node');

try {
    const payos = new PayOS('a', 'b', 'c');
    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(payos)));
} catch (e) {
    console.error('Error:', e.message);
}
