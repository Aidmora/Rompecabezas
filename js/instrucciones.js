document.addEventListener('DOMContentLoaded', () => {

    const btnBack = document.getElementById('btn-back-home');
    const userTimeDisplay = document.getElementById('user-time-display');
    const userLevelDisplay = document.getElementById('user-level-display');
    const mascotContainer = document.getElementById('global-mascot-container');

    loadUserPreferences();
    loadSavedAvatar();

    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            window.location.href = 'revision.html'; // mismo destino que "Jugar" en el menú
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    function loadSavedAvatar() {
        const savedAvatar = localStorage.getItem('savedAvatarSVG');
        if (savedAvatar && mascotContainer) {
            mascotContainer.innerHTML = savedAvatar;
        }
    }

    function loadUserPreferences() {
        const savedConfig = localStorage.getItem('puzzleConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            if (userTimeDisplay) userTimeDisplay.textContent = getLabel(config.time, 'time');
            if (userLevelDisplay) userLevelDisplay.textContent = getLabel(config.difficulty, 'diff');
        }
    }

    function getLabel(key, type) {
        const dict = {
            diff: { 'easy': 'Fácil', 'medium': 'Medio', 'hard': 'Difícil' },
            time: { 'free': 'Libre', '3min': '3 Min', '5min': '5 Min' }
        };
        return (dict[type] && dict[type][key]) ? dict[type][key] : key;
    }
});
