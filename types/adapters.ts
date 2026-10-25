import {Group} from 'three'
import {mapVRMBones,selectVRMBone} from '../src/adapters/vrm.mjs'
import {selectXRiftBone} from '../src/adapters/xrift.mjs'
import {estimateHeadTop} from '../src/overhead.mjs'
import {selectXRiftAvatar,isXRiftAvatarBindingCurrent} from '../src/adapters/xrift-runtime.mjs'
const scene=new Group()
const vrm={scene,humanoid:{getRawBoneNode:()=>new Group()}}
selectVRMBone({vrm,bone:'head'})
selectXRiftBone({userId:'example',avatarRoot:scene,bones:mapVRMBones(vrm),bone:'leftHand'})
const binding=selectXRiftAvatar({scene,userId:'example',localUserId:'example'})
isXRiftAvatarBindingCurrent(binding,{scene})
estimateHeadTop({head:binding.head,avatarRoot:binding.avatarRoot,meshes:binding.meshes})
