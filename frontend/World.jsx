import {useEffect,useRef} from 'react';
import {Viewer} from 'resium';
import * as C from 'cesium';
import {loadTerrain} from './terrain';
import {localToGeographic} from '../backend/src/geometry.mjs';
import 'cesium/Build/Cesium/Widgets/widgets.css';
const BASE=import.meta.env.BASE_URL;
const CONTEXT_OPTIONS={webgl:{alpha:false,preserveDrawingBuffer:true}};
const color=s=>C.Color.fromCssColorString(s),v=(x,y,z)=>new C.Cartesian3(x,y,z);
export default function World({scene,flightRef,stageRef,settingsRef,onReady,onError,onLabels,apiRef}){
  const ref=useRef(null);
  useEffect(()=>{let cancelled=false,removeFrame,removeReady,viewer,retry,cleanup=()=>{};
    async function init(){
      viewer=ref.current?.cesiumElement;if(cancelled)return;if(!viewer){retry=requestAnimationFrame(()=>init().catch(e=>onError(import.meta.env.DEV?e.stack:e.message)));return;}
      viewer.scene.globe.baseColor=color('#397c90');viewer.scene.backgroundColor=color('#c2dce8');viewer.scene.globe.enableLighting=false;viewer.scene.fog.density=.00012;viewer.scene.fog.minimumBrightness=.82;viewer.scene.highDynamicRange=false;viewer.scene.postProcessStages.fxaa.enabled=true;viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.scene.globe.depthTestAgainstTerrain=true;
      const startTime=C.JulianDate.fromIso8601('2026-06-18T03:00:00Z');viewer.clock.currentTime=C.JulianDate.clone(startTime);viewer.clock.shouldAnimate=false;
      viewer.scene.sun.show=false;viewer.scene.moon.show=false;viewer.scene.skyBox.show=false;viewer.scene.skyAtmosphere.hueShift=-.03;viewer.scene.skyAtmosphere.saturationShift=-.25;
      viewer.camera.setView({destination:C.Cartesian3.fromDegrees(scene.coordinateSystem.origin.longitude-.00008,scene.coordinateSystem.origin.latitude-.00023,22),orientation:{heading:0,pitch:C.Math.toRadians(-7),roll:0}});
      let imageryStatus='影像连接中';
      C.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',{enablePickFeatures:false,maximumLevel:18}).then(imagery=>{if(cancelled)return;imagery.errorEvent.addEventListener(()=>{imageryStatus='在线影像暂不可用';});viewer.imageryLayers.addImageryProvider(imagery);imageryStatus='卫星影像';}).catch(()=>{imageryStatus='在线影像暂不可用';});
      const terrain=await loadTerrain(BASE);if(cancelled)return;viewer.terrainProvider=terrain.provider;
      const response=await fetch(`${BASE}geo/hk-buildings.json`);if(!response.ok)throw Error('香港建筑资源加载失败');const buildings=await response.json();if(cancelled)return;
      const buildingInstances=Array.from({length:6},()=>[]);const palette=['#b5c5c9','#c5d1d1','#a6bdc4','#d6d8d2','#93b1c0','#dde0db'];
      for(const b of buildings.buildings){if(b.ring.length<3)continue;const positions=C.Cartesian3.fromDegreesArray(b.ring.flat());const base=terrain.sample(b.center[0],b.center[1]);buildingInstances[b.id%6].push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(positions),height:base,extrudedHeight:base+b.height,vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(color(palette[b.id%palette.length]))}}));}
      const cityPrimitives=[];for(let i=0;i<6;i++)cityPrimitives.push(viewer.scene.primitives.add(new C.Primitive({geometryInstances:buildingInstances[i],appearance:new C.MaterialAppearance({material:new C.Material({fabric:{type:'CityFacade',uniforms:{base:color(palette[i])},source:`czm_material czm_getMaterial(czm_materialInput m){czm_material result=czm_getDefaultMaterial(m);vec2 grid=fract(m.st*vec2(10.,24.));float pane=step(.14,grid.x)*step(.19,grid.y);vec3 normalWC=czm_inverseViewRotation*m.normalEC;float roof=step(.8,dot(normalize(normalWC),vec3(-.379,.844,.380)));result.diffuse=mix(mix(base.rgb,vec3(.24,.39,.47),pane*.3),base.rgb,roof);result.specular=.18;result.shininess=24.;result.alpha=1.;return result;}`}}),translucent:false,closed:true}),asynchronous:true})));
      const landmarkPositions=new Map();
      const addBox=(id,lon,lat,z,dim,col)=>viewer.entities.add({id,position:C.Cartesian3.fromDegrees(lon,lat,z),box:{dimensions:v(...dim),material:color(col),outline:false}});
      // Landmark silhouettes are original, simplified meshes located at geographic coordinates.
      for(const lm of scene.landmarks){const h=lm.height||60,base=terrain.sample(lm.longitude,lm.latitude);landmarkPositions.set(lm.id,C.Cartesian3.fromDegrees(lm.longitude,lm.latitude,base+h*.55+12));if(lm.id==='ifc'||lm.id==='icc'){const total=lm.id==='ifc'?412:484;for(let tier=0;tier<7;tier++){const width=(lm.id==='ifc'?52:62)-tier*(lm.id==='ifc'?3:1.5);addBox(`${lm.id}-${tier}`,lm.longitude,lm.latitude,base+(tier+.5)*total/7,[width,width*.8,total/7],tier%2?'#9cb9c8':'#b8cbd2');}for(let k=-2;k<=2;k++){addBox(`${lm.id}-mullion-${k}`,lm.longitude+k*.00008,lm.latitude-.0002,base+total*.45,[1.3,2,total*.87],'#e0e6e5');}}}
      // Offshore concept terminals; their positions are fictional, not planned infrastructure.
      for(const pad of scene.vertiports){const geo=localToGeographic(scene,pad.position);viewer.entities.add({position:C.Cartesian3.fromDegrees(geo.longitude,geo.latitude,pad.position.z-2.4),cylinder:{length:4,topRadius:26,bottomRadius:26,material:color('#e2e8e6')}});viewer.entities.add({position:C.Cartesian3.fromDegrees(geo.longitude,geo.latitude,pad.position.z-.34),ellipse:{semiMajorAxis:20,semiMinorAxis:20,height:pad.position.z-.34,material:color('#99b9ba'),outline:true,outlineColor:color('#f8fbf7'),outlineWidth:2}});for(const [i,b] of [[-4,0,1,12],[4,0,1,12],[0,0,9,1]].entries())addBox(`${pad.id}-H-${i}`,geo.longitude+b[0]/103000,geo.latitude+b[1]/111320,pad.position.z-.29,[b[2],b[3],.08],'#f5fbfb');addBox(`${pad.id}-terminal`,geo.longitude-.00034,geo.latitude,pad.position.z+2,[15,24,8],'#dde6e4');addBox(`${pad.id}-glass`,geo.longitude-.00025,geo.latitude,pad.position.z+2,[1,21,5],'#3b6270');}
      let currentPosition=C.Cartesian3.ZERO,currentOrientation=C.Quaternion.IDENTITY;
      const aircraft=viewer.entities.add({id:'ng-01',position:new C.CallbackPositionProperty(()=>currentPosition,false),orientation:new C.CallbackProperty(()=>currentOrientation,false),model:{uri:`${BASE}models/ng-01.glb`,scale:1,minimumPixelSize:0,runAnimations:true,shadows:C.ShadowMode.DISABLED,imageBasedLightingFactor:new C.Cartesian2(1,.8)}});
      const path=viewer.entities.add({polyline:{positions:scene.route.waypoints.slice(1,-1).map(p=>{const g=localToGeographic(scene,p.position);return C.Cartesian3.fromDegrees(g.longitude,g.latitude,p.position.z);}),width:2,material:new C.PolylineGlowMaterialProperty({glowPower:.1,color:color('#72d2d7').withAlpha(.55)})}});
      // Modest ferry traffic gives the harbour a sense of scale without simulating logistics.
      const ferries=[];for(let i=0;i<3;i++){let pos=C.Cartesian3.ZERO;const entity=viewer.entities.add({position:new C.CallbackPositionProperty(()=>pos,false),box:{dimensions:v(7,22,4),material:color(i===1?'#edf0e2':'#b8d5c8')}});ferries.push({entity,set:p=>{pos=p;},index:i});}
      let previous=performance.now(),lastLabels=0,cameraPosition=null,cameraTarget=null,lastStage=null,lookYaw=0,lookPitch=0,drag=null;
      const canvas=viewer.canvas;const down=e=>{if(stageRef.current==='flight'){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}};const move=e=>{if(!drag)return;lookYaw+=(e.clientX-drag.x)*.004;lookPitch=C.Math.clamp(lookPitch+(e.clientY-drag.y)*.002,-.38,.38);drag={x:e.clientX,y:e.clientY};};const up=()=>{drag=null;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
      apiRef.current={resetView(){lookYaw=0;lookPitch=0;},capture(){viewer.render();return canvas.toDataURL('image/png');},diagnostics(){return{buildingCount:buildings.buildings.length,imageryStatus,terrainSource:terrain.meta.source,rendered:viewer.scene.frameState?.frameNumber};}};
      removeFrame=viewer.scene.preUpdate.addEventListener(()=>{if(cancelled)return;const now=performance.now(),dt=Math.min(.1,(now-previous)/1000);previous=now;const state=flightRef.current,stage=stageRef.current,settings=settingsRef.current;viewer.clock.currentTime=C.JulianDate.addSeconds(startTime,state.elapsedSeconds,new C.JulianDate());
        viewer.resolutionScale=settings.quality==='high'?Math.min(window.devicePixelRatio,1.5):.8;path.show=settings.route&&stage==='flight';const geo=localToGeographic(scene,state.position);currentPosition=C.Cartesian3.fromDegrees(geo.longitude,geo.latitude,state.position.z+1);currentOrientation=C.Transforms.headingPitchRollQuaternion(currentPosition,new C.HeadingPitchRoll(state.heading,0,0));
        const origin=scene.coordinateSystem.origin;
        let destination,target;
        if(stage==='boarding'||stage==='loading'){
          destination=C.Cartesian3.fromDegrees(origin.longitude-.00008,origin.latitude-.00023,22);target=canvas.clientWidth<600?C.Cartesian3.fromDegrees(origin.longitude+.00005,origin.latitude+.00010,0):C.Cartesian3.fromDegrees(origin.longitude-.00010,origin.latitude+.00065,18);
        }else{
          const enu=C.Transforms.eastNorthUpToFixedFrame(currentPosition),heading=state.heading;let offset,aim;
          if(state.camera==='chase'){const h=heading+lookYaw;offset=v(-Math.sin(h)*38,-Math.cos(h)*38,14+lookPitch*25);aim=v(Math.sin(h)*35,Math.cos(h)*35,4);}
          else if(state.camera==='forward'){const h=heading+lookYaw;offset=v(0,0,1.1);aim=v(Math.sin(h)*800,Math.cos(h)*800,lookPitch*550-60);}
          else {const h=Math.atan2((114.1596-geo.longitude)*Math.cos(geo.latitude*Math.PI/180),22.2855-geo.latitude)+lookYaw;offset=v(0,0,1);aim=v(Math.sin(h)*1100,Math.cos(h)*1100,lookPitch*600-110);}
          destination=C.Matrix4.multiplyByPoint(enu,offset,new C.Cartesian3());target=C.Matrix4.multiplyByPoint(enu,aim,new C.Cartesian3());
        }
        aircraft.show=stage==='boarding'||stage==='loading'||state.camera==='chase';
        if(!cameraPosition||stage==='boarding'&&lastStage!=='boarding'){cameraPosition=C.Cartesian3.clone(destination);cameraTarget=C.Cartesian3.clone(target);}else{const alpha=1-Math.exp(-dt*(settings.reducedMotion?18:4));C.Cartesian3.lerp(cameraPosition,destination,alpha,cameraPosition);C.Cartesian3.lerp(cameraTarget,target,alpha,cameraTarget);}lastStage=stage;
        const dir=C.Cartesian3.normalize(C.Cartesian3.subtract(cameraTarget,cameraPosition,new C.Cartesian3()),new C.Cartesian3()),upVector=C.Ellipsoid.WGS84.geodeticSurfaceNormal(cameraPosition,new C.Cartesian3());viewer.camera.setView({destination:cameraPosition,orientation:{direction:dir,up:upVector}});viewer.camera.frustum.fov=C.Math.toRadians(state.camera==='window'&&stage==='flight'?68:60);
        for(const f of ferries){const t=state.elapsedSeconds*.000008;f.set(C.Cartesian3.fromDegrees(114.155+f.index*.006+Math.sin(t*10+f.index)*.003,22.294+Math.cos(t*6+f.index)*.0015,3));}
        if(now-lastLabels>150){lastLabels=now;const labels=[];if(settings.labels&&stage==='flight')for(const lm of scene.landmarks){const position=landmarkPositions.get(lm.id),to=C.Cartesian3.subtract(position,viewer.camera.positionWC,new C.Cartesian3());const projected=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,position);if(projected&&C.Cartesian3.dot(to,viewer.camera.directionWC)>0&&projected.x>60&&projected.x<canvas.clientWidth-100&&projected.y>100&&projected.y<canvas.clientHeight-150){labels.push({...lm,x:projected.x,y:projected.y,distance:C.Cartesian3.magnitude(to)});}}onLabels(labels.slice(0,3));}
      });
      cleanup=()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);};
      const readyStarted=performance.now();removeReady=viewer.scene.postRender.addEventListener(()=>{if(cityPrimitives.every(p=>p.ready)&&(viewer.scene.globe.tilesLoaded||performance.now()-readyStarted>8000)){removeReady();removeReady=null;onReady({buildings:buildings.buildings.length,terrain:terrain.meta.source});}});
    }
    init().catch(e=>{if(!cancelled)onError(import.meta.env.DEV?e.stack:e.message);});return()=>{cancelled=true;cancelAnimationFrame(retry);removeFrame?.();removeReady?.();cleanup();apiRef.current=null;};
  },[]);
  return <Viewer ref={ref} className="world" animation={false} timeline={false} baseLayerPicker={false} geocoder={false} homeButton={false} sceneModePicker={false} navigationHelpButton={false} fullscreenButton={false} selectionIndicator={false} infoBox={false} baseLayer={false} scene3DOnly contextOptions={CONTEXT_OPTIONS}/>;
}
