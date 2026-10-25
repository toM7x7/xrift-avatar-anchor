/** Reproducible transform experiments. Run: node scripts/run-experiments.mjs [--local-vrm] */
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
import {Group,Matrix4,Quaternion,Scene,Vector3} from 'three'
import * as core from '../src/index.mjs'
import {createPoseFixture} from '../demo/fixture.mjs'
import {selectXRiftHead} from '../src/adapters/xrift.mjs'
import {SYNTHETIC_CONDITIONS,createNumericalFixture,createMetadataRig,readGLBJSON,MOTIONS,snapshotRig,restoreRig,rigUnchanged,applyMotion} from './experiment-models.mjs'

const REPO=fileURLToPath(new URL('../',import.meta.url))
const POSITION_TOLERANCE_METERS=.001,ROTATION_TOLERANCE_RADIANS=.00001,SCALE_TOLERANCE=.000001
const camera=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-.65)
const environments=[
 {id:'scene-root'},
 {id:'translated-rotated-uniform-parent',position:[-2,3,4],rotation:[.2,-.6,.1],scale:1.3},
 {id:'nested-parent-and-scaled-avatar',position:[1.2,-.3,2],rotation:[-.25,.4,.3],scale:.65,avatarScale:1.15,outerPosition:[.3,.1,-.8],outerRotation:[0,.5,0],outerScale:1.2},
]

export function attachmentCases(rig){
 const crown=rig.crown??[0,.2,0]
 return [
  {id:'overhead-tag',bone:'head',settings:{offset:[.015,.28,-.035],offsetSpace:'world',rotationMode:'world-up',scale:.8}},
  {id:'observer-tag',bone:'head',settings:{offset:[0,.3,0],offsetSpace:'world',rotationMode:'camera-facing',scale:.7}},
  {id:'calibrated-hat',bone:'head',settings:{offset:crown,offsetSpace:'bone',rotationMode:'bone',scale:.6,rotationOffset:[0,Math.sin(.1),0,Math.cos(.1)]}},
  {id:'chest-badge',bone:'chest',settings:{offset:[0,.07,.14],offsetSpace:'bone',rotationMode:'bone',scale:.35}},
  {id:'left-hand-item',bone:'leftHand',settings:{offset:[.03,.055,.025],offsetSpace:'bone',rotationMode:'bone',scale:.3}},
 ].filter(item=>rig.bones[item.bone])
}

/** Specification oracle: world meter displacement and post-multiplied mount rotation. */
function expectedTransform(bone,settings){
 bone.updateWorldMatrix(true,false)
 const position=new Vector3().setFromMatrixPosition(bone.matrixWorld),q=new Quaternion(),s=new Vector3()
 bone.matrixWorld.decompose(new Vector3(),q,s)
 const offset=new Vector3().fromArray(settings.offset)
 if(settings.offsetSpace==='bone'||settings.offsetSpace==='head')offset.applyQuaternion(q)
 const rotation=settings.rotationMode==='bone'||settings.rotationMode==='head'?q.clone():settings.rotationMode==='camera-facing'?camera.clone():new Quaternion()
 if(settings.rotationOffset)rotation.multiply(new Quaternion().fromArray(settings.rotationOffset))
 return {position:position.add(offset),rotation,scale:new Vector3().setScalar(settings.scale)}
}
const mm=value=>Number((value*1000).toPrecision(9))

