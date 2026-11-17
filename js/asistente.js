document.addEventListener('DOMContentLoaded', () => {

    const avatarPreviewContainer = document.getElementById('avatar-preview-container');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const btnSaveAvatar = document.getElementById('btn-save-avatar');
    const btnCancelAvatar = document.getElementById('btn-cancel-avatar');
    const currentMiniMascot = document.getElementById('current-mini-mascot');

    let tempAvatarHTML = '';

    initAvatarSelection();

    function initAvatarSelection() {
        const savedAvatar = localStorage.getItem('savedAvatarSVG');

        if (savedAvatar) {
            tempAvatarHTML = savedAvatar;
        } else {
            const firstOption = document.querySelector('.avatar-option[data-id="hero"] svg');
            if (firstOption) {
                tempAvatarHTML = firstOption.outerHTML;
            }
        }

        updateLargePreview(tempAvatarHTML);

        if (currentMiniMascot) {
            currentMiniMascot.innerHTML = tempAvatarHTML;
        }
    }

    const optionsArray = Array.from(avatarOptions);
    const columnsPerRow = 4;
    const colorOptions = Array.from(document.querySelectorAll('.color-option'));

    // Rellenos que forman el "color principal" de cada personaje (traje, metal o pelaje).
    const MAIN_FILLS = [
        'url(#globalSuitGradient)', 'url(#globalAltSuit)', 'url(#globalMetalGradient)', 'url(#globalDogFur)',
        '#2563EB', '#1E40AF', '#10B981'
    ];

    let selectedOption = document.querySelector('.avatar-option.selected') || optionsArray[0];
    let selectedColor = '';

    // Construye el SVG del tipo elegido con el color elegido ('' = colores originales).
    function buildAvatarHTML() {
        const svg = selectedOption ? selectedOption.querySelector('svg') : null;
        if (!svg) return '';
        const copy = svg.cloneNode(true);
        if (selectedColor) {
            copy.querySelectorAll('[fill], [stroke]').forEach(el => {
                if (MAIN_FILLS.includes(el.getAttribute('fill'))) el.setAttribute('fill', selectedColor);
                if (MAIN_FILLS.includes(el.getAttribute('stroke'))) el.setAttribute('stroke', selectedColor);
            });
        }
        return copy.outerHTML;
    }

    function markSelected(group, chosen) {
        group.forEach(o => {
            o.classList.toggle('selected', o === chosen);
            o.setAttribute('aria-checked', String(o === chosen));
        });
    }

    function refreshAvatar() {
        tempAvatarHTML = buildAvatarHTML();
        updateLargePreview(tempAvatarHTML);
    }

    // Recupera el tipo y el color guardados la última vez.
    const savedId = localStorage.getItem('savedAvatarId');
    const savedColor = localStorage.getItem('savedAvatarColor') || '';
    const savedOption = optionsArray.find(o => o.dataset.id === savedId);
    if (savedOption) {
        selectedOption = savedOption;
        markSelected(optionsArray, savedOption);
    }
    const savedColorOption = colorOptions.find(o => o.dataset.color === savedColor);
    if (savedColorOption) {
        selectedColor = savedColor;
        markSelected(colorOptions, savedColorOption);
    }

    avatarOptions.forEach((option, index) => {
        option.addEventListener('click', () => {
            selectedOption = option;
            markSelected(optionsArray, option);
            refreshAvatar();
        });

        option.addEventListener('keydown', (e) => {
            handleArrowNavigation(e, index, optionsArray, columnsPerRow);
        });
    });

    colorOptions.forEach((option, index) => {
        option.addEventListener('click', () => {
            selectedColor = option.dataset.color || '';
            markSelected(colorOptions, option);
            refreshAvatar();
        });

        option.addEventListener('keydown', (e) => {
            handleArrowNavigation(e, index, colorOptions, colorOptions.length);
        });
    });

    function handleArrowNavigation(e, currentIndex, items, columns) {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

        e.preventDefault();

        const totalItems = items.length;
        const currentRow = Math.floor(currentIndex / columns);
        const currentCol = currentIndex % columns;
        const totalRows = Math.ceil(totalItems / columns);

        let newIndex = currentIndex;

        switch (e.key) {
            case 'ArrowUp':
                if (currentRow > 0) {
                    newIndex = (currentRow - 1) * columns + currentCol;
                }
                break;
            case 'ArrowDown':
                if (currentRow < totalRows - 1) {
                    const potentialIndex = (currentRow + 1) * columns + currentCol;
                    if (potentialIndex < totalItems) {
                        newIndex = potentialIndex;
                    }
                }
                break;
            case 'ArrowLeft':
                if (currentIndex > 0) {
                    newIndex = currentIndex - 1;
                }
                break;
            case 'ArrowRight':
                if (currentIndex < totalItems - 1) {
                    newIndex = currentIndex + 1;
                }
                break;
        }

        if (newIndex !== currentIndex && items[newIndex]) {
            items[newIndex].focus();
        }
    }

    function updateLargePreview(svgContent) {
        if (avatarPreviewContainer) {
            avatarPreviewContainer.style.opacity = '0.5';
            avatarPreviewContainer.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                avatarPreviewContainer.innerHTML = svgContent;
                avatarPreviewContainer.style.opacity = '1';
                avatarPreviewContainer.style.transform = 'scale(1)';
            }, 150);
        }
    }

    if (btnSaveAvatar) {
        btnSaveAvatar.addEventListener('click', () => {
            if (tempAvatarHTML) {
                localStorage.setItem('savedAvatarSVG', tempAvatarHTML);
                if (selectedOption) localStorage.setItem('savedAvatarId', selectedOption.dataset.id);
                localStorage.setItem('savedAvatarColor', selectedColor);

                const originalText = btnSaveAvatar.textContent;
                btnSaveAvatar.textContent = "¡Guardado!";
                btnSaveAvatar.style.backgroundColor = "var(--green-primary)";
                
                setTimeout(() => {
                    window.location.href = 'ajustes.html';
                }, 800);
            }
        });
    }

    if (btnCancelAvatar) {
        btnCancelAvatar.addEventListener('click', () => {
            window.location.href = 'ajustes.html';
        });
    }

});
