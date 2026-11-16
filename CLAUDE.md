# Módulo de Rompecabezas — Contexto del proyecto (TIC)

> Este archivo es el contexto para Claude Code. Describe qué debe ser el módulo
> según la documentación de tesis, para revisar el código y alinearlo con los
> requisitos. Autor del módulo: **Ariel Mora** (EPN, Ingeniería de Software).

## Qué es este proyecto
Módulo de juego serio tipo **rompecabezas**, web y accesible, para **niños con
discapacidad intelectual leve (CI 50–70)** y funcionamiento intelectual límite
(CI 70–85). Forma parte de una plataforma de juegos serios de la EPN. Su objetivo
es **fortalecer la coordinación visomotora y la motricidad fina**.

Es un módulo individual: se distingue de otros módulos de la plataforma
(emparejamiento, memoria) por centrarse en la **mecánica de armar piezas**.

## Stack tecnológico
- **HTML5, CSS3 y JavaScript** (sin framework).
- **Web Speech API** para síntesis de voz (refuerzo auditivo).
- **WAI-ARIA** para accesibilidad.

## Estándares que el código debe cumplir
- **Accesibilidad WCAG 2.2** (perceptible, operable, comprensible, robusto):
  contraste suficiente, objetivos interactivos de buen tamaño, alternativas
  textuales, navegación por teclado, HTML5 semántico + ARIA
  (`aria-label`, `aria-pressed`, `aria-modal`, `aria-hidden`), `lang="es"`,
  enlace para saltar al contenido.
- **Usabilidad ISO 9241-11** (efectividad, eficiencia, satisfacción) y principios
  de **Nielsen**.
- Tipografía legible, alto contraste y baja carga cognitiva.

## Mecánicas / funcionalidades que deben existir
1. Configurar la partida: **dificultad, tamaño, estímulos y tiempo**.
2. **Selección de imagen** desde una galería + **imagen de referencia**.
3. **Mover piezas** (arrastrar) y **girarlas** (tocar).
4. **Validar** la posición y la orientación de cada pieza.
5. **Retroalimentación inmediata** visual (visto/equis) y auditiva (sonidos + voz).
6. **Asistente virtual** con instrucciones y pistas.
7. **Modo libre** (sin tiempo) y **modo cronometrado**.
8. **Pantalla de finalización** con felicitación y resultados (tiempo, puntaje, dificultad).
9. Reiniciar la partida o seleccionar otro rompecabezas.

## Pantallas (según los prototipos)
Menú principal (Jugar, Ajustes, Instrucciones, Salir) · Ajustes (dificultad,
tamaño, estímulos, tiempo; restablecer; previsualización) · Personalización del
asistente · Instrucciones del juego · Selección de imagen · Pantalla del
rompecabezas ("Toca para girar, arrastra para mover") · Finalización.

## Requisitos funcionales
- **RF1** Configurar dificultad, tamaño, estímulos y tiempo antes de jugar.
- **RF2** Seleccionar la imagen del rompecabezas desde una galería.
- **RF3** Mover las piezas mediante arrastre y girarlas al tocarlas.
- **RF4** Validar la posición y la orientación de cada pieza.
- **RF5** Mostrar retroalimentación inmediata, visual y auditiva, de aciertos y errores.
- **RF6** Ofrecer una imagen de referencia de la figura objetivo.
- **RF7** Mostrar un asistente virtual con instrucciones y pistas.
- **RF8** Permitir el modo libre (sin límite de tiempo) o cronometrado.
- **RF9** Mostrar una pantalla de finalización con los resultados y un refuerzo positivo.
- **RF10** Permitir reiniciar la partida o seleccionar otro rompecabezas.

## Requisitos no funcionales
- **RNF1** Cumplir WCAG 2.2 (contraste, tamaño de objetivos, alternativas textuales, teclado).
- **RNF2** Cumplir ISO 9241-11 (efectividad, eficiencia, satisfacción).
- **RNF3** Tipografía legible y alto contraste para reducir la carga cognitiva.
- **RNF4** Refuerzo auditivo con la Web Speech API.
- **RNF5** Funcionar en navegador web de forma responsiva y ligera.
- **RNF6** Mantener consistencia visual e integrarse con la plataforma de juegos serios.

## Historias de usuario
- **HU-01** Configurar la partida (dificultad, tamaño, estímulos, tiempo) para adaptarla al ritmo del niño.
- **HU-02** Seleccionar la imagen del rompecabezas desde una galería.
- **HU-03** Arrastrar y girar las piezas para colocarlas y armar la figura.
- **HU-04** Validar si la pieza está bien colocada para saber que se avanza.
- **HU-05** Recibir retroalimentación visual y auditiva de aciertos y errores.
- **HU-06** Ver una imagen de referencia de la figura para guiarse.
- **HU-07** Contar con un asistente que dé instrucciones y pistas.
- **HU-08** Ver una pantalla de felicitación al terminar, para motivarse y volver a jugar.

## Cómo trabajar en este repositorio
- Revisa el código y **compáralo con esta especificación**; propón y aplica cambios
  para que el módulo cumpla los requisitos, las mecánicas y la accesibilidad.
- Haz cambios **pequeños y enfocados** (una funcionalidad o arreglo por vez).
- **NO hagas commits automáticamente.** El autor (Ariel) hace los commits con su
  propia cuenta de GitHub. Deja los cambios en el working tree para que él los
  revise y confirme.
- Sugiere mensajes de commit en español, estilo convencional:
  `feat:`, `fix:`, `a11y:`, `style:`, `docs:`.
