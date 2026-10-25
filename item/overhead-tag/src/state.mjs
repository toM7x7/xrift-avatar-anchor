const clamp=(value,min,max)=>Math.min(max,Math.max(min,value))
/** Shared instance JSON is untrusted; never feed malformed values into rendering. */
export function normalizeTagState(value){
 const object=value!==null&&typeof value==='object'&&!Array.isArray(value)?value:{}
 const ownerId=typeof object.ownerId==='string'&&object.ownerId.length>0&&object.ownerId.length<=200&&!/[\u0000-\u0020\u007f]/.test(object.ownerId)?object.ownerId:null
 return {ownerId,statusIndex:Number.isInteger(object.statusIndex)&&object.statusIndex>=0&&object.statusIndex<3?object.statusIndex:0,extraHeight:typeof object.extraHeight==='number'&&Number.isFinite(object.extraHeight)?clamp(object.extraHeight,-.09,.3):0,serial:Number.isSafeInteger(object.serial)&&object.serial>=0?object.serial:0}
}
