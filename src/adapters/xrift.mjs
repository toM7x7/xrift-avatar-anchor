// Conservative host-convention adapter. Explicit avatarRoot is preferred.
const within=(node,root)=>{for(let p=node;p;p=p.parent)if(p===root)return true;return false}
const isHead=name=>['head','chead'].includes(name.toLowerCase().replace(/^normalized_?/,'').replace(/[^a-z0-9]/g,'').replace(/^mixamorig/,'').replace(/^jbip/,''))
export function selectXRiftHead({scene,userId,localUserId,avatarRoot}={}){
 if(!userId)return {status:'empty',head:null}
 const scopes=[];scene.traverse(o=>{const d=o.userData;if(typeof d?.id==='string'&&d.id.startsWith('remote-player-')&&typeof d.onInteract==='function'&&o.parent&&o.parent!==scene)scopes.push({id:d.id.slice(14),root:o.parent})})
 const roots=avatarRoot?[avatarRoot]:userId===localUserId?[scene]:[...new Set(scopes.filter(s=>s.id===userId).map(s=>s.root))]
 if(roots.length!==1)return {status:roots.length?'ambiguous-owner':'waiting-for-avatar',head:null}
 const heads=new Set();roots[0].traverse(o=>{
  if(!avatarRoot&&userId===localUserId&&scopes.some(s=>within(o,s.root)))return
  if(o.isSkinnedMesh)for(const b of o.skeleton.bones)if(isHead(b.name)&&!/_sub(?:_\d+)?$/i.test(b.name))heads.add(b)
 })
 return heads.size===1?{status:'ready',head:[...heads][0]}:{status:heads.size?'ambiguous-head':'waiting-for-head',head:null}
}
