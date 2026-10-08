# Configurar tus hábitos personales

Puedes crear y editar el título, categoría, color, icono, frecuencia y objetivo de tus propios hábitos. Los cambios no afectan a otras personas ni recalculan los objetivos del historial.

## Crear o editar

1. En el dashboard, selecciona **Nuevo hábito** y completa el formulario.
2. Para editar, abre el detalle del hábito y selecciona **Editar hábito**. También puedes editar un hábito propio inactivo sin reactivarlo.
3. Guarda los cambios. Si hay un error, el formulario conserva los valores para corregirlos o reintentar.

| Campo | Valores permitidos |
| --- | --- |
| Título | Entre 3 y 200 caracteres después de quitar espacios exteriores. |
| Categoría | Opcional, hasta 80 caracteres. |
| Color | Opcional, hexadecimal de seis dígitos: `#RRGGBB`. |
| Icono | Identificador opcional, hasta 64 caracteres. Se sugieren `book`, `heart`, `dumbbell`, `droplet` y `star`; otros identificadores usan un icono seguro por defecto. |
| Frecuencia diaria | Todos los días. |
| Días de la semana | Al menos un día seleccionado; lunes=1 y domingo=7, sin duplicados. |
| Días por semana | Un entero de 1 a 7 **días completados**. |
| Marcar completado | Objetivo binario, sin cantidad ni unidad. |
| Cantidad | Objetivo positivo, hasta 1 000 000 000, con unidad de 1 a 32 caracteres. Admite decimales. |

La cantidad se aplica **por día registrado**, no como suma semanal. Por ejemplo, 20 páginas y 3 días por semana requiere tres días que alcancen 20 páginas; 60 páginas en un solo día no cumple tres días.

## Qué cambia ahora y qué queda pendiente

- El título y los metadatos se actualizan inmediatamente. Deja categoría, color o icono en blanco para borrarlos; los campos sin cambios se conservan.
- Un hábito nuevo empieza con su configuración hoy. Editar frecuencia u objetivo aplica el cambio desde el próximo día del calendario de tu cuenta.
- El detalle muestra **Configuración actual** y, cuando la API devuelve un cambio pendiente, **Desde el YYYY-MM-DD** con su configuración. La fecha viene de la API, no del reloj del navegador.
- Si hay una configuración pendiente, el editor empieza con ella; en caso contrario, usa la actual. Los hábitos antiguos sin configuración conservan el valor diario/binario.
- Editar sólo metadatos no envía una configuración ni crea una revisión de objetivos. Guardar sin cambios no realiza un PATCH.
- Después de guardar se recarga el detalle. Si esa recarga falla, el historial permanece visible y **Reintentar actualización** permite recuperarse sin volver a guardar.

## Límites de esta entrega (T5)

Puedes configurar objetivos cuantitativos, pero el atajo de completado queda deshabilitado para ellos hasta implementar su registro en T6. Los objetivos binarios conservan el completado sin cuerpo de solicitud. Una configuración cuantitativa pendiente no bloquea el objetivo binario actual, ni una binaria pendiente habilita el cuantitativo actual.

Esta entrega no añade controles de cantidades, notas, correcciones históricas, semanas, pausa, archivo o reapertura. Tampoco cambia estadísticas, recordatorios, autenticación, temas o dependencias.

El detalle se obtiene de la asociación autenticada antes de ofrecer la edición. Un hábito ajeno o inexistente muestra el mismo resultado de no encontrado, sin editor ni carga de su historial. La API sigue siendo la autoridad de propiedad y validación.

## Contrato y comprobación

- Crear: `POST /habits`, con configuración completa.
- Editar: `PATCH /habits/:habitId/definition`, con sólo los campos cambiados y una configuración completa únicamente cuando cambia.
- Borrar metadatos opcionales: enviar `""`; omitir un campo conserva su valor.
- Las respuestas tipadas exponen configuración actual y pendiente, no arrays de revisiones.

Consulta el [contrato de la API](../../api/docs/personal-habits.md) para los detalles de fechas efectivas y objetivos históricos.

Las pruebas en `tests/auth-dashboard.spec.cjs` y `tests/habit-details.spec.cjs` usan rutas sintéticas: payloads, validación, errores recuperables, propiedad, cambios pendientes, sesión, teclado y bloqueo cuantitativo. No verifican datos reales, MongoDB, concurrencia ni OAuth real.
