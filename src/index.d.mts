import type {Object3D,Quaternion} from 'three'
export interface AnchorSettings {offset:[number,number,number];offsetSpace:'world'|'head';rotationMode:'world-up'|'head'|'camera-facing';scale:number}
export interface AnchorInput {head:Object3D;cameraQuaternion?:Quaternion;settings?:Partial<AnchorSettings>}
export interface AnchorReport {head:number[];position:number[];settings:AnchorSettings}
export const DEFAULT_ANCHOR_SETTINGS:Readonly<AnchorSettings>
export function normalizeAnchorSettings(value?:Partial<AnchorSettings>):AnchorSettings
export function updateHeadAnchor(target:Object3D,input:AnchorInput):AnchorReport
export function createHeadAnchor(target:Object3D,initial?:Partial<AnchorSettings>):{settings:AnchorSettings;update:(options:AnchorInput)=>AnchorReport;dispose:()=>void}
