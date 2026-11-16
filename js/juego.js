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
    let startTime;
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
        const dialog = document.getElementById('reference-dialog');
        const btnClose = document.getElementById('btn-reference-close');
        if (!thumb || !full || !btnReference || !dialog) return;

        thumb.src = imageSrc;
        full.src = imageSrc;

        btnReference.addEventListener('click', () => {
            resetIdleTimer();
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
            announceToScreenReader('Así debe quedar el rompecabezas.');
        });
        if (btnClose) btnClose.addEventListener('click', () => dialog.close());
        // Tocar fuera de la imagen también cierra.
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
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

        const availWidth = container.clientWidth - 40;
        const availHeight = container.clientHeight - 120; 
        
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
            updateMascotMessage("Las piezas están giradas. ¡Tócalas para arreglarlas!");
            announceToScreenReader("Nivel Fácil. Las piezas están giradas. Presiona Enter o Espacio para girarlas.");
        } else if (config.difficulty === 'medium') {
            gameInstruction.textContent = "Nivel Medio";
            updateMascotMessage("¡Arrastra las piezas para ordenarlas!");
            announceToScreenReader("Nivel Medio. Usa las flechas para navegar entre piezas. Presiona Enter para seleccionar una pieza, navega a otra y presiona Enter para intercambiarlas.");
        } else {
            gameInstruction.textContent = "Nivel Difícil";
            updateMascotMessage("Ponlas en su sitio Y tócalas para girarlas.");
            announceToScreenReader("Nivel Difícil. Usa las flechas para navegar. Presiona Enter para seleccionar e intercambiar piezas. Presiona R para girar.");
        }

        for (let i = 0; i < totalPieces; i++) {
            const slot = document.createElement('div');
            slot.classList.add('drop-zone');
            slot.dataset.index = i;
            boardElement.appendChild(slot);
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

                piece.setAttribute('tabindex', '0');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleKeyboardRotate);
                piece.addEventListener('keydown', handleArrowNavigation);

                if (i === 0) addVisualCue(piece, 'tap');
                boardElement.children[i].appendChild(piece);
                updatePieceAriaLabel(piece, i, randomRot);
            }
            else if (config.difficulty === 'medium') {
                piece.dataset.currentRotation = 0;
                enablePointerControls(piece);

                piece.setAttribute('tabindex', '0');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleArrowNavigation);
                piece.addEventListener('keydown', handleKeyboardSwap);

                if (i === 0) addVisualCue(piece, 'drag');
                piecesArray.push(piece);
            }
            else if (config.difficulty === 'hard') {
                let randomRot = Math.floor(Math.random() * 4) * 90;
                piece.dataset.currentRotation = randomRot;
                piece.style.transform = `rotate(${randomRot}deg)`;

                piece.classList.add('clickable');
                enablePointerControls(piece);

                piece.setAttribute('tabindex', '0');
                piece.setAttribute('role', 'button');
                piece.addEventListener('keydown', handleKeyboardSwap);
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
                const slot = boardElement.children[index];
                if (slot) {
                    slot.appendChild(piece);
                    const rot = parseInt(piece.dataset.currentRotation);
                    updatePieceAriaLabel(piece, index, rot);
                }
            });
        }

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
            const newSlot = boardElement.children[newIndex];
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

    function giveFeedback(message) {
        updateMascotMessage(message);
        announceToScreenReader(message);
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

        if (result === 'correct') giveFeedback('¡Muy bien! Esa pieza está en su lugar.');
        else if (result === 'rotate') giveFeedback('¡Casi! Ahora gírala para que encaje.');
        else giveFeedback('Esa pieza no va ahí. ¡Prueba otro lugar!');

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
        return Array.from(boardElement.children).find(slot => {
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
        } else if (CAN_ROTATE()) {
            rotatePiece(piece);
        }
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
            selectedPieceForSwap = currentPiece;
            currentPiece.classList.add('selected-for-swap');
            const currentIndex = parseInt(currentSlot.dataset.index) + 1;
            announceToScreenReader(`Pieza ${currentIndex} seleccionada. Navega a otra pieza y presiona Enter para intercambiar.`);
        } else if (selectedPieceForSwap === currentPiece) {
            selectedPieceForSwap.classList.remove('selected-for-swap');
            selectedPieceForSwap = null;
            const currentIndex = parseInt(currentSlot.dataset.index) + 1;
            announceToScreenReader(`Pieza ${currentIndex} deseleccionada.`);
        } else {
            const selected = selectedPieceForSwap;
            selected.classList.remove('selected-for-swap');
            selectedPieceForSwap = null;

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
        
        if (config.stimuli === 'sound' || config.stimuli === 'mixed') {
            speakMessage(message);
        }
    }

    function speakMessage(message) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'es-ES';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }

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
            btnHelp.classList.remove('hidden');
            updateMascotMessage("¿Necesitas una pista? Toca el foco de abajo.");
            announceToScreenReader("¿Necesitas una pista? El botón de pista está disponible.");
        }, 15000);
    }

    function updateMascotMessage(message) {
        if (mascotText) {
            mascotText.textContent = message;
            mascotText.setAttribute('aria-label', `Mensaje del asistente: ${message}`);
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
            updateMascotMessage(`Hay ${incorrectCount} pieza${incorrectCount > 1 ? 's' : ''} incorrecta${incorrectCount > 1 ? 's' : ''}. ¡Sigue intentando!`);
            announceToScreenReader(`Resultado: ${correctCount} piezas correctas, ${incorrectCount} piezas incorrectas. Sigue intentando.`);
            
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

        for (let slot of slots) {
            if (slot.children.length > 0) {
                const piece = slot.children[0];
                const pIndex = parseInt(piece.dataset.correctIndex);
                const sIndex = parseInt(slot.dataset.index);
                const rot = parseInt(piece.dataset.currentRotation);

                if (pIndex !== sIndex) {
                    piece.classList.add('incorrect');
                    hintMessage = `La pieza ${pIndex + 1} no está en su lugar correcto. Intenta moverla.`;
                    updateMascotMessage("Esta pieza no está en su lugar. Intenta moverla.");
                    setTimeout(() => piece.classList.remove('incorrect'), 2000);
                    hintFound = true;
                    break;
                } else if (rot !== 0) {
                    piece.classList.add('incorrect');
                    hintMessage = `La pieza ${pIndex + 1} necesita ser girada. Está rotada ${rot} grados.`;
                    updateMascotMessage("Esta pieza necesita ser girada.");
                    setTimeout(() => piece.classList.remove('incorrect'), 2000);
                    hintFound = true;
                    break;
                }
            }
        }

        if (!hintFound) {
            hintMessage = "¡Todo se ve bien! Presiona Comprobar Solución.";
            updateMascotMessage("¡Todo se ve bien! Dale a Comprobar.");
        }

        announceToScreenReader(hintMessage);
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

        if (btnMenuToggle) {
            btnMenuToggle.focus();
        }
    }

    if(sideMenuOverlay) {
        sideMenuOverlay.addEventListener('click', (e) => {
            if (e.target === sideMenuOverlay) closeSideMenu();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !sideMenuOverlay.classList.contains('hidden')) {
            closeSideMenu();
        }
    });

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            const delta = Math.floor((Date.now() - startTime) / 1000);
            const mins = Math.floor(delta / 60).toString().padStart(2, '0');
            const secs = (delta % 60).toString().padStart(2, '0');
            if(timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    function endGame() {
        clearInterval(timerInterval);
        if(finalTimeDisplay) finalTimeDisplay.textContent = timerDisplay.textContent;
        if(finalMovesDisplay) finalMovesDisplay.textContent = moves;

        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const score = calculateScore(seconds);
        const difficultyLabel = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }[config.difficulty] || config.difficulty;
        const finalScoreDisplay = document.getElementById('final-score');
        const finalDifficultyDisplay = document.getElementById('final-difficulty');
        if (finalScoreDisplay) finalScoreDisplay.textContent = score;
        if (finalDifficultyDisplay) finalDifficultyDisplay.textContent = `${difficultyLabel} (${config.size} x ${config.size})`;

        const referenceDialog = document.getElementById('reference-dialog');
        if (referenceDialog && referenceDialog.open) referenceDialog.close();

        if(victoryModal) {
            victoryModal.classList.remove('hidden');
            victoryModal.setAttribute('aria-hidden', 'false');

            const victoryTitle = document.getElementById('victory-title');
            if (victoryTitle) {
                setTimeout(() => victoryTitle.focus(), 100);
            }
        }

        const victoryMessage = `¡Felicidades! Completaste el rompecabezas en ${timerDisplay.textContent} con ${moves} movimientos. Tu puntaje es ${score} puntos en dificultad ${difficultyLabel}.`;
        updateMascotMessage("¡Lo lograste! ¡Eres un campeón!");
        announceToScreenReader(victoryMessage);
    }

    function loadSavedAvatar() {
        const savedAvatar = localStorage.getItem('savedAvatarSVG');
        const mascotContainer = document.getElementById('global-mascot-container');
        if (savedAvatar && mascotContainer) mascotContainer.innerHTML = savedAvatar;
    }

    if (btnBackMenu) btnBackMenu.addEventListener('click', () => window.location.href = 'revision.html');
    
    if (btnCancelGame) {
        btnCancelGame.addEventListener('click', () => {
            if (confirm("¿Salir al menú principal? Perderás el progreso.")) {
                window.location.href = 'index.html';
            }
        });
    }
    
    if (btnMenu) btnMenu.addEventListener('click', () => window.location.href = 'index.html');
    const btnOtherImage = document.getElementById('btn-other-image');
    if (btnOtherImage) btnOtherImage.addEventListener('click', () => window.location.href = 'seleccion.html');
    if (btnReplay) btnReplay.addEventListener('click', () => location.reload());
    
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            announceToScreenReader("Juego pausado");
            alert("Juego Pausado. Pulsa Aceptar para continuar.");
            sideMenuOverlay.classList.add('hidden');
        });
    }
});