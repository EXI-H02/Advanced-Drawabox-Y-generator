// --- Constants ---
const WIDTH = 800;
const HEIGHT = 800;

// Center point (Origin)
const OX = WIDTH / 2;
const OY = HEIGHT / 2;

// Colors (RGB/CSS)
const AXIS_COLOR = 'rgb(200, 150, 0)';
const VECTOR_COLOR = 'rgb(0, 0, 0)';
const POINT_COLOR = 'rgb(0, 0, 0)';
const BOX_COLOR = 'rgb(50, 50, 200)'; 
const POINT_RADIUS = 3;

// Global state for main vector size limits (used only by GENERATE button)
let minSize = 10;
let maxSize = 400;

// Global state for box length values (which now control main vector length)
let boxLengthA = 0;
let boxLengthB = 0;
let boxLengthC = 0;

// Global coordinates object (for the main vectors)
let vectorCoords = {};

// Global state for initial vector angles (needed for all drawing)
let A_angle, B_angle, C_angle;

// Box Drawing State
let showBox = false;

// --- Canvas and Context Setup ---
const canvas = document.getElementById('vectorCanvas');
const ctx = canvas.getContext('2d');
const generateButton = document.getElementById('generateButton');

// Extra Options UI Elements
const extraOptionsButton = document.getElementById('extraOptionsButton');
const extraOptionsSection = document.getElementById('extraOptionsSection');
const arrowIcon = document.getElementById('arrow');
const minSizeInput = document.getElementById('minSizeInput');
const maxSizeInput = document.getElementById('maxSizeInput');

// Box UI Elements
const convAInput = document.getElementById('convA');
const convBInput = document.getElementById('convB');
const convCInput = document.getElementById('convC');
const drawBoxButton = document.getElementById('drawBoxButton');

// NEW: Individual Box Length Sliders and Readouts
const lenASlider = document.getElementById('lenASlider');
const lenBSlider = document.getElementById('lenBSlider');
const lenCSlider = document.getElementById('lenCSlider');

const lenAValue = document.getElementById('lenAValue');
const lenBValue = document.getElementById('lenBValue');
const lenCValue = document.getElementById('lenCValue');


// Initialize inputs with default values
minSizeInput.value = minSize;
maxSizeInput.value = maxSize;


// --- Helper Functions ---

function randLen() {
    // Generates a random integer length between the current minSize and maxSize
    const range = maxSize - minSize + 1;
    if (range <= 0) {
        console.error("Error: Min Size is greater than or equal to Max Size.");
        return 50; // Fallback value
    }
    return Math.floor(Math.random() * range) + minSize;
}

function angularDistance(angle1, angle2) {
    let diff = Math.abs(angle1 - angle2);
    return Math.min(diff, 360 - diff);
}

function polarToCartesian(length, angle_degrees) {
    const angle_radians = angle_degrees * (Math.PI / 180);
    
    const delta_x = length * Math.cos(angle_radians);
    const delta_y = -length * Math.sin(angle_radians); 
    
    return {
        x: OX + delta_x,
        y: OY + delta_y
    };
}

// Function to validate and apply settings for the main min/max range
function validateAndApplySettings() {
    // 1. Validate and apply main vector size (minSize/maxSize)
    let tempMin = parseInt(minSizeInput.value);
    let tempMax = parseInt(maxSizeInput.value);

    // Hard limits and checks (1 to 400)
    if (isNaN(tempMin) || tempMin < 1) tempMin = 1;
    if (isNaN(tempMax) || tempMax > 400) tempMax = 400;
    
    // Ensure min < max
    if (tempMin >= tempMax) {
        tempMax = tempMin + 1;
        if (tempMax > 400) {
            tempMax = 400;
            tempMin = 399;
        }
    }
    
    minSize = tempMin;
    maxSize = tempMax;

    minSizeInput.value = minSize;
    maxSizeInput.value = maxSize;
}


// Handler for box length changes, now also updating the main vectors
function handleBoxLengthChange(sliderElement) {
    // Sliders provide a string, parse to integer
    const validatedValue = parseInt(sliderElement.value); 
    let angleToUse;
    let axis;
    let valueElement;

    if (sliderElement === lenASlider) {
        boxLengthA = validatedValue;
        angleToUse = A_angle;
        axis = 'A';
        valueElement = lenAValue;
    } else if (sliderElement === lenBSlider) {
        boxLengthB = validatedValue;
        angleToUse = B_angle;
        axis = 'B';
        valueElement = lenBValue;
    } else if (sliderElement === lenCSlider) {
        boxLengthC = validatedValue;
        angleToUse = C_angle;
        axis = 'C';
        valueElement = lenCValue;
    }

    // Update the readout
    if (valueElement) {
        valueElement.textContent = validatedValue;
    }

    // Update the main vector coordinates to match the new box length
    if (axis && angleToUse !== undefined) {
        vectorCoords[axis] = polarToCartesian(validatedValue, angleToUse);
    }
    
    // Update the drawing
    drawElements();
}


