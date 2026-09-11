/**
 * Theme Enhancement - Tema Empresarial Preto e Laranja
 * Adiciona animações, refinamentos visuais e interatividade
 */

(function() {
    'use strict';

    // ========================
    // INICIALIZAÇÃO DO TEMA
    // ========================

    document.addEventListener('DOMContentLoaded', function() {
        initThemeEnhancements();
        initToastFunctionality();
        initModalEnhancements();
        initButtonEffects();
        initFormEnhancements();
    });

    // ========================
    // ENHANCEMENTS GERAIS
    // ========================

    function initThemeEnhancements() {
        // Adicionar classes ao documento
        document.documentElement.style.colorScheme = 'dark';
        
        // Prevenir flickering
        document.body.style.opacity = '1';
        
        // Smooth scroll
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    // ========================
    // TOAST NOTIFICATIONS
    // ========================

    function initToastFunctionality() {
        // Expor função global
        window.showToast = function(message, type = 'info', duration = 4000) {
            const toastEl = document.getElementById('toast');
            if (!toastEl) return;

            toastEl.textContent = message;
            toastEl.className = `toast show ${type}`;

            setTimeout(() => {
                toastEl.classList.remove('show');
            }, duration);
        };
    }

    // ========================
    // MODAL ENHANCEMENTS
    // ========================

    function initModalEnhancements() {
        const modal = document.getElementById('modal');
        const modalClose = document.querySelector('.modal-close');
        const modalCancel = document.getElementById('modalCancel');

        if (!modal) return;

        // Close on X click
        if (modalClose) {
            modalClose.addEventListener('click', () => closeModal());
        }

        // Close on Cancel
        if (modalCancel) {
            modalCancel.addEventListener('click', () => closeModal());
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeModal();
            }
        });
    }

    window.showConfirmation = function(title, message, callback) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirm = document.getElementById('modalConfirm');

        if (!modal) return;

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Remove old handlers
        const newConfirm = modalConfirm.cloneNode(true);
        modalConfirm.parentNode.replaceChild(newConfirm, modalConfirm);
        
        newConfirm.addEventListener('click', () => {
            callback(true);
            closeModal();
        });

        modal.classList.add('show');
    };

    function closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    window.closeModal = closeModal;

    // ========================
    // BUTTON EFFECTS
    // ========================

    function initButtonEffects() {
        const buttons = document.querySelectorAll('.btn');
        
        buttons.forEach(btn => {
            // 🔧 Verificar se já foi processado para evitar memory leak
            if (btn.dataset.themeEnhanced === 'true') return;
            btn.dataset.themeEnhanced = 'true';
            
            // Ripple effect
            btn.addEventListener('click', function(e) {
                // Criar ripple apenas para clicks válidos
                if (this.disabled) return;
                
                addRippleEffect(e, this);
            });

            // Focus states
            btn.addEventListener('focus', function() {
                if (!this.disabled) {
                    this.style.outline = 'none';
                }
            });
        });
    }

    function addRippleEffect(event, element) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        ripple.addEventListener('animationend', () => ripple.remove());
        element.appendChild(ripple);
    }

    // ========================
    // FORM ENHANCEMENTS
    // ========================

    function initFormEnhancements() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea, select');
        
        inputs.forEach(input => {
            // 🔧 Verificar se já foi processado
            if (input.dataset.themeEnhanced === 'true') return;
            input.dataset.themeEnhanced = 'true';
            
            // Focus outline refinement
            input.addEventListener('focus', function() {
                this.style.outline = 'none';
            });

            // Blur refinement
            input.addEventListener('blur', function() {
                this.style.outline = 'none';
            });

            // Placeholder enhancement
            if (input.placeholder) {
                input.style.transition = 'all 150ms ease';
            }
        });
    }

    // ========================
    // UTILITY FUNCTIONS
    // ========================

    window.animate = function(element, animation, duration = 300) {
        return new Promise(resolve => {
            element.style.animation = `${animation} ${duration}ms ease-in-out forwards`;
            setTimeout(() => {
                element.style.animation = '';
                resolve();
            }, duration);
        });
    };

    // Preflight animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s ease-out forwards;
            pointer-events: none;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Log de inicialização (comentado em produção)
    console.log('🎨 Tema Empresarial Preto & Laranja ativado');

})();
