/**
 * AntiGravityParticles.js
 * A high-performance, GPU-simulated WebGL 3D Particle Background
 * Inspired by Google Antigravity.
 * 
 * Dependencies: Three.js (tested with r134)
 */

class AntiGravityParticles {
  constructor(canvasSelector, options = {}) {
    this.canvas = document.querySelector(canvasSelector);
    if (!this.canvas) {
      console.error(`AntiGravityParticles: Canvas element "${canvasSelector}" not found.`);
      return;
    }

    // Merge custom options with defaults
    this.config = {
      mobileBreakpoint: 768,
      densityDesktop: 230,
      densityMobile: 120,
      particleScaleDesktop: 0.59,
      particleScaleMobile: 0.42,
      particleGridSize: 256, // Size of simulation FBO texture (256x256)
      ringWidth: 0.006,
      ringWidth2: 0.107,
      ringDisplacement: 0.62,
      darkColors: {
        color1: '#7189ff',
        color2: '#3074f9',
        color3: '#000000'
      },
      lightColors: {
        color1: '#2c64ed',
        color2: '#f84242',
        color3: '#ffcf03'
      },
      isDarkInitial: true,
      ...options
    };

    this.isMobile = window.innerWidth < this.config.mobileBreakpoint;
    this.isDark = this.config.isDarkInitial;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.lastTime = 0;
    this.evR = false;
    
    // Interactive tracking
    this.ringPos = new THREE.Vector2();
    this.targetPos = new THREE.Vector2();
    this.interactionPos = new THREE.Vector2();
    this.isInteracting = false;
    this.intersectionPoint = new THREE.Vector3();

    this.init();
  }

