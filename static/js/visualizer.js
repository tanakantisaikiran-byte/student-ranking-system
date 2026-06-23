// visualizer.js - Interactive Heap Sort Simulator

// Visualizer State
let visStudents = [];
let visSteps = [];
let visCurrentStep = 0;
let visIsPlaying = false;
let visInterval = null;
let visSpeed = 800; // ms per step

// DOM Elements
const visBtnPrev = document.getElementById('vis-btn-prev');
const visBtnPlay = document.getElementById('vis-btn-play');
const visBtnNext = document.getElementById('vis-btn-next');
const visBtnReset = document.getElementById('vis-btn-reset');
const visSpeedInput = document.getElementById('vis-speed');
const visSpeedLabel = document.getElementById('vis-speed-label');
const visProgressFill = document.getElementById('vis-progress-fill');
const visStepCounter = document.getElementById('vis-step-counter');
const visExplanation = document.getElementById('vis-explanation');
const visLogEntries = document.getElementById('vis-log-entries');
const treeCanvas = document.getElementById('tree-canvas');
const barChartContainer = document.getElementById('bar-chart-container');

// Pseudocode DOM mapping
const codeLines = {
    'line-build-heap': document.getElementById('line-build-heap'),
    'line-heap-loop': document.getElementById('line-heap-loop'),
    'line-heapify': document.getElementById('line-heapify'),
    'line-sort-loop': document.getElementById('line-sort-loop'),
    'line-sort-build': document.getElementById('line-sort-build'),
    'line-sort-loop2': document.getElementById('line-sort-loop2'),
    'line-sort-swap': document.getElementById('line-sort-swap'),
    'line-sort-reduce': document.getElementById('line-sort-reduce'),
    'line-sort-heapify': document.getElementById('line-sort-heapify'),
};

