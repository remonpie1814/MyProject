import * as THREE from "https://cdn.skypack.dev/three@0.128.0/build/three.module.js";
import { OBJLoader } from "https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.skypack.dev/lil-gui";

let camera, scene, renderer, model, pivot, axesHelper, controls;
let dirLight;
let positionFolder, rotationFolder, cameraFolder, lightFolder, pivotFolder;
let positionParams, rotationParams, cameraParams, lightParams, pivotParams;
let positionXCtrl, positionYCtrl, positionZCtrl;
let rotationXCtrl, rotationYCtrl, rotationZCtrl;
let fovCtrl, zoomCtrl;
let lightXCtrl, lightYCtrl, lightZCtrl;
let pivotXCtrl, pivotYCtrl, pivotZCtrl;
let xRing, yRing, zRing;
let savedPivotY = 0; // 저장된 y축 값
let useSavedYForReset = false; // 체크박스 상태에 따른 초기화 조건
let hoverCube; // 전역 변수 선언
let cubeMesh, cubeEdges; // 전역 변수 선언
let isHovering = false; // 호버 상태를 추적
let isDragging = false;
let dragStart = new THREE.Vector3();
let dragOffset = new THREE.Vector3();
let dragPlane; // 드래그 평면

function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  // 카메라 설정
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    2000
  );
  camera.position.set(0, 200, 400);

  // 씬 설정
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x999999);
  scene.fog = new THREE.Fog(0x999999, 500, 2000);

  // 조명 설정
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(0, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 500;
  dirLight.shadow.camera.bottom = -500;
  dirLight.shadow.camera.left = -500;
  dirLight.shadow.camera.right = 500;
  dirLight.shadow.camera.near = 0.8;
  dirLight.shadow.camera.far = 2000;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;

  scene.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // 바닥 생성
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  // OBJ 로더
  const loader = new OBJLoader();
  loader.load(
    "../assets/model.obj",
    function (obj) {
      pivot = new THREE.Object3D();
      scene.add(pivot);

      model = obj;
      model.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshPhongMaterial({ color: 0x999999 });
        }
      });

      // 모델의 지면 위치 보정
      const boundingBox = new THREE.Box3().setFromObject(model);
      const minY = boundingBox.min.y;
      model.position.set(0, -minY, 0); // 모델을 지면에 닿도록 보정
      model.scale.set(10, 10, 10);

      pivot.add(model);

      // 큐브 생성
      const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
      const cubeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5, // 반투명
      });
      cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);

      // 모델의 배꼽 위치에 큐브 배치 (로컬 좌표계 기준)
      // 큐브 배치를 위한 오프셋 계산
      const bellyOffset = new THREE.Vector3(0, 13, 0);
      cubeMesh.position.copy(bellyOffset);

      // 큐브를 모델의 자식 객체로 추가
      model.add(cubeMesh);

      // 윤곽선 생성 및 모델의 자식으로 추가
      const edges = new THREE.EdgesGeometry(cubeGeometry);
      const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
      cubeEdges = new THREE.LineSegments(edges, edgesMaterial);
      cubeEdges.position.copy(bellyOffset);
      model.add(cubeEdges);

      addRotationRings();
      addModelAxes();

      setupGUI();
    },
    undefined,
    function (error) {
      console.error("An error happened while loading the model:", error);
    }
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.update();

  window.addEventListener("resize", onWindowResize, false);
  document
    .getElementById("resetPosition")
    .addEventListener("click", resetPosition);
  document
    .getElementById("resetRotation")
    .addEventListener("click", resetRotation);
  document.getElementById("resetCamera").addEventListener("click", resetCamera);
  document.getElementById("resetLight").addEventListener("click", resetLight);
  document.getElementById("resetPivot").addEventListener("click", resetPivot);

  // 마우스 드래그 이벤트 업데이트
  window.addEventListener("mousedown", (event) => {
    if (!isHovering) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cubeMesh);

    if (intersects.length > 0) {
      isDragging = true;
      dragStart.copy(intersects[0].point);

      // 드래그 평면 생성 (박스 위치 기준)
      dragPlane = new THREE.Plane();
      dragPlane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(),
        dragStart
      );
    }
  });

  // 드래그 동작 업데이트 (모델 기준)
  window.addEventListener("mousemove", (event) => {
    if (!isDragging || !dragPlane) return;

    raycaster.setFromCamera(mouse, camera);
    const intersect = raycaster.ray.intersectPlane(
      dragPlane,
      new THREE.Vector3()
    );

    if (intersect) {
      const offset = intersect.clone().sub(dragStart);
      dragStart.copy(intersect);
      model.position.add(offset); // 모델 위치 업데이트

      syncCubePosition(); // 상자 동기화
    }
  });

  // 드래그 종료 후 위치 동기화
  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      dragPlane = null;

      syncCubePosition(); // 상자 동기화
    }
  });

  animate();
}