function runModel(rig,model){
 const initial=snapshotRig(rig),scene=new Scene();scene.add(rig.root)
 const records=[],failures=[]
 for(const attachment of attachmentCases(rig))for(const environment of environments){
  const parent=new Group(),outer=new Group();outer.add(parent);scene.add(outer)
  if(environment.position)parent.position.fromArray(environment.position)
  if(environment.rotation)parent.rotation.fromArray(environment.rotation)
  if(environment.scale)parent.scale.setScalar(environment.scale)
  if(environment.outerPosition)outer.position.fromArray(environment.outerPosition)
  if(environment.outerRotation)outer.rotation.fromArray(environment.outerRotation)
  if(environment.outerScale)outer.scale.setScalar(environment.outerScale)
  const target=new Group();parent.add(target)
  let maxPositionError=0,maxRotationError=0,maxScaleError=0,maxRoundTripError=0,sourceUnchanged=true,cameraUnchanged=true,passed=0
  let baselineMax=null,baselineMin=null
  const observations=[]
  const profile=core.normalizeAttachmentProfile({schema:'xrift-avatar-anchor.profile',version:1,avatarId:model.id,attachmentId:attachment.id,bone:attachment.bone,settings:attachment.settings})
  const restoredProfile=core.normalizeAttachmentProfile(JSON.parse(core.serializeAttachmentProfile(profile)))
  for(const motion of MOTIONS){
   restoreRig(initial);if(environment.avatarScale)rig.root.scale.multiplyScalar(environment.avatarScale);applyMotion(rig,motion)
   const before=snapshotRig(rig),cameraBefore=camera.clone(),bone=rig.bones[attachment.bone],desired=expectedTransform(bone,attachment.settings)
   // "Before" is the original neutral 0.22m overhead recipe, not a claim of a core defect.
   let baselinePosition=null,baselineError=null
   if(attachment.bone==='head'){
    baselinePosition=bone.getWorldPosition(new Vector3()).add(new Vector3(0,.22,0));baselineError=baselinePosition.distanceTo(desired.position)
    baselineMax=Math.max(baselineMax??0,baselineError);baselineMin=Math.min(baselineMin??Infinity,baselineError)
   }
   try{
    core.updateAnchor(target,{bone,cameraQuaternion:camera,settings:profile.settings})
    const actual=target.getWorldPosition(new Vector3()),positionError=actual.distanceTo(desired.position),rotationError=target.getWorldQuaternion(new Quaternion()).angleTo(desired.rotation),scaleError=target.getWorldScale(new Vector3()).distanceTo(desired.scale)
    maxPositionError=Math.max(maxPositionError,positionError);maxRotationError=Math.max(maxRotationError,rotationError);maxScaleError=Math.max(maxScaleError,scaleError)
    core.updateAnchor(target,{bone,cameraQuaternion:camera,settings:restoredProfile.settings})
    const roundTripError=target.getWorldPosition(new Vector3()).distanceTo(actual);maxRoundTripError=Math.max(maxRoundTripError,roundTripError)
    const unchanged=rigUnchanged(before),cameraSafe=camera.equals(cameraBefore);sourceUnchanged&&=unchanged;cameraUnchanged&&=cameraSafe
    observations.push({motion:motion.id,beforeRecipePosition:baselinePosition?.toArray()??null,beforeRecipeErrorMm:baselineError===null?null:mm(baselineError),expectedPosition:desired.position.toArray(),appliedPosition:actual.toArray(),positionErrorMm:mm(positionError),rotationErrorRadians:rotationError,scaleError,roundTripErrorMm:mm(roundTripError),sourceUnchanged:unchanged,cameraUnchanged:cameraSafe})
    if(positionError<=POSITION_TOLERANCE_METERS&&rotationError<=ROTATION_TOLERANCE_RADIANS&&scaleError<=SCALE_TOLERANCE&&roundTripError<=1e-9&&unchanged&&cameraSafe)passed++
    else failures.push({model:model.id,attachment:attachment.id,environment:environment.id,motion:motion.id,positionErrorMeters:positionError,rotationErrorRadians:rotationError,scaleError,sourceUnchanged:unchanged,cameraUnchanged:cameraSafe})
   }catch(error){failures.push({model:model.id,attachment:attachment.id,environment:environment.id,motion:motion.id,error:String(error.message)});observations.push({motion:motion.id,error:String(error.message)})}
  }
  records.push({attachment:attachment.id,bone:attachment.bone,environment:environment.id,profile,inputMotions:MOTIONS.map(m=>m.id),samples:MOTIONS.length,passed,maxPositionErrorMm:mm(maxPositionError),maxRotationErrorRadians:maxRotationError,maxScaleError,maxRoundTripErrorMm:mm(maxRoundTripError),sourceUnchanged,cameraUnchanged,beforeUncalibratedRecipe:baselineMax===null?null:{minErrorMm:mm(baselineMin),maxErrorMm:mm(baselineMax)},decision:passed===MOTIONS.length?'transform-pass':'investigate',observations})
  scene.remove(outer)
 }
 restoreRig(initial);scene.remove(rig.root);rig.dispose()
 return {...model,evidence:rig.evidence,generation:rig.generation,nodeCount:rig.nodeCount??initial.length,roles:Object.keys(rig.bones).filter(role=>['head','chest','leftHand'].includes(role)),samples:records.reduce((n,r)=>n+r.samples,0),passed:records.reduce((n,r)=>n+r.passed,0),records,failures}
}

