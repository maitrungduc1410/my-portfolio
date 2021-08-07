import './style.css'
import spaceImg from './space.jpeg'
import jamesImg from './james.jpeg'
import earthBlueMarbleImg from './earth-blue-marble.jpeg'
import earthTopologyImg from './earth-topology.png'
import moonImg from './moon.jpeg'
import moonNormalImg from './normal.jpeg'

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('bg')
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
// camera.position.setZ(30)

const geometry = new THREE.TorusGeometry(10, 3, 16, 100)
const material = new THREE.MeshStandardMaterial({ color: 0xFF6347 })
const torus = new THREE.Mesh(geometry, material)
// torus.position.z = -10

scene.add(torus)

const pointLight = new THREE.PointLight(0xffffff)
pointLight.position.set(5, 5, 5)

const ambientLight = new THREE.AmbientLight(0xffffff)
scene.add(pointLight, ambientLight)

// const lightHelper = new THREE.PointLightHelper(pointLight)
// const gridHelper = new THREE.GridHelper(200, 50)
// scene.add(lightHelper, gridHelper)

const controls = new OrbitControls(camera, renderer.domElement)

function addStar() {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24)
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
  const star = new THREE.Mesh(geometry, material)
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(100))
  star.position.set(x, y, z)
  scene.add(star)
}

Array(200).fill().forEach(addStar)

const spaceTexture = new THREE.TextureLoader().load(spaceImg)
scene.background = spaceTexture

const jamesTexture = new THREE.TextureLoader().load(jamesImg)
const james = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshBasicMaterial({ map: jamesTexture })
)
scene.add(james)

const earthTexture = new THREE.TextureLoader().load(earthBlueMarbleImg)
const normalTexture = new THREE.TextureLoader().load(earthTopologyImg)

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: earthTexture,
    normalMap: normalTexture,
  })
)
scene.add(earth)

earth.position.z = 25
earth.position.setX(-10)

const moonTexture = new THREE.TextureLoader().load(moonImg)
const normalMoonTexture = new THREE.TextureLoader().load(moonNormalImg)

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: normalMoonTexture,
  })
)
scene.add(moon)

moon.position.z = 10
moon.scale.x = 0.5
moon.scale.y = 0.5
moon.scale.z = 0.5
// moon.position.setX(15)

// Pivot point
const pivotPoint = new THREE.Object3D();
earth.add(pivotPoint);

// make the pivotpoint the sphere's parent.
pivotPoint.add(moon);


function moveCamera() {
  const t = document.body.getBoundingClientRect().top
  earth.rotation.x += 0.05
  // earth.rotation.y += 0.075
  earth.rotation.z += 0.05

  james.rotation.y += 0.01
  james.rotation.z += 0.01

  camera.position.z = t * -0.01
  camera.position.x = t * -0.0002
  camera.position.y = t * -0.0002
}

document.body.onscroll = moveCamera
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate)
  
  pivotPoint.rotation.y += 0.005;

  torus.rotation.x += 0.01
  torus.rotation.y += 0.005
  torus.rotation.z += 0.01
  controls.update()
  renderer.render(scene, camera)
}

animate()