// --- Math Helper for Intersections (Functions remain unchanged) ---

function getIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null; 

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
    };
}

function getPerspectiveInfo(origin, tip, convergence) {
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.sqrt(dx*dx + dy*dy);

    if (convergence <= 0.001) {
        return { isParallel: true, dx: dx, dy: dy };
    } else {
        const distToVP = len / convergence;
        const dirX = dx / len;
        const dirY = dy / len;

        return {
            isParallel: false,
            vp: {
                x: origin.x + dirX * distToVP,
                y: origin.y + dirY * distToVP
            }
        };
    }
}

function constructCorner(S1, Info1, S2, Info2) {
    // Ray 1: Starts at S1, targets Info2's VP/direction
    let p1 = S1; 
    let p2;      

    if (Info2.isParallel) {
        p2 = { x: S1.x + Info2.dx, y: S1.y + Info2.dy };
    } else {
        p2 = Info2.vp;
    }

    // Ray 2: Starts at S2, targets Info1's VP/direction
    let p3 = S2; 
    let p4;      

    if (Info1.isParallel) {
        p4 = { x: S2.x + Info1.dx, y: S2.y + Info1.dy };
    } else {
        p4 = Info1.vp;
    }

    return getIntersection(p1, p2, p3, p4);
}

// Function to calculate the base vectors for the box using stored lengths and angles
function getBoxBaseVectors() {
    if (A_angle === undefined || B_angle === undefined || C_angle === undefined) {
        return { A: null, B: null, C: null };
    }

    // Use the global boxLength variables (which are updated by the inputs)
    const A_box = polarToCartesian(boxLengthA, A_angle);
    const B_box = polarToCartesian(boxLengthB, B_angle);
    const C_box = polarToCartesian(boxLengthC, C_angle);

    return { A: A_box, B: B_box, C: C_box };
}


function generateVectors() {
    // Reset box on new generation
    showBox = false;
    
    validateAndApplySettings();

    let lenA = randLen();
    let lenB = randLen();
    let lenC = randLen();
    
    let angleA, angleB, angleC;

    // Rejection Sampling for 90 degree minimum separation
    while (true) {
        angleA = Math.floor(Math.random() * 360);
        angleB = Math.floor(Math.random() * 360);
        angleC = Math.floor(Math.random() * 360);

        const dAB = angularDistance(angleA, angleB);
        const dAC = angularDistance(angleA, angleC);
        const dBC = angularDistance(angleB, angleC);

        if (dAB >= 90 && dAC >= 90 && dBC >= 90) {
            break; 
        }
    }
    
    // Store angles globally 
    A_angle = angleA;
    B_angle = angleB;
    C_angle = angleC;
    
    // Store lengths globally for box construction (default to initial vector lengths)
    boxLengthA = lenA;
    boxLengthB = lenB;
    boxLengthC = lenC;

    // Update the box length sliders and readouts
    lenASlider.value = boxLengthA;
    lenBSlider.value = boxLengthB;
    lenCSlider.value = boxLengthC;

    lenAValue.textContent = boxLengthA;
    lenBValue.textContent = boxLengthB;
    lenCValue.textContent = boxLengthC;

    vectorCoords.A = polarToCartesian(lenA, angleA);
    vectorCoords.B = polarToCartesian(lenB, angleB);
    vectorCoords.C = polarToCartesian(lenC, angleC);
    
    console.log(`Generated: A=${angleA}°, B=${angleB}°, C=${angleC}°`);
    
    drawElements();
}

