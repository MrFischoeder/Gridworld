// The light map in the shaders (0.199). Every material that takes the scene's fog (the land, the places, the foes,
// the props) also takes the darkness: after the fog, its colour is multiplied by how lit the spot is, between the
// place's ambient light `uAmb` and full light, mixed in by `uDark` (0 by day: nothing changes). The light comes from
// your own light (`uEye`: a lamp's reach round the eye; `uCone`: a flashlight's beam along the view) and the lamps
// nearby (`uLamps`, camera-relative, w = reach). The positions are worked camera-relative (`uViewInv` = the camera's
// world matrix), so the numbers stay small tens of km from Gridholm. The uniforms are one shared set: every
// material gets the same objects in its `onBeforeCompile`, so world/light.ts sets them once a frame. A material
// without them (a fog-free one, the viewmodel's scene) is simply not darkened. Imported by world/render.ts, before
// any material compiles.
import * as THREE from 'three';

export const LAMP_SLOTS = 12;
export const DARK = {
  uDark: { value: 0 },
  uAmb: { value: 1 },
  uEye: { value: new THREE.Vector4() },
  uCone: { value: new THREE.Vector4() },
  uLamps: { value: Array.from({ length: LAMP_SLOTS }, () => new THREE.Vector4()) },
  uViewInv: { value: new THREE.Matrix4() },
};

const C = THREE.ShaderChunk as unknown as Record<string, string>;
C.fog_pars_vertex += `
#ifdef USE_FOG
	varying vec3 vDarkV;
	uniform mat4 uViewInv;
#endif`;
C.fog_vertex += `
#ifdef USE_FOG
	vDarkV = mat3( uViewInv ) * mvPosition.xyz;
#endif`;
C.fog_pars_fragment += `
#ifdef USE_FOG
	varying vec3 vDarkV;
	uniform float uDark;
	uniform float uAmb;
	uniform vec4 uEye;
	uniform vec4 uCone;
	uniform vec4 uLamps[ ${LAMP_SLOTS} ];
	float darkLit() {
		float d = length( vDarkV ), l = uAmb;
		if ( uEye.w > 0.0 ) l = max( l, 1.0 - smoothstep( uEye.w * 0.45, uEye.w, d ) );
		if ( uCone.w > 0.0 ) {
			float c = dot( vDarkV / max( d, 0.001 ), uCone.xyz );
			l = max( l, smoothstep( 0.84, 0.95, c ) * ( 1.0 - smoothstep( uCone.w * 0.45, uCone.w, d ) ) );
		}
		for ( int i = 0; i < ${LAMP_SLOTS}; i ++ ) {
			vec4 L = uLamps[ i ];
			if ( L.w <= 0.0 ) continue;
			l = max( l, 1.0 - smoothstep( L.w * 0.4, L.w, length( vDarkV - L.xyz ) ) );
		}
		return clamp( l, 0.0, 1.0 );
	}
#endif`;
C.fog_fragment += `
#ifdef USE_FOG
	if ( uDark > 0.0 ) gl_FragColor.rgb *= mix( 1.0, darkLit(), uDark );
#endif`;

// every material gets the shared uniforms (none of ours sets its own onBeforeCompile)
THREE.Material.prototype.onBeforeCompile = function (shader: THREE.WebGLProgramParametersWithUniforms) { Object.assign(shader.uniforms, DARK); };
