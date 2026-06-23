// app.js - Frontend Logic and API Interaction

// State Variables
let studentsState = [];
let branchesState = new Set();
let editStudentId = null;

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

// Stats Elements
const statTotalStudents = document.getElementById('stat-total-students');
const statTopRanker = document.getElementById('stat-top-ranker');
const statTopScore = document.getElementById('stat-top-score');
const statClassAverage = document.getElementById('stat-class-average');

// Table Bodies
const rankingsTbody = document.getElementById('rankings-tbody');
const studentsTbody = document.getElementById('students-tbody');

// Forms & Modals
const studentModal = document.getElementById('student-modal');
const studentForm = document.getElementById('student-form');
const modalTitle = document.getElementById('modal-title');
const studentIdInput = document.getElementById('student-id');
const studentNameInput = document.getElementById('student-name');
const studentRollInput = document.getElementById('student-roll');
const studentBranchInput = document.getElementById('student-branch');
const studentYearSelect = document.getElementById('student-year');
const subjectRowsContainer = document.getElementById('subject-rows-container');
const subjectEmptyMsg = document.getElementById('subject-empty-msg');

// Buttons
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const btnAddSubjectRow = document.getElementById('btn-add-subject-row');
const btnExportCSV = document.getElementById('btn-export-csv');
const btnExportPDF = document.getElementById('btn-export-pdf');

// Search & Filter Inputs
const searchStudentInput = document.getElementById('search-student');
const filterStudentBranchSelect = document.getElementById('filter-student-branch');
const filterStudentYearSelect = document.getElementById('filter-student-year');
const filterRankBranchSelect = document.getElementById('filter-rank-branch');
const filterRankYearSelect = document.getElementById('filter-rank-year');

// Toast notifications container
const toastContainer = document.getElementById('toast-container');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupTabNavigation();
    setupEventListeners();
    loadAllData();
}

// 1. Tab Navigation Setup
function setupTabNavigation() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // If switched to visualizer, initialize or refresh visualizer data
            if (targetTab === 'visualizer-tab' && typeof initVisualizer === 'function') {
                initVisualizer(studentsState);
            }
        });
    });
}

// 2. Event Listeners Setup
function setupEventListeners() {
    // Modal controls
    btnOpenAddModal.addEventListener('click', () => openModal());
    btnCloseModal.addEventListener('click', () => closeModal());
    btnCancelModal.addEventListener('click', () => closeModal());
    btnAddSubjectRow.addEventListener('click', () => addSubjectRow());
    
    studentForm.addEventListener('submit', handleFormSubmit);
    
    // Live Search & Filtering
    searchStudentInput.addEventListener('input', renderStudentsTable);
    filterStudentBranchSelect.addEventListener('change', renderStudentsTable);
    filterStudentYearSelect.addEventListener('change', renderStudentsTable);
    
    filterRankBranchSelect.addEventListener('change', renderRankingsTable);
    filterRankYearSelect.addEventListener('change', renderRankingsTable);
    
    // Export buttons
    btnExportCSV.addEventListener('click', exportToCSV);
    btnExportPDF.addEventListener('click', exportToPDF);
}