  // Simplex Noise GLSL helper
  static get SimplexNoiseGLSL() {
    return `vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g,l.zxy);vec3 i2=max(g,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;
  }

  // Poisson Disk generator in 2D
  generatePoissonPoints(w, h, minD, maxD, tries) {
    const cs = minD / Math.SQRT2;
    const gw = Math.ceil(w / cs);
    const gh = Math.ceil(h / cs);
    const grid = new Array(gw * gh).fill(-1);
    const pts = [];
    const act = [];

    const gi = (x, y) => Math.floor(x / cs) + Math.floor(y / cs) * gw;
    const add = (x, y) => {
      const i = pts.length;
      pts.push([x, y]);
      act.push(i);
      grid[gi(x, y)] = i;
    };

    const ok = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      const gx = Math.floor(x / cs);
      const gy = Math.floor(y / cs);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
          const idx = grid[nx + ny * gw];
          if (idx !== -1 && Math.hypot(pts[idx][0] - x, pts[idx][1] - y) < minD) return false;
        }
      }
      return true;
    };

    add(w / 2, h / 2);
    while (act.length > 0) {
      const ri = Math.floor(Math.random() * act.length);
      const [px, py] = pts[act[ri]];
      let f = false;
      for (let t = 0; t < tries; t++) {
        const a = Math.random() * Math.PI * 2;
        const d = minD + Math.random() * (maxD - minD);
        const nx = px + Math.cos(a) * d;
        const ny = py + Math.sin(a) * d;
        if (ok(nx, ny)) {
          add(nx, ny);
          f = true;
          break;
        }
      }
      if (!f) act.splice(ri, 1);
    }
    return pts;
  }

  init() {
    const SS = this.config.particleGridSize;
    const SL = SS * SS;

    // WebGL Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.isDark ? 0x000000 : 0xffffff);

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, .1, 1000);
    this.camera.position.z = 3.1;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, precision: 'highp' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Performance: Cap DPR strictly on mobile devices
    const dpr = Math.min(devicePixelRatio, this.isMobile ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);

    try {
      this.renderer.getContext().getExtension('EXT_color_buffer_float');
    } catch (e) {
      console.warn("AntiGravityParticles: EXT_color_buffer_float not supported");
    }

    // Generate Points via Poisson Disk
    const DN = this.isMobile ? this.config.densityMobile : this.config.densityDesktop;
    const mapVal = (v, a, b, c, d) => (v - a) * (d - c) / (b - a) + c;
    const minD = mapVal(DN, 0, 300, 10, 2);
    const maxD = mapVal(DN, 0, 300, 11, 3);
    
    const rp = this.generatePoissonPoints(500, 500, minD, maxD, 20);
    const pd = [];
    for (let i = 0; i < rp.length; i++) {
      pd.push(rp[i][0] - 250, rp[i][1] - 250);
    }
    const particleCount = pd.length / 2;
    this.particleCount = particleCount;

    // Data texture generation for positions
    const pData = new Float32Array(SL * 4);
    for (let i = 0; i < particleCount; i++) {
      pData[i * 4] = pd[i * 2] / 250;
      pData[i * 4 + 1] = pd[i * 2 + 1] / 250;
    }
    this.posTex = new THREE.DataTexture(pData, SS, SS, THREE.RGBAFormat, THREE.FloatType);
    this.posTex.needsUpdate = true;

    // FBO Simulation Targets (Ping-Pong)
    const createRenderTarget = () => new THREE.WebGLRenderTarget(SS, SS, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.rt1 = createRenderTarget();
    this.rt2 = createRenderTarget();

    this.renderer.setRenderTarget(this.rt1); this.renderer.setClearColor(0, 0); this.renderer.clear();
    this.renderer.setRenderTarget(this.rt2); this.renderer.setClearColor(0, 0); this.renderer.clear();
    this.renderer.setRenderTarget(null);

    // Setup GPU Physics Simulation Shader
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.simScene = new THREE.Scene();
    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: this.posTex },
        uPosRefs: { value: this.posTex },
        uRingPos: { value: new THREE.Vector2() },
        uRingRadius: { value: .2 },
        uDeltaTime: { value: 0 },
        uRingWidth: { value: this.config.ringWidth },
        uRingWidth2: { value: this.config.ringWidth2 },
        uRingDisplacement: { value: this.config.ringDisplacement },
        uTime: { value: 0 }
      },
      vertexShader: `void main(){gl_Position=vec4(position,1.);}`,
      fragmentShader: `precision highp float;uniform sampler2D uPosition,uPosRefs;uniform vec2 uRingPos;uniform float uTime,uDeltaTime,uRingRadius,uRingWidth,uRingWidth2,uRingDisplacement;${AntiGravityParticles.SimplexNoiseGLSL}
      void main(){vec2 uv=gl_FragCoord.xy/${SS}.0;vec4 pF=texture2D(uPosition,uv);float sc=pF.z,vel=pF.w;vec2 ref=texture2D(uPosRefs,uv).xy,cp=ref,pos=pF.xy*.8;float dist=distance(cp,uRingPos);float n0=snoise(vec3(cp*.2+vec2(18.49,72.97),uTime*.25));float d1=distance(cp+n0*.005,uRingPos);float t=smoothstep(uRingRadius-uRingWidth*2.,uRingRadius,dist)-smoothstep(uRingRadius,uRingRadius+uRingWidth,d1);float t2=smoothstep(uRingRadius-uRingWidth2*2.,uRingRadius,dist)-smoothstep(uRingRadius,uRingRadius+uRingWidth2,d1);float t3=smoothstep(uRingRadius+uRingWidth2,uRingRadius,dist);t=pow(t,2.);t2=pow(t2,3.);t+=t2*3.+t3*.4;t+=snoise(vec3(cp*30.+vec2(11.49,12.97),uTime*.25))*t3*.5;float nS=snoise(vec3(cp*2.+vec2(18.49,72.97),uTime*.25));t+=pow((nS+1.5)*.5,2.)*.6;float n1=snoise(vec3(cp*4.+vec2(88.49,32.44),uTime*.175));float n2=snoise(vec3(cp*4.+vec2(50.9,120.95),uTime*.175));float n3=snoise(vec3(cp*20.+vec2(18.49,72.97),uTime*.25));float n4=snoise(vec3(cp*20.+vec2(50.9,120.95),uTime*.25));vec2 disp=vec2(n1,n2)*.03+vec2(n3,n4)*.005;disp.x+=sin(ref.x*20.+uTime*2.)*.02*clamp(dist,0.,1.);disp.y+=cos(ref.y*20.+uTime*1.5)*.02*clamp(dist,0.,1.);pos-=(uRingPos-(cp+disp))*pow(t2,.75)*uRingDisplacement;float sd=t-sc;sd*=.2;sc+=sd;vec2 fp=cp+disp+pos*.25;vel=vel*.5+sc*.25;gl_FragColor=vec4(fp,sc,vel);}`
    });
    this.simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial));

    // Render Geometry & Shader Setup
    const geo = new THREE.BufferGeometry();
    const uvs = new Float32Array(particleCount * 2);
    const positions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount * 4);

    for (let i = 0; i < particleCount; i++) {
      uvs[i * 2] = (i % SS) / SS;
      uvs[i * 2 + 1] = Math.floor(i / SS) / SS;
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('seeds', new THREE.BufferAttribute(seeds, 4));

    const initialScale = this.renderer.domElement.width / dpr / 2000 * (this.isMobile ? this.config.particleScaleMobile : this.config.particleScaleDesktop);

    this.renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: this.posTex },
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(this.isDark ? this.config.darkColors.color1 : this.config.lightColors.color1) },
        uColor2: { value: new THREE.Color(this.isDark ? this.config.darkColors.color2 : this.config.lightColors.color2) },
        uColor3: { value: new THREE.Color(this.isDark ? this.config.darkColors.color3 : this.config.lightColors.color3) },
        uAlpha: { value: 1 },
        uRingPos: { value: new THREE.Vector2() },
        uRez: { value: new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height) },
        uParticleScale: { value: initialScale },
        uPixelRatio: { value: dpr },
        uColorScheme: { value: this.isDark ? 0 : 1 }
      },
      vertexShader: `precision highp float;attribute vec4 seeds;uniform sampler2D uPosition;uniform float uTime,uParticleScale,uPixelRatio;varying vec4 vSeeds;varying float vVelocity,vScale;varying vec2 vLocalPos,vScreenPos;void main(){vec4 pos=texture2D(uPosition,uv);vSeeds=seeds;vVelocity=pos.w;vScale=pos.z;vLocalPos=pos.xy;vec4 vs=modelViewMatrix*vec4(pos.xy,0.,1.);gl_Position=projectionMatrix*vs;vScreenPos=gl_Position.xy;gl_PointSize=(vScale*7.)*(uPixelRatio*.5)*uParticleScale;}`,
      fragmentShader: `precision highp float;varying vec4 vSeeds;varying vec2 vScreenPos,vLocalPos;varying float vScale,vVelocity;uniform vec3 uColor1,uColor2,uColor3;uniform vec2 uRingPos,uRez;uniform float uAlpha,uTime;uniform int uColorScheme;${AntiGravityParticles.SimplexNoiseGLSL}
      float sdRB(vec2 p,vec2 b,vec4 r){r.xy=(p.x>0.)?r.xy:r.zw;r.x=(p.y>0.)?r.x:r.y;vec2 q=abs(p)-b+r.x;return min(max(q.x,q.y),0.)+length(max(q,0.))-r.x;}
      vec2 rot(vec2 v,float a){float s=sin(a),c=cos(a);return mat2(c,s,-s,c)*v;}
      void main(){float nA=snoise(vec3(vLocalPos*10.+vec2(18.49,72.97),uTime*.85));float nC=snoise(vec3(vLocalPos*2.+vec2(74.66,91.56),uTime*.5));nC=(nC+1.)*.5;float angle=atan(vLocalPos.y-uRingPos.y,vLocalPos.x-uRingPos.x);vec2 uv=gl_PointCoord.xy-vec2(.5);uv.y*=-1.;uv=rot(uv,-angle+nA*.5);float h=.8;float prog=smoothstep(0.,.75,pow(nC,2.));vec3 col=mix(mix(uColor1,uColor2,prog/h),mix(uColor2,uColor3,(prog-h)/(1.-h)),step(h,prog));float rd=sdRB(uv,vec2(.5,.2),vec4(.25));rd=smoothstep(.1,0.,rd);float a=uAlpha*rd*smoothstep(.1,.2,vScale);if(a<.01)discard;col=clamp(col,0.,1.);col=mix(col,col*clamp(vVelocity,0.,1.),float(uColorScheme));gl_FragColor=vec4(col,clamp(a,0.,1.));}`,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.renderMaterial);
    this.points.scale.set(5, 5, 5);
    this.scene.add(this.points);

    // Custom Simplex noise logic for cursor drift
    class SN {
      constructor() {
        this.p = [];
        for (let i = 0; i < 512; i++) this.p[i] = Math.random();
      }
      getVal(t) {
        const i = Math.floor(t) & 255, f = t - Math.floor(t);
        return this.p[i] * (1 - f) + this.p[(i + 1) & 255] * f;
      }
    }
    this.noise = new SN();

    // Mouse Interaction Raycasting Plane
    this.raycaster = new THREE.Raycaster();
    this.raycastPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 12.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.raycastPlane);

    // Bind Event Listeners
    this.onResizeBound = this.onResize.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onTouchMoveBound = this.onTouchMove.bind(this);
    this.onTouchEndBound = this.onTouchEnd.bind(this);
    
    window.addEventListener('resize', this.onResizeBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    document.addEventListener('touchmove', this.onTouchMoveBound, { passive: true });
    document.addEventListener('touchend', this.onTouchEndBound);

    // Start Simulation Loop
    this.animateBound = this.animate.bind(this);
    this.animate();
  }

  onMouseMove(e) {
    this.interactionPos.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.interactionPos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.isInteracting = true;
  }

  onTouchMove(e) {
    if (e.touches[0]) {
      this.interactionPos.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      this.interactionPos.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      this.isInteracting = true;
    }
  }

  onTouchEnd() {
    this.isInteracting = false;
  }

  onResize() {
    this.isMobile = window.innerWidth < this.config.mobileBreakpoint;
    
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const dpr = Math.min(devicePixelRatio, this.isMobile ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);

    const scaleAttr = this.isMobile ? this.config.particleScaleMobile : this.config.particleScaleDesktop;
    const pS = this.renderer.domElement.width / dpr / 2000 * scaleAttr;

    this.renderMaterial.uniforms.uRez.value.set(this.renderer.domElement.width, this.renderer.domElement.height);
    this.renderMaterial.uniforms.uPixelRatio.value = dpr;
    this.renderMaterial.uniforms.uParticleScale.value = pS;
    this.renderMaterial.needsUpdate = true;
  }

  updateTheme(isDark) {
    this.isDark = isDark;
    this.scene.background = new THREE.Color(isDark ? 0x000000 : 0xffffff);

    const colors = isDark ? this.config.darkColors : this.config.lightColors;
    this.renderMaterial.uniforms.uColor1.value.set(colors.color1);
    this.renderMaterial.uniforms.uColor2.value.set(colors.color2);
    this.renderMaterial.uniforms.uColor3.value.set(colors.color3);
    this.renderMaterial.uniforms.uColorScheme.value = isDark ? 0 : 1;
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animateBound);

    const elapsedTime = this.clock.getElapsedTime();
    const dt = elapsedTime - this.lastTime;
    this.lastTime = elapsedTime;
    this.time += dt;

    // Organic camera cursor drifting (using Sn noise class)
    const nx = (this.noise.getVal(this.time * .66 + 94.234) - .5) * 2;
    const ny = (this.noise.getVal(this.time * .75 + 21.028) - .5) * 2;
    this.targetPos.set(nx * .2, ny * .1);

    if (this.isInteracting) {
      this.raycaster.setFromCamera(this.interactionPos, this.camera);
      const intersects = this.raycaster.intersectObject(this.raycastPlane);
      if (intersects.length > 0) {
        this.intersectionPoint.copy(intersects[0].point);
        this.targetPos.set(
          this.intersectionPoint.x * .175 + nx * .1,
          this.intersectionPoint.y * .175 + ny * .1
        );
        this.ringPos.x += (this.targetPos.x - this.ringPos.x) * .02;
        this.ringPos.y += (this.targetPos.y - this.ringPos.y) * .02;
      }
    } else {
      this.ringPos.x += (this.targetPos.x - this.ringPos.x) * .01;
      this.ringPos.y += (this.targetPos.y - this.ringPos.y) * .01;
    }

    const dpr = Math.min(devicePixelRatio, this.isMobile ? 1.5 : 2);
    const scaleAttr = this.isMobile ? this.config.particleScaleMobile : this.config.particleScaleDesktop;
    const pS = this.renderer.domElement.width / dpr / 2000 * scaleAttr;

    // GPU Simulation Ping-Pong render passes
    this.simMaterial.uniforms.uPosition.value = this.evR ? this.rt1.texture : this.posTex;
    this.simMaterial.uniforms.uTime.value = elapsedTime;
    this.simMaterial.uniforms.uDeltaTime.value = dt;
    this.simMaterial.uniforms.uRingRadius.value = .175 + Math.sin(this.time) * .03 + Math.cos(this.time * 3) * .02;
    this.simMaterial.uniforms.uRingPos.value = this.ringPos;

    this.renderer.setRenderTarget(this.rt2);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);

    // Render pass to viewport
    this.renderMaterial.uniforms.uPosition.value = this.evR ? this.rt2.texture : this.posTex;
    this.renderMaterial.uniforms.uTime.value = elapsedTime;
    this.renderMaterial.uniforms.uRingPos.value = this.ringPos;
    this.renderMaterial.uniforms.uParticleScale.value = pS;

    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Swap Render Targets
    const tmp = this.rt1;
    this.rt1 = this.rt2;
    this.rt2 = tmp;
    this.evR = true;
  }

  destroy() {
    cancelAnimationFrame(this.animationId);

    window.removeEventListener('resize', this.onResizeBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('touchmove', this.onTouchMoveBound);
    document.removeEventListener('touchend', this.onTouchEndBound);

    this.rt1.dispose();
    this.rt2.dispose();
    this.posTex.dispose();
    this.simMaterial.dispose();
    this.renderMaterial.dispose();
    this.points.geometry.dispose();

    this.renderer.dispose();
  }
}
