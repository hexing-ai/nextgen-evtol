import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',define:{CESIUM_BASE_URL:JSON.stringify('./cesium/')},server:{host:'127.0.0.1',port:5173},preview:{host:'127.0.0.1',port:4173},build:{chunkSizeWarningLimit:1600,rollupOptions:{output:{manualChunks(id){if(id.includes('/cesium/')||id.includes('/@cesium/')||id.includes('/resium/'))return 'cesium';}}}}});
