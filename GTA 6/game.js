import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- GAME CONFIGURATION ---
const CONFIG = {
    speed: 10,
    runSpeed: 20,
    carSpeed: 50,
    worldSize: 1000
};

// --- CORE ENGINE ---
class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Vice City Sky
        this.scene.fog = new THREE.Fog(0x87CEEB, 0, 750);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.objects = []; // Çarpışma ve etkileşim için nesneler
        
        this.initLights();
        this.initWorld();
        
        this.player = new Player(this);
        this.missionManager = new MissionManager(this);
        
        // Örnek Bir Araba ve NPC
        this.car = new Car(this, new THREE.Vector3(20, 2.5, 20));
        this.npc = new NPC(this, new THREE.Vector3(-30, 0, -30));

        this.animate();
        this.setupResize();
    }

    initLights() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 200, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    initWorld() {
        // Zemin
        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Basit Binalar (Procedural City)
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        for (let i = 0; i < 50; i++) {
            const building = new THREE.Mesh(boxGeo, boxMat);
            const height = Math.random() * 50 + 10;
            building.position.x = (Math.random() - 0.5) * 400;
            building.position.z = (Math.random() - 0.5) * 400;
            building.position.y = height / 2;
            building.scale.set(20, height, 20);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
            this.objects.push(building);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();

        this.player.update(dt);
        this.car.update(dt);
        this.missionManager.update();
        
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

// --- PLAYER SYSTEM ---
class Player {
    constructor(game) {
        this.game = game;
        this.controls = new PointerLockControls(game.camera, document.body);
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.inCar = false;
        this.currentCar = null;

        // Başlangıç Pozisyonu
        this.game.camera.position.y = 2;

        this.setupInputs();
        this.setupWeapon();
    }

    setupInputs() {
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) this.controls.lock();
            else if (!this.inCar) this.shoot();
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space': if (this.canJump) this.velocity.y += 30; this.canJump = false; break;
                case 'KeyF': this.handleVehicleInteraction(); break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    handleVehicleInteraction() {
        if (this.inCar) {
            // Araçtan İniş
            this.inCar = false;
            this.game.camera.position.copy(this.currentCar.mesh.position);
            this.game.camera.position.y += 3; // Çatıya ışınla
            this.game.camera.position.x += 3;
            this.currentCar = null;
            this.canJump = true;
        } else {
            // Araca Biniş (Mesafe kontrolü)
            const dist = this.game.camera.position.distanceTo(this.game.car.mesh.position);
            if (dist < 10) {
                this.inCar = true;
                this.currentCar = this.game.car;
                this.game.missionManager.triggerMissionEvent('entered_car');
            }
        }
    }

    shoot() {
        // Basit Raycasting (Silah Sistemi)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        const intersects = raycaster.intersectObjects(this.game.objects);

        if (intersects.length > 0) {
            // Vuruş Efekti
            const obj = intersects[0].object;
            obj.material.color.set(0xff0000); // Vurulan objeyi kırmızı yap
            
            // Mermi izi (Tracer)
            // (Burada basitlik için sadece renk değişimi yapıldı)
        }
    }

    update(dt) {
        if (this.inCar) {
            // Araç içindeyken kamera aracı takip eder
            this.currentCar.drive(this.moveForward, this.moveBackward, this.moveLeft, this.moveRight, dt);
            this.game.camera.position.copy(this.currentCar.mesh.position).add(new THREE.Vector3(0, 5, -10).applyQuaternion(this.currentCar.mesh.quaternion));
            this.game.camera.lookAt(this.currentCar.mesh.position);
            return;
        }

        if (this.controls.isLocked) {
            this.velocity.x -= this.velocity.x * 10.0 * dt;
            this.velocity.z -= this.velocity.z * 10.0 * dt;
            this.velocity.y -= 9.8 * 10.0 * dt; // Yerçekimi

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 400.0 * dt;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 400.0 * dt;

            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);
            this.game.camera.position.y += (this.velocity.y * dt);

            if (this.game.camera.position.y < 2) {
                this.velocity.y = 0;
                this.game.camera.position.y = 2;
                this.canJump = true;
            }
        }
    }

    setupWeapon() {
        // Ekrana basit bir silah modeli (Küp) ekle
        const gunGeo = new THREE.BoxGeometry(0.5, 0.5, 2);
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.gun = new THREE.Mesh(gunGeo, gunMat);
        this.gun.position.set(0.5, -0.5, -1);
        this.game.camera.add(this.gun);
        this.game.scene.add(this.game.camera);
    }
}

// --- VEHICLE SYSTEM ---
class Car {
    constructor(game, position) {
        this.game = game;
        // Basit Araba Modeli (Gövde + Tekerlekler birleşik)
        const geometry = new THREE.BoxGeometry(4, 2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0055 }); // Vice City Pembesi
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.castShadow = true;
        
        // Farlar
        const light = new THREE.SpotLight(0xffffff, 1);
        light.position.set(0, 1, 4);
        light.target.position.set(0, 0, 20);
        this.mesh.add(light);
        this.mesh.add(light.target);

        game.scene.add(this.mesh);
        game.objects.push(this.mesh); // Kurşunlar değsin diye
        
        this.speed = 0;
        this.rotation = 0;
    }

    drive(forward, backward, left, right, dt) {
        if (forward) this.speed += 50 * dt;
        if (backward) this.speed -= 30 * dt;
        
        // Sürtünme
        this.speed *= 0.98;

        if (Math.abs(this.speed) > 0.1) {
            if (left) this.rotation += 2 * dt;
            if (right) this.rotation -= 2 * dt;
        }

        this.mesh.rotation.y = this.rotation;
        this.mesh.translateX(this.speed * dt);
    }
}

