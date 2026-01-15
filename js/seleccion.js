/**
 * Lógica de la Pantalla de Selección de Imagen (seleccion.js)
 * Permite elegir la imagen del rompecabezas y guarda la elección.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Referencias ---
    const btnBack = document.getElementById('btn-back');
    const btnContinue = document.getElementById('btn-continue');
    const imageCards = document.querySelectorAll('.image-card');
    const mascotContainer = document.getElementById('global-mascot-container');
    const mascotText = document.getElementById('mascot-text');
    
    // Panel Superior
    const userTimeDisplay = document.getElementById('user-time-display');
    const userLevelDisplay = document.getElementById('user-level-display');

    let selectedUrl = null;

    // --- Inicialización ---
    loadSavedAvatar();      // Cargar tu personaje
    loadUserPreferences();  // Cargar nivel/tiempo

    // Verificar si ya había una selección previa (al regresar de otra pantalla)
    const previousSelection = localStorage.getItem('selectedPuzzleImage');

    // --- Lógica de las Tarjetas ---
    imageCards.forEach(card => {
        const imgUrl = card.getAttribute('data-img-url');

        // Si esta tarjeta coincide con la guardada, márcala
        if (imgUrl === previousSelection) {
            selectCard(card, imgUrl);
        }

        card.addEventListener('click', () => {
            selectCard(card, imgUrl);
            
            // Feedback del Asistente
            if (mascotText) {
                mascotText.textContent = "¡Excelente elección! Esa imagen quedará genial.";
            }
        });
    });

    /**
     * Marca una tarjeta como seleccionada y actualiza el estado.
     */
    function selectCard(cardElement, url) {
        // 1. Quitar selección visual de todas
        imageCards.forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
        });

        // 2. Marcar la actual
        cardElement.classList.add('selected');
        cardElement.setAttribute('aria-pressed', 'true');

        // 3. Actualizar variable y guardar en LocalStorage (CRÍTICO)
        selectedUrl = url;
        localStorage.setItem('selectedPuzzleImage', selectedUrl);

        // 4. Habilitar botón continuar
        if (btnContinue) {
            btnContinue.removeAttribute('disabled');
            btnContinue.setAttribute('aria-disabled', 'false');
        }
    }

    // --- Botones de Navegación ---

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            // Regresar a la revisión de detalles
            window.location.href = 'revision.html';
        });
    }

    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            if (selectedUrl) {
                window.location.href = 'juego.html';
            }
        });
    }

    // --- Funciones Auxiliares (Reutilizadas para consistencia) ---

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