export function runOwnerIsolation(){
 const scene=new Scene(),first=createPoseFixture(),other=createPoseFixture(),remote=new Group(),marker=new Group()
 scene.add(first.mesh,remote);remote.add(other.mesh,marker);marker.userData={id:'remote-player-observer',onInteract(){}}
 const local=selectXRiftHead({scene,userId:'owner',localUserId:'owner'}),remoteResult=selectXRiftHead({scene,userId:'observer',localUserId:'owner'})
 const target=new Group();scene.add(target);const otherBefore=snapshotRig({root:other.mesh}),headBefore=first.bones.head.position.clone()
 core.updateAnchor(target,{bone:local.head,settings:{offset:[0,.3,0]}})
 const explicit=selectXRiftHead({scene,userId:'owner',localUserId:'owner',avatarRoot:first.mesh})
 const third=createPoseFixture();scene.add(third.mesh);const ambiguous=selectXRiftHead({scene,userId:'owner',localUserId:'owner'})
 const checks={localOwner:local.head===first.bones.head,remoteOwner:remoteResult.head===other.bones.head,explicitOwner:explicit.head===first.bones.head,ambiguousRejected:ambiguous.status==='ambiguous-head',otherRigUnchanged:rigUnchanged(otherBefore),sourceHeadUnchanged:first.bones.head.position.equals(headBefore)}
 first.dispose();other.dispose();third.dispose()
 return {evidence:'synthetic-host-convention',checks,passed:Object.values(checks).every(Boolean),realXRiftVerified:false}
}

export async function runExperiments({localVRM=false}={}){
 if(typeof core.updateAnchor!=='function'||typeof core.normalizeAttachmentProfile!=='function')throw new Error('Generic core and profile v1 implementation required')
 const models=SYNTHETIC_CONDITIONS.map(condition=>runModel(createNumericalFixture(condition),{id:`fixture:${condition}`,condition}))
 if(localVRM){
  const directory=path.join(REPO,'local-assets','vrm'),files=(await readdir(directory)).filter(name=>/\.vrm$/i.test(name)),privateInputs=[]
  for(const name of files){const bytes=await readFile(path.join(directory,name));privateInputs.push({bytes,sha256:createHash('sha256').update(bytes).digest('hex')})}
  privateInputs.sort((a,b)=>a.sha256.localeCompare(b.sha256))
  for(let i=0;i<privateInputs.length;i++){
   const {bytes,sha256}=privateInputs[i],rig=createMetadataRig(readGLBJSON(bytes))
   models.push(runModel(rig,{id:`V${String(i+1).padStart(2,'0')}`,sha256,byteLength:bytes.length,condition:'authored-glTF-node-hierarchy'}))
  }
 }
 const ownerIsolation=runOwnerIsolation(),failures=models.flatMap(model=>model.failures)
 return {schema:'xrift-avatar-anchor.experiments',version:1,date:'2026-10-25',runtime:{node:process.version,platform:process.platform},protocol:{units:'meters',positionToleranceMm:1,rotationToleranceRadians:ROTATION_TOLERANCE_RADIANS,scaleTolerance:SCALE_TOLERANCE,motions:MOTIONS,environments,before:'uncalibrated original head-pivot + [0,0.22,0] world recipe; hand/chest have no before recipe',after:'explicit role + per-attachment v1 profile + world-meter offset and optional orientation correction',calibrationMeaning:'Synthetic hat crown is authored test metadata; VRM offsets are numerical probes, not fitted visual recommendations.'},summary:{models:models.length,syntheticModels:models.filter(m=>m.evidence==='synthetic-transform').length,vrmMetadataModels:models.filter(m=>m.evidence==='vrm-metadata-transform').length,samples:models.reduce((n,m)=>n+m.samples,0),passed:models.reduce((n,m)=>n+m.passed,0),failures:failures.length,ownerIsolationPassed:ownerIsolation.passed,maxPositionErrorMm:Math.max(...models.flatMap(m=>m.records.map(r=>r.maxPositionErrorMm)))},models,ownerIsolation,limitations:['VRM tier reconstructs authored glTF node transforms only. No GLTFLoader/VRMLoader, meshes, expressions, springs or animation runtime.','VRM labels V01.. are ordered by file SHA256 and do not establish prior A01/A02/A03 identities or authorship.','Metadata rigs preserve authored GLB coordinates. The browser demo applies its explicit VRM0 forward-axis convention; report-only V IDs and browser profile IDs are separate, and numerical profiles must not be copied between these coordinate systems.','All supplied local files declare VRM 0.0; actual VRM 1.0 compatibility remains unverified.','Transform-pass does not establish visual hat fit, skin/hair clearance, human readability or real-device frame latency.','No live XRift, Quest, other-user view, host avatar API or published item validated by this runner.','Unsupported shear, reflected source bones, and singular transforms are covered by core rejection tests, not included as passing transforms.'],passed:failures.length===0&&ownerIsolation.passed}
}

