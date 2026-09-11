/**
 * Utility Functions
 * Shared utility functions for the application
 */

/**
 * Get CSRF token from multiple sources
 * @returns {string} - CSRF token
 * @throws {Error} - If token not found
 */
function getCsrfToken() {
    // Método 1: Variável global
    if (typeof csrfToken !== 'undefined') {
        return csrfToken;
    }
    
    // Método 2: Meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        return meta.getAttribute('content');
    }
    
    // Método 3: Input hidden
    const input = document.querySelector('input[name="_csrf"]');
    if (input) {
        return input.value;
    }
    
    throw new Error('CSRF token não encontrado');
}

/**
 * Validators object for form validation
 */
const validators = {
    required: (val) => val !== null && val !== undefined && val !== '' && val.toString().trim() !== '',
    number: (val) => !isNaN(parseFloat(val)),
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    minLength: (min) => (val) => val && val.length >= min,
    maxLength: (max) => (val) => !val || val.length <= max,
    positive: (val) => parseFloat(val) > 0,
    matches: (pattern) => (val) => pattern.test(val),
};

/**
 * Validate a form field
 * @param {string} value - Value to validate
 * @param {array} rules - Array of validation rules
 * @returns {object} - { isValid: boolean, errors: [] }
 */
function validateField(value, rules = []) {
    const errors = [];
    
    for (const rule of rules) {
        if (typeof rule === 'function') {
            if (!rule(value)) {
                errors.push('Validação falhou');
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Make a fetch request with CSRF token and error handling
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise} - JSON response
 */
async function apiCall(url, options = {}) {
    try {
        // Adicionar CSRF token automaticamente
        const csrfToken = getCsrfToken();
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        console.error('API call error:', error);
        showToast(`Erro: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Display a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', or 'warning'
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Show a modal confirmation dialog
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {function} onConfirm - Callback when confirmed
 */
function showModal(title, message, onConfirm) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalClose = document.querySelector('.modal-close');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    const closeModal = () => {
        modal.classList.remove('show');
    };

    modalClose.onclick = closeModal;
    modalCancel.onclick = closeModal;
    
    modalConfirm.onclick = () => {
        closeModal();
        onConfirm();
    };

    modal.classList.add('show');
}

/**
 * Format a date to Brazilian format (DD/MM/YYYY)
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format time in HH:MM format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted time
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Debounce a function
 * @param {function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Calculate macros totals
 * @param {array} foods - Array of food objects
 * @returns {object} - Totals object
 */
function calculateMacros(foods) {
    return foods.reduce(
        (acc, food) => ({
            calories: acc.calories + (food.calories || 0),
            protein: acc.protein + (food.protein || 0),
            carbs: acc.carbs + (food.carbs || 0),
            fat: acc.fat + (food.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}
