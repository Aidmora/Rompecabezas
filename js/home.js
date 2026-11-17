document.addEventListener('DOMContentLoaded', () => {

    loadUserPreferences();
    loadSavedAvatar();

    const btnPlay = document.getElementById('btn-play');
    const btnSettings = document.getElementById('btn-settings');
    const btnInstructions = document.getElementById('btn-instructions');
    const btnExit = document.getElementById('btn-exit');

    const menuButtons = [btnPlay, btnSettings, btnInstructions, btnExit].filter(btn => btn !== null);
    setupArrowNavigation(menuButtons);

    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            window.location.href = 'revision.html';
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            window.location.href = 'ajustes.html';
        });
    }

    if (btnInstructions) {
        btnInstructions.addEventListener('click', () => {
            window.location.href = 'instrucciones.html';
        });
    }

    if (btnExit) {
        btnExit.addEventListener('click', openExitDialog);
    }

    // --- Diálogo propio para salir (reemplaza al confirm() nativo) ---

    const exitOverlay = document.getElementById('exit-overlay');
    const btnExitConfirm = document.getElementById('btn-exit-confirm');
    const btnExitCancel = document.getElementById('btn-exit-cancel');

    // Mientras el diálogo está abierto, el resto de la página queda inerte.
    function setPageInert(isInert) {
        document.querySelectorAll('body > .skip-link, body > header, body > main, body > aside')
            .forEach(el => { el.inert = isInert; });
    }

    function openExitDialog() {
        if (!exitOverlay) return;
        setPageInert(true);
        exitOverlay.classList.remove('hidden');
        exitOverlay.setAttribute('aria-hidden', 'false');
        btnExitCancel.focus(); // el foco empieza en la opción segura
    }

    function closeExitDialog() {
        if (!exitOverlay || exitOverlay.classList.contains('hidden')) return;
        exitOverlay.classList.add('hidden');
        exitOverlay.setAttribute('aria-hidden', 'true');
        setPageInert(false);
        if (btnExit) btnExit.focus();
    }

    if (exitOverlay && btnExitConfirm && btnExitCancel) {
        btnExitCancel.addEventListener('click', closeExitDialog);
        exitOverlay.addEventListener('click', (e) => { if (e.target === exitOverlay) closeExitDialog(); });
        // Escape cancela y Tab no sale del diálogo.
        exitOverlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeExitDialog();
            } else if (e.key === 'Tab') {
                const first = btnExitConfirm, last = btnExitCancel;
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                else if (document.activeElement !== first && document.activeElement !== last) { e.preventDefault(); first.focus(); }
            }
        });
        btnExitConfirm.addEventListener('click', () => {
            window.close();
            document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:20%'>¡Hasta la próxima aventura!</h1>";
            document.body.style.backgroundColor = "#333";
        });
    }

    function setupArrowNavigation(buttons) {
        buttons.forEach((btn, index) => {
            btn.addEventListener('keydown', (e) => {
                if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

                e.preventDefault();
                let newIndex = index;

                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    newIndex = index > 0 ? index - 1 : buttons.length - 1;
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    newIndex = index < buttons.length - 1 ? index + 1 : 0;
                }

                buttons[newIndex].focus();
            });
        });
    }
});

function loadSavedAvatar() {
    const savedAvatar = localStorage.getItem('savedAvatarSVG');
    const mascotContainer = document.getElementById('global-mascot-container');
    
    if (savedAvatar && mascotContainer) {
        mascotContainer.innerHTML = savedAvatar;
    }
}

function loadUserPreferences() {
    const userTimeDisplay = document.getElementById('user-time-display');
    const userLevelDisplay = document.getElementById('user-level-display');

    const savedConfig = localStorage.getItem('puzzleConfig');

    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (userTimeDisplay) userTimeDisplay.textContent = getLabel(config.time, 'time');
        if (userLevelDisplay) userLevelDisplay.textContent = getLabel(config.difficulty, 'diff');
    }
}

function getLabel(key, type) {
    const dict = {
        diff: {
            'easy': 'Fácil',
            'medium': 'Medio',
            'hard': 'Difícil'
        },
        time: {
            'free': 'Libre',
            '3min': '3 Min',
            '5min': '5 Min'
        }
    };
    return (dict[type] && dict[type][key]) ? dict[type][key] : key;
}
