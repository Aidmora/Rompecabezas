document.addEventListener('DOMContentLoaded', () => {
    
    const boardElement = document.getElementById('puzzle-board');
    const workspaceElement = document.getElementById('game-workspace');
    const scatteredLayer = document.getElementById('scattered-layer');
    const gameInstruction = document.getElementById('game-instruction');
    const mascotText = document.getElementById('mascot-text');
    const moveCountDisplay = document.getElementById('move-count');
    const timerDisplay = document.getElementById('timer');
    const btnMenuToggle = document.getElementById('btn-menu-toggle');
    const btnMenuClose = document.getElementById('btn-menu-close');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const btnPause = document.getElementById('btn-pause');
    const btnBackMenu = document.getElementById('btn-back-menu');
    const btnCancelGame = document.getElementById('btn-cancel-game');
    const btnHelp = document.getElementById('btn-help');
    const btnCheck = document.getElementById('btn-check');
    const victoryModal = document.getElementById('victory-modal');
    const finalTimeDisplay = document.getElementById('final-time');
    const finalMovesDisplay = document.getElementById('final-moves');
    const btnReplay = document.getElementById('btn-replay');
    const btnMenu = document.getElementById('btn-menu');

    let config = { size: 3, difficulty: 'easy', time: 'free', stimuli: 'visual' };
    let imageSrc = '';
    let moves = 0;
    // Cronómetro: tiempo acumulado que solo avanza mientras el juego está en marcha.
    let elapsedMs = 0;
    let lastTick = null;      // null = cronómetro detenido
    let timeLimit = null;     // segundos; null = modo libre
    let warningsGiven = 0;    // cuántos avisos de TIME_WARNINGS ya se dieron
    let slots = [];           // casillas del tablero en orden (fila por fila)
    let isPaused = false;
    const TIME_WARNINGS = [30, 10]; // segundos restantes en los que se avisa (modo cronometrado)
    let timerInterval;
    let hintsUsed = 0;
    let pointerState = null;
    let gameEnded = false;
    const DRAG_THRESHOLD = 10; // px que debe moverse el dedo para contar como arrastre y no como toque
    const CAN_DRAG = () => config.difficulty !== 'easy';
    const CAN_ROTATE = () => config.difficulty !== 'medium';
    let selectedPieceForSwap = null;
    let totalPieces = 0;
    let idleTimer;
    let boardWidth, boardHeight;

    initGame();
    loadSavedAvatar(); 

    function initGame() {
        const savedConfig = localStorage.getItem('puzzleConfig');
        if (savedConfig) config = JSON.parse(savedConfig);
        
        imageSrc = localStorage.getItem('selectedPuzzleImage') || 'assets/images/perro.jpg'; 

        setupReferenceImage();

        requestAnimationFrame(() => {
            setupBoardDimensions();
            generatePuzzle();
            startTimer();
            resetIdleTimer();
        });

        window.addEventListener('resize', setupBoardDimensions);
    }

    // Imagen de referencia (RF6): miniatura siempre visible y vista ampliada en un diálogo.
    function setupReferenceImage() {
        const thumb = document.getElementById('reference-thumb');
        const full = document.getElementById('reference-full');
        const btnReference = document.getElementById('btn-reference');
        const overlay = document.getElementById('reference-overlay');
        const btnClose = document.getElementById('btn-reference-close');
        if (!thumb || !full || !btnReference || !overlay || !btnClose) return;

        thumb.src = imageSrc;
        full.src = imageSrc;

        btnReference.addEventListener('click', openReference);
        btnClose.addEventListener('click', closeReference);
        // Tocar el fondo oscuro también cierra.
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeReference(); });

        trapModalKeys(overlay, closeReference);
    }

    // Patrón común de los modales: Escape ejecuta onEscape (si existe) y Tab no sale del diálogo.
    function trapModalKeys(overlay, onEscape) {
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (onEscape) onEscape();
            } else if (e.key === 'Tab') {
                const focusables = overlay.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (!Array.from(focusables).includes(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    // Mientras hay un diálogo abierto, el resto de la página queda inerte:
    // ni el teclado ni el lector de pantalla pueden salir del diálogo.
    function setPageInert(isInert) {
        document.querySelectorAll('body > .skip-link, body > header, body > main, body > aside')
            .forEach(el => { el.inert = isInert; });
    }

    function showOverlay(overlay, focusTarget) {
        setPageInert(true);
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        if (focusTarget) focusTarget.focus();
    }

    function hideOverlay(overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        setPageInert(false);
    }

    // --- Pausa: congela el cronómetro y muestra un modal accesible ---

    const pauseOverlay = document.getElementById('pause-overlay');
    const btnResume = document.getElementById('btn-resume');
    if (pauseOverlay && btnResume) {
        btnResume.addEventListener('click', resumeGame);
        trapModalKeys(pauseOverlay, resumeGame);
    }

    function pauseGame() {
        if (isPaused || gameEnded || !pauseOverlay) return;
        isPaused = true;
        stopTimer();
        clearTimeout(idleTimer);
        stopAssistantVoice();
        setListenButton(false);
        closeReference(false);
        if (!sideMenuOverlay.classList.contains('hidden')) closeSideMenu();
        showOverlay(pauseOverlay, btnResume);
        announceToScreenReader('Juego en pausa. El tiempo está detenido.');
    }

    function resumeGame() {
        if (!isPaused) return;
        isPaused = false;
        hideOverlay(pauseOverlay);
        if (btnMenuToggle) btnMenuToggle.focus();
        startTimer();
        resetIdleTimer();
        announceToScreenReader('¡Seguimos jugando!');
    }

    // --- Tiempo agotado (modo cronometrado) ---

    const timeoutOverlay = document.getElementById('timeout-overlay');
    const btnTimeoutRetry = document.getElementById('btn-timeout-retry');
    const btnTimeoutMenu = document.getElementById('btn-timeout-menu');
    if (timeoutOverlay) trapModalKeys(timeoutOverlay, null);
    if (btnTimeoutRetry) btnTimeoutRetry.addEventListener('click', () => location.reload());
    const btnTimeoutOther = document.getElementById('btn-timeout-other');
    if (btnTimeoutOther) btnTimeoutOther.addEventListener('click', () => window.location.href = 'seleccion.html');
    if (btnTimeoutMenu) btnTimeoutMenu.addEventListener('click', () => window.location.href = 'index.html');

    function handleTimeUp() {
        if (gameEnded) return;
        gameEnded = true;
        stopTimer();
        clearTimeout(idleTimer);
        if (pointerState) endPointerInteraction();
        closeReference(false);
        if (!sideMenuOverlay.classList.contains('hidden')) closeSideMenu();

        const placed = document.querySelectorAll('.puzzle-piece.correct').length;
        const summary = `Colocaste ${placed} de ${totalPieces} piezas. ¡Buen trabajo!`;
        const summaryEl = document.getElementById('timeout-summary');
        if (summaryEl) summaryEl.textContent = summary;

        if (timeoutOverlay) showOverlay(timeoutOverlay, btnTimeoutRetry);
        assistantSay('¡Se acabó el tiempo! Lo hiciste muy bien.');
        announceToScreenReader(`Se acabó el tiempo. ${summary} ¿Quieres intentarlo otra vez?`);
    }

    function isReferenceOpen() {
        const overlay = document.getElementById('reference-overlay');
        return !!overlay && !overlay.classList.contains('hidden');
    }

    function openReference() {
        const overlay = document.getElementById('reference-overlay');
        if (!overlay || gameEnded) return;
        resetIdleTimer();
        showOverlay(overlay, document.getElementById('btn-reference-close'));
        speakAssistant('Así debe quedar.');
        announceToScreenReader('Imagen de referencia abierta. Así debe quedar el rompecabezas. Presiona Escape para cerrar.');
    }

    function closeReference(restoreFocus = true) {
        const overlay = document.getElementById('reference-overlay');
        if (!overlay || !isReferenceOpen()) return;
        hideOverlay(overlay);
        const btnReference = document.getElementById('btn-reference');
        if (restoreFocus && btnReference) btnReference.focus();
    }

    // Puntaje (RF9): 100 puntos por pieza, menos 2 por movimiento, 1 por segundo y 20 por pista,
    // multiplicado según la dificultad. Nunca baja de 10 puntos por pieza.
    function calculateScore(seconds) {
        const multiplier = { easy: 1, medium: 1.5, hard: 2 }[config.difficulty] || 1;
        const base = totalPieces * 100 - moves * 2 - seconds - hintsUsed * 20;
        return Math.round(Math.max(totalPieces * 10, base) * multiplier);
    }

    function setupBoardDimensions() {
        const container = document.querySelector('.board-area');
        if (!container) return;

        // Se mide con el tablero plegado: así la tarjeta (que ahora puede crecer con su
        // contenido) no hereda el tamaño anterior al achicar la ventana.
        workspaceElement.style.width = '0px';
        workspaceElement.style.height = '0px';

        const availWidth = container.clientWidth - 40;
        const availHeight = container.clientHeight - 140; // deja sitio a la fila de botones sin forzar scroll
        
        let size = Math.min(availWidth, availHeight);
        size = Math.max(280, Math.min(size, 800));

        workspaceElement.style.width = `${size}px`;
        workspaceElement.style.height = `${size}px`;
        
        boardWidth = size;
        boardHeight = size;

        boardElement.style.gridTemplateColumns = `repeat(${config.size}, 1fr)`;
        boardElement.style.gridTemplateRows = `repeat(${config.size}, 1fr)`;
        
        document.documentElement.style.setProperty('--board-width', `${size}px`);
        document.documentElement.style.setProperty('--board-height', `${size}px`);
    }

    function generatePuzzle() {
        totalPieces = config.size * config.size;
        
        const pieceWPercent = 100 / (config.size - 1);
        const pieceHPercent = 100 / (config.size - 1);

        boardElement.innerHTML = '';
        scatteredLayer.innerHTML = '';
        let piecesArray = [];

        if (config.difficulty === 'easy') {
            gameInstruction.textContent = "Nivel Fácil";
            assistantSay("Las piezas están giradas. ¡Tócalas para arreglarlas!");
            announceToScreenReader("Nivel Fácil. Las piezas están giradas. Presiona Enter o Espacio para girarlas.");
        } else if (config.difficulty === 'medium') {
            gameInstruction.textContent = "Nivel Medio";
            assistantSay("Arrastra las piezas, o toca una y luego toca su lugar.");
            announceToScreenReader("Nivel Medio. Usa las flechas para navegar entre piezas. Presiona Enter para seleccionar una pieza, navega a otra y presiona Enter para intercambiarlas.");
        } else {
            gameInstruction.textContent = "Nivel Difícil";
            if (btnTapMode) btnTapMode.classList.remove('hidden'); // solo aquí el toque tiene dos usos
            assistantSay("Pon las piezas en su sitio y tócalas para girarlas.");
            announceToScreenReader("Nivel Difícil. Usa las flechas para navegar. Presiona Enter para seleccionar e intercambiar piezas. Presiona R para girar.");
        }

        // Estructura de cuadrícula accesible: grid > row > gridcell. Las filas usan
        // display: contents, así que el diseño (CSS grid) no cambia.
        slots = [];
        for (let r = 0; r < config.size; r++) {
            const rowEl = document.createElement('div');
            rowEl.classList.add('board-row');
            rowEl.setAttribute('role', 'row');
            for (let c = 0; c < config.size; c++) {
                const slot = document.createElement('div');
                slot.classList.add('drop-zone');
                slot.setAttribute('role', 'gridcell');
                slot.dataset.index = slots.length;
                rowEl.appendChild(slot);
                slots.push(slot);
            }
            boardElement.appendChild(rowEl);
        }

        for (let i = 0; i < totalPieces; i++) {
            const row = Math.floor(i / config.size);
            const col = i % config.size;

            const piece = document.createElement('div');
            piece.classList.add('puzzle-piece');
            piece.id = `piece-${i}`;
            piece.dataset.correctIndex = i;
            
            piece.style.backgroundImage = `url('${imageSrc}')`;
            piece.style.backgroundPosition = `${col * pieceWPercent}% ${row * pieceHPercent}%`;
            piece.style.width = '100%';
            piece.style.height = '100%';

            if (config.difficulty === 'easy') {
                let randomRot = (Math.floor(Math.random() * 3) + 1) * 90;
                piece.dataset.currentRotation = randomRot;
                piece.style.transform = `rotate(${randomRot}deg)`;

                piece.classList.add('clickable');
                enablePointerControls(piece);

                piece.setAttribute('tabindex', '-1');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleKeyboardRotate);
                piece.addEventListener('keydown', handleArrowNavigation);

                if (i === 0) addVisualCue(piece, 'tap');
                slots[i].appendChild(piece);
                updatePieceAriaLabel(piece, i, randomRot);
            }
            else if (config.difficulty === 'medium') {
                piece.dataset.currentRotation = 0;
                enablePointerControls(piece);

                piece.setAttribute('tabindex', '-1');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleArrowNavigation);
                piece.addEventListener('keydown', handleKeyboardSwap);
                piece.setAttribute('aria-pressed', 'false'); // true mientras está seleccionada para intercambiar

                if (i === 0) addVisualCue(piece, 'drag');
                piecesArray.push(piece);
            }
            else if (config.difficulty === 'hard') {
                let randomRot = Math.floor(Math.random() * 4) * 90;
                piece.dataset.currentRotation = randomRot;
                piece.style.transform = `rotate(${randomRot}deg)`;

                piece.classList.add('clickable');
                enablePointerControls(piece);

                piece.setAttribute('tabindex', '-1');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleKeyboardSwap);
                piece.setAttribute('aria-pressed', 'false'); // true mientras está seleccionada para intercambiar
                piece.addEventListener('keydown', handleKeyboardRotateHard);
                piece.addEventListener('keydown', handleArrowNavigation);

                if (i === 0) addVisualCue(piece, 'both');
                piecesArray.push(piece);
            }
        }

        if (config.difficulty === 'medium' || config.difficulty === 'hard') {
            // Fisher–Yates: barajado uniforme. Se repite si el tablero queda ya resuelto.
            const isSolved = () => piecesArray.every((p, idx) => parseInt(p.dataset.correctIndex) === idx);
            do {
                for (let i = piecesArray.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [piecesArray[i], piecesArray[j]] = [piecesArray[j], piecesArray[i]];
                }
            } while (piecesArray.length > 1 && isSolved());

            piecesArray.forEach((piece, index) => {
                const slot = slots[index];
                if (slot) {
                    slot.appendChild(piece);
                    const rot = parseInt(piece.dataset.currentRotation);
                    updatePieceAriaLabel(piece, index, rot);
                }
            });
        }

        // Foco itinerante: el tablero es una sola parada de tabulación y dentro se navega con flechas.
        const firstPiece = slots[0] && slots[0].children[0];
        if (firstPiece) firstPiece.setAttribute('tabindex', '0');

        // Las piezas que ya empiezan bien colocadas quedan marcadas desde el inicio.
        document.querySelectorAll('.puzzle-piece').forEach(p => validatePiece(p, false));
    }

    function updatePieceAriaLabel(piece, slotIndex, rotation) {
        const pieceNumber = slotIndex + 1;
        const positionText = `Pieza ${pieceNumber}`;

        if (piece.classList.contains('correct')) {
            piece.setAttribute('aria-label', `${positionText}, colocada correctamente`);
            return;
        }

        let stateText = '';
        if (config.difficulty === 'easy' || config.difficulty === 'hard') {
            stateText = rotation === 0 ? ', orientación correcta' : `, rotada ${rotation} grados`;
        }

        let actionText = '';
        if (config.difficulty === 'easy') {
            actionText = '. Presiona Enter o Espacio para girar';
        } else if (config.difficulty === 'medium') {
            actionText = '. Presiona Enter o Espacio para seleccionar y mover';
        } else if (config.difficulty === 'hard') {
            actionText = '. Presiona Enter o Espacio para seleccionar y mover, o R para girar';
        }

        piece.setAttribute('aria-label', `${positionText}${stateText}${actionText}`);
    }

    // La pieza que recibe el foco (teclado o puntero) pasa a ser la parada de tabulación del tablero.
    boardElement.addEventListener('focusin', (e) => {
        const piece = e.target.closest('.puzzle-piece');
        if (!piece) return;
        boardElement.querySelectorAll('.puzzle-piece[tabindex="0"]').forEach(p => p.setAttribute('tabindex', '-1'));
        piece.setAttribute('tabindex', '0');
    });

    function setSwapSelection(piece) {
        if (selectedPieceForSwap) {
            selectedPieceForSwap.classList.remove('selected-for-swap');
            selectedPieceForSwap.setAttribute('aria-pressed', 'false');
        }
        selectedPieceForSwap = piece;
        if (piece) {
            piece.classList.add('selected-for-swap');
            piece.setAttribute('aria-pressed', 'true');
        }
    }

    function handleArrowNavigation(e) {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

        e.preventDefault();

        const currentPiece = e.target;
        const currentSlot = currentPiece.parentElement;
        if (!currentSlot || !currentSlot.classList.contains('drop-zone')) return;

        const currentIndex = parseInt(currentSlot.dataset.index);
        const currentRow = Math.floor(currentIndex / config.size);
        const currentCol = currentIndex % config.size;

        let newRow = currentRow;
        let newCol = currentCol;

        switch (e.key) {
            case 'ArrowUp':
                newRow = Math.max(0, currentRow - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(config.size - 1, currentRow + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, currentCol - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(config.size - 1, currentCol + 1);
                break;
        }

        const newIndex = newRow * config.size + newCol;
        if (newIndex !== currentIndex) {
            const newSlot = slots[newIndex];
            if (newSlot && newSlot.children.length > 0) {
                newSlot.children[0].focus();
            }
        }
    }

    function addVisualCue(piece, type) {
        if(piece.querySelector('.action-indicator')) return;
        const cue = document.createElement('div');
        cue.classList.add('action-indicator');
        
        if (type === 'tap') cue.innerHTML = '👆'; 
        else if (type === 'drag') cue.innerHTML = '✋'; 
        else if (type === 'both') {
            cue.innerHTML = '<span style="font-size:0.8em">✋/👆</span>'; 
            cue.classList.add('pulse-dual'); 
        } 
        
        piece.appendChild(cue);
        setTimeout(() => { 
            if(cue.parentNode) {
                cue.style.opacity = '0';
                setTimeout(() => cue.remove(), 500); 
            }
        }, 5000);
    }

    function handleRotateClick(e) {
        rotatePiece(e.currentTarget || e.target);
    }

    function rotatePiece(piece) {
        if (gameEnded || piece.classList.contains('dragging')) return;
        if (piece.classList.contains('correct')) {
            announceToScreenReader('Esta pieza ya está en su lugar.');
            return;
        }

        resetIdleTimer();
        const cue = piece.querySelector('.action-indicator');
        if(cue) cue.remove();

        piece.classList.remove('incorrect', 'correct');

        let currentRot = parseInt(piece.dataset.currentRotation);
        currentRot = (currentRot + 90) % 360;
        piece.dataset.currentRotation = currentRot;
        piece.style.transform = `rotate(${currentRot}deg)`;

        moves++;
        updateStatsWithoutAnnounce();

        // Validación inmediata: girar nunca muestra equis, solo confirma el acierto.
        if (validatePiece(piece, false) === 'correct') {
            playSound('success');
            giveFeedback('¡Muy bien! Esa pieza está en su lugar.');
            checkCompletion();
        } else {
            const rotationText = currentRot === 0 ? 'orientación correcta' : `rotada ${currentRot} grados`;
            announceToScreenReader(`Pieza girada, ${rotationText}`);
        }
    }

    // Comprueba posición y orientación de una pieza y la marca al instante.
    // Devuelve 'correct', 'rotate' (lugar correcto, falta girar) o 'wrong'.
    function validatePiece(piece, showError) {
        const slot = piece.parentElement;
        const slotIndex = parseInt(slot.dataset.index);
        const rot = parseInt(piece.dataset.currentRotation) || 0;
        const inPlace = parseInt(piece.dataset.correctIndex) === slotIndex;
        let result;

        piece.classList.remove('correct', 'incorrect');

        if (inPlace && rot === 0) {
            piece.classList.add('correct');
            result = 'correct';
        } else if (inPlace) {
            result = 'rotate';
        } else {
            if (showError) {
                piece.classList.add('incorrect');
                setTimeout(() => piece.classList.remove('incorrect'), 1200);
            }
            result = 'wrong';
        }

        updatePieceAriaLabel(piece, slotIndex, rot);
        return result;
    }

    // Retroalimentación con dos destinatarios:
    //  - childMessage: frase corta y positiva para el niño (burbuja + voz del asistente).
    //  - srMessage: texto para el lector de pantalla (región aria-live); puede llevar
    //    teclas o estados técnicos que la voz del asistente nunca lee.
    function giveFeedback(childMessage, srMessage = childMessage) {
        assistantSay(childMessage);
        announceToScreenReader(srMessage);
    }

    // El asistente habla al niño: actualiza la burbuja y, si hay estímulo auditivo, lo dice en voz alta.
    function assistantSay(message) {
        updateMascotMessage(message);
        speakAssistant(message);
    }

    // Estímulo auditivo activo solo con "Solo Sonido" o "Visual y Sonido" en Ajustes.
    function audioEnabled() {
        return config.stimuli === 'sound' || config.stimuli === 'mixed';
    }

    // --- Efectos de sonido (Web Audio API): tonos cortos generados en código ---

    // Cada nota: [frecuencia en Hz, duración en segundos]
    const SOUNDS = {
        success: { wave: 'sine',     notes: [[523.25, 0.12], [783.99, 0.22]] },
        error:   { wave: 'sine',     notes: [[246.94, 0.16], [196.00, 0.26]] },
        victory: { wave: 'triangle', notes: [[523.25, 0.14], [659.25, 0.14], [783.99, 0.14], [1046.5, 0.45]] }
    };
    let audioCtx = null;

    function playSound(name) {
        const sound = SOUNDS[name];
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!sound || !AudioCtx || !audioEnabled()) return;

        try {
            if (!audioCtx) audioCtx = new AudioCtx();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            let start = audioCtx.currentTime + 0.02;
            sound.notes.forEach(([freq, duration]) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = sound.wave;
                osc.frequency.value = freq;
                // Envolvente suave (sin clics) y volumen moderado para no sobresaltar.
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(start);
                osc.stop(start + duration + 0.02);
                start += duration * 0.9;
            });
        } catch (err) {
            // Sin audio disponible: el juego sigue con la retroalimentación visual.
        }
    }

    function checkCompletion() {
        if (gameEnded) return;
        const allPieces = document.querySelectorAll('.puzzle-piece');
        if (Array.from(allPieces).every(p => p.classList.contains('correct'))) {
            gameEnded = true;
            setTimeout(endGame, 700);
        }
    }

    // Mueve una pieza a una casilla (intercambiando si está ocupada) y la valida.
    function movePieceToSlot(piece, targetSlot) {
        const originSlot = piece.parentElement;
        const other = targetSlot.children[0];

        if (other && other.classList.contains('correct')) {
            giveFeedback('Esa pieza ya está en su lugar. ¡Prueba otro espacio!');
            return false;
        }

        if (other) {
            originSlot.appendChild(other);
            resetPieceStyle(other);
        }
        targetSlot.appendChild(piece);
        resetPieceStyle(piece);

        moves++;
        updateStatsWithoutAnnounce();
        resetIdleTimer();

        if (other) validatePiece(other, false);
        const result = validatePiece(piece, true);

        if (result === 'correct') {
            playSound('success');
            giveFeedback('¡Muy bien! Esa pieza está en su lugar.');
        } else if (result === 'rotate') {
            giveFeedback('¡Casi! Ahora gírala para que encaje.',
                '¡Casi! La pieza está en su lugar pero girada. Presiona R para girarla.');
        } else {
            playSound('error');
            giveFeedback('Esa pieza no va ahí. ¡Prueba otro lugar!');
        }

        checkCompletion();
        return true;
    }

    // --- Arrastre y toque con Pointer Events (ratón, dedo y lápiz) ---

    function enablePointerControls(piece) {
        piece.addEventListener('pointerdown', handlePointerDown);
        piece.addEventListener('pointermove', handlePointerMove);
        piece.addEventListener('pointerup', handlePointerUp);
        piece.addEventListener('pointercancel', handlePointerCancel);
        piece.addEventListener('dragstart', (e) => e.preventDefault());
    }

    function setPieceTransform(piece, dx = 0, dy = 0) {
        const rot = parseInt(piece.dataset.currentRotation) || 0;
        const move = (dx || dy) ? `translate(${dx}px, ${dy}px) ` : '';
        piece.style.transform = `${move}rotate(${rot}deg)`;
    }

    function slotAtPoint(x, y) {
        return slots.find(slot => {
            const r = slot.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) || null;
    }

    function setHoveredSlot(slot) {
        if (pointerState.hoverSlot === slot) return;
        if (pointerState.hoverSlot) pointerState.hoverSlot.classList.remove('hovered');
        if (slot) slot.classList.add('hovered');
        pointerState.hoverSlot = slot;
    }

    function handlePointerDown(e) {
        if (pointerState || gameEnded) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const piece = e.currentTarget;
        if (piece.classList.contains('correct')) return;

        pointerState = {
            piece,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
            hoverSlot: null
        };
        piece.setPointerCapture(e.pointerId);
        resetIdleTimer();

        const cue = piece.querySelector('.action-indicator');
        if (cue) cue.remove();
    }

    function handlePointerMove(e) {
        if (!pointerState || e.pointerId !== pointerState.pointerId) return;
        const { piece, startX, startY } = pointerState;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!pointerState.dragging) {
            if (!CAN_DRAG() || Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            pointerState.dragging = true;
            setSwapSelection(null); // al arrastrar se descarta la selección hecha con toque o teclado
            piece.classList.add('dragging');
            piece.style.transition = 'none';
        }

        e.preventDefault();
        setPieceTransform(piece, dx, dy);
        const slot = slotAtPoint(e.clientX, e.clientY);
        setHoveredSlot(slot && slot !== piece.parentElement ? slot : null);
    }

    function handlePointerUp(e) {
        if (!pointerState || e.pointerId !== pointerState.pointerId) return;
        const { piece, dragging } = pointerState;
        const target = dragging ? slotAtPoint(e.clientX, e.clientY) : null;
        endPointerInteraction();

        if (dragging) {
            if (target && target !== piece.parentElement) movePieceToSlot(piece, target);
        } else if (tapMovesPieces()) {
            handleTapMove(piece);
        } else if (CAN_ROTATE()) {
            rotatePiece(piece);
        }
    }

    // --- Mover sin arrastrar (WCAG 2.5.7): tocar una pieza y luego tocar su destino ---
    // Nivel Medio: el toque siempre selecciona/mueve (ahí el toque no gira).
    // Nivel Difícil: el toque gira por defecto; el botón "Mover tocando" lo cambia a seleccionar/mover.
    // Nivel Fácil: las piezas no se mueven de casilla, solo se giran.

    const btnTapMode = document.getElementById('btn-tap-mode');
    let tapMoveMode = false;

    function tapMovesPieces() {
        return config.difficulty === 'medium' || (config.difficulty === 'hard' && tapMoveMode);
    }

    function handleTapMove(piece) {
        if (gameEnded) return;
        resetIdleTimer();
        const pieceNumber = parseInt(piece.parentElement.dataset.index) + 1;

        if (!selectedPieceForSwap) {
            setSwapSelection(piece);
            giveFeedback('¡Bien! Ahora toca dónde va.',
                `Pieza ${pieceNumber} seleccionada. Toca otra pieza para intercambiarlas.`);
        } else if (selectedPieceForSwap === piece) {
            setSwapSelection(null);
            announceToScreenReader(`Pieza ${pieceNumber} deseleccionada.`);
        } else {
            const selected = selectedPieceForSwap;
            setSwapSelection(null);
            movePieceToSlot(selected, piece.parentElement);
        }
    }

    // Las piezas ya colocadas no reciben toques (pointer-events: none): el toque llega a su casilla.
    boardElement.addEventListener('click', (e) => {
        if (!selectedPieceForSwap || gameEnded || !tapMovesPieces()) return;
        const slot = e.target.closest('.drop-zone');
        const piece = slot && slot.children[0];
        if (piece && piece.classList.contains('correct') && e.target === slot) {
            giveFeedback('Esa pieza ya está en su lugar. ¡Toca otra!');
        }
    });

    if (btnTapMode) {
        btnTapMode.addEventListener('click', () => {
            tapMoveMode = !tapMoveMode;
            btnTapMode.setAttribute('aria-pressed', String(tapMoveMode));
            setSwapSelection(null);
            resetIdleTimer();
            if (tapMoveMode) {
                giveFeedback('Toca una pieza y luego toca dónde va.',
                    'Mover tocando activado. Toca una pieza y luego toca otra para intercambiarlas.');
            } else {
                giveFeedback('Toca una pieza para girarla.',
                    'Mover tocando desactivado. Al tocar una pieza, gira.');
            }
        });
    }

    function handlePointerCancel(e) {
        if (!pointerState || e.pointerId !== pointerState.pointerId) return;
        endPointerInteraction();
    }

    function endPointerInteraction() {
        const { piece, pointerId } = pointerState;
        setHoveredSlot(null);
        if (piece.hasPointerCapture(pointerId)) piece.releasePointerCapture(pointerId);
        piece.classList.remove('dragging');
        piece.style.transition = '';
        setPieceTransform(piece);
        pointerState = null;
    }

    function handleKeyboardRotate(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            handleRotateClick(e);
        }
    }

    function handleKeyboardRotateHard(e) {
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            handleRotateClick(e);
        }
    }

    function handleKeyboardSwap(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();

        const currentPiece = e.target;
        const currentSlot = currentPiece.parentElement;
        if (!currentSlot || !currentSlot.classList.contains('drop-zone')) return;

        if (!selectedPieceForSwap && currentPiece.classList.contains('correct')) {
            announceToScreenReader('Esta pieza ya está en su lugar.');
        } else if (!selectedPieceForSwap) {
            setSwapSelection(currentPiece);
            const currentIndex = parseInt(currentSlot.dataset.index) + 1;
            announceToScreenReader(`Pieza ${currentIndex} seleccionada. Navega a otra pieza y presiona Enter para intercambiar.`);
        } else if (selectedPieceForSwap === currentPiece) {
            setSwapSelection(null);
            const currentIndex = parseInt(currentSlot.dataset.index) + 1;
            announceToScreenReader(`Pieza ${currentIndex} deseleccionada.`);
        } else {
            const selected = selectedPieceForSwap;
            setSwapSelection(null);

            if (movePieceToSlot(selected, currentSlot)) {
                currentSlot.children[0].focus();
            }
        }
    }

    function announceToScreenReader(message) {
        const announcer = document.getElementById('screen-reader-announcer');
        if (announcer) {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 100);
        }
    }

    // Voz del asistente (Web Speech API): solo frases dirigidas al niño.
    // Lo que va a announceToScreenReader nunca pasa por aquí.
    function speakAssistant(message, onEnd) {
        if (!audioEnabled() || !('speechSynthesis' in window)) return false;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
        }
        window.speechSynthesis.speak(utterance);
        return true;
    }

    function stopAssistantVoice() {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    // --- Botón de instrucciones: el asistente explica cómo se juega ---

    const btnListen = document.getElementById('btn-listen');
    let readingInstructions = false;

    function setListenButton(reading) {
        readingInstructions = reading;
        if (!btnListen) return;
        const label = btnListen.querySelector('.btn-listen-label');
        const icon = btnListen.querySelector('.btn-listen-icon');
        if (reading) {
            if (icon) icon.textContent = '⏹️';
            if (label) label.textContent = 'Detener';
            btnListen.setAttribute('aria-label', 'Detener la lectura de las instrucciones');
        } else if (audioEnabled()) {
            if (icon) icon.textContent = '🔊';
            if (label) label.textContent = 'Instrucciones';
            btnListen.setAttribute('aria-label', 'Escuchar las instrucciones del juego');
        } else {
            // Solo Visual: el botón muestra las instrucciones en la burbuja, sin voz.
            if (icon) icon.textContent = '📖';
            if (label) label.textContent = 'Instrucciones';
            btnListen.setAttribute('aria-label', 'Ver las instrucciones del juego');
        }
    }

    function playInstructions() {
        if (gameEnded) return;
        resetIdleTimer();

        if (readingInstructions) {
            stopAssistantVoice();
            setListenButton(false);
            return;
        }

        // Frases cortas para el niño; las teclas van aparte, solo al lector de pantalla.
        const childText = {
            easy: 'Toca una pieza para girarla. Gírala hasta que quede derecha. ¡Arma toda la imagen!',
            medium: 'Arrastra cada pieza a su lugar. También puedes tocar una pieza y luego tocar su lugar. ¡Arma toda la imagen!',
            hard: 'Arrastra cada pieza a su lugar. Tócala para girarla. Con el botón Mover tocando, toca una pieza y luego su lugar. ¡Arma toda la imagen!'
        }[config.difficulty] || 'Arma toda la imagen.';
        const keyboardText = {
            easy: 'Con teclado: usa las flechas para moverte entre piezas y Enter o Espacio para girar.',
            medium: 'Con teclado: usa las flechas para moverte, Enter para seleccionar una pieza y Enter en otra para intercambiarlas.',
            hard: 'Con teclado: usa las flechas para moverte, Enter para seleccionar e intercambiar piezas y R para girar.'
        }[config.difficulty] || '';

        updateMascotMessage(childText);
        announceToScreenReader(`${childText} ${keyboardText}`);
        if (speakAssistant(childText, () => setListenButton(false))) setListenButton(true);
    }

    if (btnListen) btnListen.addEventListener('click', playInstructions);
    setListenButton(false); // etiqueta inicial según el ajuste de estímulos

    function resetPieceStyle(piece) {
        piece.style.position = 'relative';
        piece.style.left = '0';
        piece.style.top = '0';
        piece.style.width = '100%';
        piece.style.height = '100%';
        piece.classList.remove('incorrect', 'correct');
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            giveFeedback("¿Necesitas una pista? Toca el foco de abajo.",
                "¿Necesitas una pista? Usa el botón Pedir pista.");
        }, 15000);
    }

    function updateMascotMessage(message) {
        if (mascotText) {
            // Solo texto visible: los anuncios van por la única región aria-live (#screen-reader-announcer).
            mascotText.textContent = message;
        }
    }

    function updateStatsWithoutAnnounce() {
        if(moveCountDisplay) {
            moveCountDisplay.textContent = moves;
        }
    }

    if(btnCheck) btnCheck.addEventListener('click', checkSolution);

    function checkSolution() {
        let correctCount = 0;
        let hasErrors = false;
        
        const allPieces = document.querySelectorAll('.puzzle-piece');

        allPieces.forEach(piece => {
            piece.classList.remove('correct', 'incorrect');
            const parent = piece.parentElement;
            
            if (!parent.classList.contains('drop-zone')) {
                piece.classList.add('incorrect');
                hasErrors = true;
                return;
            }

            const pIndex = parseInt(piece.dataset.correctIndex);
            const sIndex = parseInt(parent.dataset.index);
            const rot = parseInt(piece.dataset.currentRotation);

            if (pIndex === sIndex && rot === 0) {
                piece.classList.add('correct');
                correctCount++;
            } else {
                piece.classList.add('incorrect');
                hasErrors = true;
            }
        });

        if (correctCount === totalPieces) {
            if (!gameEnded) {
                gameEnded = true;
                endGame();
            }
        } else {
            const incorrectCount = totalPieces - correctCount;
            playSound('error');
            giveFeedback(
                incorrectCount > 1 ? `Faltan ${incorrectCount} piezas. ¡Sigue intentando!` : 'Falta 1 pieza. ¡Ya casi!',
                `Resultado: ${correctCount} piezas correctas, ${incorrectCount} piezas incorrectas. Sigue intentando.`);
            
            setTimeout(() => {
                document.querySelectorAll('.incorrect').forEach(el => el.classList.remove('incorrect'));
            }, 2500);
        }
    }

    if(btnHelp) btnHelp.addEventListener('click', () => {
        const slots = document.querySelectorAll('.drop-zone');
        hintsUsed++;
        let hintFound = false;
        let hintMessage = '';
        let childHint = '';
        if (gameEnded) return;
        resetIdleTimer();

        for (let slot of slots) {
            if (slot.children.length > 0) {
                const piece = slot.children[0];
                const pIndex = parseInt(piece.dataset.correctIndex);
                const sIndex = parseInt(slot.dataset.index);
                const rot = parseInt(piece.dataset.currentRotation);

                if (pIndex !== sIndex) {
                    piece.classList.add('incorrect');
                    hintMessage = `La pieza ${pIndex + 1} no está en su lugar correcto. Intenta moverla.`;
                    childHint = "Esta pieza no está en su lugar. Intenta moverla.";
                    setTimeout(() => piece.classList.remove('incorrect'), 2000);
                    hintFound = true;
                    break;
                } else if (rot !== 0) {
                    piece.classList.add('incorrect');
                    hintMessage = `La pieza ${pIndex + 1} necesita ser girada. Está rotada ${rot} grados.`;
                    childHint = "Esta pieza necesita un giro.";
                    setTimeout(() => piece.classList.remove('incorrect'), 2000);
                    hintFound = true;
                    break;
                }
            }
        }

        if (!hintFound) {
            hintMessage = "¡Todo se ve bien! Presiona Comprobar Solución.";
            childHint = "¡Todo se ve bien! Toca Comprobar.";
        }

        giveFeedback(childHint, hintMessage);
    });

    if(btnMenuToggle) {
        btnMenuToggle.addEventListener('click', () => {
            openSideMenu();
        });
    }

    if(btnMenuClose) {
        btnMenuClose.addEventListener('click', () => {
            closeSideMenu();
        });
    }

    function openSideMenu() {
        setPageInert(true);
        sideMenuOverlay.classList.remove('hidden');
        sideMenuOverlay.setAttribute('aria-hidden', 'false');
        btnMenuToggle.setAttribute('aria-expanded', 'true');

        const menuTitle = document.getElementById('menu-title');
        if (menuTitle) {
            if (!menuTitle.hasAttribute('tabindex')) {
                menuTitle.setAttribute('tabindex', '-1');
            }
            setTimeout(() => menuTitle.focus(), 100);
        }
        
        announceToScreenReader("Menú de opciones abierto");
    }

    function closeSideMenu() {
        sideMenuOverlay.classList.add('hidden');
        sideMenuOverlay.setAttribute('aria-hidden', 'true');
        btnMenuToggle.setAttribute('aria-expanded', 'false');
        setPageInert(false);

        if (btnMenuToggle) {
            btnMenuToggle.focus();
        }
    }

    if(sideMenuOverlay) {
        trapModalKeys(sideMenuOverlay, closeSideMenu);
        sideMenuOverlay.addEventListener('click', (e) => {
            if (e.target === sideMenuOverlay) closeSideMenu();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !sideMenuOverlay.classList.contains('hidden')) {
            closeSideMenu();
        }
    });

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function elapsedSeconds() {
        return Math.floor(elapsedMs / 1000);
    }

    // Inicia o reanuda el cronómetro. Solo suma el tiempo entre ticks mientras está en marcha,
    // así que el rato en pausa no cuenta.
    function startTimer() {
        if (lastTick !== null) return;
        timeLimit = { '3min': 180, '5min': 300 }[config.time] || null;
        lastTick = Date.now();
        timerInterval = setInterval(tickTimer, 250);
        renderTimer();
    }

    function stopTimer() {
        if (lastTick === null) return;
        elapsedMs += Date.now() - lastTick;
        lastTick = null;
        clearInterval(timerInterval);
        renderTimer();
    }

    function tickTimer() {
        const now = Date.now();
        elapsedMs += now - lastTick;
        lastTick = now;
        renderTimer();

        if (timeLimit === null || gameEnded) return;
        const remaining = timeLimit - elapsedSeconds();

        if (remaining <= 0) {
            handleTimeUp();
        } else if (warningsGiven < TIME_WARNINGS.length && remaining <= TIME_WARNINGS[warningsGiven]) {
            // Si se saltó algún umbral (pestaña en segundo plano), avisa solo del más cercano.
            while (warningsGiven < TIME_WARNINGS.length && remaining <= TIME_WARNINGS[warningsGiven]) warningsGiven++;
            const secs = TIME_WARNINGS[warningsGiven - 1];
            const badge = timerDisplay ? timerDisplay.closest('.timer-badge') : null;
            if (badge) badge.classList.add('timer-warning');
            showTimeWarning(`¡Quedan ${secs} segundos!`);
            giveFeedback(`¡Quedan ${secs} segundos! Tú puedes.`);
        }
    }

    // Aviso visual grande y temporal; el texto para el lector de pantalla va por la región aria-live.
    let timeWarningTimeout;
    function showTimeWarning(text) {
        const banner = document.getElementById('time-warning');
        if (!banner) return;
        banner.querySelector('.time-warning-text').textContent = text;
        banner.classList.remove('hidden');
        clearTimeout(timeWarningTimeout);
        timeWarningTimeout = setTimeout(hideTimeWarning, 6000);
    }

    function hideTimeWarning() {
        const banner = document.getElementById('time-warning');
        clearTimeout(timeWarningTimeout);
        if (banner) banner.classList.add('hidden');
    }

    // Modo libre: cuenta hacia arriba. Modo cronometrado: cuenta hacia atrás.
    function renderTimer() {
        if (!timerDisplay) return;
        const shown = timeLimit === null
            ? elapsedSeconds()
            : Math.max(0, timeLimit - elapsedSeconds());
        timerDisplay.textContent = formatTime(shown);
    }

    function endGame() {
        stopTimer();
        clearTimeout(idleTimer);
        const seconds = elapsedSeconds();
        const finalTime = formatTime(seconds);
        if(finalTimeDisplay) finalTimeDisplay.textContent = finalTime;
        if(finalMovesDisplay) finalMovesDisplay.textContent = moves;

        const score = calculateScore(seconds);
        const difficultyLabel = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }[config.difficulty] || config.difficulty;
        const finalScoreDisplay = document.getElementById('final-score');
        const finalDifficultyDisplay = document.getElementById('final-difficulty');
        if (finalScoreDisplay) finalScoreDisplay.textContent = score;
        if (finalDifficultyDisplay) finalDifficultyDisplay.textContent = `${difficultyLabel} (${config.size} x ${config.size})`;

        closeReference(false);

        if (!sideMenuOverlay.classList.contains('hidden')) closeSideMenu();

        if(victoryModal) {
            // La mascota (con el avatar elegido) pasa a la pantalla de felicitación.
            const mascotSource = document.getElementById('global-mascot-container');
            const mascotTarget = document.getElementById('victory-mascot-container');
            if (mascotSource && mascotTarget) mascotTarget.append(...mascotSource.childNodes);

            // El juego que queda detrás deja de ser alcanzable con teclado y lector de pantalla.
            setPageInert(true);
            hideTimeWarning();

            victoryModal.classList.remove('hidden');
            victoryModal.setAttribute('aria-hidden', 'false');

            // El foco va al título: el lector anuncia el diálogo y el siguiente Tab llega al primer botón.
            const victoryTitle = document.getElementById('victory-title');
            if (victoryTitle) {
                setTimeout(() => victoryTitle.focus(), 100);
            }
        }

        const victoryMessage = `¡Felicidades! Completaste el rompecabezas en ${finalTime} con ${moves} movimientos. Tu puntaje es ${score} puntos en dificultad ${difficultyLabel}.`;
        playSound('victory');
        giveFeedback("¡Lo lograste! ¡Eres un campeón!", victoryMessage);
    }

    function loadSavedAvatar() {
        const savedAvatar = localStorage.getItem('savedAvatarSVG');
        const mascotContainer = document.getElementById('global-mascot-container');
        if (savedAvatar && mascotContainer) mascotContainer.innerHTML = savedAvatar;
    }

    if (btnBackMenu) btnBackMenu.addEventListener('click', () => window.location.href = 'revision.html');
    
    if (btnCancelGame) {
        btnCancelGame.addEventListener('click', () => {
            // El cronómetro no corre mientras el cuadro de confirmación está abierto.
            const wasRunning = lastTick !== null;
            stopTimer();
            clearTimeout(idleTimer);
            if (confirm("¿Salir al menú principal? Perderás el progreso.")) {
                window.location.href = 'index.html';
            } else if (!gameEnded) {
                if (wasRunning && !isPaused) startTimer();
                resetIdleTimer();
            }
        });
    }
    
    if (btnMenu) btnMenu.addEventListener('click', () => window.location.href = 'index.html');
    const btnOtherImage = document.getElementById('btn-other-image');
    if (btnOtherImage) btnOtherImage.addEventListener('click', () => window.location.href = 'seleccion.html');
    if (btnReplay) btnReplay.addEventListener('click', () => location.reload());

    // Pantalla de felicitación: Tab no sale del diálogo y, si falta la imagen del anillo, se usa el de CSS.
    if (victoryModal) trapModalKeys(victoryModal, null);
    const victoryRing = document.getElementById('victory-ring');
    const victoryRingImg = victoryRing ? victoryRing.querySelector('img') : null;
    if (victoryRingImg) {
        const useCssRing = () => victoryRing.classList.add('ring-missing');
        victoryRingImg.addEventListener('error', useCssRing);
        if (victoryRingImg.complete && victoryRingImg.naturalWidth === 0) useCssRing();
    }

    if (btnPause) {
        btnPause.addEventListener('click', pauseGame);
    }
});