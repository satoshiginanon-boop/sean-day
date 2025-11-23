import * as THREE from "https://cdn.skypack.dev/three@0.133.1/build/three.module";

const canvasEl = document.querySelector("#canvas");
const cleanBtn = document.querySelector(".clean-btn");

const pointer = {
    x: .66,
    y: .3,
    clicked: true,
};

let basicMaterial, shaderMaterial;
let renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

let sceneShader = new THREE.Scene();
let sceneBasic = new THREE.Scene();
let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
let clock = new THREE.Clock();

let renderTargets = [
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight),
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight)
];

createPlane();
updateSize();

window.addEventListener("resize", () => {
    updateSize();
    cleanCanvas();
});

render();

let isTouchScreen = false;

window.addEventListener("click", e => {
    isTouchScreen = false;
    pointer.x = e.pageX / window.innerWidth;
    pointer.y = e.pageY / window.innerHeight;
    // quick visual dot to confirm clicks (appears behind UI)
    (function showClickDot(px, py){
        const container = document.querySelector('.container');
        const dot = document.createElement('div');
        dot.className = 'click-dot';
        if (container) {
            const rect = container.getBoundingClientRect();
            dot.style.left = (px - rect.left - 6) + 'px';
            dot.style.top = (py - rect.top - 6) + 'px';
            container.appendChild(dot);
            setTimeout(() => dot.remove(), 420);
        }
    })(e.pageX, e.pageY);
    pointer.clicked = true;
    // randomize color seed per click (so each flower is different)
    try {
        if (shaderMaterial && shaderMaterial.uniforms && shaderMaterial.uniforms.u_colorSeed) {
            shaderMaterial.uniforms.u_colorSeed.value = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        }
    } catch (err) {
        console.warn('Could not set color seed on shader:', err);
    }
    console.log('flower click', pointer.x.toFixed(3), pointer.y.toFixed(3));
});

window.addEventListener("touchstart", e => {
    isTouchScreen = true;
    pointer.x = e.targetTouches[0].pageX / window.innerWidth;
    pointer.y = e.targetTouches[0].pageY / window.innerHeight;
    pointer.clicked = true;
    try {
        if (shaderMaterial && shaderMaterial.uniforms && shaderMaterial.uniforms.u_colorSeed) {
            shaderMaterial.uniforms.u_colorSeed.value = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        }
    } catch (err) {
        console.warn('Could not set color seed on shader:', err);
    }
    console.log('flower touch', pointer.x.toFixed(3), pointer.y.toFixed(3));
});

if (cleanBtn) cleanBtn.addEventListener("click", cleanCanvas);

function cleanCanvas() {
    pointer.vanishCanvas = true;
    setTimeout(() => {
        pointer.vanishCanvas = false;
    }, 50);
}

function createPlane() {
    shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_stop_time: { type: "f", value: 0. },
            u_stop_randomizer: { type: "v2", value: new THREE.Vector2(Math.random(), Math.random()) },
            u_cursor: { type: "v2", value: new THREE.Vector2(pointer.x, pointer.y) },
            u_ratio: { type: "f", value: window.innerWidth / window.innerHeight },
            u_texture: { type: "t", value: null },
            u_colorSeed: { type: "v3", value: new THREE.Vector3(Math.random(), Math.random(), Math.random()) },
            u_clean: { type: "f", value: 1. },
            u_fade: { type: "f", value: 0.5 } // fading control
        },
        vertexShader: document.getElementById("vertexShader").textContent,
        fragmentShader: document.getElementById("fragmentShader").textContent
    });

    basicMaterial = new THREE.MeshBasicMaterial();
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    const planeBasic = new THREE.Mesh(planeGeometry, basicMaterial);
    const planeShader = new THREE.Mesh(planeGeometry, shaderMaterial);
    sceneBasic.add(planeBasic);
    sceneShader.add(planeShader);
}

function render() {
    if (!shaderMaterial) {
        // shader not ready — keep loop alive, fallback visuals can show
        requestAnimationFrame(render);
        return;
    }

    shaderMaterial.uniforms.u_clean.value = pointer.vanishCanvas ? 0 : 1;
    shaderMaterial.uniforms.u_texture.value = renderTargets[0].texture;

    if (pointer.clicked) {
        shaderMaterial.uniforms.u_cursor.value = new THREE.Vector2(pointer.x, 1 - pointer.y);
        shaderMaterial.uniforms.u_stop_randomizer.value = new THREE.Vector2(Math.random(), Math.random());
        shaderMaterial.uniforms.u_stop_time.value = 0.;
        shaderMaterial.uniforms.u_fade.value = 0.9999; // reset fade when flower appears
        pointer.clicked = false;
    }

    shaderMaterial.uniforms.u_stop_time.value += clock.getDelta();
    shaderMaterial.uniforms.u_fade.value *= 0.9999; // slow fade

    // debug: indicate shader active when a click just happened
    if (clock.oldTime === undefined) clock.oldTime = 0;
    // (lightweight) log only when stop_time is small to avoid spamming
    if (shaderMaterial.uniforms.u_stop_time && shaderMaterial.uniforms.u_stop_time.value < 0.05) {
        // show a small console hint when a flower spawn is triggered
        console.debug('flower shader spawned at', shaderMaterial.uniforms.u_cursor.value.x.toFixed(3), shaderMaterial.uniforms.u_cursor.value.y.toFixed(3));
    }

    renderer.setRenderTarget(renderTargets[1]);
    renderer.render(sceneShader, camera);
    basicMaterial.map = renderTargets[1].texture;
    renderer.setRenderTarget(null);
    renderer.render(sceneBasic, camera);

    let tmp = renderTargets[0];
    renderTargets[0] = renderTargets[1];
    renderTargets[1] = tmp;

    requestAnimationFrame(render);
}

function updateSize() {
    if (!shaderMaterial) return;
    shaderMaterial.uniforms.u_ratio.value = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// If WebGL isn't available or shader fails, provide a visible fallback so clicks show something
function spawnFallbackFlower(pageX, pageY) {
    const el = document.createElement('div');
    el.className = 'fallback-flower';
    el.textContent = '🌸';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    // append inside the canvas container so it appears behind UI
    const container = document.querySelector('.container');
    if (container) {
        const rect = container.getBoundingClientRect();
        el.style.left = (pageX - rect.left - 18) + 'px';
        el.style.top = (pageY - rect.top - 18) + 'px';
        container.appendChild(el);
    } else {
        el.style.left = (pageX - 18) + 'px';
        el.style.top = (pageY - 18) + 'px';
        document.body.appendChild(el);
    }
    setTimeout(() => el.classList.add('fade'), 10);
    setTimeout(() => el.remove(), 1600);
}

// If shader isn't working, show fallback flowers when user clicks
window.addEventListener('click', (e) => {
    setTimeout(() => {
        if (!shaderMaterial) spawnFallbackFlower(e.pageX, e.pageY);
    }, 50);
});

// Show a small instruction note in `.name`
const nameEl = document.querySelector('.name');
if (nameEl) {
    nameEl.textContent = 'Tap anywhere to spawn a flower 🌸';
    nameEl.style.transition = 'opacity 600ms';
    nameEl.style.opacity = '0.0';
    setTimeout(() => { nameEl.style.opacity = '0.95'; }, 200);
    setTimeout(() => { nameEl.style.opacity = '0.0'; }, 6000);
}
