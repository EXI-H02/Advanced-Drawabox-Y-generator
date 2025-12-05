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

// Global state for vector size limits
// Default value changed to 400
let minSize = 10;
let maxSize = 400;

// Global coordinates object
let vectorCoords = {};

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

// Initialize inputs with default values
// These values will be set by the browser from index.html, but we set them here for robustness
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

function validateAndApplySettings() {
    // Parse values
    let tempMin = parseInt(minSizeInput.value);
    let tempMax = parseInt(maxSizeInput.value);

    // Validate Numbers
    if (isNaN(tempMin)) tempMin = 1;
    if (isNaN(tempMax)) tempMax = 400; // Use 400 as default max if invalid

    // Hard limits
    if (tempMin < 1) tempMin = 1;
    if (tempMax > 400) tempMax = 400;

    // Logic: Ensure Min < Max
    if (tempMin >= tempMax) {
        tempMax = tempMin + 1;
        if (tempMax > 400) {
            tempMax = 400;
            tempMin = 399;
        }
    }
    
    // Check for min > 399 in case of edge case from user input
    if (tempMin > 399) tempMin = 399;


    // Update Global State
    minSize = tempMin;
    maxSize = tempMax;

    // Update Input Fields
    minSizeInput.value = minSize;
    maxSizeInput.value = maxSize;
}

// --- Math Helper for Intersections ---

// Finds intersection of Line 1 (p1->p2) and Line 2 (p3->p4)
function getIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null; // Parallel lines

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
    };
}

// Calculates a Vanishing Point or a Direction for a specific vector and convergence
function getPerspectiveInfo(origin, tip, convergence) {
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.sqrt(dx*dx + dy*dy);

    if (convergence <= 0.001) {
        // Parallel mode: Return direction vector only
        return { isParallel: true, dx: dx, dy: dy };
    } else {
        // Perspective mode: Calculate Vanishing Point (VP)
        const distToVP = len / convergence;
        
        // Normalize direction
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

// Helper to find the corner of a face defined by StartPoints (S1, S2) and their perspective targets (Info1, Info2)
function constructCorner(S1, Info1, S2, Info2) {
    let p1 = S1; // Start of ray 1
    let p2;      // Target of ray 1

    if (Info2.isParallel) {
        p2 = { x: S1.x + Info2.dx, y: S1.y + Info2.dy };
    } else {
        p2 = Info2.vp;
    }

    let p3 = S2; // Start of ray 2
    let p4;      // Target of ray 2

    if (Info1.isParallel) {
        p4 = { x: S2.x + Info1.dx, y: S2.y + Info1.dy };
    } else {
        p4 = Info1.vp;
    }

    return getIntersection(p1, p2, p3, p4);
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

    const A = polarToCartesian(lenA, angleA);
    const B = polarToCartesian(lenB, angleB);
    const C = polarToCartesian(lenC, angleC);
    
    vectorCoords = { A, B, C };
    
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

    // 2. Draw vectors (Lines)
    ctx.strokeStyle = VECTOR_COLOR;
    ctx.lineWidth = 2;
    const { A, B, C } = vectorCoords;
    const Origin = { x: OX, y: OY };

    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(A.x, A.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(C.x, C.y); ctx.stroke();

    // 3. Draw Box (if enabled)
    if (showBox) {
        drawBoxConstruction(Origin, A, B, C);
    }

    // 4. Draw points (Draw last to cover line ends)
    ctx.fillStyle = POINT_COLOR;
    ctx.beginPath(); ctx.arc(OX, OY, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(A.x, A.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(B.x, B.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(C.x, C.y, POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
}

function drawBoxConstruction(O, A, B, C) {
    const cA = parseFloat(convAInput.value);
    const cB = parseFloat(convBInput.value);
    const cC = parseFloat(convCInput.value);

    // Get Perspective Info for all 3 axes
    const infoA = getPerspectiveInfo(O, A, cA);
    const infoB = getPerspectiveInfo(O, B, cB);
    const infoC = getPerspectiveInfo(O, C, cC);

    ctx.strokeStyle = BOX_COLOR;
    ctx.lineWidth = 1.5;

    // --- Face Intersections ---
    const P_AB = constructCorner(A, infoA, B, infoB);
    const P_AC = constructCorner(A, infoA, C, infoC);
    const P_BC = constructCorner(B, infoB, C, infoC);

    // --- Far Corner (P_ABC) ---
    let P_ABC = null;
    if (P_AB && P_BC) {
        P_ABC = constructCorner(P_AB, infoA, P_BC, infoC);
    }

    // --- DRAWING: VISIBLE LINES (SOLID) ---
    ctx.setLineDash([]); 
    ctx.beginPath();

    // Lines from A
    if (P_AB) { ctx.moveTo(A.x, A.y); ctx.lineTo(P_AB.x, P_AB.y); }
    if (P_AC) { ctx.moveTo(A.x, A.y); ctx.lineTo(P_AC.x, P_AC.y); }

    // Lines from B
    if (P_AB) { ctx.moveTo(B.x, B.y); ctx.lineTo(P_AB.x, P_AB.y); }
    if (P_BC) { ctx.moveTo(B.x, B.y); ctx.lineTo(P_BC.x, P_BC.y); }

    // Lines from C
    if (P_AC) { ctx.moveTo(C.x, C.y); ctx.lineTo(P_AC.x, P_AC.y); }
    if (P_BC) { ctx.moveTo(C.x, C.y); ctx.lineTo(P_BC.x, P_BC.y); }

    ctx.stroke();

    // --- DRAWING: HIDDEN LINES (DOTTED) ---
    if (P_ABC) {
        ctx.setLineDash([5, 4]); // Dotted pattern
        ctx.beginPath();
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

// Use 'change' event for length inputs as requested
minSizeInput.addEventListener('change', validateAndApplySettings);
maxSizeInput.addEventListener('change', validateAndApplySettings);

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