import { createServer } from 'node:http';
import { handler } from './api.mjs';

const host = process.env.HOST ?? '127.0.0.1', port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createServer({ requestTimeout: 10000, headersTimeout: 10000, keepAliveTimeout: 5000 }, handler({ allowedOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean) }));
server.listen(port, host, () => console.log(`Nextgen eVTOL API: http://${host}:${port} (concept data)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