function drawElements() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // 1. Draw axes
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, OY); ctx.lineTo(WIDTH, OY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, 0); ctx.lineTo(OX, HEIGHT); ctx.stroke();

    // 2. Draw vectors (Lines) - Uses updated vectorCoords
    ctx.strokeStyle = VECTOR_COLOR;
    ctx.lineWidth = 2;
    const { A, B, C } = vectorCoords;
    const Origin = { x: OX, y: OY };

    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(A.x, A.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(C.x, C.y); ctx.stroke();

    // 3. Draw Box (if enabled)
    if (showBox) {
        // Use the box-specific base vectors (which are now equal to the main vectors)
        const boxBaseVectors = getBoxBaseVectors();
        if (boxBaseVectors.A && boxBaseVectors.B && boxBaseVectors.C) {
            drawBoxConstruction(Origin, boxBaseVectors.A, boxBaseVectors.B, boxBaseVectors.C);
        }
    }

    // 4. Draw points (Draw last to cover line ends)
    ctx.fillStyle = POINT_COLOR;
    ctx.beginPath(); ctx.arc(OX, OY, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(A.x, A.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(B.x, B.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(C.x, C.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
}

function drawBoxConstruction(O, A_box, B_box, C_box) {
const cA = parseFloat(convAInput.value);
    const cB = parseFloat(convBInput.value);
    const cC = parseFloat(convCInput.value);

    const infoA = getPerspectiveInfo(O, A_box, cA);
    const infoB = getPerspectiveInfo(O, B_box, cB);
    const infoC = getPerspectiveInfo(O, C_box, cC);

    ctx.strokeStyle = BOX_COLOR;
    ctx.lineWidth = 1.5;

    // --- Face Intersections (Front visible corners) ---
    const P_AB = constructCorner(A_box, infoA, B_box, infoB);
    const P_AC = constructCorner(A_box, infoA, C_box, infoC);
    const P_BC = constructCorner(B_box, infoB, C_box, infoC);

    // --- Far Corner (P_ABC) ---
    let P_ABC = null;
    if (P_AB && P_BC) {
        // FIX: The ray from P_AB (A-B plane) must extend along C (infoC).
        // The ray from P_BC (B-C plane) must extend along A (infoA).
        // The correct call is constructCorner(S1, Info1, S2, Info2): Ray 1 uses Info2, Ray 2 uses Info1.
        // Therefore: S1=P_AB, Info2=infoC, S2=P_BC, Info1=infoA.
        P_ABC = constructCorner(P_AB, infoA, P_BC, infoC); // Corrected
    }

    // --- DRAWING: VISIBLE LINES (SOLID) ---
    ctx.setLineDash([]); 
    ctx.beginPath();

    // Lines from A_box
    if (P_AB) { ctx.moveTo(A_box.x, A_box.y); ctx.lineTo(P_AB.x, P_AB.y); }
    if (P_AC) { ctx.moveTo(A_box.x, A_box.y); ctx.lineTo(P_AC.x, P_AC.y); }

    // Lines from B_box
    if (P_AB) { ctx.moveTo(B_box.x, B_box.y); ctx.lineTo(P_AB.x, P_AB.y); }
    if (P_BC) { ctx.moveTo(B_box.x, B_box.y); ctx.lineTo(P_BC.x, P_BC.y); }

    // Lines from C_box
    if (P_AC) { ctx.moveTo(C_box.x, C_box.y); ctx.lineTo(P_AC.x, P_AC.y); }
    if (P_BC) { ctx.moveTo(C_box.x, C_box.y); ctx.lineTo(P_BC.x, P_BC.y); }

    ctx.stroke();

    // --- DRAWING: HIDDEN LINES (DOTTED) ---
    if (P_ABC) {
        ctx.setLineDash([5, 4]); // Dotted pattern
        ctx.beginPath();
        // Lines connecting the visible face corners to the far corner P_ABC
        if(P_AB) { ctx.moveTo(P_AB.x, P_AB.y); ctx.lineTo(P_ABC.x, P_ABC.y); }
        if(P_AC) { ctx.moveTo(P_AC.x, P_AC.y); ctx.lineTo(P_ABC.x, P_ABC.y); }
        if(P_BC) { ctx.moveTo(P_BC.x, P_BC.y); ctx.lineTo(P_ABC.x, P_ABC.y); }
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid for other elements
    }
}


// --- Event Listeners ---

extraOptionsButton.addEventListener('click', () => {
    extraOptionsSection.classList.toggle('hidden');
    arrowIcon.classList.toggle('arrow-up');
    arrowIcon.classList.toggle('arrow-down');
});

// 'change' event for main vector length limits
minSizeInput.addEventListener('change', validateAndApplySettings);
maxSizeInput.addEventListener('change', validateAndApplySettings);

// Add 'input' event listener for each box length slider for real-time update
lenASlider.addEventListener('input', () => handleBoxLengthChange(lenASlider));
lenBSlider.addEventListener('input', () => handleBoxLengthChange(lenBSlider));
lenCSlider.addEventListener('input', () => handleBoxLengthChange(lenCSlider));

// If sliders change while box is visible, redraw immediately
[convAInput, convBInput, convCInput].forEach(input => {
    input.addEventListener('input', () => {
        if (showBox) drawElements();
    });
});

drawBoxButton.addEventListener('click', () => {
    showBox = true;
    drawElements();
});

generateButton.addEventListener('click', generateVectors);


// --- Initial Run ---
generateVectors();