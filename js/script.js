var SCREEN_WIDTH = window.innerWidth;
var SCREEN_HEIGHT = window.innerHeight;
var FLOOR = 0;

var container;
var stats;

var camera;
var scene;
var webglRenderer;
var cameraOrtho;

var pointLight;

var mouseX = 0;
var mouseY = 0;
var tomouseX = 0;
var tomouseY = 0;
var mx = -1.57;

var render_gl = 1;
var has_gl = 0;

var r = 0;

var delta
var time;
var oldTime;

var uniformsNoise, uniformsNormal,
    normalMap, noiseMap,
    quadTarget,
    mesh;

var uniformsNormalMap;

var colorRampTexture, specularRampTexture;

var mlib = {};

var lightCone;

var cameraCube, sceneCube, cubeTarget;

document.addEventListener('mousemove', onDocumentMouseMove, false);

init(), animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    var aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

    camera = new THREE.PerspectiveCamera(65, aspect, 1, 100000);

    camera.position.z = 350;
    camera.position.x = -350;
    camera.position.y = 150;

    camTarget = new THREE.Object3D();

    cameraOrtho = new THREE.Camera();
    cameraOrtho.projectionMatrix = THREE.Matrix4.makeOrtho(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000);
    cameraOrtho.position.z = 100;


    sceneRenderTarget = new THREE.Scene();

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x131313, 0.0001);


    cameraCube = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 100000);

    cubeTarget = new THREE.Vector3(0, 0, 0);

    sceneCube = new THREE.Scene();

    var path = "images/";
    var format = '.jpg';
    var urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];

    var textureCube = THREE.ImageUtils.loadTextureCube(urls);


    var shader = THREE.ShaderUtils.lib["cube"];
    shader.uniforms["tCube"].texture = textureCube;

    var material = new THREE.ShaderMaterial({

            fragmentShader: shader.fragmentShader,
            vertexShader: shader.vertexShader,
            uniforms: shader.uniforms,
            depthWrite: false

        }),

        mesh = new THREE.Mesh(new THREE.CubeGeometry(100, 100, 100), material);
    mesh.flipSided = true;
    sceneCube.add(mesh);


    ambientLight = new THREE.AmbientLight(0x111111);
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(0xd9d29d, 1, 0);
    pointLight.position.y = 10;
    scene.add(pointLight);

    var spotlight = new THREE.SpotLight(0xd2cfb9, 2, 0);
    spotlight.position.set(50, 150, -200);
    scene.add(spotlight);


    var rx = 512,
        ry = 512;
    var pars = {
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBFormat
    };

    noiseMap = new THREE.WebGLRenderTarget(rx, ry, pars);
    normalMap = new THREE.WebGLRenderTarget(rx, ry, pars);
    colorMap = new THREE.WebGLRenderTarget(rx, ry, pars);
    specularMap = new THREE.WebGLRenderTarget(rx, ry, pars);

    uniformsNoise = {

        time: {
            type: "f",
            value: 1.0
        },
        scale: {
            type: "v2",
            value: new THREE.Vector2(2, 2)
        }

    };

    uniformsNormal = {

        height: {
            type: "f",
            value: 0.075
        },
        resolution: {
            type: "v2",
            value: new THREE.Vector2(rx, ry)
        },
        scale: {
            type: "v2",
            value: new THREE.Vector2(1, 1)
        },
        heightMap: {
            type: "t",
            value: 1,
            texture: noiseMap
        }

    };

    var rwidth = 256,
        rheight = 1,
        rsize = rwidth * rheight;

    var tcolor = new THREE.Color(0xffffff);



    var dataSpecular = new Uint8Array(rsize * 3);

    for (var i = 0; i < rsize; i++) {

        var h = i / 255;

        tcolor.setHSV(0.0, 0.0, 1 - h);

        dataSpecular[i * 3] = Math.floor(tcolor.r * 255);
        dataSpecular[i * 3 + 1] = Math.floor(tcolor.g * 255);
        dataSpecular[i * 3 + 2] = Math.floor(tcolor.b * 255);

    }



    specularRampTexture = new THREE.DataTexture(dataSpecular, rwidth, rheight, THREE.RGBFormat);
    specularRampTexture.needsUpdate = true;

    uniformsColor = {

        scale: {
            type: "v2",
            value: new THREE.Vector2(1, 1)
        },
        heightMap: {
            type: "t",
            value: 1,
            texture: noiseMap
        },
        colorRamp: {
            type: "t",
            value: 2,
            texture: colorRampTexture
        }

    };

    var vertexShader = document.getElementById('vertexShader').textContent;
    var vertexShaderFlip = document.getElementById('vertexShaderFlip').textContent;


    var normalShader = THREE.ShaderUtils.lib["normal"];

    uniformsNormalMap = THREE.UniformsUtils.clone(normalShader.uniforms);

    uniformsNormalMap["tNormal"].texture = normalMap;


    uniformsNormalMap["tDiffuse"].texture = colorMap;
    uniformsNormalMap["tSpecular"].texture = specularMap;
    uniformsNormalMap["tAO"].texture = noiseMap;

    uniformsNormalMap["enableAO"].value = true;
    uniformsNormalMap["enableDiffuse"].value = false;
    uniformsNormalMap["enableSpecular"].value = true;

    uniformsNormalMap["uDiffuseColor"].value.setHex(0x202336);
    uniformsNormalMap["uSpecularColor"].value.setHex(0xd2cfb9);
    uniformsNormalMap["uAmbientColor"].value.setHex(0x1a1d21);

    uniformsNormalMap["uShininess"].value = 20;

    uniformsNormalMap["enableReflection"].value = true;
    uniformsNormalMap["tCube"].texture = textureCube;
    uniformsNormalMap["uReflectivity"].value = 0.40;

    uniformsNormalMap["tNormal"].texture.wrapS = uniformsNormalMap["tNormal"].texture.wrapT = THREE.MirroredRepeatWrapping;
    uniformsNormalMap["tSpecular"].texture.wrapS = uniformsNormalMap["tSpecular"].texture.wrapT = THREE.MirroredRepeatWrapping;
    uniformsNormalMap["tAO"].texture.wrapS = uniformsNormalMap["tAO"].texture.wrapT = THREE.MirroredRepeatWrapping;

    uniformsNormalMap["uRepeat"].value = new THREE.Vector2(20, 80);

    var size = 1.25,
        params = [
            ['noise', document.getElementById('fragmentShaderNoise').textContent, vertexShader, uniformsNoise, false, false],
            ['normal', document.getElementById('fragmentShaderNormal').textContent, vertexShaderFlip, uniformsNormal, false, false],
            ['color', document.getElementById('fragmentShaderColormap').textContent, vertexShaderFlip, uniformsColor, false, false],
            ['normalmap', normalShader.fragmentShader, normalShader.vertexShader, uniformsNormalMap, true, true]
        ];

    for (var i = 0; i < params.length; i++) {

        material = new THREE.ShaderMaterial({

            uniforms: params[i][3],
            vertexShader: params[i][2],
            fragmentShader: params[i][1],
            lights: params[i][4],
            fog: params[i][5]
        });

        mlib[params[i][0]] = material;

    }


    var plane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

    quadTarget = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
        color: 0xff0000
    }));
    quadTarget.position.z = -500;
    sceneRenderTarget.add(quadTarget);


    var plane = new THREE.PlaneGeometry(50000, 50000, 1, 1);

    plane.computeFaceNormals();
    plane.computeVertexNormals();
    plane.computeTangents();


    var meshPlane = new THREE.Mesh(plane, mlib["normalmap"]);

    meshPlane.rotation.x = -Math.PI / 2;
    scene.add(meshPlane);

    var loader = new THREE.JSONLoader();
    loader.load("js/lighthouse.js", lighthouseLoaded);
    loader.load("js/rock.js", rockLoaded);


    var shipImage = THREE.ImageUtils.loadTexture("images/ship.png");

    var ship = new THREE.Sprite({
        map: shipImage,
        useScreenCoordinates: false
    });
    ship.position.set(20000, 400, 10000);
    ship.scale.set(10, 3, 1.5);
    ship.opacity = 0.15;
    scene.add(ship);


    try {
        webglRenderer = new THREE.WebGLRenderer({
            scene: scene,
            clearColor: 0x131313,
            clearAlpha: 1.0,
            antiAlias: false
        });
        webglRenderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
        container.appendChild(webglRenderer.domElement);
        webglRenderer.autoClear = false;
        THREEx.WindowResize(webglRenderer, camera);
        THREEx.WindowResize(webglRenderer, cameraCube);
        has_gl = 1;
    } catch (e) {

        return;
    }

}

