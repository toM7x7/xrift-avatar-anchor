import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import {xriftDev} from '@xrift/sdk/vite'
export default defineConfig(({mode})=>({
 base:'./',
 plugins:[react(),xriftDev({configPath:'dev-world.xrift.json'}),federation({name:'xrift_auto_head_tag',filename:'remoteEntry.js',exposes:{'./Item':'./src/index.tsx'},shared:Object.fromEntries(['react','react-dom','react/jsx-runtime','three','@react-three/fiber','@react-three/drei','@react-three/rapier','@xrift/world-components'].map(name=>[name,{requiredVersion:'*',...(mode==='item'?{import:false,generate:false}:{})}]))})],
 resolve:{dedupe:['react','react-dom','three','@react-three/fiber']},
 server:{fs:{allow:['../..']}},
 build:{target:'esnext',minify:false,assetsDir:'',...(mode==='item'?{rollupOptions:{input:'./src/item-entry.ts'}}:{})},
 define:{global:'globalThis'}
}))