// Initialize the visualizer tab with the current database students
window.initVisualizer = function(students) {
    // Clean up active simulation
    pauseSimulation();
    
    // Sort a copy of student list by database id to have a consistent initial order
    visStudents = students.map(s => ({
        id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        total_score: s.total_score,
        average_score: s.average_score
    })).sort((a, b) => a.id - b.id);
    
    if (visStudents.length === 0) {
        visExplanation.innerText = "No student records available to visualize. Add students in the Database tab first.";
        treeCanvas.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-size="14">No data to display. Please add students first.</text>`;
        barChartContainer.innerHTML = '';
        disableControls();
        return;
    }
    
    enableControls();
    generateSimulationSteps();
    resetSimulation();
};

function disableControls() {
    visBtnPrev.disabled = true;
    visBtnPlay.disabled = true;
    visBtnNext.disabled = true;
    visBtnReset.disabled = true;
}

function enableControls() {
    visBtnPrev.disabled = false;
    visBtnPlay.disabled = false;
    visBtnNext.disabled = false;
    visBtnReset.disabled = false;
}

// Event Listeners for Visualizer Controls
visBtnPrev.addEventListener('click', stepBackward);
visBtnNext.addEventListener('click', stepForward);
visBtnReset.addEventListener('click', resetSimulation);
visBtnPlay.addEventListener('click', togglePlay);

visSpeedInput.addEventListener('input', (e) => {
    visSpeed = parseInt(e.target.value);
    visSpeedLabel.innerText = `${(visSpeed / 1000).toFixed(1)}s`;
    
    // If playing, reset interval with new speed
    if (visIsPlaying) {
        clearInterval(visInterval);
        visInterval = setInterval(stepForward, visSpeed);
    }
});

// Step Generator for Heap Sort Simulation
function generateSimulationSteps() {
    visSteps = [];
    const arr = visStudents.map(s => ({ ...s }));
    const n = arr.length;
    let heapSize = n;
    
    // Helper to log step snapshot
    function recordStep(description, activeIndices = [], overrides = {}, line = '') {
        const statuses = Array(n).fill('HEAPIFIED');
        for (let i = heapSize; i < n; i++) {
            statuses[i] = 'SORTED';
        }
        for (const [idx, status] of Object.entries(overrides)) {
            statuses[parseInt(idx)] = status;
        }
        
        visSteps.push({
            arrayState: arr.map(s => ({ ...s })),
            statuses,
            activeIndices,
            description,
            heapSize,
            pseudocodeLine: line
        });
    }

    // Comparison logic matching python backend
    // Ascending order of key: (-total_score, roll_number)
    function compareStudents(a, b) {
        if (a.total_score !== b.total_score) {
            // Higher total_score sorted first (A.score > B.score means keyA < keyB)
            return b.total_score - a.total_score;
        }
        // Roll number alphabetically smaller sorted first
        if (a.roll_number < b.roll_number) return -1;
        if (a.roll_number > b.roll_number) return 1;
        return 0;
    }
    
    // In our Max-Heap implementation for Heap Sort:
    // We want the element that sorts last (largest key, which is lowest score / highest roll)
    // to float to the root so it gets swapped to the end of the array.
    function isGreaterThan(i, j) {
        return compareStudents(arr[i], arr[j]) > 0;
    }

    function heapifyStep(size, i) {
        let largest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        
        recordStep(
            `Checking node at index ${i} (${arr[i].name}) with score ${arr[i].total_score}`, 
            [i], 
            { [i]: 'COMPARING' }, 
            'line-heapify'
        );
        
        if (l < size) {
            recordStep(
                `Comparing root index ${i} (${arr[i].name}) with left child index ${l} (${arr[l].name})`, 
                [i, l], 
                { [i]: 'COMPARING', [l]: 'COMPARING' }, 
                'line-heapify'
            );
            if (isGreaterThan(l, largest)) {
                largest = l;
            }
        }
        
        if (r < size) {
            recordStep(
                `Comparing largest index ${largest} (${arr[largest].name}) with right child index ${r} (${arr[r].name})`, 
                [largest, r], 
                { [largest]: 'COMPARING', [r]: 'COMPARING' }, 
                'line-heapify'
            );
            if (isGreaterThan(r, largest)) {
                largest = r;
            }
        }
        
        if (largest !== i) {
            recordStep(
                `Swapping parent node ${i} (${arr[i].name}) with largest child node ${largest} (${arr[largest].name})`, 
                [i, largest], 
                { [i]: 'SWAPPING', [largest]: 'SWAPPING' }, 
                'line-heapify'
            );
            
            // Swap in array
            const temp = arr[i];
            arr[i] = arr[largest];
            arr[largest] = temp;
            
            recordStep(
                `Swapped. Continuing to heapify down from index ${largest}.`, 
                [i, largest], 
                { [i]: 'SWAPPING', [largest]: 'SWAPPING' }, 
                'line-heapify'
            );
            
            heapifyStep(size, largest);
        } else {
            recordStep(
                `Node at index ${i} is in correct heap position. Heapify completed for this subtree.`, 
                [i], 
                { [i]: 'HEAPIFIED' }, 
                'line-heapify'
            );
        }
    }

    // Step 0: Unsorted initial list
    const initialStatuses = Array(n).fill('UNSORTED');
    visSteps.push({
        arrayState: arr.map(s => ({ ...s })),
        statuses: initialStatuses,
        activeIndices: [],
        description: "Initial list of students loaded in visualizer.",
        heapSize: n,
        pseudocodeLine: 'line-sort-build'
    });

    // 1. Build Max Heap
    recordStep("Starting Max Heap Construction. Heapifying subtrees from last non-leaf node down to root.", [], {}, 'line-build-heap');
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        recordStep(`Entering MaxHeapify for subtree rooted at index ${i}`, [i], { [i]: 'COMPARING' }, 'line-heap-loop');
        heapifyStep(n, i);
    }
    
    recordStep("Max Heap constructed. Root node 0 contains the maximum element (lowest ranked student). Ready to sort.", [], {}, 'line-sort-loop2');

    // 2. Extract elements
    for (let i = n - 1; i > 0; i--) {
        recordStep(
            `Swapping root node 0 (${arr[0].name}) with last unsorted node ${i} (${arr[i].name})`, 
            [0, i], 
            { [0]: 'SWAPPING', [i]: 'SWAPPING' }, 
            'line-sort-swap'
        );
        
        // Swap
        const temp = arr[0];
        arr[0] = arr[i];
        arr[i] = temp;
        
        recordStep(
            `Node ${i} (${arr[i].name}) placed in final sorted position.`, 
            [0, i], 
            { [0]: 'SWAPPING', [i]: 'SORTED' }, 
            'line-sort-swap'
        );
        
        heapSize = i;
        recordStep(`Reducing active heap size to ${heapSize}.`, [], {}, 'line-sort-reduce');
        
        recordStep(`Re-heapifying root subtree to restore max-heap order.`, [0], { [0]: 'COMPARING' }, 'line-sort-heapify');
        heapifyStep(heapSize, 0);
    }
    
    // Final element (index 0) is sorted
    heapSize = 0;
    recordStep("Heap Sort completed! All student records are sorted successfully (Highest Total Score to Lowest).", [], {}, 'line-sort-loop2');
}

// Reset simulation to start
function resetSimulation() {
    pauseSimulation();
    visCurrentStep = 0;
    updateUIForStep();
    
    // Clear log list and add initial entry
    visLogEntries.innerHTML = `<div class="log-entry system-log">Visualizer reset. Total steps generated: ${visSteps.length}</div>`;
}

// Autoplay Simulation toggler
function togglePlay() {
    if (visIsPlaying) {
        pauseSimulation();
    } else {
        startSimulation();
    }
}

function startSimulation() {
    visIsPlaying = true;
    visBtnPlay.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    visBtnPlay.title = "Pause Simulation";
    visInterval = setInterval(stepForward, visSpeed);
}

function pauseSimulation() {
    visIsPlaying = false;
    visBtnPlay.innerHTML = `<i class="fa-solid fa-play"></i>`;
    visBtnPlay.title = "Play Simulation";
    if (visInterval) {
        clearInterval(visInterval);
        visInterval = null;
    }
}

function stepForward() {
    if (visCurrentStep >= visSteps.length - 1) {
        pauseSimulation();
        return;
    }
    visCurrentStep++;
    updateUIForStep();
    logStep(visSteps[visCurrentStep]);
}

function stepBackward() {
    if (visCurrentStep <= 0) return;
    pauseSimulation();
    visCurrentStep--;
    updateUIForStep();
    logStep(visSteps[visCurrentStep]);
}

// Log steps into the visualizer log list
function logStep(step) {
    const entry = document.createElement('div');
    
    // Assign styles based on step types
    let typeClass = 'system-log';
    if (step.description.toLowerCase().includes('compar')) typeClass = 'compare-log';
    else if (step.description.toLowerCase().includes('swap')) typeClass = 'swap-log';
    else if (step.description.toLowerCase().includes('sort completed')) typeClass = 'sorted-log';
    
    entry.className = `log-entry ${typeClass}`;
    entry.innerText = `Step ${visCurrentStep}: ${step.description}`;
    
    visLogEntries.appendChild(entry);
    visLogEntries.scrollTop = visLogEntries.scrollHeight; // Auto scroll to bottom
}

// Synchronize UI elements with current step data
function updateUIForStep() {
    const step = visSteps[visCurrentStep];
    if (!step) return;
    
    // 1. Update Progress Bar
    const progressPercent = (visCurrentStep / (visSteps.length - 1)) * 100;
    visProgressFill.style.width = `${progressPercent}%`;
    visStepCounter.innerText = `Step ${visCurrentStep} / ${visSteps.length - 1}`;
    
    // 2. Update Explanation Box
    visExplanation.innerText = step.description;
    
    // 3. Highlight Pseudocode Line
    Object.values(codeLines).forEach(el => {
        if (el) el.classList.remove('active');
    });
    const activeLine = codeLines[step.pseudocodeLine];
    if (activeLine) activeLine.classList.add('active');
    
    // 4. Render Heap Tree in SVG
    renderHeapTree(step);
    
    // 5. Render Horizontal Bar Chart
    renderBarChart(step);
}

// SVG Tree Rendering Engine
function renderHeapTree(step) {
    const arr = step.arrayState;
    const statuses = step.statuses;
    const n = arr.length;
    
    const svgWidth = treeCanvas.clientWidth || 700;
    const svgHeight = treeCanvas.clientHeight || 380;
    
    treeCanvas.innerHTML = ''; // Clear SVG
    
    // Calculate vertical and horizontal positions of nodes dynamically
    const maxDepth = Math.floor(Math.log2(n));
    const depthGap = (svgHeight - 100) / Math.max(1, maxDepth);
    
    const positions = [];
    
    function calculatePositions(idx, depth, left, right) {
        if (idx >= n) return;
        const x = (left + right) / 2;
        const y = 50 + depth * depthGap;
        positions[idx] = { x, y };
        
        calculatePositions(2 * idx + 1, depth + 1, left, x);
        calculatePositions(2 * idx + 2, depth + 1, x, right);
    }
    
    calculatePositions(0, 0, 40, svgWidth - 40);
    
    // 1. Render Edges (Lines connecting nodes) first so circles draw on top
    for (let i = 1; i < n; i++) {
        const parentIdx = Math.floor((i - 1) / 2);
        const parentPos = positions[parentIdx];
        const childPos = positions[i];
        
        if (parentPos && childPos) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parentPos.x);
            line.setAttribute('y1', parentPos.y);
            line.setAttribute('x2', childPos.x);
            line.setAttribute('y2', childPos.y);
            
            // Edges connecting active heap elements vs sorted elements
            const isChildSorted = statuses[i] === 'SORTED';
            const isParentSorted = statuses[parentIdx] === 'SORTED';
            
            if (isChildSorted || isParentSorted) {
                line.setAttribute('class', 'tree-edge text-muted');
                line.setAttribute('style', 'stroke: rgba(255, 255, 255, 0.05); stroke-dasharray: 4;');
            } else {
                // Highlight line if either index is currently active (comparing/swapping)
                const isActive = step.activeIndices.includes(i) && step.activeIndices.includes(parentIdx);
                if (isActive) {
                    line.setAttribute('class', 'tree-edge active');
                } else {
                    line.setAttribute('class', 'tree-edge');
                }
            }
            
            treeCanvas.appendChild(line);
        }
    }
    
    // 2. Render Nodes (Circles, scores, and details)
    for (let i = 0; i < n; i++) {
        const pos = positions[i];
        if (!pos) continue;
        
        const status = statuses[i];
        const student = arr[i];
        
        // Define color scheme based on state
        let fill = 'var(--color-vis-unsorted)';
        let stroke = 'rgba(255, 255, 255, 0.2)';
        let strokeWidth = '1';
        let filterEffect = '';
        
        if (status === 'COMPARING') {
            fill = 'var(--color-vis-comparing)';
            stroke = '#ffffff';
            strokeWidth = '2.5';
            filterEffect = 'drop-shadow(0px 0px 8px rgba(245, 158, 11, 0.8))';
        } else if (status === 'SWAPPING') {
            fill = 'var(--color-vis-swapping)';
            stroke = '#ffffff';
            strokeWidth = '3';
            filterEffect = 'drop-shadow(0px 0px 10px rgba(239, 68, 68, 0.9))';
        } else if (status === 'HEAPIFIED') {
            fill = 'var(--color-vis-heapified)';
            stroke = 'rgba(99, 102, 241, 0.5)';
            strokeWidth = '1.5';
        } else if (status === 'SORTED') {
            fill = 'var(--color-vis-sorted)';
            stroke = 'rgba(16, 185, 129, 0.4)';
            strokeWidth = '1';
            strokeWidth = '1';
        }
        
        // Group element to hold circle and texts
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '22');
        circle.setAttribute('fill', fill);
        circle.setAttribute('stroke', stroke);
        circle.setAttribute('stroke-width', strokeWidth);
        circle.setAttribute('class', 'tree-node-circle');
        if (filterEffect) circle.setAttribute('style', `filter: ${filterEffect}`);
        
        // Add dynamic tooltip to circle
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `Index [${i}]\nName: ${student.name}\nRoll: ${student.roll_number}\nMarks: ${student.total_score}`;
        circle.appendChild(title);
        
        group.appendChild(circle);
        
        // Node Score Text
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('x', pos.x);
        scoreText.setAttribute('y', pos.y + 4);
        scoreText.setAttribute('class', 'tree-node-text');
        scoreText.textContent = student.total_score;
        group.appendChild(scoreText);
        
        // Node Index Text (rendered above circle)
        const indexText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        indexText.setAttribute('x', pos.x);
        indexText.setAttribute('y', pos.y - 28);
        indexText.setAttribute('class', 'tree-node-index');
        indexText.textContent = `[${i}]`;
        group.appendChild(indexText);
        
        // Node Name label (rendered below circle)
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', pos.x);
        nameText.setAttribute('y', pos.y + 36);
        nameText.setAttribute('class', 'tree-node-name');
        nameText.textContent = truncateString(student.name, 9);
        group.appendChild(nameText);
        
        treeCanvas.appendChild(group);
    }
}

// Array bar representation at bottom of view
function renderBarChart(step) {
    const arr = step.arrayState;
    const statuses = step.statuses;
    const n = arr.length;
    
    // Find maximum marks to normalize heights
    const maxScore = Math.max(...arr.map(s => s.total_score), 1);
    
    barChartContainer.innerHTML = arr.map((student, i) => {
        const status = statuses[i];
        const heightPercent = Math.max((student.total_score / maxScore) * 80, 15); // limit min/max height
        
        // Map status to bar background class
        let bgStyle = 'var(--color-vis-unsorted)';
        if (status === 'COMPARING') bgStyle = 'var(--color-vis-comparing)';
        else if (status === 'SWAPPING') bgStyle = 'var(--color-vis-swapping)';
        else if (status === 'HEAPIFIED') bgStyle = 'var(--color-vis-heapified)';
        else if (status === 'SORTED') bgStyle = 'var(--color-vis-sorted)';
        
        return `
            <div class="vis-bar-wrapper">
                <div class="vis-bar" style="height: ${heightPercent}px; background-color: ${bgStyle};" title="Name: ${escapeTooltip(student.name)}&#10;Index: ${i}&#10;Marks: ${student.total_score}">
                </div>
                <div class="vis-bar-label">${student.total_score}</div>
                <div class="vis-bar-sublabel">[${i}]</div>
            </div>
        `;
    }).join('');
}

// Helpers
function truncateString(str, num) {
    if (!str) return '';
    if (str.length <= num) return str;
    return str.slice(0, num) + '..';
}

function escapeTooltip(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
