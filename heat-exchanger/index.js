document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing...");
    // --- Canvas & DOM Elements ---
    const canvas = document.getElementById('heatExchangerCanvas');
    const propertyPanel = document.getElementById('propertyPanel');
    const popupTitle = document.getElementById('popupTitle');
    const popupFields = document.getElementById('popupFields');
    const propertyButtons = document.getElementById('propertyButtons');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const frontHeadSelect = document.getElementById('frontHeadSelect');
    const shellSelect = document.getElementById('shellSelect');
    const rearHeadSelect = document.getElementById('rearHeadSelect');

    const calcPopup = document.getElementById('calculationPopup');
    const closeCalcButton = document.getElementById('closeCalcPopup');
    const calculateButton = document.getElementById('calculateButton');
    const loadExampleButton = document.getElementById('loadExampleButton');
    const temaTypeDisplay = document.getElementById('temaType');

    if (!canvas || !canvas.getContext) { console.error("Canvas not found or not supported!"); return; }
    if (!propertyPanel || !saveButton || !cancelButton) { console.error("Property panel elements not found!"); return; }
    const ctx = canvas.getContext('2d');

    // --- State ---
    let currentPartIdForPopup = null; // ID of the part whose properties are being edited ('shell', 'tubes', 'baffles')
    let selectedFrontType = frontHeadSelect.value;
    let selectedShellType = shellSelect.value;
    let selectedRearType = rearHeadSelect.value;
    let hoveredPartId = null; // Track the currently hovered part

    const baseColors = { head: "#A9CCE3", shell: "#D5DBDB", tubes: "#85929E", baffles: "#ABB2B9", nozzles: "#5D6D7E", tubesheet: "#5D6D7E" };
    const hoverColorOffset = 30; // How much brighter/different hover color is
    const lineColor = '#2C3E50';
    const hoverLineColor = '#E74C3C'; // Red color for hover stroke
    const hoverLineWidth = 2;

    // --- Simulation State ---
    let isSimulationRunning = false;
    let simulationParticles = [];
    let animationFrameId = null;
    const simulationButton = document.getElementById('simulationButton');
    const simulationPanel = document.getElementById('simulationPanel');
    const graphContainer = document.getElementById('graphContainer');
    const temperatureGraphCanvas = document.getElementById('temperatureGraph');
    const graphCtx = temperatureGraphCanvas ? temperatureGraphCanvas.getContext('2d') : null;
    
    // Simulation properties
    let simProps = {
        flowSpeed: 1.0,
        particleDensity: 50,
        particleSize: 4,
        showTempGradient: true,
        showFlowDirection: true,
        showTurbulence: true,
        showHeatTransfer: true,
        showGraph: true,
        flowType: 'counter',
        fluidType: 'oil',
        shellInletTemp: 150,
        shellOutletTemp: 90,
        tubeInletTemp: 25,
        tubeOutletTemp: 75,
        shellFlowRate: 5,
        tubeFlowRate: 8
    };
    
    let simulationTime = 0;

    const requiredFields = {
        shell: ['inletTemp', 'outletTemp', 'inletDiameter', 'flowRate'],
        tubes: ['inletTemp', 'outletTemp', 'inletDiameter', 'outerDiameter', 'flowRate'],
        baffles: ['spacing']
    };

    const partProperties = {
        shell: {
            name: "Shell",
            inletTemp: null, outletTemp: null, inletDiameter: null, flowRate: null,
            innerDiameter: null,
            orientation: null,
            numPasses: null,
            testPressure: null,
            corrosionAllowance: null,
            designH2Pressure: null,
            insulationPurpose: null,
            designMetalTemp: null,
            mechDesignTempMin: null,
            mechDesignTempMax: null,
            material: null,
            minNozzleDistance: null
        },
        tubes: {
            name: "Tubes",
            inletTemp: null,
            outletTemp: null,
            flowRate: null,
            inletDiameter: null,
            outerDiameter: null,
            numTubes: null,
            effectiveTubeLength: null,
            tubeInnerDiameter: null,
            tubePitch: null,
            tubeLayout: null,
            material: null
        },
        baffles: {
            name: "Baffles",
            spacing: null,
            baffleType: null,
            cutOrientation: null,
            freeEndSpacing: null,
            nearEndSpacing: null,
            outerCutPercent: null,
            freeOuterHoleArea: null,
            tubesInWindow: null,
            impingementPlate: null,
            material: null
        }
    };

    let clickableAreas = []; // { id: 'shell'/'tubes', rect: {x,y,w,h} }

    // --- Helper Function ---
    function checkPropertiesComplete(partId) {
        if (!partProperties[partId]) return false;
        const props = partProperties[partId];
        for (const key in props) {
            if (key === 'name') continue; // Skip the name property
            if (props[key] === null || props[key] === undefined || String(props[key]).trim() === '') {
                return false; // Found an incomplete property
            }
        }
        return true; // All properties are filled
    }

    // --- Drawing --- (Simplified Shapes)

    // Helper: Basic Nozzle with Flange
    function drawNozzle(ctx, x, y, width, height, side = 'top') {
        const flangeWidth = width * 1.4;
        const flangeHeight = height * 0.3;
        const bodyWidth = width;
        const bodyHeight = height * 0.7;

        let bodyX = x + (flangeWidth - bodyWidth) / 2;
        let bodyY, flangeX, flangeY;

        flangeX = x;

        if (side === 'top') {
            flangeY = y - flangeHeight;
            bodyY = flangeY - bodyHeight;
        } else { // bottom
            flangeY = y;
            bodyY = flangeY + flangeHeight;
        }

        ctx.fillStyle = baseColors.nozzles;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;

        // Draw Body
        ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
        ctx.strokeRect(bodyX, bodyY, bodyWidth, bodyHeight);

        // Draw Flange
        ctx.fillRect(flangeX, flangeY, flangeWidth, flangeHeight);
        ctx.strokeRect(flangeX, flangeY, flangeWidth, flangeHeight);
    }

    // --- Component Drawing Functions (Simplified & Improved) ---

    function drawFrontHead(type, ctx, x, y, width, height) {
        const partId = 'front';
        const isHovering = hoveredPartId === partId;
        const isComplete = false;

        let fillColor = baseColors.head;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isHovering ? hoverLineColor : lineColor;
        ctx.lineWidth = isHovering ? hoverLineWidth : 2;
        const flangeThickness = 8;

        ctx.fillStyle = baseColors.head;
        ctx.fillRect(x, y - flangeThickness, width, flangeThickness);
        ctx.strokeRect(x, y - flangeThickness, width, flangeThickness);
        ctx.fillRect(x, y + height, width, flangeThickness);
        ctx.strokeRect(x, y + height, width, flangeThickness);

        const headX = x + flangeThickness / 2;
        const headWidth = width - flangeThickness;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isHovering ? hoverLineColor : lineColor;
        ctx.lineWidth = isHovering ? hoverLineWidth : 2;

        switch (type) {
            case 'A':
                // Channel and Removable Cover - two sections with removable cover (dotted line)
                const channelWidthA = headWidth * 0.6;
                const coverWidthA = headWidth * 0.4;
                ctx.fillRect(headX, y, channelWidthA, height);
                ctx.strokeRect(headX, y, channelWidthA, height);
                ctx.fillRect(headX + channelWidthA, y, coverWidthA, height);
                ctx.strokeRect(headX + channelWidthA, y, coverWidthA, height);
                ctx.beginPath();
                ctx.moveTo(headX + channelWidthA, y);
                ctx.lineTo(headX + channelWidthA, y + height);
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = lineColor;
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'C':
                // Channel Integral with Tubesheet - larger section with partial divider
                const channelWidthC = headWidth * 0.75;
                const partWidthC = headWidth * 0.25;
                ctx.fillRect(headX, y, channelWidthC, height);
                ctx.strokeRect(headX, y, channelWidthC, height);
                ctx.fillRect(headX + channelWidthC, y, partWidthC, height);
                ctx.strokeRect(headX + channelWidthC, y, partWidthC, height);
                // Draw partial internal line
                ctx.beginPath();
                ctx.moveTo(headX + channelWidthC, y + height * 0.2);
                ctx.lineTo(headX + channelWidthC, y + height * 0.8);
                ctx.strokeStyle = lineColor;
                ctx.stroke();
                break;
            case 'N':
                // Channel Integral - similar to C but with different proportion
                const channelWidthN = headWidth * 0.7;
                const partWidthN = headWidth * 0.3;
                ctx.fillRect(headX, y, channelWidthN, height);
                ctx.strokeRect(headX, y, channelWidthN, height);
                ctx.fillRect(headX + channelWidthN, y, partWidthN, height);
                ctx.strokeRect(headX + channelWidthN, y, partWidthN, height);
                break;
            case 'B':
            default:
                // Bonnet - simple integral cover
                ctx.fillRect(headX, y, headWidth, height);
                ctx.strokeRect(headX, y, headWidth, height);
                break;
        }
        clickableAreas.push({ id: 'front', rect: { x: x, y: y - flangeThickness, width: width, height: height + 2 * flangeThickness } });
    }

    function drawShell(type, ctx, x, y, width, height, rearType, hoveredPartId) {
        const isHoveringShell = hoveredPartId === 'shell';
        let shellFillColor = baseColors.shell;
        if (isHoveringShell) {
            const baseHex = baseColors.shell;
            const r = Math.min(255, parseInt(baseHex.slice(1,3), 16) + hoverColorOffset/2);
            const g = Math.min(255, parseInt(baseHex.slice(3,5), 16) + hoverColorOffset/2);
            const b = Math.min(255, parseInt(baseHex.slice(5,7), 16) + hoverColorOffset/2);
            shellFillColor = `rgb(${r}, ${g}, ${b})`;
        }

        ctx.fillStyle = shellFillColor;
        ctx.strokeStyle = isHoveringShell ? hoverLineColor : lineColor;
        ctx.lineWidth = isHoveringShell ? hoverLineWidth : 2;

        const flangeThickness = 8;

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = baseColors.shell;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;

        ctx.fillRect(x - flangeThickness, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);
        ctx.strokeRect(x - flangeThickness, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);
        ctx.fillRect(x + width, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);
        ctx.strokeRect(x + width, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);

        // Draw shell-specific internal features
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        switch (type) {
            case 'F':
                // Two Pass Shell - Longitudinal Baffle (divides shell horizontally)
                ctx.beginPath();
                ctx.moveTo(x + 10, y + height / 2);
                ctx.lineTo(x + width - 10, y + height / 2);
                ctx.setLineDash([8, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'G':
                // Split Flow - inlet at center, two outlets
                ctx.beginPath();
                ctx.moveTo(x + width / 2, y + 5);
                ctx.lineTo(x + width / 2, y + height - 5);
                ctx.setLineDash([6, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'H':
                // Double Split Flow - X pattern
                ctx.beginPath();
                ctx.moveTo(x + width / 2, y + 5);
                ctx.lineTo(x + width / 2, y + height - 5);
                ctx.moveTo(x + 10, y + height / 2);
                ctx.lineTo(x + width - 10, y + height / 2);
                ctx.setLineDash([6, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'J':
                // Divided Flow - three sections
                ctx.beginPath();
                ctx.moveTo(x + width / 3, y + 5);
                ctx.lineTo(x + width / 3, y + height - 5);
                ctx.moveTo(x + 2 * width / 3, y + 5);
                ctx.lineTo(x + 2 * width / 3, y + height - 5);
                ctx.setLineDash([5, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'K':
                // Kettle Type Reboiler - enlarged shell at top
                ctx.strokeStyle = isHoveringShell ? hoverLineColor : lineColor;
                ctx.beginPath();
                ctx.moveTo(x, y - height * 0.3);
                ctx.lineTo(x + width, y - height * 0.3);
                ctx.lineTo(x + width, y);
                ctx.moveTo(x, y - height * 0.3);
                ctx.lineTo(x, y);
                ctx.stroke();
                break;
            case 'X':
                // Cross Flow - multiple cross sections
                ctx.beginPath();
                for (let i = 1; i <= 3; i++) {
                    const xPos = x + (i * width) / 4;
                    ctx.moveTo(xPos, y + 10);
                    ctx.lineTo(xPos, y + height - 10);
                }
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'E':
            default:
                // One Pass Shell - no special internal features
                break;
        }

        ctx.lineWidth = 1;

        const numBafflesVisual = Math.max(1, Math.floor(width / 80));
        const baffleSpacing = width / (numBafflesVisual + 1);
        const baffleCutPercent = 0.25;
        const baffleHeight = height * (1 - baffleCutPercent);
        const baffleWidth = 4;
        const isHoveringBaffles = hoveredPartId === 'baffles';
        const areBafflesComplete = checkPropertiesComplete('baffles');

        let baffleFillColor = baseColors.baffles;
        if (isHoveringBaffles) {
            const baseHex = baseColors.baffles;
            const r = Math.min(255, parseInt(baseHex.slice(1,3), 16) + hoverColorOffset);
            const g = Math.min(255, parseInt(baseHex.slice(3,5), 16) + hoverColorOffset);
            const b = Math.min(255, parseInt(baseHex.slice(5,7), 16) + hoverColorOffset);
            baffleFillColor = `rgb(${r}, ${g}, ${b})`;
        }
        ctx.fillStyle = baffleFillColor;
        ctx.strokeStyle = isHoveringBaffles ? hoverLineColor : baseColors.baffles;
        ctx.lineWidth = isHoveringBaffles ? hoverLineWidth : 1;

        for (let i = 1; i <= numBafflesVisual; i++) {
            const baffleX = x + i * baffleSpacing - baffleWidth / 2;
            const baffleY = (i % 2 === 1) ? y : y + height * baffleCutPercent;
            ctx.fillRect(baffleX, baffleY, baffleWidth, baffleHeight);
            if (isHoveringBaffles) {
                ctx.strokeRect(baffleX, baffleY, baffleWidth, baffleHeight);
            }
            if (!clickableAreas.some(a => a.id === 'baffles' && a.rect.x === baffleX)) {
                clickableAreas.push({ id: 'baffles', rect: { x: baffleX, y: baffleY, width: baffleWidth, height: baffleHeight } });
            }
        }
        ctx.lineWidth = 1;

        const numTubesVisual = 5;
        const tubeSpacing = height / (numTubesVisual + 1);
        const tubeStartX = x + 5;
        const tubeEndX = x + width - 5;
        const tubeDrawWidth = tubeEndX - tubeStartX;
        const isHoveringTubes = hoveredPartId === 'tubes';
        const areTubesComplete = checkPropertiesComplete('tubes');
        const tubeBaseLineWidth = 2;
        const tubeHoverLineWidth = 3;

        let tubeStrokeColor = baseColors.tubes;
        if (isHoveringTubes) {
            tubeStrokeColor = hoverLineColor;
        }
        ctx.strokeStyle = tubeStrokeColor;
        ctx.lineWidth = isHoveringTubes ? tubeHoverLineWidth : tubeBaseLineWidth;

        ctx.beginPath();
        if (rearType === 'U') {
            const tubeBendRadius = tubeSpacing / 2;
            const straightLen = tubeDrawWidth - tubeBendRadius;
            for (let i = 1; i <= numTubesVisual; i++) {
                const tubeY = y + i * tubeSpacing;
                if (i % 2 !== 0 && i < numTubesVisual) {
                    const nextTubeY = y + (i + 1) * tubeSpacing;
                    ctx.moveTo(tubeStartX, tubeY);
                    ctx.lineTo(tubeStartX + straightLen, tubeY);
                    ctx.arcTo(tubeEndX, tubeY, tubeEndX, tubeY + tubeBendRadius, tubeBendRadius);
                    ctx.arcTo(tubeEndX, nextTubeY, tubeStartX + straightLen, nextTubeY, tubeBendRadius);
                    ctx.lineTo(tubeStartX, nextTubeY);
                } else if (i === numTubesVisual && i % 2 !== 0) {
                    ctx.moveTo(tubeStartX, tubeY);
                    ctx.lineTo(tubeEndX, tubeY);
                }
            }
        } else {
            for (let i = 1; i <= numTubesVisual; i++) {
                const tubeY = y + i * tubeSpacing;
                ctx.moveTo(tubeStartX, tubeY);
                ctx.lineTo(tubeEndX, tubeY);
            }
        }
        ctx.stroke();
        ctx.lineWidth = 1;

        if (!clickableAreas.some(a => a.id === 'shell')) {
            clickableAreas.push({ id: 'shell', rect: { x: x - flangeThickness, y: y - flangeThickness, width: width + 2 * flangeThickness, height: height + 2 * flangeThickness } });
        }
        if (!clickableAreas.some(a => a.id === 'tubes')) {
            clickableAreas.push({ id: 'tubes', rect: { x: tubeStartX, y: y + tubeSpacing / 2, width: tubeDrawWidth, height: height - tubeSpacing } });
        }
    }

    function drawRearHead(type, ctx, x, y, width, height) {
        const partId = 'rear';
        const isHovering = hoveredPartId === partId;
        const isComplete = false;

        let fillColor = baseColors.head;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isHovering ? hoverLineColor : lineColor;
        ctx.lineWidth = isHovering ? hoverLineWidth : 2;
        const flangeThickness = 8;

        ctx.fillStyle = baseColors.head;
        ctx.fillRect(x - flangeThickness, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);
        ctx.strokeRect(x - flangeThickness, y - flangeThickness, flangeThickness, height + 2 * flangeThickness);

        const headX = x;
        const headWidth = width;

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isHovering ? hoverLineColor : lineColor;
        ctx.lineWidth = isHovering ? hoverLineWidth : 2;

        switch (type) {
            case 'L':
                // Fixed Tubesheet Like "A" - channel with removable cover
                const channelWidthL = headWidth * 0.4;
                const coverWidthL = headWidth * 0.6;
                ctx.fillRect(headX, y, coverWidthL, height);
                ctx.strokeRect(headX, y, coverWidthL, height);
                ctx.fillRect(headX + coverWidthL, y, channelWidthL, height);
                ctx.strokeRect(headX + coverWidthL, y, channelWidthL, height);
                ctx.beginPath();
                ctx.moveTo(headX + coverWidthL, y);
                ctx.lineTo(headX + coverWidthL, y + height);
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = lineColor;
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'N':
                // Fixed Tubesheet Like "N" - channel integral
                const channelWidthN = headWidth * 0.3;
                const partWidthN = headWidth * 0.7;
                ctx.fillRect(headX, y, partWidthN, height);
                ctx.strokeRect(headX, y, partWidthN, height);
                ctx.fillRect(headX + partWidthN, y, channelWidthN, height);
                ctx.strokeRect(headX + partWidthN, y, channelWidthN, height);
                break;
            case 'P':
                // Outside Packed Floating Head - with packing gland
                ctx.fillRect(headX, y, headWidth * 0.7, height);
                ctx.strokeRect(headX, y, headWidth * 0.7, height);
                // Draw packing gland (hatched area)
                ctx.fillRect(headX + headWidth * 0.7, y + height * 0.3, headWidth * 0.3, height * 0.4);
                ctx.strokeRect(headX + headWidth * 0.7, y + height * 0.3, headWidth * 0.3, height * 0.4);
                // Add hatch pattern
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const yPos = y + height * 0.3 + (i * height * 0.08);
                    ctx.moveTo(headX + headWidth * 0.7, yPos);
                    ctx.lineTo(headX + headWidth, yPos);
                }
                ctx.stroke();
                break;
            case 'S':
                // Floating Head with Backing Device - split backing ring
                ctx.fillRect(headX, y, headWidth * 0.75, height);
                ctx.strokeRect(headX, y, headWidth * 0.75, height);
                ctx.fillRect(headX + headWidth * 0.75, y + height * 0.25, headWidth * 0.25, height * 0.5);
                ctx.strokeRect(headX + headWidth * 0.75, y + height * 0.25, headWidth * 0.25, height * 0.5);
                // Draw split line
                ctx.beginPath();
                ctx.moveTo(headX + headWidth * 0.875, y + height * 0.25);
                ctx.lineTo(headX + headWidth * 0.875, y + height * 0.75);
                ctx.setLineDash([3, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            case 'T':
                // Pull Through Floating Head - with enlarged section
                ctx.fillRect(headX, y + height * 0.2, headWidth * 0.6, height * 0.6);
                ctx.strokeRect(headX, y + height * 0.2, headWidth * 0.6, height * 0.6);
                ctx.fillRect(headX + headWidth * 0.6, y, headWidth * 0.4, height);
                ctx.strokeRect(headX + headWidth * 0.6, y, headWidth * 0.4, height);
                break;
            case 'U':
                // U-Tube Bundle - rounded end
                ctx.beginPath();
                ctx.arc(headX + headWidth / 2, y + height / 2, Math.min(headWidth, height) / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;
            case 'W':
                // Externally Sealed Floating Tubesheet - with seal arrangement
                ctx.fillRect(headX, y, headWidth * 0.6, height);
                ctx.strokeRect(headX, y, headWidth * 0.6, height);
                // Draw seal area
                ctx.fillStyle = baseColors.nozzles;
                ctx.fillRect(headX + headWidth * 0.6, y + height * 0.35, headWidth * 0.4, height * 0.3);
                ctx.strokeRect(headX + headWidth * 0.6, y + height * 0.35, headWidth * 0.4, height * 0.3);
                ctx.fillStyle = fillColor;
                break;
            case 'M':
            default:
                // Fixed Tubesheet Like "B" - simple bonnet
                ctx.fillRect(headX, y, headWidth, height);
                ctx.strokeRect(headX, y, headWidth, height);
                break;
        }
        clickableAreas.push({ id: 'rear', rect: { x: x - flangeThickness, y: y - flangeThickness, width: width + flangeThickness, height: height + 2 * flangeThickness } });
    }

    // Update TEMA type display
    function updateTEMADisplay() {
        if (temaTypeDisplay) {
            const temaType = `${selectedFrontType}${selectedShellType}${selectedRearType}`;
            temaTypeDisplay.textContent = temaType;
        }
    }

    // --- Main Drawing Orchestration ---
    function drawHeatExchanger() {
        console.log(`Redrawing HX: Front=${selectedFrontType}, Shell=${selectedShellType}, Rear=${selectedRearType}, Hover=${hoveredPartId}`);
        updateTEMADisplay();
        clickableAreas = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const totalWidth = canvas.width;
        const totalHeight = canvas.height;
        const padding = 50;
        const headWidth = 60;
        const tubeSheetWidth = 10;
        const rearHeadWidth = 60;
        const shellHeight = totalHeight * 0.4;
        const shellTop = (totalHeight - shellHeight) / 2;
        const flangeThickness = 8;

        const frontHeadLeft = padding;
        const frontTubeSheetLeft = frontHeadLeft + headWidth;
        const shellLeft = frontTubeSheetLeft + tubeSheetWidth;

        const fixedEndsWidth = padding + headWidth + tubeSheetWidth + tubeSheetWidth + rearHeadWidth + padding;
        let shellWidth = totalWidth - fixedEndsWidth;

        let rearTubeSheetLeft = shellLeft + shellWidth;
        let rearHeadLeft = rearTubeSheetLeft + tubeSheetWidth;
        if (selectedRearType === 'U') {
            shellWidth = totalWidth - (padding + headWidth + tubeSheetWidth + rearHeadWidth + padding);
            rearTubeSheetLeft = -1;
            rearHeadLeft = shellLeft + shellWidth;
        } else {
            rearTubeSheetLeft = shellLeft + shellWidth;
            rearHeadLeft = rearTubeSheetLeft + tubeSheetWidth;
        }

        const nozzleHeight = 25;
        const nozzleWidth = 15;

        if (shellWidth <= 0) {
            console.error("Canvas too narrow for current layout!");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Canvas too small! Resize the window.", totalWidth / 2, totalHeight / 2);
            return;
        }

        drawFrontHead(selectedFrontType, ctx, frontHeadLeft, shellTop, headWidth, shellHeight);

        ctx.fillStyle = baseColors.tubesheet; ctx.strokeStyle = lineColor; ctx.lineWidth = 1;
        ctx.fillRect(frontTubeSheetLeft, shellTop - flangeThickness, tubeSheetWidth, shellHeight + 2 * flangeThickness);
        ctx.strokeRect(frontTubeSheetLeft, shellTop - flangeThickness, tubeSheetWidth, shellHeight + 2 * flangeThickness);

        drawShell(selectedShellType, ctx, shellLeft, shellTop, shellWidth, shellHeight, selectedRearType, hoveredPartId);

        if (rearTubeSheetLeft > 0) {
            ctx.fillStyle = baseColors.tubesheet; ctx.strokeStyle = lineColor; ctx.lineWidth = 1;
            ctx.fillRect(rearTubeSheetLeft, shellTop - flangeThickness, tubeSheetWidth, shellHeight + 2 * flangeThickness);
            ctx.strokeRect(rearTubeSheetLeft, shellTop - flangeThickness, tubeSheetWidth, shellHeight + 2 * flangeThickness);
        }

        drawRearHead(selectedRearType, ctx, rearHeadLeft, shellTop, rearHeadWidth, shellHeight);

        const nozzleOffset = nozzleWidth * 1.4 / 2;
        drawNozzle(ctx, shellLeft + shellWidth * 0.8 - nozzleOffset, shellTop, nozzleWidth, nozzleHeight, 'top');
        const shellOutletXpos = (selectedShellType === 'F') ? shellLeft + shellWidth * 0.8 - nozzleOffset : shellLeft + shellWidth * 0.2 - nozzleOffset;
        drawNozzle(ctx, shellOutletXpos, shellTop + shellHeight, nozzleWidth, nozzleHeight, 'bottom');
        drawNozzle(ctx, frontHeadLeft + headWidth / 2 - nozzleOffset, shellTop, nozzleWidth, nozzleHeight, 'top');
        drawNozzle(ctx, frontHeadLeft + headWidth / 2 - nozzleOffset, shellTop + shellHeight, nozzleWidth, nozzleHeight, 'bottom');

        const supportY = shellTop + shellHeight + flangeThickness;
        const supportWidth = 40;
        const supportHeight = 20;
        const supportRadius = supportWidth / 4;
        const support1X = shellLeft + shellWidth * 0.2 - supportWidth / 2;
        const support2X = shellLeft + shellWidth * 0.8 - supportWidth / 2;

        ctx.fillStyle = baseColors.nozzles;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;

        [support1X, support2X].forEach(supX => {
            ctx.beginPath();
            ctx.moveTo(supX, supportY + supportHeight);
            ctx.lineTo(supX + supportWidth, supportY + supportHeight);
            ctx.lineTo(supX + supportWidth, supportY + supportRadius);
            ctx.arcTo(supX + supportWidth, supportY, supX + supportWidth - supportRadius, supportY, supportRadius);
            ctx.lineTo(supX + supportRadius, supportY);
            ctx.arcTo(supX, supportY, supX, supportY + supportRadius, supportRadius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        console.log("Drawing complete.");
    }

    // --- Interaction ---
    function isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    function handleCanvasClick(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let clickedPartId = null;
        console.log(`Click at: (${x.toFixed(0)}, ${y.toFixed(0)})`);

        for (let i = clickableAreas.length - 1; i >= 0; i--) {
            const area = clickableAreas[i];
            if (isPointInRect(x, y, area.rect)) {
                if (area.id === 'shell') {
                    const tubeArea = clickableAreas.find(a => a.id === 'tubes');
                    if (tubeArea && isPointInRect(x, y, tubeArea.rect)) {
                        clickedPartId = 'tubes';
                        break;
                    }
                    const baffleAreas = clickableAreas.filter(a => a.id === 'baffles');
                    let clickedBaffle = false;
                    for (const baffleArea of baffleAreas) {
                        if (isPointInRect(x, y, baffleArea.rect)) {
                            clickedPartId = 'baffles';
                            clickedBaffle = true;
                            break;
                        }
                    }
                    if (clickedBaffle) break;

                    clickedPartId = 'shell';
                    break;
                } else {
                    clickedPartId = area.id;
                    break;
                }
            }
        }

        if (clickedPartId) {
            console.log("Clicked on area ID:", clickedPartId);
            showPopup(clickedPartId);
        } else {
            console.log("Clicked on empty area");
        }
    }

    function handleCanvasMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let currentHoverId = null;

        for (let i = clickableAreas.length - 1; i >= 0; i--) {
            const area = clickableAreas[i];
            if (isPointInRect(x, y, area.rect)) {
                if (area.id === 'shell') {
                    const tubeArea = clickableAreas.find(a => a.id === 'tubes');
                    if (tubeArea && isPointInRect(x, y, tubeArea.rect)) {
                        currentHoverId = 'tubes';
                        break;
                    }
                    const baffleAreas = clickableAreas.filter(a => a.id === 'baffles');
                    let hoveringBaffle = false;
                    for (const baffleArea of baffleAreas) {
                        if (isPointInRect(x, y, baffleArea.rect)) {
                            currentHoverId = 'baffles';
                            hoveringBaffle = true;
                            break;
                        }
                    }
                    if (hoveringBaffle) break;

                    currentHoverId = 'shell';
                    break;
                } else if (area.id === 'tubes' || area.id === 'baffles') {
                    currentHoverId = area.id;
                    break;
                }
            }
        }

        if (currentHoverId !== hoveredPartId) {
            hoveredPartId = currentHoverId;
            drawHeatExchanger();
            canvas.style.cursor = (hoveredPartId === 'tubes' || hoveredPartId === 'baffles' || hoveredPartId === 'shell') ? 'pointer' : 'default';
        }
    }

    function handleCanvasMouseLeave(event) {
        if (hoveredPartId !== null) {
            hoveredPartId = null;
            drawHeatExchanger();
            canvas.style.cursor = 'default';
        }
    }

    function createFormField(partPrefix, key, value, isRequired, partData) {
        const fieldContainer = document.createElement('div');
        const label = document.createElement('label');
        const inputId = `${partPrefix}-prop-${key}`;
        label.htmlFor = inputId;

        let labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let inputType = 'text';
        let inputStep = 'any';
        let inputMin = undefined;

        switch (key) {
            case 'inletTemp':
            case 'outletTemp':
            case 'designMetalTemp':
            case 'mechDesignTempMin':
            case 'mechDesignTempMax':
                labelText += ' (°C)';
                inputType = 'number';
                break;
            case 'inletDiameter':
            case 'innerDiameter':
            case 'corrosionAllowance':
            case 'minNozzleDistance':
            case 'outerDiameter':
            case 'effectiveTubeLength':
            case 'tubeInnerDiameter':
            case 'tubePitch':
            case 'spacing':
            case 'freeEndSpacing':
            case 'nearEndSpacing':
                labelText += ' (mm)';
                inputType = 'number';
                inputStep = '0.1';
                inputMin = '0';
                break;
            case 'freeOuterHoleArea':
                labelText += ' (m²)';
                inputType = 'number';
                inputStep = '0.001';
                inputMin = '0';
                break;
            case 'testPressure':
                labelText += ' (kg/cm² g)';
                inputType = 'number';
                inputMin = '0';
                break;
            case 'flowRate':
                labelText += ' (kg/h)';
                inputType = 'number';
                inputMin = '0';
                break;
            case 'numPasses':
            case 'numTubes':
            case 'tubesInWindow':
                inputType = 'number';
                inputStep = '1';
                inputMin = '0';
                break;
            case 'outerCutPercent':
                labelText += ' (%)';
                inputType = 'number';
                inputStep = '0.1';
                inputMin = '0';
                inputMax = '100';
                break;
            case 'orientation':
            case 'designH2Pressure':
            case 'insulationPurpose':
            case 'material':
            case 'tubeLayout':
            case 'tubeMaterial':
            case 'baffleType':
            case 'cutOrientation':
            case 'impingementPlate':
            case 'baffleMaterial':
                inputType = 'text';
                break;
            default:
                break;
        }

        label.textContent = labelText + (isRequired ? ' *' : '');
        let input;

        input = document.createElement('input');
        input.type = inputType;
        if (inputType === 'number') {
            input.step = inputStep;
            if (inputMin !== undefined) input.min = inputMin;
        }

        input.id = inputId;
        input.name = `${partPrefix}-${key}`;
        input.required = isRequired;
        input.value = (value !== null && value !== undefined) ? value : '';
        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        return fieldContainer;
    }

    function showPopup(clickedPartId) {
        console.log(`showPopup called for: ${clickedPartId}`);
        currentPartIdForPopup = clickedPartId;
        let title = "";
        const partsToShow = [];

        if (clickedPartId === 'shell') {
            title = `Edit Shell Properties`;
            partsToShow.push('shell');
        } else if (clickedPartId === 'tubes') {
            title = `Edit Tube Properties`;
            partsToShow.push('tubes');
        } else if (clickedPartId === 'baffles') {
            title = `Edit Baffle Properties`;
            partsToShow.push('baffles');
        } else {
            console.log("Clicked on non-editable area:", clickedPartId);
            return;
        }

        popupTitle.textContent = title;
        popupFields.innerHTML = '';

        const partId = partsToShow[0];
        const props = partProperties[partId];
        const reqFields = requiredFields[partId];
        if (!props) { console.warn(`Properties not found for ${partId}`); return; }

        for (const key in props) {
            if (key === 'name') continue;
            const isRequired = reqFields?.includes(key);
            try {
                const fieldElement = createFormField(partId, key, props[key], isRequired, props);
                popupFields.appendChild(fieldElement);
            } catch (e) {
                console.error(`Error creating field for ${partId}-${key}:`, e);
            }
        }

        // Show the property panel
        propertyPanel.style.display = 'flex';
        console.log("Property panel updated with form.");
    }

    function hidePopup() {
        // Hide the property panel completely
        propertyPanel.style.display = 'none';
        popupTitle.textContent = 'Properties';
        popupFields.innerHTML = '';
        currentPartIdForPopup = null;
        console.log("Property panel hidden.");
    }

    // Load Example Data from CSV files
    async function loadExampleData() {
        try {
            console.log("Loading example data from CSV files...");
            let loadedCount = 0;
            let skippedCount = 0;
            
            // Load shell data
            const shellResponse = await fetch('data/shell.csv');
            const shellText = await shellResponse.text();
            const shellLines = shellText.trim().split('\n');
            if (shellLines.length >= 2) {
                const headers = shellLines[0].split(',');
                const values = shellLines[1].split(',');
                console.log("Shell CSV headers:", headers);
                console.log("Shell CSV values:", values);
                headers.forEach((header, index) => {
                    const key = header.trim();
                    const value = values[index]?.trim();
                    if (partProperties.shell[key] !== undefined) {
                        if (value !== undefined && value !== '') {
                            // Check if it's a number
                            const numValue = parseFloat(value);
                            partProperties.shell[key] = isNaN(numValue) ? value : numValue;
                            loadedCount++;
                            console.log(`Loaded shell.${key} = ${partProperties.shell[key]}`);
                        } else {
                            skippedCount++;
                            console.log(`Skipped shell.${key} (empty value)`);
                        }
                    } else {
                        console.log(`Skipped shell.${key} (property not found in schema)`);
                    }
                });
            }

            // Load tube data
            const tubeResponse = await fetch('data/tube.csv');
            const tubeText = await tubeResponse.text();
            const tubeLines = tubeText.trim().split('\n');
            if (tubeLines.length >= 2) {
                const headers = tubeLines[0].split(',');
                const values = tubeLines[1].split(',');
                console.log("Tube CSV headers:", headers);
                console.log("Tube CSV values:", values);
                headers.forEach((header, index) => {
                    const key = header.trim();
                    const value = values[index]?.trim();
                    if (partProperties.tubes[key] !== undefined) {
                        if (value !== undefined && value !== '') {
                            const numValue = parseFloat(value);
                            partProperties.tubes[key] = isNaN(numValue) ? value : numValue;
                            loadedCount++;
                            console.log(`Loaded tubes.${key} = ${partProperties.tubes[key]}`);
                        } else {
                            skippedCount++;
                            console.log(`Skipped tubes.${key} (empty value)`);
                        }
                    } else {
                        console.log(`Skipped tubes.${key} (property not found in schema)`);
                    }
                });
            }

            // Load baffle data
            const baffleResponse = await fetch('data/baffle.csv');
            const baffleText = await baffleResponse.text();
            const baffleLines = baffleText.trim().split('\n');
            if (baffleLines.length >= 2) {
                const headers = baffleLines[0].split(',');
                const values = baffleLines[1].split(',');
                console.log("Baffle CSV headers:", headers);
                console.log("Baffle CSV values:", values);
                headers.forEach((header, index) => {
                    const key = header.trim();
                    const value = values[index]?.trim();
                    if (partProperties.baffles[key] !== undefined) {
                        if (value !== undefined && value !== '') {
                            const numValue = parseFloat(value);
                            partProperties.baffles[key] = isNaN(numValue) ? value : numValue;
                            loadedCount++;
                            console.log(`Loaded baffles.${key} = ${partProperties.baffles[key]}`);
                        } else {
                            skippedCount++;
                            console.log(`Skipped baffles.${key} (empty value)`);
                        }
                    } else {
                        console.log(`Skipped baffles.${key} (property not found in schema)`);
                    }
                });
            }

            console.log("=== Data Loading Summary ===");
            console.log("Shell properties:", partProperties.shell);
            console.log("Tube properties:", partProperties.tubes);
            console.log("Baffle properties:", partProperties.baffles);
            console.log(`Total loaded: ${loadedCount} properties`);
            console.log(`Total skipped: ${skippedCount} properties`);

            // Redraw the canvas to reflect any changes
            draw();
            
            alert(`Example data loaded successfully!\n\nLoaded ${loadedCount} properties from CSV files.\n\nClick on components (Shell, Tubes, Baffles) to view/edit the loaded properties.`);
        } catch (error) {
            console.error("Error loading example data:", error);
            alert(`Error loading example data: ${error.message}\n\nPlease check the browser console for details.`);
        }
    }

    function saveProperties() {
        console.log("Save button clicked.");
        const inputs = popupFields.querySelectorAll('input, select');
        let formIsValid = true;
        const updatedProps = {};
        const currentPartId = currentPartIdForPopup;

        if (!currentPartId || !partProperties[currentPartId]) {
            console.error("Cannot save, invalid part ID:", currentPartId);
            return;
        }

        inputs.forEach(input => {
            const nameParts = input.name.split('-');
            if (nameParts.length < 2) return;
            const partId = nameParts[0];
            const key = nameParts.slice(1).join('-');

            if (partId !== currentPartId) return;
            if (!partProperties[partId] || partProperties[partId][key] === undefined) return;

            if (!updatedProps[partId]) updatedProps[partId] = {};

            let value = input.value;
            const isRequired = input.required;
            input.style.borderColor = '';

            if (input.type === 'number') {
                if (value.trim() === '') {
                    value = null;
                    if (isRequired) {
                        formIsValid = false;
                        input.style.borderColor = 'red';
                    }
                } else {
                    value = parseFloat(value);
                    if (isNaN(value)) {
                        value = null;
                        if (isRequired) {
                            formIsValid = false;
                            input.style.borderColor = 'red';
                        }
                    }
                }
            } else if (input.tagName === 'SELECT') {
                if (value === '' && isRequired) {
                    value = null;
                    formIsValid = false;
                    input.style.borderColor = 'red';
                }
            } else if (input.type === 'text') {
                value = value.trim();
                if (value === '') {
                    value = null;
                    if (isRequired) {
                        formIsValid = false;
                        input.style.borderColor = 'red';
                    }
                }
            }

            updatedProps[partId][key] = value;
        });

        if (!formIsValid) {
            alert('Please fill in all required (*) fields correctly.');
            console.log("Validation failed, save aborted.");
            return;
        }

        console.log("Validation passed. Updating properties for:", currentPartId, updatedProps);
        let redrawNeeded = false;
        if (updatedProps[currentPartId]) {
            partProperties[currentPartId] = { ...partProperties[currentPartId], ...updatedProps[currentPartId] };
            redrawNeeded = true;
            console.log("Updated state:", partProperties[currentPartId]);
        }

        hidePopup();
        if (redrawNeeded) {
            drawHeatExchanger();
            console.log("Properties updated. Redrawing canvas.");
        } else {
            console.log("No changes detected requiring redraw.");
        }
    }

    async function loadDefaultProperties() {
        try {
            // Load shell properties
            const shellResponse = await fetch('data/shell.csv');
            const shellText = await shellResponse.text();
            const [shellHeaders, shellValues] = shellText.split('\n').map(line => line.split(','));
            shellHeaders.forEach((header, index) => {
                if (partProperties.shell[header] !== undefined) {
                    partProperties.shell[header] = parseFloat(shellValues[index]) || shellValues[index];
                }
            });

            // Load tube properties
            const tubeResponse = await fetch('data/tube.csv');
            const tubeText = await tubeResponse.text();
            const [tubeHeaders, tubeValues] = tubeText.split('\n').map(line => line.split(','));
            tubeHeaders.forEach((header, index) => {
                if (partProperties.tubes[header] !== undefined) {
                    partProperties.tubes[header] = parseFloat(tubeValues[index]) || tubeValues[index];
                }
            });

            // Load baffle properties
            const baffleResponse = await fetch('data/baffle.csv');
            const baffleText = await baffleResponse.text();
            const [baffleHeaders, baffleValues] = baffleText.split('\n').map(line => line.split(','));
            baffleHeaders.forEach((header, index) => {
                if (partProperties.baffles[header] !== undefined) {
                    partProperties.baffles[header] = parseFloat(baffleValues[index]) || baffleValues[index];
                }
            });

            console.log('Default properties loaded successfully');
            drawHeatExchanger();
        } catch (error) {
            console.error('Error loading default properties:', error);
        }
    }

    function calculateHeatExchanger() {
        if (!checkPropertiesComplete('shell') || !checkPropertiesComplete('tubes')) {
            alert('Please complete shell and tube properties before calculating.');
            return;
        }

        const shellProps = partProperties.shell;
        const tubeProps = partProperties.tubes;
        const baffleProps = partProperties.baffles;

        // Get fluid properties at mean temperatures
        const shellTempMean = (shellProps.inletTemp + shellProps.outletTemp) / 2;
        const tubeTempMean = (tubeProps.inletTemp + tubeProps.outletTemp) / 2;
        
        // Fluid properties for water (temperature-dependent approximations)
        const getWaterProperties = (temp) => {
            const rho = 1000 - 0.2 * (temp - 20); // kg/m³
            const mu = 0.001 * Math.exp(-0.02 * (temp - 20)); // Pa·s
            const cp = 4.186; // kJ/kg·K
            const lambda = 0.6 + 0.002 * temp; // W/m·K
            const Pr = (mu * cp * 1000) / lambda; // Prandtl number
            return { rho, mu, cp, lambda, Pr };
        };
        
        const shellFluid = getWaterProperties(shellTempMean);
        const tubeFluid = getWaterProperties(tubeTempMean);

        // Basic parameters
        const shellMassFlow = shellProps.flowRate / 3600; // kg/s
        const shellTempIn = shellProps.inletTemp;
        const shellTempOut = shellProps.outletTemp;
        const tubeMassFlow = tubeProps.flowRate / 3600; // kg/s
        const tubeTempIn = tubeProps.inletTemp;
        const tubeTempOut = tubeProps.outletTemp;

        // Geometry calculations
        const tubeOD = tubeProps.outerDiameter / 1000; // m
        const tubeID = tubeProps.tubeInnerDiameter / 1000; // m
        const tubeLength = tubeProps.effectiveTubeLength / 1000; // m
        const numTubes = tubeProps.numTubes;
        const numPasses = shellProps.numPasses || 1;
        const tubesPerPass = numTubes / numPasses;
        const baffleSpacing = baffleProps.spacing / 1000; // m
        const shellID = shellProps.innerDiameter / 1000; // m
        const tubePitch = tubeProps.tubePitch / 1000; // m
        const tubeWallThickness = (tubeOD - tubeID) / 2; // m
        
        // Heat duty calculations
        const shellDuty = shellMassFlow * shellFluid.cp * (shellTempIn - shellTempOut); // kW
        const tubeDuty = tubeMassFlow * tubeFluid.cp * (tubeTempOut - tubeTempIn); // kW
        const avgDuty = (Math.abs(shellDuty) + Math.abs(tubeDuty)) / 2;

        // Temperature calculations
        const dt1 = Math.abs(shellTempIn - tubeTempOut);
        const dt2 = Math.abs(shellTempOut - tubeTempIn);
        const lmtd = Math.abs((dt1 - dt2) / Math.log(dt1 / dt2));
        
        // LMTD Correction Factor (F) - for 1 shell pass, N tube passes
        const P = (tubeTempOut - tubeTempIn) / (shellTempIn - tubeTempIn);
        const R = (shellTempIn - shellTempOut) / (tubeTempOut - tubeTempIn);
        let F = 1.0; // Default for pure counterflow
        if (numPasses > 1 && R !== 1 && P > 0 && P < 1) {
            const S = Math.sqrt(R * R + 1) / (R - 1);
            const W = Math.pow((1 - P * R) / (1 - P), 1 / numPasses);
            const F_numerator = Math.log((1 - W) / (1 - R * W));
            const F_denominator = Math.log((2 / W - 1 - R + S) / (2 / W - 1 - R - S));
            F = S * F_numerator / F_denominator;
            F = Math.max(0.75, Math.min(1.0, F)); // Clamp between 0.75 and 1.0
        }
        const CMTD = F * lmtd;

        // Tube side calculations
        const tubeCrossSection = (Math.PI * tubeID * tubeID / 4) * tubesPerPass; // m²
        const tubeVelocity = (tubeMassFlow / tubeFluid.rho) / tubeCrossSection; // m/s
        const tubeRe = (tubeFluid.rho * tubeVelocity * tubeID) / tubeFluid.mu;
        
        // Tube side Nusselt number (Dittus-Boelter for turbulent, Sieder-Tate for laminar)
        let tubeNu;
        if (tubeRe < 2300) {
            // Laminar flow
            tubeNu = 1.86 * Math.pow((tubeRe * tubeFluid.Pr * tubeID / tubeLength), 0.33);
        } else if (tubeRe < 8000) {
            // Transition region
            tubeNu = (0.037 * Math.pow(tubeRe, 0.75) - 6.66) * Math.pow(tubeFluid.Pr, 0.42);
        } else {
            // Turbulent flow
            tubeNu = 0.023 * Math.pow(tubeRe, 0.8) * Math.pow(tubeFluid.Pr, 0.4);
        }
        const hi = (tubeNu * tubeFluid.lambda) / tubeID; // W/m²·K

        // Shell side calculations
        const segmentalHeight = (baffleProps.outerCutPercent / 100) * shellID;
        const shellCrossSection = baffleSpacing * (shellID - numTubes * tubeOD / numPasses);
        const shellVelocity = (shellMassFlow / shellFluid.rho) / shellCrossSection; // m/s
        const shellRe = (shellFluid.rho * shellVelocity * tubeOD) / shellFluid.mu;
        
        // Shell side Nusselt number (for tube bundles)
        let shellNu;
        if (shellRe < 1000) {
            shellNu = 0.196 * Math.pow(shellRe, 0.6) * Math.pow(shellFluid.Pr, 0.33);
        } else {
            shellNu = 0.36 * Math.pow(shellRe, 0.55) * Math.pow(shellFluid.Pr, 0.33);
        }
        const ho = (shellNu * shellFluid.lambda) / tubeOD; // W/m²·K

        // Overall heat transfer coefficient
        const tubeLambda = 50; // W/m·K (steel)
        const foulingTube = 0.0002; // m²·K/W
        const foulingShell = 0.0002; // m²·K/W
        const U_calc = 1 / (1/hi + tubeWallThickness/tubeLambda + 1/ho + foulingTube + foulingShell);

        // Heat transfer area
        const tubeArea = Math.PI * tubeOD * tubeLength * numTubes; // m²
        const requiredArea = (avgDuty * 1000) / (U_calc * CMTD); // m²

        // Pressure drop calculations - Tube side
        let tubeFrictionFactor;
        if (tubeRe < 2300) {
            tubeFrictionFactor = 64 / tubeRe;
        } else {
            tubeFrictionFactor = 0.316 / Math.pow(tubeRe, 0.25);
        }
        const tubePressureDrop = (tubeFrictionFactor * (tubeLength / tubeID) * numPasses + 4 * numPasses) * 
                                 (tubeFluid.rho * tubeVelocity * tubeVelocity / 2) / 1000; // kPa

        // Pressure drop calculations - Shell side
        const numBaffles = Math.floor((tubeLength - baffleSpacing) / baffleSpacing);
        const shellFrictionFactor = Math.exp(0.576 - 0.19 * Math.log(shellRe));
        const numTubeCrossRows = Math.floor(shellID / tubePitch);
        const shellPressureDrop = ((numBaffles + 1) * shellFrictionFactor * numTubeCrossRows * 
                                  shellFluid.rho * shellVelocity * shellVelocity / 2) / 1000; // kPa

        // Performance metrics
        const effectiveness = Math.abs(shellTempIn - shellTempOut) / Math.abs(shellTempIn - tubeTempIn) * 100;
        const areaMargin = ((tubeArea / requiredArea) - 1) * 100;
        const heatBalanceError = Math.abs((shellDuty - tubeDuty) / avgDuty * 100);

        // Update results sections
        document.getElementById('heatTransferResults').innerHTML = `
            <div class="result-item">
                <div class="result-label">Shell Side Heat Duty</div>
                <div class="result-value">${shellDuty.toFixed(2)} kW</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Side Heat Duty</div>
                <div class="result-value">${tubeDuty.toFixed(2)} kW</div>
            </div>
            <div class="result-item">
                <div class="result-label">Heat Transfer Area</div>
                <div class="result-value">${tubeArea.toFixed(2)} m²</div>
            </div>
            <div class="result-item">
                <div class="result-label">Required Area</div>
                <div class="result-value">${requiredArea.toFixed(2)} m²</div>
            </div>
            <div class="result-item">
                <div class="result-label">Overall U Calculated</div>
                <div class="result-value">${U_calc.toFixed(1)} W/m²·K</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Side h<sub>i</sub></div>
                <div class="result-value">${hi.toFixed(1)} W/m²·K</div>
            </div>
            <div class="result-item">
                <div class="result-label">Shell Side h<sub>o</sub></div>
                <div class="result-value">${ho.toFixed(1)} W/m²·K</div>
            </div>
        `;

        document.getElementById('temperatureResults').innerHTML = `
            <div class="result-item">
                <div class="result-label">LMTD</div>
                <div class="result-value">${lmtd.toFixed(2)} °C</div>
            </div>
            <div class="result-item">
                <div class="result-label">Correction Factor (F)</div>
                <div class="result-value">${F.toFixed(3)}</div>
            </div>
            <div class="result-item">
                <div class="result-label">CMTD</div>
                <div class="result-value">${CMTD.toFixed(2)} °C</div>
            </div>
            <div class="result-item">
                <div class="result-label">Temperature Approach</div>
                <div class="result-value">${Math.min(dt1, dt2).toFixed(2)} °C</div>
            </div>
            <div class="result-item">
                <div class="result-label">Temperature Efficiency (P)</div>
                <div class="result-value">${(P * 100).toFixed(2)}%</div>
            </div>
            <div class="result-item">
                <div class="result-label">Heat Capacity Ratio (R)</div>
                <div class="result-value">${R.toFixed(3)}</div>
            </div>
        `;

        document.getElementById('efficiencyResults').innerHTML = `
            <div class="result-item">
                <div class="result-label">Effectiveness</div>
                <div class="result-value">${effectiveness.toFixed(2)}%</div>
            </div>
            <div class="result-item">
                <div class="result-label">Area Margin</div>
                <div class="result-value">${areaMargin.toFixed(2)}%</div>
            </div>
            <div class="result-item">
                <div class="result-label">Heat Balance Error</div>
                <div class="result-value">${heatBalanceError.toFixed(2)}%</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Reynolds Number</div>
                <div class="result-value">${tubeRe.toFixed(0)}</div>
            </div>
            <div class="result-item">
                <div class="result-label">Shell Reynolds Number</div>
                <div class="result-value">${shellRe.toFixed(0)}</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Nusselt Number</div>
                <div class="result-value">${tubeNu.toFixed(1)}</div>
            </div>
            <div class="result-item">
                <div class="result-label">Shell Nusselt Number</div>
                <div class="result-value">${shellNu.toFixed(1)}</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Velocity</div>
                <div class="result-value">${tubeVelocity.toFixed(2)} m/s</div>
            </div>
            <div class="result-item">
                <div class="result-label">Shell Velocity</div>
                <div class="result-value">${shellVelocity.toFixed(2)} m/s</div>
            </div>
            <div class="result-item">
                <div class="result-label">Tube Pressure Drop</div>
                <div class="result-value">${tubePressureDrop.toFixed(2)} kPa</div>
            </div>
            <div class="result-item">
                <div class="result-label">Shell Pressure Drop</div>
                <div class="result-value">${shellPressureDrop.toFixed(2)} kPa</div>
            </div>
            <div class="result-item">
                <div class="result-label">Number of Baffles</div>
                <div class="result-value">${numBaffles}</div>
            </div>
        `;

        calcPopup.style.display = 'block';
    }

    // --- Flow Simulation Functions ---
    class FluidParticle {
        constructor(x, y, type, bounds, tubeIndex = -1) {
            this.x = x;
            this.y = y;
            this.type = type; // 'shell' or 'tube'
            this.bounds = bounds;
            this.tubeIndex = tubeIndex;
            this.baseY = y;
            this.speed = 0.8 + Math.random() * 0.4;
            this.phase = Math.random() * Math.PI * 2;
            this.turbulenceOffset = 0;
            this.temperature = type === 'shell' ? simProps.shellInletTemp : simProps.tubeInletTemp;
            this.alpha = 0.7 + Math.random() * 0.3;
        }

        update(deltaTime) {
            const baseSpeed = simProps.flowSpeed * this.speed * 2;
            const direction = this.type === 'shell' ? 1 : (simProps.flowType === 'counter' ? -1 : 1);
            
            this.x += baseSpeed * direction;
            
            // Turbulence effect
            if (simProps.showTurbulence) {
                this.turbulenceOffset = Math.sin(simulationTime * 3 + this.phase) * 2;
                this.y = this.baseY + this.turbulenceOffset;
            }
            
            // Update temperature based on position
            const progress = (this.x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX);
            if (this.type === 'shell') {
                this.temperature = simProps.shellInletTemp - (simProps.shellInletTemp - simProps.shellOutletTemp) * progress;
            } else {
                if (simProps.flowType === 'counter') {
                    this.temperature = simProps.tubeOutletTemp - (simProps.tubeOutletTemp - simProps.tubeInletTemp) * progress;
                } else {
                    this.temperature = simProps.tubeInletTemp + (simProps.tubeOutletTemp - simProps.tubeInletTemp) * progress;
                }
            }
            
            // Reset particle when out of bounds
            if (this.type === 'shell') {
                if (this.x > this.bounds.maxX) {
                    this.x = this.bounds.minX;
                    this.temperature = simProps.shellInletTemp;
                }
            } else {
                if (simProps.flowType === 'counter') {
                    if (this.x < this.bounds.minX) {
                        this.x = this.bounds.maxX;
                        this.temperature = simProps.tubeInletTemp;
                    }
                } else {
                    if (this.x > this.bounds.maxX) {
                        this.x = this.bounds.minX;
                        this.temperature = simProps.tubeInletTemp;
                    }
                }
            }
        }

        getColor() {
            if (!simProps.showTempGradient) {
                return this.type === 'shell' ? 'rgba(220, 80, 60, 0.8)' : 'rgba(60, 130, 220, 0.8)';
            }
            
            // Temperature to color mapping
            const minTemp = Math.min(simProps.tubeInletTemp, simProps.shellOutletTemp);
            const maxTemp = Math.max(simProps.shellInletTemp, simProps.tubeOutletTemp);
            const tempRange = maxTemp - minTemp;
            const normalizedTemp = (this.temperature - minTemp) / tempRange;
            
            // Hot = Red, Cold = Blue
            const r = Math.floor(50 + normalizedTemp * 205);
            const g = Math.floor(50 + (1 - Math.abs(normalizedTemp - 0.5) * 2) * 100);
            const b = Math.floor(50 + (1 - normalizedTemp) * 205);
            
            return `rgba(${r}, ${g}, ${b}, ${this.alpha})`;
        }

        draw(ctx) {
            const size = simProps.particleSize;
            ctx.fillStyle = this.getColor();
            ctx.beginPath();
            ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw trail effect
            const trailLength = 3;
            const direction = this.type === 'shell' ? 1 : (simProps.flowType === 'counter' ? -1 : 1);
            for (let i = 1; i <= trailLength; i++) {
                ctx.globalAlpha = this.alpha * (1 - i / (trailLength + 1)) * 0.5;
                ctx.beginPath();
                ctx.arc(this.x - direction * i * size * 1.5, this.y, size * (1 - i * 0.2), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    function getSimulationBounds() {
        const totalWidth = canvas.width;
        const totalHeight = canvas.height;
        const padding = 50;
        const headWidth = 60;
        const tubeSheetWidth = 10;
        const shellHeight = totalHeight * 0.4;
        const shellTop = (totalHeight - shellHeight) / 2;
        
        const frontTubeSheetLeft = padding + headWidth;
        const shellLeft = frontTubeSheetLeft + tubeSheetWidth;
        const fixedEndsWidth = padding + headWidth + tubeSheetWidth + tubeSheetWidth + 60 + padding;
        const shellWidth = totalWidth - fixedEndsWidth;

        return {
            shell: {
                minX: shellLeft + 5,
                maxX: shellLeft + shellWidth - 5,
                minY: shellTop + 5,
                maxY: shellTop + shellHeight - 5,
                width: shellWidth,
                height: shellHeight
            },
            tubes: {
                minX: shellLeft + 5,
                maxX: shellLeft + shellWidth - 5,
                minY: shellTop + shellHeight * 0.2,
                maxY: shellTop + shellHeight * 0.8,
                width: shellWidth,
                height: shellHeight * 0.6
            }
        };
    }

    function initializeSimulation() {
        simulationParticles = [];
        const bounds = getSimulationBounds();
        const numParticles = simProps.particleDensity;
        
        // Create shell-side particles (between tubes)
        const shellLayers = 4; // Particles in shell regions (top, bottom, between tubes)
        const particlesPerShellLayer = Math.floor(numParticles / shellLayers);
        
        for (let layer = 0; layer < shellLayers; layer++) {
            let yPos;
            if (layer === 0) {
                yPos = bounds.shell.minY + (bounds.tubes.minY - bounds.shell.minY) / 2;
            } else if (layer === shellLayers - 1) {
                yPos = bounds.tubes.maxY + (bounds.shell.maxY - bounds.tubes.maxY) / 2;
            } else {
                yPos = bounds.shell.minY + (bounds.shell.maxY - bounds.shell.minY) * (layer / (shellLayers - 1));
            }
            
            for (let i = 0; i < particlesPerShellLayer; i++) {
                const x = bounds.shell.minX + (bounds.shell.width / particlesPerShellLayer) * i + Math.random() * 20;
                const particle = new FluidParticle(x, yPos + (Math.random() - 0.5) * 10, 'shell', bounds.shell);
                simulationParticles.push(particle);
            }
        }
        
        // Create tube-side particles (inside tubes)
        const numTubeRows = 5;
        const particlesPerTube = Math.floor(numParticles * 0.6 / numTubeRows);
        
        for (let tube = 0; tube < numTubeRows; tube++) {
            const tubeY = bounds.tubes.minY + (bounds.tubes.height / (numTubeRows + 1)) * (tube + 1);
            
            for (let i = 0; i < particlesPerTube; i++) {
                const startX = simProps.flowType === 'counter' 
                    ? bounds.tubes.maxX - (bounds.tubes.width / particlesPerTube) * i 
                    : bounds.tubes.minX + (bounds.tubes.width / particlesPerTube) * i;
                const particle = new FluidParticle(
                    startX + (Math.random() - 0.5) * 20, 
                    tubeY + (Math.random() - 0.5) * 5, 
                    'tube', 
                    bounds.tubes, 
                    tube
                );
                simulationParticles.push(particle);
            }
        }
    }

    function drawFlowArrows(ctx, bounds, type) {
        if (!simProps.showFlowDirection) return;
        
        const direction = type === 'shell' ? 1 : (simProps.flowType === 'counter' ? -1 : 1);
        const color = type === 'shell' ? 'rgba(180, 60, 40, 0.6)' : 'rgba(40, 100, 180, 0.6)';
        const y = type === 'shell' ? bounds.minY - 15 : bounds.maxY + 15;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        
        const numArrows = 5;
        const spacing = bounds.width / (numArrows + 1);
        const arrowSize = 8;
        const animOffset = (simulationTime * 30 * simProps.flowSpeed * direction) % spacing;
        
        for (let i = 0; i < numArrows; i++) {
            let x = bounds.minX + spacing * (i + 1) + animOffset;
            if (x > bounds.maxX) x -= bounds.width;
            if (x < bounds.minX) x += bounds.width;
            
            ctx.beginPath();
            if (direction > 0) {
                ctx.moveTo(x - arrowSize, y - arrowSize / 2);
                ctx.lineTo(x, y);
                ctx.lineTo(x - arrowSize, y + arrowSize / 2);
            } else {
                ctx.moveTo(x + arrowSize, y - arrowSize / 2);
                ctx.lineTo(x, y);
                ctx.lineTo(x + arrowSize, y + arrowSize / 2);
            }
            ctx.stroke();
        }
        
        // Draw label
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = color;
        const label = type === 'shell' ? 'Shell Flow (Hot)' : 'Tube Flow (Cold)';
        const labelX = type === 'shell' ? bounds.minX : bounds.maxX - 80;
        ctx.fillText(label, labelX, y + (type === 'shell' ? -5 : 5));
    }

    function drawHeatTransferZones(ctx, bounds) {
        if (!simProps.showHeatTransfer) return;
        
        const numZones = 5;
        const zoneWidth = bounds.shell.width / numZones;
        
        for (let i = 0; i < numZones; i++) {
            const x = bounds.shell.minX + zoneWidth * i;
            const intensity = 0.15 - (i * 0.02);
            
            // Heat transfer zone highlight
            const gradient = ctx.createRadialGradient(
                x + zoneWidth / 2, (bounds.shell.minY + bounds.shell.maxY) / 2, 10,
                x + zoneWidth / 2, (bounds.shell.minY + bounds.shell.maxY) / 2, 60
            );
            gradient.addColorStop(0, `rgba(255, 200, 100, ${intensity})`);
            gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, bounds.shell.minY, zoneWidth, bounds.shell.height);
        }
    }

    function drawTemperatureGraph() {
        if (!graphCtx || !simProps.showGraph) return;
        
        const width = temperatureGraphCanvas.width;
        const height = temperatureGraphCanvas.height;
        const padding = { left: 60, right: 20, top: 30, bottom: 40 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;
        
        // Clear
        graphCtx.fillStyle = '#fff';
        graphCtx.fillRect(0, 0, width, height);
        
        // Draw grid
        graphCtx.strokeStyle = '#e0e0e0';
        graphCtx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (graphHeight / 5) * i;
            graphCtx.beginPath();
            graphCtx.moveTo(padding.left, y);
            graphCtx.lineTo(width - padding.right, y);
            graphCtx.stroke();
        }
        
        for (let i = 0; i <= 10; i++) {
            const x = padding.left + (graphWidth / 10) * i;
            graphCtx.beginPath();
            graphCtx.moveTo(x, padding.top);
            graphCtx.lineTo(x, height - padding.bottom);
            graphCtx.stroke();
        }
        
        // Calculate temperature range
        const minTemp = Math.min(simProps.tubeInletTemp, simProps.shellOutletTemp) - 10;
        const maxTemp = Math.max(simProps.shellInletTemp, simProps.tubeOutletTemp) + 10;
        const tempRange = maxTemp - minTemp;
        
        // Draw shell temperature profile (hot side)
        graphCtx.strokeStyle = '#dc3545';
        graphCtx.lineWidth = 3;
        graphCtx.beginPath();
        
        for (let i = 0; i <= 100; i++) {
            const x = padding.left + (graphWidth / 100) * i;
            const progress = i / 100;
            const temp = simProps.shellInletTemp - (simProps.shellInletTemp - simProps.shellOutletTemp) * progress;
            const y = padding.top + graphHeight - ((temp - minTemp) / tempRange) * graphHeight;
            
            if (i === 0) graphCtx.moveTo(x, y);
            else graphCtx.lineTo(x, y);
        }
        graphCtx.stroke();
        
        // Draw tube temperature profile (cold side)
        graphCtx.strokeStyle = '#0d6efd';
        graphCtx.lineWidth = 3;
        graphCtx.beginPath();
        
        for (let i = 0; i <= 100; i++) {
            const x = padding.left + (graphWidth / 100) * i;
            const progress = i / 100;
            let temp;
            if (simProps.flowType === 'counter') {
                temp = simProps.tubeOutletTemp - (simProps.tubeOutletTemp - simProps.tubeInletTemp) * progress;
            } else {
                temp = simProps.tubeInletTemp + (simProps.tubeOutletTemp - simProps.tubeInletTemp) * progress;
            }
            const y = padding.top + graphHeight - ((temp - minTemp) / tempRange) * graphHeight;
            
            if (i === 0) graphCtx.moveTo(x, y);
            else graphCtx.lineTo(x, y);
        }
        graphCtx.stroke();
        
        // Draw axes
        graphCtx.strokeStyle = '#333';
        graphCtx.lineWidth = 2;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, padding.top);
        graphCtx.lineTo(padding.left, height - padding.bottom);
        graphCtx.lineTo(width - padding.right, height - padding.bottom);
        graphCtx.stroke();
        
        // Y-axis labels (Temperature)
        graphCtx.fillStyle = '#333';
        graphCtx.font = '11px Arial';
        graphCtx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const temp = minTemp + (tempRange / 5) * (5 - i);
            const y = padding.top + (graphHeight / 5) * i;
            graphCtx.fillText(temp.toFixed(0) + '°C', padding.left - 5, y + 4);
        }
        
        // X-axis label
        graphCtx.textAlign = 'center';
        graphCtx.fillText('Length along HX', width / 2, height - 8);
        
        // Y-axis label
        graphCtx.save();
        graphCtx.translate(15, height / 2);
        graphCtx.rotate(-Math.PI / 2);
        graphCtx.fillText('Temperature', 0, 0);
        graphCtx.restore();
        
        // Title
        graphCtx.font = 'bold 12px Arial';
        graphCtx.fillText('Temperature Profile', width / 2, 15);
        
        // Legend
        graphCtx.font = '10px Arial';
        graphCtx.textAlign = 'left';
        
        graphCtx.fillStyle = '#dc3545';
        graphCtx.fillRect(width - 120, 10, 12, 12);
        graphCtx.fillStyle = '#333';
        graphCtx.fillText('Shell (Hot)', width - 105, 20);
        
        graphCtx.fillStyle = '#0d6efd';
        graphCtx.fillRect(width - 120, 26, 12, 12);
        graphCtx.fillStyle = '#333';
        graphCtx.fillText('Tube (Cold)', width - 105, 36);
    }

    function updateRealtimeData() {
        // Calculate LMTD
        const dT1 = simProps.shellInletTemp - (simProps.flowType === 'counter' ? simProps.tubeOutletTemp : simProps.tubeInletTemp);
        const dT2 = simProps.shellOutletTemp - (simProps.flowType === 'counter' ? simProps.tubeInletTemp : simProps.tubeOutletTemp);
        const lmtd = (dT1 - dT2) / Math.log(dT1 / dT2);
        
        // Calculate heat transfer rate (simplified)
        const Cp = simProps.fluidType === 'water' ? 4.18 : (simProps.fluidType === 'oil' ? 2.0 : 2.1);
        const Q = simProps.shellFlowRate * Cp * (simProps.shellInletTemp - simProps.shellOutletTemp);
        
        // Calculate effectiveness
        const Cmin = Math.min(simProps.shellFlowRate * Cp, simProps.tubeFlowRate * 4.18);
        const Qmax = Cmin * (simProps.shellInletTemp - simProps.tubeInletTemp);
        const effectiveness = (Q / Qmax) * 100;
        
        // Update display
        document.getElementById('heatTransferRate').textContent = Q.toFixed(1) + ' kW';
        document.getElementById('lmtdValue').textContent = lmtd.toFixed(1) + ' °C';
        document.getElementById('effectivenessValue').textContent = effectiveness.toFixed(1) + ' %';
        document.getElementById('simTimeValue').textContent = simulationTime.toFixed(1) + ' s';
    }

    function animateSimulation() {
        if (!isSimulationRunning) return;

        const deltaTime = 0.016; // ~60fps
        simulationTime += deltaTime;

        // Redraw the heat exchanger
        drawHeatExchanger();
        
        const bounds = getSimulationBounds();
        
        // Draw heat transfer zones
        drawHeatTransferZones(ctx, bounds);

        // Update and draw all particles
        simulationParticles.forEach(particle => {
            particle.update(deltaTime);
            particle.draw(ctx);
        });
        
        // Draw flow arrows
        drawFlowArrows(ctx, bounds.shell, 'shell');
        drawFlowArrows(ctx, bounds.tubes, 'tube');
        
        // Update temperature graph
        drawTemperatureGraph();
        
        // Update real-time data
        updateRealtimeData();

        // Continue animation
        animationFrameId = requestAnimationFrame(animateSimulation);
    }

    function toggleSimulation() {
        isSimulationRunning = !isSimulationRunning;

        if (isSimulationRunning) {
            simulationButton.textContent = 'Stop Simulation';
            simulationButton.classList.add('simulation-active');
            simulationPanel.style.display = 'flex';
            propertyPanel.style.display = 'none';
            if (simProps.showGraph) {
                graphContainer.style.display = 'block';
            }
            initializeSimulation();
            simulationTime = 0;
            animateSimulation();
        } else {
            stopSimulation();
        }
    }
    
    function stopSimulation() {
        isSimulationRunning = false;
        simulationButton.textContent = 'Start Simulation';
        simulationButton.classList.remove('simulation-active');
        simulationPanel.style.display = 'none';
        graphContainer.style.display = 'none';
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        drawHeatExchanger();
    }
    
    function resetSimulation() {
        simulationTime = 0;
        initializeSimulation();
    }

    // Simulation control listeners
    function setupSimulationControls() {
        // Range inputs
        const rangeInputs = [
            { id: 'flowSpeed', prop: 'flowSpeed', valueId: 'flowSpeedValue', suffix: 'x', toFixed: 1 },
            { id: 'particleDensity', prop: 'particleDensity', valueId: 'particleDensityValue', suffix: '', toFixed: 0, reinit: true },
            { id: 'particleSize', prop: 'particleSize', valueId: 'particleSizeValue', suffix: '', toFixed: 1 }
        ];
        
        rangeInputs.forEach(input => {
            const el = document.getElementById(input.id);
            const valueEl = document.getElementById(input.valueId);
            if (el && valueEl) {
                el.addEventListener('input', (e) => {
                    simProps[input.prop] = parseFloat(e.target.value);
                    valueEl.textContent = simProps[input.prop].toFixed(input.toFixed) + input.suffix;
                    if (input.reinit && isSimulationRunning) {
                        initializeSimulation();
                    }
                });
            }
        });
        
        // Number inputs for temperatures and flow rates
        const numInputs = ['shellInletTemp', 'shellOutletTemp', 'tubeInletTemp', 'tubeOutletTemp', 'shellFlowRate', 'tubeFlowRate'];
        numInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    simProps[id] = parseFloat(e.target.value);
                });
            }
        });
        
        // Checkbox inputs
        const checkboxInputs = ['showTempGradient', 'showFlowDirection', 'showTurbulence', 'showHeatTransfer', 'showGraph'];
        checkboxInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    simProps[id] = e.target.checked;
                    if (id === 'showGraph') {
                        graphContainer.style.display = e.target.checked && isSimulationRunning ? 'block' : 'none';
                    }
                });
            }
        });
        
        // Select inputs
        const flowTypeEl = document.getElementById('flowType');
        if (flowTypeEl) {
            flowTypeEl.addEventListener('change', (e) => {
                simProps.flowType = e.target.value;
                if (isSimulationRunning) {
                    initializeSimulation();
                }
            });
        }
        
        const fluidTypeEl = document.getElementById('fluidType');
        if (fluidTypeEl) {
            fluidTypeEl.addEventListener('change', (e) => {
                simProps.fluidType = e.target.value;
            });
        }
        
        // Reset and Stop buttons
        const resetBtn = document.getElementById('resetSimButton');
        const stopBtn = document.getElementById('stopSimButton');
        if (resetBtn) resetBtn.addEventListener('click', resetSimulation);
        if (stopBtn) stopBtn.addEventListener('click', stopSimulation);
    }

    frontHeadSelect.addEventListener('change', (e) => { selectedFrontType = e.target.value; drawHeatExchanger(); });
    shellSelect.addEventListener('change', (e) => { selectedShellType = e.target.value; drawHeatExchanger(); });
    rearHeadSelect.addEventListener('change', (e) => { selectedRearType = e.target.value; drawHeatExchanger(); });

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    saveButton.addEventListener('click', saveProperties);
    cancelButton.addEventListener('click', hidePopup);

    calculateButton.addEventListener('click', calculateHeatExchanger);
    loadExampleButton.addEventListener('click', loadExampleData);
    simulationButton.addEventListener('click', toggleSimulation);

    closeCalcButton.addEventListener('click', () => {
        calcPopup.style.display = 'none';
    });

    console.log("Running initial setup...");
    setupSimulationControls();
    loadDefaultProperties();
    drawHeatExchanger();
    console.log("Initialization complete.");
});