import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 0, 750);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.objects = [];

        this.initLights();
        this.initWorld();
        
        this.player = new Player(this);
        this.car = new Car(this, new THREE.Vector3(30, 0, 30));
        this.npc = new NPC(this, new THREE.Vector3(-50, 0, -50));
        this.missionManager = new MissionManager(this);

        this.animate();
        this.setupResize();
    }

    initLights() {
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        this.scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(100, 100, 50);
        dir.castShadow = true;
        this.scene.add(dir);
    }

    initWorld() {
        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 50; i++) {
            const mat = new THREE.MeshStandardMaterial({ color: 0x777777 });
            const building = new THREE.Mesh(boxGeo, mat);
            const h = Math.random() * 50 + 10;
            building.scale.set(15, h, 15);
            building.position.set((Math.random() - 0.5) * 500, h / 2, (Math.random() - 0.5) * 500);
            building.castShadow = true;
            this.scene.add(building);
            this.objects.push(building);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();
        if (this.player) this.player.update(dt);
        if (this.car) this.car.update(dt);
        if (this.missionManager) this.missionManager.update();
        this.renderer.render(this.scene, this.camera);
    }

    setupResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.controls = new PointerLockControls(game.camera, document.body);
        this.move = { f: false, b: false, l: false, r: false };
        this.velocity = new THREE.Vector3();
        this.inCar = false;
        this.currentCar = null;

        game.camera.position.set(0, 2, 10);

        document.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        document.addEventListener('keyup', (e) => this.handleKey(e.code, false));
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) this.controls.lock();
            else if (!this.inCar) this.shoot();
        });
    }

    handleKey(code, val) {
        if (code === 'KeyW') this.move.f = val;
        if (code === 'KeyS') this.move.b = val;
        if (code === 'KeyA') this.move.l = val;
        if (code === 'KeyD') this.move.r = val;
        if (code === 'KeyF' && val) this.toggleVehicle();
    }

    toggleVehicle() {
        if (this.inCar) {
            this.inCar = false;
            this.currentCar = null;
            this.game.camera.position.y = 2;
        } else {
            const dist = this.game.camera.position.distanceTo(this.game.car.mesh.position);
            if (dist < 15) {
                this.inCar = true;
                this.currentCar = this.game.car;
                this.game.missionManager.trigger();
            }
        }
    }

    shoot() {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(), this.game.camera);
        const hits = rc.intersectObjects(this.game.objects);
        if (hits.length > 0) hits[0].object.material.color.set(0xff0000);
    }

    update(dt) {
        if (this.inCar) {
            this.currentCar.drive(this.move, dt);
            const offset = new THREE.Vector3(0, 5, -15).applyQuaternion(this.currentCar.mesh.quaternion);
            this.game.camera.position.copy(this.currentCar.mesh.position).add(offset);
            this.game.camera.lookAt(this.currentCar.mesh.position);
            return;
        }

        if (this.controls.isLocked) {
            this.velocity.x -= this.velocity.x * 10 * dt;
            this.velocity.z -= this.velocity.z * 10 * dt;
            const dz = Number(this.move.f) - Number(this.move.b);
            const dx = Number(this.move.r) - Number(this.move.l);
            if (dz !== 0) this.velocity.z -= dz * 400 * dt;
            if (dx !== 0) this.velocity.x -= dx * 400 * dt;
            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);
        }
    }
}

class Car {
    constructor(game, pos) {
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 10), new THREE.MeshStandardMaterial({color: 0xff00ff}));
        this.mesh.position.copy(pos);
        game.scene.add(this.mesh);
        this.speed = 0;
        this.rot = 0;
    }

    drive(m, dt) {
        if (m.f) this.speed += 60 * dt;
        if (m.b) this.speed -= 40 * dt;
        this.speed *= 0.97;
        if (Math.abs(this.speed) > 1) {
            if (m.l) this.rot += 2 * dt;
            if (m.r) this.rot -= 2 * dt;
        }
        this.mesh.rotation.y = this.rot;
        this.mesh.translateX(this.speed * dt);
    }
}

class NPC {
    constructor(game, pos) {
        this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4), new THREE.MeshStandardMaterial({color: 0x00ff00}));
        this.mesh.position.copy(pos);
        game.scene.add(this.mesh);
    }
}

class MissionManager {
    constructor(game) {
        this.game = game;
        this.state = 0;
    }

    trigger() { if (this.state === 0) this.state = 1; }

    update() {
        const title = document.getElementById('mission-title');
        const desc = document.getElementById('mission-desc');
        if (this.state === 0) {
            title.innerText = "GÖREV 1";
            desc.innerText = "Arabaya bin (F)";
        } else if (this.state === 1) {
            title.innerText = "GÖREV 2";
            desc.innerText = "Hedefe git";
            const d = this.game.car.mesh.position.distanceTo(this.game.npc.mesh.position);
            if (d < 15) {
                this.state = 2;
                this.game.car.mesh.material.color.set(0xffd700);
            }
        } else {
            title.innerText = "GÖREV TAMAM";
            desc.innerText = "Şehir senindir.";
        }
    }
}

new Game();