// 3. Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    if (type === 'info') iconClass = 'fa-circle-info';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate removal
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 4. API Requests
async function loadAllData() {
    try {
        const response = await fetch('/api/students');
        if (!response.ok) throw new Error('Failed to fetch students.');
        
        const data = await response.json();
        studentsState = data;
        
        // Recalculate unique branches
        branchesState.clear();
        data.forEach(student => {
            if (student.branch) branchesState.add(student.branch);
        });
        
        populateBranchFilters();
        updateDashboardStats();
        renderStudentsTable();
        renderRankingsTable();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function populateBranchFilters() {
    const branchOptions = Array.from(branchesState).sort();
    
    // Keep the default first "All Branches" option
    const studentDefaultOption = filterStudentBranchSelect.options[0].outerHTML;
    const rankDefaultOption = filterRankBranchSelect.options[0].outerHTML;
    
    let optionsHTML = branchOptions.map(branch => `<option value="${branch}">${branch}</option>`).join('');
    
    filterStudentBranchSelect.innerHTML = studentDefaultOption + optionsHTML;
    filterRankBranchSelect.innerHTML = rankDefaultOption + optionsHTML;
}

// 5. Dashboard Stats calculations
function updateDashboardStats() {
    statTotalStudents.innerText = studentsState.length;
    
    if (studentsState.length === 0) {
        statTopRanker.innerText = 'N/A';
        statTopScore.innerText = '-';
        statClassAverage.innerText = '0.0';
        return;
    }
    
    // Find top ranker (rank 1)
    const topRanker = studentsState.find(s => s.rank === 1);
    if (topRanker) {
        statTopRanker.innerText = topRanker.name;
        statTopScore.innerText = `Roll: ${topRanker.roll_number} | Marks: ${topRanker.total_score}`;
    } else {
        statTopRanker.innerText = 'N/A';
        statTopScore.innerText = '-';
    }
    
    // Class average marks
    const totalMarksSum = studentsState.reduce((sum, s) => sum + s.total_score, 0);
    const average = totalMarksSum / studentsState.length;
    statClassAverage.innerText = average.toFixed(2);
}

// 6. Rendering Tables
function renderStudentsTable() {
    const searchQuery = searchStudentInput.value.toLowerCase().trim();
    const filterBranch = filterStudentBranchSelect.value;
    const filterYear = filterStudentYearSelect.value;
    
    const filtered = studentsState.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery) || s.roll_number.toLowerCase().includes(searchQuery);
        const matchesBranch = filterBranch === '' || s.branch === filterBranch;
        const matchesYear = filterYear === '' || s.year.toString() === filterYear;
        return matchesSearch && matchesBranch && matchesYear;
    });
    
    if (filtered.length === 0) {
        studentsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No student records found matching the criteria.</td>
            </tr>
        `;
        return;
    }
    
    studentsTbody.innerHTML = filtered.map(s => {
        // Create tooltip/pill display for dynamic subjects
        const subjectPills = s.subjects && s.subjects.length > 0 
            ? s.subjects.map(sub => `<span class="subject-pill">${sub.subject_name}: ${sub.score}</span>`).join('')
            : '<span class="text-muted">No subjects</span>';
            
        return `
            <tr>
                <td><strong>${escapeHtml(s.roll_number)}</strong></td>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.branch)}</td>
                <td>${s.year} Year</td>
                <td>
                    <div class="subject-pills">${subjectPills}</div>
                </td>
                <td><strong>${s.total_score}</strong></td>
                <td class="actions-cell">
                    <button class="action-btn edit" onclick="openEditModal(${s.id})" title="Edit Student">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn delete" onclick="handleDeleteClick(${s.id}, '${escapeHtml(s.name)}')" title="Delete Student">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRankingsTable() {
    const filterBranch = filterRankBranchSelect.value;
    const filterYear = filterRankYearSelect.value;
    
    // Ranks are fetched pre-sorted from database
    const filtered = studentsState.filter(s => {
        const matchesBranch = filterBranch === '' || s.branch === filterBranch;
        const matchesYear = filterYear === '' || s.year.toString() === filterYear;
        return matchesBranch && matchesYear;
    });
    
    if (filtered.length === 0) {
        rankingsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No student rankings found matching the criteria.</td>
            </tr>
        `;
        return;
    }
    
    rankingsTbody.innerHTML = filtered.map(s => {
        let rankBadgeClass = 'rank-default';
        if (s.rank === 1) rankBadgeClass = 'rank-gold';
        else if (s.rank === 2) rankBadgeClass = 'rank-silver';
        else if (s.rank === 3) rankBadgeClass = 'rank-bronze';
        
        return `
            <tr>
                <td><span class="rank-badge ${rankBadgeClass}">${s.rank}</span></td>
                <td><strong>${escapeHtml(s.roll_number)}</strong></td>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.branch)}</td>
                <td>${s.year} Year</td>
                <td><strong>${s.total_score}</strong></td>
                <td>${s.average_score.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

// 7. Modal Form Handlers
function openModal(isEdit = false) {
    studentModal.classList.add('active');
    subjectRowsContainer.innerHTML = '';
    editStudentId = null;
    
    if (!isEdit) {
        modalTitle.innerText = 'Add New Student';
        studentIdInput.value = '';
        studentForm.reset();
        toggleSubjectEmptyMessage();
    }
}

function closeModal() {
    studentModal.classList.remove('active');
    studentForm.reset();
    editStudentId = null;
}

function toggleSubjectEmptyMessage() {
    if (subjectRowsContainer.children.length === 0) {
        subjectEmptyMsg.style.display = 'block';
    } else {
        subjectEmptyMsg.style.display = 'none';
    }
}

function addSubjectRow(name = '', score = '') {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
        <input type="text" placeholder="Subject Name (e.g. Mathematics)" required value="${escapeHtml(name)}" class="subject-name-input">
        <input type="number" placeholder="Marks (0-100)" required min="0" max="100" step="0.5" value="${score}" class="subject-score-input">
        <button type="button" class="btn btn-danger btn-sm remove-row-btn" onclick="removeSubjectRow(this)">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    subjectRowsContainer.appendChild(row);
    toggleSubjectEmptyMessage();
}

// Window scoped helper to delete subject row
window.removeSubjectRow = function(btn) {
    btn.parentElement.remove();
    toggleSubjectEmptyMessage();
};

window.openEditModal = function(id) {
    const student = studentsState.find(s => s.id === id);
    if (!student) return;
    
    openModal(true);
    modalTitle.innerText = 'Edit Student Details';
    editStudentId = id;
    studentIdInput.value = id;
    studentNameInput.value = student.name;
    studentRollInput.value = student.roll_number;
    studentBranchInput.value = student.branch;
    studentYearSelect.value = student.year;
    
    // Load subjects
    if (student.subjects && student.subjects.length > 0) {
        student.subjects.forEach(sub => {
            addSubjectRow(sub.subject_name, sub.score);
        });
    }
    toggleSubjectEmptyMessage();
};

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = studentNameInput.value.trim();
    const roll_number = studentRollInput.value.trim();
    const branch = studentBranchInput.value.trim();
    const year = parseInt(studentYearSelect.value);
    
    // Gather subjects
    const subjects = [];
    const rows = subjectRowsContainer.querySelectorAll('.subject-row');
    let hasValidationError = false;
    
    rows.forEach(row => {
        const subject_name = row.querySelector('.subject-name-input').value.trim();
        const score = parseFloat(row.querySelector('.subject-score-input').value);
        
        if (!subject_name) {
            hasValidationError = true;
            return;
        }
        if (isNaN(score) || score < 0 || score > 100) {
            hasValidationError = true;
            return;
        }
        
        subjects.push({ subject_name, score });
    });
    
    if (hasValidationError) {
        showToast('Please correct subject name/score validations.', 'error');
        return;
    }
    
    const payload = { name, roll_number, branch, year, subjects };
    
    try {
        const url = editStudentId ? `/api/students/${editStudentId}` : '/api/students';
        const method = editStudentId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
            throw new Error(resData.error || 'Failed to save student.');
        }
        
        showToast(editStudentId ? 'Student updated successfully.' : 'Student added successfully.');
        closeModal();
        loadAllData(); // Reload ranks and list
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.handleDeleteClick = async function(id, name) {
    if (!confirm(`Are you sure you want to delete student: ${name}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/students/${id}`, {
            method: 'DELETE'
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
            throw new Error(resData.error || 'Failed to delete student.');
        }
        
        showToast('Student deleted successfully.');
        loadAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// 8. CSV & PDF Exports
function exportToCSV() {
    const filterBranch = filterRankBranchSelect.value;
    const filterYear = filterRankYearSelect.value;
    
    const filtered = studentsState.filter(s => {
        const matchesBranch = filterBranch === '' || s.branch === filterBranch;
        const matchesYear = filterYear === '' || s.year.toString() === filterYear;
        return matchesBranch && matchesYear;
    });
    
    if (filtered.length === 0) {
        showToast('No rankings data available to export.', 'info');
        return;
    }
    
    // CSV Header matching layout: Rank | Roll Number | Name | Branch | Year | Total Marks | Average Marks
    let csvContent = 'Rank,Roll Number,Name,Branch,Year,Total Marks,Average Marks\n';
    
    filtered.forEach(s => {
        const row = [
            s.rank,
            `"${s.roll_number.replace(/"/g, '""')}"`,
            `"${s.name.replace(/"/g, '""')}"`,
            `"${s.branch.replace(/"/g, '""')}"`,
            `"${s.year} Year"`,
            s.total_score,
            s.average_score.toFixed(2)
        ];
        csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Student_Rankings_${filterBranch || 'All'}_Year_${filterYear || 'All'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rankings exported as CSV file.');
}

function exportToPDF() {
    if (studentsState.length === 0) {
        showToast('No rankings data available to print.', 'info');
        return;
    }
    
    // Set statistics in the hidden print header
    document.getElementById('print-report-date').innerText = `Generated on: ${new Date().toLocaleString()}`;
    document.getElementById('print-stat-total').innerText = statTotalStudents.innerText;
    document.getElementById('print-stat-avg').innerText = statClassAverage.innerText;
    
    const topRanker = studentsState.find(s => s.rank === 1);
    document.getElementById('print-stat-top').innerText = topRanker ? `${topRanker.name} (${topRanker.total_score} marks)` : 'N/A';
    
    // Open Print Dialog
    window.print();
}

// 9. General Helpers
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
