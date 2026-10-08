# Configurar y registrar tus hábitos personales

Puedes crear y editar tus hábitos, filtrar por estado, pausar o archivar sin perder historial, registrar la cantidad de hoy, corregir registros por fecha y consultar siete días con sus objetivos originales. Los cambios no afectan a otras personas ni recalculan la finalización guardada del historial.

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

## Registrar la cantidad de hoy (T6a)

1. Abre el **detalle** del hábito. El atajo cuantitativo del dashboard sigue deshabilitado y te dirige al detalle.
2. En **Progreso de hoy**, revisa la fecha del calendario de tu cuenta y el objetivo original.
3. Introduce **Cantidad de hoy** y selecciona **Guardar cantidad**. El valor reemplaza el total anterior, no lo incrementa. Admite decimales y cero; debe ser finito, no negativo y como máximo 1 000 000 000.

El registro guardado de hoy manda: su snapshot conserva objetivo, unidad y frecuencia originales. Sin snapshot se usa la configuración actual del detalle, nunca la pendiente. La finalización mostrada viene del registro, no de un cálculo del navegador. Si un registro antiguo no tiene cantidad, aparece **Cantidad no registrada** y el campo queda vacío: no se inventa un valor a partir del objetivo ni del booleano.

Sólo un hábito activo permite registrar hoy. Para un registro nuevo, hoy debe ser un día seleccionado cuando la frecuencia usa días de la semana; un registro ya existente puede actualizarse aunque su día no esté seleccionado. Los objetivos binarios conservan el completado sin cuerpo de solicitud. Una configuración pendiente no cambia los controles de hoy.

Después de guardar una cantidad se recargan los registros y la semana. Si falla la recarga de registros, **Reintentar registros** hace sólo una lectura; si falla la semana, **Reintentar semana** hace sólo una lectura semanal. Ninguno repite el POST ya guardado. Los errores ordinarios al guardar conservan el campo para corregirlo o reintentar.

## Corregir un registro o su nota (T6b)

1. En el detalle, abre **Corregir un registro** e introduce **Fecha del registro** como `YYYY-MM-DD`. Puedes seleccionar fechas de meses anteriores; deben ser reales y no posteriores a hoy en la zona de tu cuenta.
2. Espera a que se carguen el registro de esa fecha y su definición semanal. Revisa **Objetivo original**, **Finalización guardada** y la cantidad, cuando exista.
3. Para editar sólo la **Nota**, deja **Corregir progreso** desactivado. Para corregir progreso, actívalo e introduce **Cantidad corregida** o marca/desmarca **Completado**, según el objetivo original.
4. Selecciona **Guardar registro**. Sin cambios, el botón queda deshabilitado. **Recargar registro** descarta el borrador y vuelve a leer los datos; también permite recuperar un conflicto de identidad (409).

| Operación | Qué se conserva o valida |
| --- | --- |
| Objetivo | Manda el snapshot almacenado. Sin snapshot, se lee la configuración efectiva en esa fecha, nunca la actual o pendiente del detalle. |
| Nota sola | Sólo se envía la nota cambiada, sin alterar cantidad, finalización ni snapshot. Se quitan espacios exteriores; hasta 2000 caracteres. Vacío borra la nota; sin cambios no se envía. |
| Cantidad | Total finito de 0 a 1 000 000 000, obligatorio al activar la corrección. Reemplaza el anterior; la API deriva finalización con el objetivo original. No se envía un booleano. |
| Checkbox | Envía un booleano explícito, incluido `false`, y nunca una cantidad. El progreso sin cambios se omite, aunque hayas activado la opción. |
| Cantidad antigua desconocida | **Cantidad no registrada (registro antiguo)**; no se inventa un valor desde el objetivo ni desde la finalización. Una nota no añade cantidad ni snapshot. |
| Registro existente | Un hábito propio inactivo o un día ya registrado no seleccionado permite corregir sin reactivación. |
| Registro nuevo | Requiere hábito activo, progreso explícito y día seleccionado cuando corresponda. Una entrada semanal vacía no se considera registro; una nota sola no lo crea. |

Los errores 400, 404 y 409 quedan visibles con el borrador conservado. Un 401 usa la limpieza de sesión y vuelta al login existentes. Después de guardar se recargan la fecha elegida, el historial del mes actual y la semana del detalle. Si alguna lectura falla, **Reintentar lecturas** repite sólo GET, nunca el PATCH ya guardado; la edición queda bloqueada hasta recuperar las lecturas. El panel semanal mantiene además su reintento independiente.

Al seleccionar otra fecha se retira inmediatamente el formulario anterior y se cancelan sus solicitudes. Cambiar ruta, sesión o día de la cuenta descarta el contexto anterior; la validación se repite antes de guardar.

## Filtrar, pausar, archivar y restaurar (T6c)

En el dashboard, **Estado de los hábitos** empieza en **Activos**. Selecciona **Pausados**, **Archivados** o **Todos** para consultar tus otras asociaciones. Una lista vacía sólo indica que no hay hábitos en ese estado; no implica que no tengas hábitos en otros filtros. El completado de hoy sigue usando los registros de la fecha de tu cuenta.