// 링
function addRotationRings() {
  const ringRadius = 30;
  const ringThickness = 1.5;
  const ringOpacity = 0.4;

  // X축 링 (빨간색)
  const xGeometry = new THREE.TorusGeometry(ringRadius, ringThickness, 16, 100);
  const xMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: ringOpacity, // 투명도를 40%로 설정
  });
  xRing = new THREE.Mesh(xGeometry, xMaterial);
  xRing.rotation.y = Math.PI / 2;
  xRing.visible = false; // 초기 상태에서 숨김
  pivot.add(xRing);

  // Y축 링 (초록색)
  const yGeometry = new THREE.TorusGeometry(ringRadius, ringThickness, 16, 100);
  const yMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: ringOpacity, // 투명도를 40%로 설정
  });
  yRing = new THREE.Mesh(yGeometry, yMaterial);
  yRing.rotation.z = Math.PI / 2;
  yRing.visible = false; // 초기 상태에서 숨김
  pivot.add(yRing);

  // Z축 링 (파란색)
  const zGeometry = new THREE.TorusGeometry(ringRadius, ringThickness, 16, 100);
  const zMaterial = new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    transparent: true,
    opacity: ringOpacity, // 투명도를 40%로 설정
  });
  zRing = new THREE.Mesh(zGeometry, zMaterial);
  zRing.rotation.x = Math.PI / 2;
  zRing.visible = false; // 초기 상태에서 숨김
  pivot.add(zRing);
}

