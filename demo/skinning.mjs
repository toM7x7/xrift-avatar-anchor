/**
 * Flush both Object3D world transforms and SkinnedMesh's attached-bind inverse.
 * updateWorldMatrix alone bypasses SkinnedMesh.updateMatrixWorld, which otherwise
 * leaves CPU-skinned bounds dependent on the transform from the previous render.
 */
export function syncSkinnedTransforms(root){
 root.updateWorldMatrix(true,false)
 root.updateMatrixWorld(true)
 root.traverse(object=>{if(object.isSkinnedMesh)object.skeleton.update()})
}

export function refreshSkinnedBounds(root){
 syncSkinnedTransforms(root)
 root.traverse(object=>{if(object.isSkinnedMesh)object.computeBoundingBox()})
}