En el detalle, la insignia muestra **Activo**, **Pausado** o **Archivado**. El estado explícito de la API manda sobre el booleano antiguo `active`; sin estado, un hábito antiguo inactivo se considera pausado.

| Estado actual | Acciones disponibles |
| --- | --- |
| Activo | **Pausar** o **Archivar**. |
| Pausado | **Reanudar** o **Archivar**. |
| Archivado | **Restaurar**, de forma explícita. |

Cada acción pide confirmación y explica que conserva historial y objetivos originales. **Cancelar** o Escape no envía cambios. Mientras se guarda, confirmación, cancelación y otras acciones de estado quedan bloqueadas. Un error mantiene el detalle y el historial; puedes volver a confirmar para reintentar. Un 401 conserva el flujo existente de limpieza de sesión y vuelta al login.

Después de guardar permaneces en el detalle: se aplica el estado devuelto por la API sin borrar registros, metadatos ni configuración. El historial, la semana, la edición personal y la corrección de registros existentes siguen disponibles. Pausados y archivados no permiten progreso de hoy ni crear registros históricos nuevos; una corrección existente no reactiva el hábito. Reanudar o restaurar requiere confirmación, nunca ocurre al consultar o registrar progreso. Crear un hábito cuyo identificador ya está archivado puede devolver 409; el formulario no restaura el archivo automáticamente.

Cambiar filtro, ruta, cuenta, sesión o día retira el contexto anterior. Las lecturas se cancelan y sus respuestas, errores o finalizaciones tardías no reemplazan la lista vigente ni vuelven a llenar la caché de completados después de salir.

## Leer la semana

El panel **Semana** selecciona hoy por defecto en la zona de la cuenta y muestra siete etiquetas de lunes a domingo, incluso sin registros. Cada día muestra su definición original, cantidad cuando existe y finalización guardada. Los días no programados se señalan sin borrar registros.

El resumen cuenta **días completados**, nunca suma cantidades de unidades distintas. Si la fecha seleccionada tiene frecuencia semanal, **Cuota de la fecha seleccionada** muestra su cuota; no sustituye las metas de los demás días aunque hayan cambiado a mitad de semana. La fecha, las metas y el recuento vienen de la API. Un fallo semanal no oculta el historial o la definición ya cargados ni bloquea por sí mismo el registro de hoy.

## Límites actuales

T6a–T6c añaden cantidades de hoy, lectura semanal, notas, correcciones por fecha, filtros de estado y pausa/archivo/restauración explícitos. No hay selector del panel semanal independiente, controles cuantitativos del dashboard, auditoría de cambios ni rediseño de estadísticas, recordatorios, autenticación, temas o dependencias.

El detalle se obtiene de la asociación autenticada antes de ofrecer edición o cargar historial y semana. Un hábito ajeno o inexistente muestra el mismo resultado de no encontrado. Cambiar ruta, cuenta o día descarta las respuestas antiguas; la API sigue siendo la autoridad de propiedad y validación.

## Contrato y comprobación

- Listar: `GET /habits` mantiene el valor activo por defecto; `?status=active|paused|archived|all` selecciona el estado.
- Cambiar estado: `PATCH /habits/:habitId/lifecycle`, sólo `{ "status": "active" | "paused" | "archived" }`, tras confirmación. No usa el PATCH antiguo ni elimina historial.
- Crear: `POST /habits`, con configuración completa.
- Editar: `PATCH /habits/:habitId/definition`, con sólo los campos cambiados y una configuración completa únicamente cuando cambia.
- Borrar metadatos opcionales: enviar `""`; omitir un campo conserva su valor.
- Registrar hoy: `POST /habits/:habitId/complete`, con `{ "amount": número }` para cantidad y sin cuerpo para checkbox.
- Semana: `GET /habits/:habitId/week` sin fecha explícita para el panel de hoy; `?date=YYYY-MM-DD` resuelve el objetivo original del editor.
- Registro por fecha: `GET /habits/:habitId/logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`, antes de ofrecer el formulario. Funciona fuera del mes actual.
- Corrección: `PATCH /habits/:habitId/logs/:date`, sólo nota cambiada y/o progreso explícito cambiado. Nunca incluye `configurationSnapshot`.
- Las respuestas tipadas exponen configuración actual y pendiente, no arrays de revisiones.

Consulta el [contrato de la API](../../api/docs/personal-habits.md) para los detalles de fechas efectivas y objetivos históricos.

Las pruebas en `tests/auth-dashboard.spec.cjs` y `tests/habit-details.spec.cjs` usan rutas sintéticas: payloads, cero y valores inválidos, reemplazo de cantidades, snapshots frente a definición actual/pendiente, cantidades antiguas desconocidas, semanas vacías y cambios de unidad a mitad de semana, notas sin pérdida de cantidades antiguas, borrado y omisión de notas sin cambios, checkbox `false`, fechas inválidas/futuras y meses anteriores, corrección inactiva, creación explícita, reintentos de lecturas sin repetir mutaciones, carreras de selección, actividad/días programados, propiedad, sesión, teclado y cambio de día en la zona de la cuenta, filtros y listas vacías, confirmación/cancelación de cada transición, conservación del detalle con respuestas de asociación antiguas, errores de estado y carreras de filtro/lectura/mutación. No verifican datos reales, MongoDB, concurrencia ni OAuth real.