function formatMarkdown(report,jsonFilename='matrix-2026-10-25.json'){
 const rows=report.models.map(model=>`| ${model.id} | ${model.evidence==='synthetic-transform'?'自作・数値':'VRM metadata・数値'} | ${model.generation} | ${model.passed}/${model.samples} | ${Math.max(...model.records.map(r=>r.maxPositionErrorMm)).toExponential(3)} |`)
 return `# 並行実験・数値マトリクス 2026-10-25\n\nこの記録は入力・参照計算・適用後の姿勢を再実行可能にするものです。実モデルの描画・装着見た目の合格とは別に扱います。\n\n実行: \`node scripts/run-experiments.mjs --local-vrm\`。私有VRMなしでは \`node scripts/run-experiments.mjs\`。再実行の結果は毎回新しい \`artifacts/experiments/<実行時刻とID>/matrix.json\` と \`MATRIX.md\` に出力し、保存済み基準記録は上書きしません。\n\n| 入力 | 証拠の範囲 | 世代 | 通過/計測 | 最大位置誤差 mm |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n${report.summary.samples}条件中 ${report.summary.passed}条件が数値基準（1mm以内・回転1e-5rad以内・スケール1e-6以内）を満たしました。設定JSONの往復、アバターの位置/回転/拡縮の不変、入力カメラQuaternionの不変も各条件で確認します。所有者の分離テスト: ${report.ownerIsolation.passed?'通過':'要調査'}。\n\n6つの自作条件は標準・小型・大型・前へずれたpivot・90度回転した骨軸・大きい頭です。小型/大型は同一骨格の拡縮対照であり、別モデル互換性の証拠には数えません。各入力について頭上タグ・観察者向きタグ・帽子・胸バッジ・左手小物を、9姿勢×3親座標環境で比較します。\n\n帽子の自作条件では既知の頭頂点を補正に使い、骨の軸が違う場合に補正ベクトルも変えます。実VRMでは同じ値を数値プローブとして適用するだけで、髪や帽子への採用値とはしません。\n\n変更前は既存の頭pivot+[0,0.22,0]という共通レシピ、変更後は部位と装着物を明示したprofileです。変更前との差は「以前のコア計算のバグ」を意味しません。頭pivotと目的位置が異なるために必要な補正量を測っています。手/胸には従来の頭専用レシピに対応する変更前値を設けていません。\n\n詳細な入力補正、各条件の前後の最大/最小差、適用後の位置・回転・スケール誤差、判断は [${jsonFilename}](${jsonFilename}) に記録します。実ファイル名・作者・モデル画像は含めません。SHA256は同じローカル入力の照合用です。\n\nこの数値runnerはGLBに記録された元の座標を保持します。ブラウザデモのVRM0向き補正とは座標系を分けています。レポート用のV番号はブラウザのprofile IDではなく、双方の補正JSONを流用しません。同じファイルSHA256でも座標系が異なれば別の校正です。\n\n## 未確認\n\n${report.limitations.map(value=>`- ${value}`).join('\n')}\n`
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const report=await runExperiments({localVRM:process.argv.includes('--local-vrm')})
 // Every run gets a fresh ignored folder. Never replace the recorded docs baseline.
 const parent=path.join(REPO,'artifacts','experiments')
 await mkdir(parent,{recursive:true})
 const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`,directory=path.join(parent,runId)
 await mkdir(directory)
 const jsonPath=path.join(directory,'matrix.json'),markdownPath=path.join(directory,'MATRIX.md')
 await writeFile(jsonPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
 await writeFile(markdownPath,formatMarkdown(report,'matrix.json'),{flag:'wx'})
 console.log(JSON.stringify({...report.summary,output:{directory,json:jsonPath,markdown:markdownPath}},null,2));if(!report.passed)process.exitCode=1
}
