import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class Game {
    constructor() {
        // --- 1. SAHNE VE RENDERER KURULUMU ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Vice City Mavisi
        this.scene.fog = new THREE.Fog(0x87CEEB, 0, 750);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.objects = []; 

        // --- 2. AYDINLATMA ---
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(100, 100, 50);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // --- 3. DÜNYA VE NESNELER ---
        this.initWorld();
        
        // --- 4. SİSTEMLER ---
        this.player = new Player(this);
        this.car = new Car(this, new THREE.Vector3(30, 0, 30));
        this.npc = new NPC(this, new THREE.Vector3(-50, 0, -50));
        this.missionManager = new MissionManager(this);

        this.animate();
        this.setupResize();
        
        console.log("GTA Motoru Başlatıldı...");
    }

    initWorld() {
        // Zemin
        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Binalar
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 60; i++) {
            const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
            const building = new THREE.Mesh(boxGeo, mat);
            const h = Math.random() * 60 + 10;
            building.scale.set(15, h, 15);
            building.position.set((Math.random() - 0.5) * 500, h / 2, (Math.random() - 0.5) * 500);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
            this.objects.push(building);
        }
    }

    setupResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();

        if (this.player) this.player.update(dt);
        if (this.car) this.car.update(dt);
        if (this.missionManager) this.missionManager.update();

        this.renderer.render(this.scene, this.camera);
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.controls = new PointerLockControls(game.camera, document.body);
        this.move = { forward: false, backward: false, left: false, right: false };
        this.velocity = new THREE.Vector3();
        this.inCar = false;
        this.currentCar = null;

        game.camera.position.set(0, 2, 0);

        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) this.controls.lock();
            else if (!this.inCar) this.shoot();
        });

        // Silah Görünümü
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1), new THREE.MeshStandardMaterial({color: 0x111111}));
        gun.position.set(0.3, -0.3, -0.5);
        game.camera.add(gun);
        game.scene.add(game.camera);
    }

    onKey(e, status) {
        switch(e.code) {
            case 'KeyW': this.move.forward = status; break;
            case 'KeyS': this.move.backward = status; break;
            case 'KeyA': this.move.left = status; break;
            case 'KeyD': this.move.right = status; break;
            case 'KeyF': if(status) this.toggleVehicle(); break;
        }
    }

    toggleVehicle() {
        if (this.inCar) {
            this.inCar = false;
            this.game.camera.position.add(new THREE.Vector3(5, 2, 5));
            this.currentCar = null;
        } else {
            const dist = this.game.camera.position.distanceTo(this.game.car.mesh.position);
            if (dist < 15) {
                this.inCar = true;
                this.currentCar = this.game.car;
                this.game.missionManager.trigger('car_entered');
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
            
            const dir = new THREE.Vector3();
            dir.z = Number(this.move.forward) - Number(this.move.backward);
            dir.x = Number(this.move.right) - Number(this.move.left);
            dir.normalize();

            if (this.move.forward || this.move.backward) this.velocity.z -= dir.z * 400 * dt;
            if (this.move.left || this.move.right) this.velocity.x -= dir.x * 400 * dt;

            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);
        }
    }
}

class Car {
    constructor(game, pos) {
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 10), new THREE.MeshStandardMaterial({color: 0xff00ff}));
        this.mesh.position.copy(pos);
        this.mesh.castShadow = true;
        game.scene.add(this.mesh);
        game.objects.push(this.mesh);
        this.speed = 0;
        this.rot = 0;
    }

    drive(move, dt) {
        if (move.forward) this.speed += 60 * dt;
        if (move.backward) this.speed -= 40 * dt;
        this.speed *= 0.97;
        if (Math.abs(this.speed) > 1) {
            if (move.left) this.rot += 2 * dt;
            if (move.right) this.rot -= 2 * dt;
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
        this.updateUI("GÖREV: BAŞLANGIÇ", "Pembe araca bin (F).");
    }

    trigger(e) {
        if (e === 'car_entered' && this.state === 0) {
            this.state = 1;
            this.updateUI("GÖREV: TESLİMAT", "Yeşil hedefe git.");
        }
    }

    update() {
        if (this.state === 1 && this.game.player.inCar) {
            const d = this.game.car.mesh.position.distanceTo(this.game.npc.mesh.position);
            if (d < 15) {
                this.state = 2;
                this.updateUI("GÖREV BAŞARILI", "Tebrikler!");
                this.game.car.mesh.material.color.set(0xffd700);
            }
        }
    }

    updateUI(t, d) {
        document.getElementById('mission-title').innerText = t;
        document.getElementById('mission-desc').innerText = d;
    }
}

window.onload = () => new Game();
