import type {Object3D,Bone} from 'three'
export function selectXRiftHead(input:{scene:Object3D;userId:string|null;localUserId:string|null;avatarRoot?:Object3D}):{status:string;head:Bone|null}
