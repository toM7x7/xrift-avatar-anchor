import {Group,Bone,Quaternion} from 'three'
import {createHeadAnchor,updateHeadAnchor} from '../src/index.mjs'
import {selectXRiftHead} from '../src/adapters/xrift.mjs'
const target=new Group(),head=new Bone(),a=createHeadAnchor(target)
a.update({head,settings:{offset:[0,.2,-.04]}});a.dispose()
updateHeadAnchor(target,{head,cameraQuaternion:new Quaternion(),settings:{rotationMode:'camera-facing'}})
selectXRiftHead({scene:new Group(),userId:'me',localUserId:'me'})
