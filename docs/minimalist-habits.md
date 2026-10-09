# Hábitos sin configuración

Crea hábitos con un nombre, marca hoy y consulta un historial sencillo. El dashboard muestra sólo los hábitos activos; los que no usas quedan en **Hábitos ocultos**, sin perder su historial.

## Acceso

En la portada, **Iniciar sesión**, **Empezar con Google** y **Crear mi primer hábito** abren el mismo diálogo de Google, sin salir de la página. `/login` también muestra la portada con ese diálogo; los enlaces protegidos siguen pasando por esa entrada.

Puedes cerrar con el botón, Escape o el fondo y volver al control que lo abrió. Mientras aparece **Ingresando...**, el cierre queda bloqueado para evitar cancelar una autenticación en curso. Los errores permiten volver a intentarlo; una sesión iniciada entra al dashboard sin pedir Google otra vez. **Salir** limpia la sesión y los registros locales de hoy antes de volver a la portada.

La muestra de la portada usa **datos de ejemplo**: puedes marcar y desmarcar sus tres hábitos con el ratón o con Espacio. Los cambios sólo viven en esa página; abrir y cerrar el diálogo los conserva, pero recargar los reinicia. No se guardan ni pertenecen a tu cuenta, tampoco crean hábitos reales. El historial ilustrativo sigue siendo un ejemplo estático, sin cambiar al marcar.

## Uso rápido

1. En el dashboard, pulsa **Nuevo hábito**, escribe un título de 3 a 200 caracteres y pulsa **Crear hábito**.
2. Marca **Completado hoy** en la tarjeta o en el detalle. El día sigue la zona horaria de tu cuenta, no la del dispositivo.
3. Desmarca la casilla para eliminar el registro de hoy. Los días anteriores no se editan desde estas pantallas.
4. Pulsa el nombre para abrir el historial del mes actual de tu cuenta. Usa **Editar hábito** para cambiar sólo el nombre.
5. En el detalle, pulsa **Ocultar hábito** y confirma. Para recuperarlo, abre **Hábitos ocultos** en el dashboard, pulsa su nombre y confirma **Restaurar hábito** en el detalle.

**Nuevo hábito** aparece junto al saludo, sin tapar las tarjetas. Cada fila muestra un círculo a la izquierda: vacío o con una marca verde, con **Sin completar hoy** o **Completado hoy** debajo del nombre. La casilla conserva su estado nativo, un área de 44 px y foco visible sobre el círculo; el nombre abre el historial sin marcar. Mientras se guarda, la casilla se desactiva y aparece **Guardando...**. Las tarjetas completadas añaden un borde verde discreto. Los nombres largos se ajustan en móvil; los controles tienen áreas cómodas y foco visible de teclado.

El recuento de hoy incluye sólo hábitos activos y usa la finalización guardada, sin sumar cantidades. Los hábitos antiguos pausados también aparecen entre los ocultos; abrir esa sección no cambia su estado ni sus registros.

## Datos anteriores y errores

Los hábitos antiguos funcionan con la misma casilla, aunque tengan cantidades u otros horarios guardados. Sus metadatos, notas, cantidades y objetivos originales no se convierten ni se borran al editar el nombre u ocultarlos. El historial muestra las fechas y la finalización guardadas, sin recalcular objetivos. Desmarcar conserva el comportamiento de borrar el registro de hoy.

**Reintentar** vuelve a leer los datos, sin repetir una creación o un marcado. Si el nombre ya se guardó pero falló la recarga, **Reintentar actualización** no vuelve a enviarlo.

## Alcance

La simplificación está completa: nombre, casilla de hoy, historial y ocultar/restaurar. Ese recorte retiró 768 líneas netas del núcleo; el pulido visual mantiene las mismas funciones. La API conserva compatibilidad para los datos anteriores.

## Verificación y límites

- API: 653 pruebas unitarias y 123 HTTP con mocks, TypeScript y lint aprobados de forma independiente.
- Frontend: 126 pruebas de comportamiento y 8 de presentación aprobadas con API sintética. Las de presentación comprueban áreas de 44 px, foco, contraste, estados y ausencia de desbordamiento a 375/320 px; capturan cuatro imágenes fuera del repositorio. TypeScript, lint y bundle en memoria del núcleo aprobados de forma independiente. No se leyeron archivos de entorno ni se añadieron dependencias.
- Acceso en diálogo (L1): 154 pruebas de navegador aprobadas, conservando las 134 anteriores y añadiendo 20 casos de acceso, cancelación, foco, sesión y respuestas tardías, incluidas peticiones ajenas simultáneas. El widget de Google se sustituye sólo en las pruebas por un iframe sintético; las capturas de portada y diálogo se guardan fuera del repositorio a 1440/375/320 px.
- Filas y muestra local (L2): 157/157 pruebas de navegador aprobadas, conservando las 154 de L1. Los tres casos nuevos comprueban la muestra anónima y autenticada: marcado reversible con Espacio, cero peticiones de datos o escrituras locales al marcar, conservación al cerrar el diálogo y reinicio al recargar. Las comprobaciones de presentación mantienen áreas de 44 px, círculo de 28 px, foco, contraste ≥ 4,5 y nombres largos a 375/320 px. Capturas de dashboard y muestra interactiva fuera del repositorio; TypeScript, lint y bundle en memoria aprobados.
- Pendiente: revisión visual manual, integración con MongoDB/Google reales y build generado de Nest. Las pruebas de navegador usan una API sintética.

La verificación final independiente confirmó las 157 pruebas, TypeScript, lint y bundle en memoria. Las capturas de landing, modal y dashboard se revisaron en escritorio y móvil; eso no sustituye la aceptación con Google real.

La evidencia y los commits están en los registros de [simplificación](../odd/tasks/minimalist-core.md), [pulido visual](../odd/tasks/minimalist-ui-polish.md) y [acceso y muestra local](../odd/tasks/landing-login-and-demo.md).

## Datos de compatibilidad de navegadores

El aviso de `caniuse-lite` antiguo era una advertencia, no un fallo de la aplicación. Se actualizaron sólo los datos de navegadores y el aviso desapareció, sin cambiar las dependencias declaradas. Con pnpm 12, la actualización puntual sin scripts es:

```sh
pnpm up --no-save --ignore-scripts caniuse-lite baseline-browser-mapping
```
