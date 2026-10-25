import {Group,Bone,Quaternion} from 'three'
import {createHeadAnchor,updateHeadAnchor,createAnchor,normalizeAttachmentProfile,resolveAttachmentProfile,serializeAttachmentProfile} from '../src/index.mjs'
import {selectXRiftHead} from '../src/adapters/xrift.mjs'
const target=new Group(),head=new Bone(),a=createHeadAnchor(target)
a.update({head,settings:{offset:[0,.2,-.04]}});a.dispose()
updateHeadAnchor(target,{head,cameraQuaternion:new Quaternion(),settings:{rotationMode:'camera-facing'}})
selectXRiftHead({scene:new Group(),userId:'me',localUserId:'me'})
const boneAnchor=createAnchor(new Group(),{offsetSpace:'bone',rotationMode:'bone',rotationOffset:[0,0,0,1]})
boneAnchor.update({bone:head});boneAnchor.dispose()
const profile=normalizeAttachmentProfile({schema:'xrift-avatar-anchor.profile',version:1,avatarId:'fixture:standard',attachmentId:'hat',bone:'head',settings:{offset:[0,.18,0],offsetSpace:'bone',rotationMode:'bone'}})
const resolved=resolveAttachmentProfile([profile],{avatarId:'fixture:standard',attachmentId:'hat',bone:'head'})
if(resolved.status==='ready')serializeAttachmentProfile(resolved.profile)
