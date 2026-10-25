import assert from 'node:assert/strict'
import {readFile,readdir,stat} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const directory=new URL('../dist/',import.meta.url),names=await readdir(directory)
const exposed=names.find(name=>/^__federation_expose_Item.*\.js$/.test(name))
assert.ok(exposed,'The Item federation entry must exist')
const code=await readFile(new URL(exposed,directory),'utf8')
const prefix='https://assets.xrift.net/users/example/items/example/revision/'
const paths=[...code.matchAll(/new URL\(\s*(['"])([^'"\n]*\.png)\1\s*,\s*import\.meta\.url\s*\)/g)].map(match=>match[2])
assert.ok(paths.length>=3,'Expected external Japanese label assets')
for(const path of paths){
 const resolved=new URL(path,prefix+exposed)
 assert.ok(resolved.href.startsWith(prefix),`Label escaped its published item directory: ${resolved.href}`)
 await stat(new URL(path,directory))
}
const thumbnail=await readFile(new URL('thumbnail.png',directory))
assert.equal(thumbnail.readUInt32BE(16),512,'Thumbnail width')
assert.equal(thumbnail.readUInt32BE(20),512,'Thumbnail height')
assert.ok(!names.some(name=>/\.(vrm|vrma|env)$/i.test(name)),'Private input in distribution')
console.log(JSON.stringify({exposed,labelUrlsChecked:paths.length,relativeCdnAssets:true,thumbnail:'512x512',privateModelFiles:false,directory:fileURLToPath(directory)},null,2))
