import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'

// Image filenames
const imageFilenames = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg', '10.jpg']

// GLTF loader
const gltfLoader = new GLTFLoader()

// Debug
// const pane = new Pane()
// pane.registerPlugin(EssentialsPlugin)

// const fpsGraph = pane.addBlade({
//     view: 'fpsgraph',
//     label: 'fpsgraph',
// })

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)

    // Update grid layout
    updateGridLayout()
})

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
camera.position.set(0, 0, 5)
scene.add(camera)

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

/**
 * Texture Loader
 */
const textureLoader = new THREE.TextureLoader()
const textures = imageFilenames.map(filename => textureLoader.load(filename))

/**
 * Create Image Grid
 */
const grid = new THREE.Group()
scene.add(grid)

const materials = []

function createImagePlane(texture) {
    const material = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            uniform float uBend;

            void main()
            {
                vec3 pos = position;
                pos.y += sin(uv.x * 3.14) * uBend;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec4 uResolution;
            uniform sampler2D uImage;
            
            uniform vec2 scale;
            uniform vec2 imageBounds;
            uniform vec3 color;
            uniform sampler2D map;
            uniform float zoom;
            uniform float grayscale;
            uniform float opacity;
            
            const vec3 luma = vec3(0.299, 0.587, 0.114);
            
            vec4 toGrayscale(vec4 color, float intensity) {
                return vec4(mix(color.rgb, vec3(dot(color.rgb, luma)), intensity), color.a);
            }
            
            vec2 aspect(vec2 size) {
                return size / min(size.x, size.y);
            }
            
            void main() {
                vec2 s = aspect(scale);
                vec2 i = aspect(imageBounds);
                float rs = s.x / s.y;
                float ri = i.x / i.y;
                vec2 newSize = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
                vec2 offset = (rs < ri ? vec2((newSize.x - s.x) / 2.0, 0.0) : vec2(0.0, (newSize.y - s.y) / 2.0)) / newSize;
                vec2 uv = vUv * s / newSize + offset;
                
                vec2 zUv = (uv - vec2(0.5, 0.5)) / zoom + vec2(0.5, 0.5);
                vec4 outputImageColor = toGrayscale(texture2D(map, zUv) * vec4(color, opacity), grayscale);
            
                gl_FragColor = outputImageColor;
            }
        `,
        uniforms: {
            uTime: { value: 0 },
            uImage: { value: texture },
            uResolution: { value: new THREE.Vector2(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio) },
            color: { value: new THREE.Color('white') },
            scale: { value: new THREE.Vector2(1, 1) },
            imageBounds: { value: new THREE.Vector2(3840, 2400) },
            map: { value: texture },
            zoom: { value: 1.0 },
            grayscale: { value: 0 },
            opacity: { value: 1 },
            uBend: { value: 0 }
        },
        side: THREE.DoubleSide,
        transparent: true
    })

    materials.push(material)
    const geometry = new THREE.PlaneGeometry(4, 3, 10, 10)
    const plane = new THREE.Mesh(geometry, material)
    plane.userData.originalMaterial = material

    plane.userData.onClick = () => {
        expandImage(plane)
    }

    return plane
}

textures.forEach(texture => {
    const plane = createImagePlane(texture)
    grid.add(plane)
})





/**
 * Update Grid Layout
 */
let maxScroll, minScroll;

function updateGridLayout() {
    // Define constants
    const BASE_WIDTH = 300; // Base width to determine columns
    const MAX_COLS = 2; // Maximum number of columns
    const MIN_COLS = 1; // Minimum number of columns
    const MARGIN = 1; // Margin between planes
    const BASE_SPACING = 5; // Base spacing without scale
    const SCALE_FACTOR = 1.5; // Scale factor for 2 columns

    // Calculate the number of columns based on the width
    const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, Math.floor(sizes.width / BASE_WIDTH)));
    const rows = Math.ceil(textures.length / cols);

    // Determine the scale based on the number of columns
    const scale = (cols === 2) ? SCALE_FACTOR : 1;

    // Calculate the spacing based on the scale and margin
    const spacing = BASE_SPACING * scale + MARGIN;

    // Iterate over each plane and set its position and scale
    grid.children.forEach((plane, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        // Calculate the position
        plane.position.x = col * spacing - (cols - 1) * spacing / 2;
        plane.position.y = -row * spacing + (rows - 1) * spacing / 2;

        // Set the scale
        plane.scale.set(scale, scale, scale);
    });

    // Calculate the scroll limits based on the grid height
    const gridHeight = (rows - 1) * spacing;
    maxScroll = gridHeight / 2;
    minScroll = -maxScroll;

    console.log(`Columns: ${cols}, Rows: ${rows}, Scale: ${scale}, Spacing: ${spacing}`);
}

updateGridLayout();


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)
renderer.setClearColor(0x6e76ff, 1)



/**
 * Scroll Easing
 */
let scrollTarget = 0
let currentScroll = 0
let lastScroll = 0
let isScrolling = false
let scrollTimeout = null
let lastWheelTime = 0

function onScroll(deltaY) {
    scrollTarget += deltaY * 0.03
    scrollTarget = Math.max(minScroll, Math.min(maxScroll, scrollTarget))
    isScrolling = true

    lastWheelTime = performance.now()

    if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout)
    }

    scrollTimeout = setTimeout(() => {
        isScrolling = false
    }, 200)
}

canvas.addEventListener('wheel', (event) => {
    onScroll(event.deltaY)
}, { passive: true })

// Touch events
let touchStartY = 0
let touchEndY = 0
canvas.addEventListener('touchstart', (event) => {
    touchStartY = event.touches[0].clientY
})

canvas.addEventListener('touchmove', (event) => {
    touchEndY = event.touches[0].clientY
    const deltaY = touchStartY - touchEndY
    onScroll(deltaY)
    touchStartY = touchEndY
})

/**
 * Animate
 */
const clock = new THREE.Clock()

// Function to generate random HSL color with fixed saturation and lightness
function getRandomHSLColor() {
    const hue = Math.random() -0.5
    const saturation = 0.5
    const lightness = 0.5
    return new THREE.Color().setHSL(hue, saturation, lightness)
}

// Initial random colors
let color1 = getRandomHSLColor()
let color2 = getRandomHSLColor()

const tick = () => {
    // fpsGraph.begin()

    const elapsedTime = clock.getElapsedTime()

    // Determine if scrolling has stopped
    if (performance.now() - lastWheelTime > 200) {
        isScrolling = false
    }

    // Update scroll position
    currentScroll += (scrollTarget - currentScroll) * 0.1
    camera.position.y = -currentScroll

    // Calculate scroll direction
    const scrollDirection = Math.sign(currentScroll - lastScroll)
    lastScroll = currentScroll

    // Update material properties based on scroll position
    materials.forEach((material, index) => {
        if (isScrolling) {
            material.uniforms.uBend.value = THREE.MathUtils.lerp(material.uniforms.uBend.value, scrollDirection * 0.5, 0.1)
            material.uniforms.zoom.value = THREE.MathUtils.lerp(material.uniforms.zoom.value, 1.8, 0.1)
            material.uniforms.grayscale.value = THREE.MathUtils.lerp(material.uniforms.grayscale.value, 1.2, 0.1)
        } else {
            material.uniforms.uBend.value = THREE.MathUtils.lerp(material.uniforms.uBend.value, 0, 0.1)
            material.uniforms.zoom.value = THREE.MathUtils.lerp(material.uniforms.zoom.value, 1, 0.1)
            material.uniforms.grayscale.value = THREE.MathUtils.lerp(material.uniforms.grayscale.value, 0, 0.1)
        }
    })


    const t = (camera.position.y + 8) / 16
    const interpolatedColor = color1.clone().lerp(color2, t)
    renderer.setClearColor(interpolatedColor)


    // Render
    renderer.render(scene, camera)

    // fpsGraph.end()

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()