// --- NPC & DIALOGUE SYSTEM ---
class NPC {
    constructor(game, position) {
        const geo = new THREE.CylinderGeometry(1, 1, 3, 32);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        this.mesh.position.y = 1.5;
        game.scene.add(this.mesh);
        this.game = game;
        this.hasTalked = false;
    }
}

// --- MISSION & UI SYSTEM ---
class MissionManager {
    constructor(game) {
        this.game = game;
        this.step = 0;
        this.uiTitle = document.getElementById('mission-title');
        this.uiDesc = document.getElementById('mission-desc');
        this.dialogueBox = document.getElementById('dialogue-box');
        this.speaker = document.getElementById('speaker');
        this.text = document.getElementById('dialogue');
        
        this.startMission();
    }

    startMission() {
        this.updateUI("Çalıntı Araba", "Pembe aracı bul ve içine bin (F tuşu).");
    }

    triggerMissionEvent(event) {
        if (event === 'entered_car' && this.step === 0) {
            this.step = 1;
            this.updateUI("Teslimat", "Arabayı NPC'nin (Yeşil Silindir) yanına sür.");
            this.showDialogue("Lester", "Hey! O arabayı aldın mı? Hemen buluşma noktasına getir!");
        }
    }

    update() {
        // NPC ile mesafe kontrolü (Görev Sonu)
        if (this.step === 1 && this.game.npc) {
            const dist = this.game.player.currentCar.mesh.position.distanceTo(this.game.npc.mesh.position);
            if (dist < 10) {
                this.step = 2;
                this.updateUI("GÖREV TAMAMLANDI", "Saygınlık +100$");
                this.showDialogue("Lester", "Harika iş dostum! Şimdi git ve kendine bir şeyler ısmarla.");
                this.game.player.currentCar.mesh.material.color.set(0xGold); // Ödül olarak araba altın olur
            }
        }
    }

    updateUI(title, desc) {
        this.uiTitle.innerText = title;
        this.uiDesc.innerText = desc;
    }

    showDialogue(name, content) {
        this.dialogueBox.classList.remove('hidden');
        this.speaker.innerText = name;
        this.text.innerText = content;
        
        setTimeout(() => {
            this.dialogueBox.classList.add('hidden');
        }, 5000);
    }
}

// Oyunu Başlat
new Game();