# Hábitos sin configuración

Crea hábitos con un nombre, marca hoy y consulta un historial sencillo. El dashboard muestra sólo los hábitos activos; los que no usas quedan en **Hábitos ocultos**, sin perder su historial.

## Uso rápido

1. En el dashboard, pulsa **Nuevo hábito**, escribe un título de 3 a 200 caracteres y pulsa **Crear hábito**.
2. Marca **Completado hoy** en la tarjeta o en el detalle. El día sigue la zona horaria de tu cuenta, no la del dispositivo.
3. Desmarca la casilla para eliminar el registro de hoy. Los días anteriores no se editan desde estas pantallas.
4. Pulsa el nombre para abrir el historial del mes actual de tu cuenta. Usa **Editar hábito** para cambiar sólo el nombre.
5. En el detalle, pulsa **Ocultar hábito** y confirma. Para recuperarlo, abre **Hábitos ocultos** en el dashboard, pulsa su nombre y confirma **Restaurar hábito** en el detalle.

El recuento de hoy incluye sólo hábitos activos y usa la finalización guardada, sin sumar cantidades. Los hábitos antiguos pausados también aparecen entre los ocultos; abrir esa sección no cambia su estado ni sus registros.

## Datos anteriores y errores

Los hábitos antiguos funcionan con la misma casilla, aunque tengan cantidades u otros horarios guardados. Sus metadatos, notas, cantidades y objetivos originales no se convierten ni se borran al editar el nombre u ocultarlos. El historial muestra las fechas y la finalización guardadas, sin recalcular objetivos. Desmarcar conserva el comportamiento de borrar el registro de hoy.

**Reintentar** vuelve a leer los datos, sin repetir una creación o un marcado. Si el nombre ya se guardó pero falló la recarga, **Reintentar actualización** no vuelve a enviarlo.

## Alcance

La simplificación está completa: nombre, casilla de hoy, historial y ocultar/restaurar. Se retiraron los paneles y la lógica avanzada del frontend, con 768 líneas netas menos de código. La API conserva compatibilidad para los datos anteriores.

## Verificación y límites

- API: 653 pruebas unitarias y 123 HTTP con mocks, TypeScript y lint aprobados de forma independiente.
- Frontend: 126 pruebas de navegador, TypeScript, lint y bundle en memoria aprobados de forma independiente. No se leyeron archivos de entorno ni se añadieron dependencias.
- Pendiente: revisión visual manual, integración con MongoDB/Google reales y build generado de Nest. Las pruebas de navegador usan una API sintética.

La evidencia y los commits están en el [registro de simplificación](../odd/tasks/minimalist-core.md).