function lighthouseLoaded(geometry) {

    var material = new THREE.MeshFaceMaterial();

    var lighthouse = new THREE.Mesh(geometry, material);

    var scale = 1;
    lighthouse.scale.set(scale, scale, scale);
    lighthouse.position.set(-8000, 100, -8000);
    scene.add(lighthouse);

    var pl = new THREE.PlaneGeometry(200, 2600, 1, 1);

    var material = new THREE.MeshBasicMaterial({
        color: 0xd9d29d,
        opacity: 0.45,
        map: THREE.ImageUtils.loadTexture("images/ray.png"),
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    var plane1 = new THREE.Mesh(pl, material);
    plane1.rotation.z = -Math.PI / 2 + 0.08;
    plane1.rotation.y = -Math.PI / 2;
    plane1.position.z = -1360;
    plane1.doubleSided = true;

    var pl = new THREE.PlaneGeometry(200, 200, 1, 1);

    var material = new THREE.MeshBasicMaterial({
        color: 0xd9d29d,
        opacity: 0.95,
        map: THREE.ImageUtils.loadTexture("images/bob2.png"),
        blending: THREE.NormalBlending,
        transparent: true
    });

    var plane2 = new THREE.Mesh(pl, material);
    plane2.position.y = 110;
    plane2.position.z = -70;
    plane2.flipSided = true;

    lightCone = new THREE.Object3D();
    lightCone.position.y = 450;
    lightCone.position.z = -8000;
    lightCone.position.x = -8000;

    lightCone.add(plane1);
    lightCone.add(plane2);

    scene.add(lightCone);

}

function rockLoaded(geometry) {

    var material = new THREE.MeshPhongMaterial({
        opacity: 1,
        color: 0x222222,
        ambient: 0x111111,
        specular: 0x444444,
        shininess: 15,
        shading: THREE.SmoothShading
    });

    var rock = new THREE.Mesh(geometry, material);

    var scale = 1;
    rock.scale.set(scale * 2, scale * 0.6, scale * 2);
    rock.position.set(-8000, 0, -8000);
    scene.add(rock);

    var rock2 = new THREE.Mesh(geometry, material);
    rock2.scale.set(scale * 15, scale * 1.4, scale * 6);
    rock2.position.set(-14000, 0, -12000);
    scene.add(rock2);

    var rock3 = new THREE.Mesh(geometry, material);
    rock3.scale.set(scale * 30, scale * 3, scale * 30);
    rock3.position.set(-25000, 0, -5000);
    rock3.rotation.y = Math.PI;
    scene.add(rock3);


}

function onDocumentMouseMove(event) {

    tomouseX = (event.clientX - (window.innerWidth >> 1));
    tomouseY = (event.clientY - (window.innerHeight >> 1));

}

function animate() {
    requestAnimationFrame(animate);
    loop();
}

function loop() {

    time = new Date().getTime();
    delta = time - oldTime;
    oldTime = time;

    if (isNaN(delta) || delta > 1000 || delta == 0) {
        delta = 1000 / 60;
    }

    r += delta / 1500;

    mouseX += (tomouseX - mouseX) / 20;
    mouseY += (tomouseY - mouseY) / 40;



    uniformsNoise.time.value += delta / 20000;
    uniformsNormalMap["uOffset"].value.y -= delta / 10000;

    if (lightCone) {

        lightCone.rotation.y -= delta / 1500;

        pointLight.position.x = lightCone.position.x + (2000 * Math.cos(-lightCone.rotation.y - (Math.PI / 2)));
        pointLight.position.z = lightCone.position.z + (2000 * Math.sin(-lightCone.rotation.y - (Math.PI / 2)));

    }


    mx += mouseX / (90000 - (delta * 1000));
    camTarget.position.x = camera.position.x + (100000 * Math.cos(mx));
    camTarget.position.z = camera.position.z + (100000 * Math.sin(mx));
    camTarget.position.y = camera.position.y - (mouseY * 100);

    camera.lookAt(camTarget.position);
    camera.up.x = mouseX / 10000;

    camera.position.y = 150 + Math.sin(r * 8) * 1.5;

    cubeTarget.x = -camTarget.position.x;
    cubeTarget.y = +camTarget.position.y;
    cubeTarget.z = -camTarget.position.z;

    cameraCube.lookAt(cubeTarget);
    cameraCube.up.x = -camera.up.x;


    webglRenderer.clear();
    quadTarget.materials[0] = mlib["noise"];
    webglRenderer.render(sceneRenderTarget, cameraOrtho, noiseMap, true);

    quadTarget.materials[0] = mlib["normal"];
    webglRenderer.render(sceneRenderTarget, cameraOrtho, normalMap, true);

    quadTarget.materials[0] = mlib["color"];
    mlib["color"].uniforms.colorRamp.texture = specularRampTexture;
    webglRenderer.render(sceneRenderTarget, cameraOrtho, specularMap, true);


    if (render_gl && has_gl) {
        webglRenderer.clear();
        webglRenderer.render(sceneCube, cameraCube);
        webglRenderer.render(scene, camera);
    }

}