// 축 시각화
function addModelAxes() {
  // X축 (빨간색)
  const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const xPoints = [
    new THREE.Vector3(0, 0, 0), // 시작점
    new THREE.Vector3(50, 0, 0), // 끝점 (X축으로 50 단위) // 100으로 설정하면 선 길이 늘어남
  ];
  const xGeometry = new THREE.BufferGeometry().setFromPoints(xPoints);
  const xAxis = new THREE.Line(xGeometry, xMaterial);

  // Y축 (초록색)
  const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const yPoints = [
    new THREE.Vector3(0, 0, 0), // 시작점
    new THREE.Vector3(0, 50, 0), // 끝점 (Y축으로 50 단위)
  ];
  const yGeometry = new THREE.BufferGeometry().setFromPoints(yPoints);
  const yAxis = new THREE.Line(yGeometry, yMaterial);

  // Z축 (파란색)
  const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
  const zPoints = [
    new THREE.Vector3(0, 0, 0), // 시작점
    new THREE.Vector3(0, 0, 50), // 끝점 (Z축으로 50 단위)
  ];
  const zGeometry = new THREE.BufferGeometry().setFromPoints(zPoints);
  const zAxis = new THREE.Line(zGeometry, zMaterial);

  // 축을 피벗에 추가
  pivot.add(xAxis);
  pivot.add(yAxis);
  pivot.add(zAxis);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
  // 마우스 위치를 정규화된 장치 좌표(-1 ~ +1)로 변환
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("mousemove", onMouseMove);

// 마우스 호버 효과
function checkIntersection() {
  if (!cubeMesh || !cubeEdges) return;

  raycaster.setFromCamera(mouse, camera);

  // 면 교차 확인
  const intersectsMesh = raycaster.intersectObject(cubeMesh);
  const intersectsEdges = raycaster.intersectObject(cubeEdges);

  if (intersectsMesh.length > 0 || intersectsEdges.length > 0) {
    cubeMesh.material.color.set(0xffa500); // 면: 주황색
    cubeEdges.material.color.set(0xffa500); // 윤곽선: 주황색
    isHovering = true; // 호버 중
    controls.enabled = false; // 카메라 조작 비활성화
  } else {
    cubeMesh.material.color.set(0xffffff); // 면: 흰색
    cubeEdges.material.color.set(0xffffff); // 윤곽선: 흰색
    isHovering = false; // 호버 아님
    controls.enabled = true; // 카메라 조작 활성화
  }
}

function animate() {
  requestAnimationFrame(animate);

  // 박스 위치를 모델의 배꼽 위치로 지속적으로 동기화
  if (!isDragging) {
    const bellyOffset = new THREE.Vector3(0, 130 / 10, 0);
    const correctedPosition = pivot.position.clone().add(bellyOffset);
    cubeMesh.position.copy(correctedPosition);
    cubeEdges.position.copy(correctedPosition);
  }

  // 마우스 위치 업데이트
  raycaster.setFromCamera(mouse, camera);

  checkIntersection(); // 교차 감지

  renderer.render(scene, camera);
}

function hsvToRgb(h, s, v) {
  let r, g, b;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
}

// 위치 초기화 (모델 기준)
function resetPosition() {
  model.position.set(0, 0, 0); // 모델 위치 초기화
  syncCubePosition(); // 상자 동기화

  if (positionXCtrl && positionYCtrl && positionZCtrl) {
    positionXCtrl.setValue(0);
    positionYCtrl.setValue(0);
    positionZCtrl.setValue(0);
  }
}

// 로테이션 초기화
function resetRotation() {
  pivot.rotation.set(0, 0, 0);
  if (rotationXCtrl && rotationYCtrl && rotationZCtrl) {
    rotationXCtrl.setValue(0);
    rotationYCtrl.setValue(0);
    rotationZCtrl.setValue(0);
  }
}

// 카메라 초기화
function resetCamera() {
  camera.position.set(0, 200, 400);
  camera.fov = 45;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.set(0, 100, 0);
  controls.update();

  fovCtrl.setValue(45);
  zoomCtrl.setValue(1);
}

// 광원 초기화
function resetLight() {
  dirLight.position.set(0, 200, 100);
  lightXCtrl.setValue(0);
  lightYCtrl.setValue(200);
  lightZCtrl.setValue(100);
}

// 회전축 초기화
function resetPivot() {
  // 피벗 위치 초기화
  pivot.position.set(0, 0, 0);

  // 피벗 회전 초기화
  pivot.rotation.set(0, 0, 0);

  // 모델 위치 초기화 (피벗에 의해 위치가 변경되었으므로 다시 보정)
  model.position.set(0, 0, 0);

  // GUI 컨트롤 초기화
  pivotXCtrl.setValue(0);
  pivotYCtrl.setValue(0);
  pivotZCtrl.setValue(0);
  rotationXCtrl.setValue(0);
  rotationYCtrl.setValue(0);
  rotationZCtrl.setValue(0);
}

let isPivotEnabled = false; // 피벗 조작 활성화 여부

function setupGUI() {
  const gui = new GUI();

  // 피벗 조작 락 활성화 여부를 제어하는 GUI
  const pivotToggleParams = { EnablePivotControl: false };
  gui
    .add(pivotToggleParams, "EnablePivotControl")
    .name("Enable Pivot Control")
    .onChange((value) => {
      isPivotEnabled = value;
      const pointerEvents = isPivotEnabled ? "none" : "auto";
      const opacity = isPivotEnabled ? "0.5" : "1";

      positionFolder.domElement.style.pointerEvents = pointerEvents;
      positionFolder.domElement.style.opacity = opacity;

      rotationFolder.domElement.style.pointerEvents = pointerEvents;
      rotationFolder.domElement.style.opacity = opacity;

      pivotFolder.domElement.style.pointerEvents = isPivotEnabled
        ? "auto"
        : "none";
      pivotFolder.domElement.style.opacity = isPivotEnabled ? "1" : "0.5";

      // 피벗 조작을 종료할 때 Y축 위치 저장
      if (!value) {
        savedPivotY = pivot.position.y; // 현재 피벗의 Y축 값을 저장
      }
    });

  // === 정육면체 가시성 제어 체크박스 추가 ===
  const cubeVisibilityParams = { ShowCube: true };
  gui
    .add(cubeVisibilityParams, "ShowCube")
    .name("Show Cube")
    .onChange((value) => {
      if (cubeMesh) cubeMesh.visible = value; // 면 표시/숨기기
      if (cubeEdges) cubeEdges.visible = value; // 윤곽선 표시/숨기기
    });

  // 위치 조작 컨트롤
  positionFolder = gui.addFolder("Position Controls");
  positionParams = {
    positionX: pivot.position.x,
    positionY: pivot.position.y,
    positionZ: pivot.position.z,
  };

  // 위치 동기화 (모델 기준)
  ["positionX", "positionY", "positionZ"].forEach((axis) => {
    positionFolder.add(positionParams, axis, -150, 150).onChange((value) => {
      model.position[axis.charAt(axis.length - 1).toLowerCase()] = value;
      syncCubePosition();
    });
  });

  // 상자와 모델 위치 동기화 함수
  function syncCubePosition() {
    const bellyOffset = new THREE.Vector3(0, 130, 0); // 상자 위치 기준 오프셋
    const correctedPosition = model.position.clone().add(bellyOffset);
    cubeMesh.position.copy(correctedPosition); // 상자 위치 동기화
    cubeEdges.position.copy(correctedPosition); // 윤곽선 동기화
  }

  // 새 체크박스 추가: 저장된 Y값 사용 여부
  const savedYParams = { UseSavedY: true };
  positionFolder
    .add(savedYParams, "UseSavedY")
    .name("Use Saved Y for Reset")
    .onChange((value) => {
      useSavedYForReset = value; // 체크박스 상태 저장
    });

  // "발을 땅에 붙이기" 버튼 추가
  const attachToGroundController = positionFolder
    .add({ AttachToGround: () => attachToGround() }, "AttachToGround")
    .name("발을 땅에 붙이기");

  // 버튼 스타일 수정
  setTimeout(() => {
    const buttonElement =
      attachToGroundController.domElement.querySelector("button");
    if (buttonElement) {
      buttonElement.style.width = "100px"; // 버튼 너비 설정
    }
  }, 0); // lil-gui가 DOM에 버튼을 추가한 후 실행

  // 발을 땅에 붙이기 함수
  function attachToGround() {
    if (!model) return;

    // 모델의 bounding box 계산
    const boundingBox = new THREE.Box3().setFromObject(model);
    const minY = boundingBox.min.y;

    // 모델 위치 조정
    pivot.position.y -= minY; // 모델 발이 땅에 닿도록 이동

    // 정육면체를 모델의 배꼽 위치에 고정
    const cubeYOffset = 130; // 배꼽 위치를 기준으로 Y축 오프셋
    cubeMesh.position.set(0, pivot.position.y + cubeYOffset, 0);
    cubeEdges.position.set(0, pivot.position.y + cubeYOffset, 0);

    // GUI 컨트롤 업데이트
    if (positionYCtrl) {
      positionYCtrl.setValue(pivot.position.y);
    }
  }

  // 회전 조작
  rotationFolder = gui.addFolder("Rotation Controls");
  rotationParams = {
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };

  // 회전 로직
  ["rotationX", "rotationY", "rotationZ"].forEach((axis, index) => {
    rotationFolder.add(rotationParams, axis, -180, 180).onChange((value) => {
      pivot.rotation[["x", "y", "z"][index]] = (value * Math.PI) / 180; // 라디안으로 변환
    });
  });

  /* 

1/12
1/19
2/2
2/9
3/2

*/

  // 카메라 조작
  cameraFolder = gui.addFolder("Camera Controls");
  cameraParams = {
    fov: camera.fov,
    zoom: camera.zoom,
  };

  fovCtrl = cameraFolder.add(cameraParams, "fov", 10, 100).onChange((value) => {
    camera.fov = value;
    camera.updateProjectionMatrix();
  });
  zoomCtrl = cameraFolder
    .add(cameraParams, "zoom", 0.1, 5)
    .onChange((value) => {
      camera.zoom = value;
      camera.updateProjectionMatrix();
    });

  // 조명 조작
  lightFolder = gui.addFolder("Light Controls");
  lightParams = {
    lightX: dirLight.position.x,
    lightY: dirLight.position.y,
    lightZ: dirLight.position.z,
  };

  lightXCtrl = lightFolder
    .add(lightParams, "lightX", -500, 500)
    .onChange((value) => {
      dirLight.position.x = value;
    });
  lightYCtrl = lightFolder
    .add(lightParams, "lightY", 0, 500)
    .onChange((value) => {
      dirLight.position.y = value;
    });
  lightZCtrl = lightFolder
    .add(lightParams, "lightZ", -500, 500)
    .onChange((value) => {
      dirLight.position.z = value;
    });

  // 피벗 조작
  pivotFolder = gui.addFolder("Pivot Controls");
  pivotParams = {
    pivotX: pivot.position.x,
    pivotY: pivot.position.y,
    pivotZ: pivot.position.z,
  };

  pivotXCtrl = pivotFolder
    .add(pivotParams, "pivotX", -500, 500)
    .onChange((value) => {
      if (!isPivotEnabled) return; // 피벗 조작 비활성화 시 동작 중단
      const delta = value - pivot.position.x;
      pivot.position.x = value;

      const worldDelta = new THREE.Vector3(delta, 0, 0).applyQuaternion(
        pivot.quaternion
      );
      model.position.sub(worldDelta);
    });

  pivotYCtrl = pivotFolder
    .add(pivotParams, "pivotY", -500, 500)
    .onChange((value) => {
      if (!isPivotEnabled) return;
      const delta = value - pivot.position.y;
      pivot.position.y = value;

      const worldDelta = new THREE.Vector3(0, delta, 0).applyQuaternion(
        pivot.quaternion
      );
      model.position.sub(worldDelta);
    });

  pivotZCtrl = pivotFolder
    .add(pivotParams, "pivotZ", -500, 500)
    .onChange((value) => {
      if (!isPivotEnabled) return;
      const delta = value - pivot.position.z;
      pivot.position.z = value;

      const worldDelta = new THREE.Vector3(0, 0, delta).applyQuaternion(
        pivot.quaternion
      );
      model.position.sub(worldDelta);
    });

  // 초기 상태에서 피벗 컨트롤 비활성화
  pivotFolder.domElement.style.pointerEvents = "none";
  pivotFolder.domElement.style.opacity = "0.5";

  function syncCubePosition() {
    if (!cubeMesh || !cubeEdges) return;

    // 상자의 위치를 모델 로컬 좌표를 기준으로 유지
    const bellyOffset = new THREE.Vector3(0, 130 / 10, 0); // 상자의 로컬 오프셋
    const worldOffset = bellyOffset.applyMatrix4(model.matrixWorld); // 모델 기준으로 월드 좌표 계산

    cubeMesh.position.copy(worldOffset); // 상자의 월드 좌표로 위치 고정
    cubeEdges.position.copy(worldOffset); // 윤곽선도 동일하게 적용
  }

  // === 새 코드 ===

  // Pivot Lock 상태 관리 변수 추가
  let isPivotLocked = true;
  let pivotLockChanged = false; // 초기 상태에서 메시지 표시 방지

  // Pivot Lock 상태 변경 함수
  function updatePivotLock(lock) {
    isPivotLocked = lock;

    const scaleFactor = isPivotLocked ? 0.25 : 1; // 1/4로 설정
    const rangeX = [-500 * scaleFactor, 500 * scaleFactor];
    const rangeY = [-500 * scaleFactor, 500 * scaleFactor];
    const rangeZ = [-500 * scaleFactor, 500 * scaleFactor];

    // GUI 범위 업데이트
    pivotXCtrl.min(rangeX[0]).max(rangeX[1]);
    pivotYCtrl.min(rangeY[0]).max(rangeY[1]);
    pivotZCtrl.min(rangeZ[0]).max(rangeZ[1]);

    // 메시지 표시: 사용자가 Lock 상태를 변경한 이후부터 표시
    if (pivotLockChanged) {
      if (isPivotLocked) {
        alert("Pivot Lock Enabled. Adjustment range is reduced to 1/4.");
      } else {
        alert("Pivot Lock Disabled. Full adjustment range restored.");
      }
    }
  }

  // GUI 설정에서 Pivot Lock 추가
  pivotFolder
    .add({ Unlock: false }, "Unlock")
    .name("Unlock Pivot Controls")
    .onChange((value) => {
      pivotLockChanged = true; // 사용자가 최초로 상태를 변경한 이후 메시지 표시
      updatePivotLock(!value); // Unlock 옵션이 true일 때 Lock을 false로
    });

  // 초기 상태에서 Pivot Lock 설정
  updatePivotLock(true); // 초기에는 메시지 표시하지 않음

  // 새로운 "Visualization Controls" 폴더 추가
  const visualizationFolder = gui.addFolder("Visualization Controls");

  // 링 가시성 제어
  const ringVisibilityParams = { ShowRings: false };
  visualizationFolder
    .add(ringVisibilityParams, "ShowRings")
    .name("Show Rings")
    .onChange((value) => {
      // 링의 가시성 조절
      xRing.visible = value;
      yRing.visible = value;
      zRing.visible = value;
    });

  // 축 가시성 제어
  const axesVisibilityParams = { ShowAxes: true };
  visualizationFolder
    .add(axesVisibilityParams, "ShowAxes")
    .name("Show Axes")
    .onChange((value) => {
      // 축의 가시성 조절
      pivot.children.forEach((child) => {
        if (child.isLine) {
          child.visible = value;
        }
      });
    });

  function setupColorControls(gui) {
    const colorFolder = gui.addFolder("Color Controls");

    const colorParams = {
      hue: 0, // 초기 Hue (0~1)
      saturation: 0, // 초기 Saturation (0~1)
      value: 0.6, // 초기 Value (0~1)
    };

    function updateModelColor() {
      const { r, g, b } = hsvToRgb(
        colorParams.hue,
        colorParams.saturation,
        colorParams.value
      );
      const newColor = new THREE.Color(r, g, b);

      model.traverse((child) => {
        if (child.isMesh && child.material && "color" in child.material) {
          child.material.color.set(newColor); // set 메서드로 안전하게 설정
          child.material.needsUpdate = true; // 강제 갱신
        }
      });
    }

    // Hue 슬라이더
    colorFolder
      .add(colorParams, "hue", 0, 1, 0.01)
      .name("Hue")
      .onChange(updateModelColor);

    // Saturation 슬라이더
    colorFolder
      .add(colorParams, "saturation", 0, 1, 0.01)
      .name("Saturation")
      .onChange(updateModelColor);

    // Value 슬라이더
    colorFolder
      .add(colorParams, "value", 0, 1, 0.01)
      .name("Value")
      .onChange(updateModelColor);
  }
  setupColorControls(gui);
  updateModelColor(); // 기본 색상 초기화

  // === 새 코드 끝 ===

  // 기본으로 열림 상태 유지
  positionFolder.open();
  rotationFolder.open();
  cameraFolder.open();
  lightFolder.open();
  pivotFolder.open();
  visualizationFolder.open();
  colorFolder.open();
}

init();
