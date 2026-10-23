# Casos de uso del proyecto

## Alcance y criterios

Este documento reúne los casos de uso identificados en el backend, la aplicación web y la aplicación móvil. Los flujos describen el comportamiento que está presente en el código, no únicamente las opciones que aparecen en los menús. Cuando una pantalla está vacía, es demostrativa o anuncia una función pendiente, se indica expresamente.

Los actores nombrados son los roles manejados por el sistema: Administrador, Cajero, Mesero, Cocina y Cliente; también se consideran visitantes sin sesión cuando una función lo permite. La autenticación y los permisos se aplican en las rutas del backend y pueden variar según la operación. La navegación web filtra algunas opciones por rol, mientras que la navegación móvil no aplica un filtro general por rol.

## Acceso, cuenta y navegación

| ID | Actor(es) | Caso de uso | Precondiciones | Flujo principal | Alternativas y resultado |
|---|---|---|---|---|---|
| CU-01 | Usuario registrado | Iniciar sesión | Cuenta existente y activa; credenciales disponibles. | Ingresa usuario y contraseña; el sistema valida las credenciales y entrega un token para acceder a las funciones protegidas. Web y móvil guardan la sesión y dirigen a Mesas. | Credenciales incorrectas, cuenta inactiva, error de conexión o token inválido impiden el acceso. Cinco intentos fallidos bloquean la cuenta durante 24 horas. |
| CU-02 | Usuario registrado | Recuperar contraseña | Acceso al correo de la cuenta. | Solicita un código por correo; envía el código vigente y la nueva contraseña; el sistema actualiza la contraseña y permite volver al inicio de sesión. | Código incorrecto o vencido, correo no asociado, contraseñas que no coinciden o error al enviar el correo impiden completar el flujo. El código vence a los 15 minutos. |
| CU-03 | Usuario con cuenta bloqueada | Desbloquear cuenta | Acceso al correo asociado y cuenta bloqueada. | Solicita el código de desbloqueo, lo presenta y el sistema retira el bloqueo y restablece los intentos fallidos. | Código inválido o vencido, cuenta no bloqueada o error de correo impiden desbloquearla. |
| CU-04 | Visitante / Cliente | Registrar cuenta de cliente | No requiere iniciar sesión. | Ingresa nombre, usuario, correo, contraseña y, opcionalmente, teléfono; el sistema valida los datos y crea una cuenta con rol Cliente. | Rechaza datos obligatorios faltantes, usuario/correo duplicados o datos que no cumplen las validaciones de la interfaz. El registro público no permite escoger otro rol. |
| CU-05 | Administrador | Administrar usuarios y empleados | Sesión autenticada; permisos de Administrador para administrar otras cuentas. | Consulta y crea usuarios; actualiza sus datos, rol o estado. En móvil, la pantalla de empleados ofrece roles Cocina, Cajero y Mesero. | Rechaza roles inexistentes, duplicados, usuarios inexistentes o cambios de rol/estado efectuados por quien no tenga privilegios. |
| CU-06 | Administrador | Consultar y crear roles | Sesión con rol Administrador. | Consulta los roles existentes y registra un nuevo rol. | No se implementan operaciones de edición ni eliminación de roles. |
| CU-07 | Usuario autenticado | Consultar y editar perfil propio | Sesión vigente. | Consulta su perfil y actualiza nombre, correo, teléfono u otros datos permitidos; puede cancelar la edición. | No puede modificar el perfil de otra persona sin privilegios de Administrador. El backend valida permisos y duplicidad de correo. |
| CU-08 | Usuario autenticado | Consultar panel principal y cerrar sesión | Sesión vigente para consultar el panel. | En web, consulta el saludo, rol y resumen mostrado; puede navegar por el menú y cerrar sesión. Cerrar sesión elimina la sesión local y redirige al acceso. | Sin token o con sesión inválida se redirige al inicio de sesión. Algunos contadores y textos de actividad del panel son informativos de interfaz, no métricas consultadas al servidor. |

## Carta, mesas y pedidos

| ID | Actor(es) | Caso de uso | Precondiciones | Flujo principal | Alternativas y resultado |
|---|---|---|---|---|---|
| CU-09 | Visitante / Cliente | Consultar carta | La carta está disponible; no se requiere sesión para consultar productos. | Consulta productos, busca por nombre y filtra por categoría. En móvil, el Cliente autenticado puede continuar a personalizar un producto o vincular una mesa. | Si falla la carga, se informa el error y se puede reintentar. Las acciones de pedido requieren autenticación. |
| CU-10 | Cliente | Vincularse a una mesa mediante QR | Sesión autenticada; mesa habilitada para pedidos por QR; permiso de cámara cuando se usa el escáner. | Escanea el QR, obtiene el identificador de mesa y solicita vincularse; la aplicación consulta el estado de la mesa mientras mantiene la vinculación. | QR no reconocido o mesa no disponible se rechazan. Si la mesa termina, se elimina la vinculación y se solicita escanear otra. |
| CU-11 | Cliente | Crear y enviar pedido desde la carta | Sesión autenticada y mesa activa vinculada. | Selecciona productos, cantidades, ingredientes y opciones; añade instrucciones y envía el carrito. El servidor crea los consumos con el precio vigente y las personalizaciones. | Se rechazan cantidades, productos u opciones inválidos, carrito fuera de límites o mesa no activa. Si la mesa dejó de estar disponible, se limpia la vinculación y se pide escanear otra. |
| CU-12 | Administrador / Cajero | Administrar mesas y barras | Sesión autenticada; permisos según la operación. | Consulta mesas, crea o actualiza su información, cambia estado o elimina una mesa disponible. En móvil puede generar e imprimir el QR de una mesa. | No se elimina una mesa ocupada o con movimientos asociados. Las operaciones de activar, cerrar y finalizar requieren un estado/movimiento compatible; activar una mesa operativa requiere caja abierta. |
| CU-13 | Administrador / Cajero / Mesero | Consultar mesas y abrir una cuenta | Sesión autenticada; caja abierta para iniciar un consumo. | Consulta disponibilidad, ocupación y totales; selecciona una mesa o movimiento de barra y añade productos para iniciar la cuenta. Web y móvil reciben actualizaciones de mesa en tiempo real. | Sin caja abierta no puede iniciarse el consumo. Si falla la carga o conexión, la interfaz informa el error y permite actualizar o reintentar cuando está disponible. |
| CU-14 | Administrador / Cajero / Mesero | Registrar y modificar consumos | Mesa o movimiento de barra válido; productos existentes. | Añade productos, cambia cantidades, descuentos o notas, personaliza ingredientes/opciones y elimina líneas. En barra puede crear o seleccionar movimientos de consumo. | Una cantidad de cero elimina la línea desde las interfaces de operación. El backend rechaza referencias inválidas y errores de persistencia. |
| CU-15 | Administrador / Cajero / Mesero | Imprimir cuenta, cancelar o finalizar una cuenta | Cuenta con mesa/movimiento asociado; caja abierta para registrar la venta. | Consulta el detalle, aplica descuentos por línea, propina y domicilio; puede imprimir una vista previa, cancelar con confirmación o finalizar la cuenta. | Imprimir no finaliza la venta. Cancelar elimina/anula los consumos. La interfaz web y móvil envía el método de pago Efectivo, sin selector en este flujo. Si falta caja abierta o la cuenta no es válida, la finalización se rechaza. |
| CU-16 | Administrador / Cocina | Procesar pedidos de cocina | Sesión autenticada; pedidos con productos que requieren preparación. | Consulta pedidos pendientes, su ubicación, antigüedad, notas y modificadores; marca ítems como preparados o completa el pedido. | Los pedidos antiguos se resaltan en la interfaz. Si una actualización falla, se vuelve a consultar el estado del servidor; una ruta no disponible se informa como error. |

## Catálogo e inventario

| ID | Actor(es) | Caso de uso | Precondiciones | Flujo principal | Alternativas y resultado |
|---|---|---|---|---|---|
| CU-17 | Administrador / Cajero | Administrar categorías | Sesión autenticada; permisos de escritura según rol. | Consulta, busca, crea y edita categorías; activa o desactiva una categoría. | Se valida el nombre y se informa si hay datos inválidos, categoría inexistente o falta de permisos. La baja se maneja principalmente mediante el estado. |
| CU-18 | Administrador / Cajero; consulta de Mesero | Administrar productos e imágenes | Sesión autenticada; categoría válida para asociar el producto. | Consulta, busca, crea y edita productos, precio, cantidad, categoría y si requiere preparación; activa/desactiva y carga imágenes, escogiendo una principal. | Se validan campos requeridos, precio/cantidad y referencias. Imágenes vacías, que no sean imágenes o superen 10 MB se rechazan. Un fallo en pasos auxiliares puede dejar el producto creado con relaciones o imágenes pendientes. |
| CU-19 | Administrador / Cajero / Mesero | Mantener ingredientes y recetas | Sesión autenticada; ingredientes y productos existentes. | Consulta, crea, edita y activa/desactiva ingredientes; asocia o retira ingredientes de recetas/productos. | Se rechazan datos o relaciones inexistentes y operaciones sin permiso. |
| CU-20 | Administrador / Cajero | Configurar grupos y opciones de productos | Sesión autenticada. | Crea, consulta, edita y elimina grupos u opciones; asocia o desasocia grupos de productos. | Una asociación o registro inexistente, datos inválidos o falta de permisos impide completar la operación. En un pedido se aplican las opciones disponibles para el producto. |

## Clientes y empresa

| ID | Actor(es) | Caso de uso | Precondiciones | Flujo principal | Alternativas y resultado |
|---|---|---|---|---|---|
| CU-21 | Administrador | Consultar y crear clientes | Sesión autenticada; rol Cliente configurado para listar clientes. | En móvil, consulta clientes, busca y filtra por estado; puede crear un cliente y revisar sus visitas/compras, historial y productos asociados. | Si no existe el rol Cliente, la pantalla muestra un estado vacío. El alta valida los datos requeridos y no está disponible para otros roles en esa pantalla. |
| CU-22 | Administrador | Consultar y actualizar información de empresa | Sesión autenticada con rol Administrador; registro de empresa existente. | Consulta los datos y actualiza nombre, dirección, teléfono, NIT y correo. | Se validan campos requeridos y formato del correo en la aplicación móvil. No se implementa alta ni baja de empresas. |

## Caja, ventas y gastos

| ID | Actor(es) | Caso de uso | Precondiciones | Flujo principal | Alternativas y resultado |
|---|---|---|---|---|---|
| CU-23 | Administrador / Cajero | Consultar caja actual e historial | Sesión autenticada. | Consulta estado de caja, ingresos por método de pago, gastos, propinas, balance estimado/final e historial; puede abrir el detalle de una caja. | Si no hay caja abierta, la aplicación móvil permite dirigirse al flujo de apertura. La consulta puede filtrarse por periodos en las pantallas que lo ofrecen. |
| CU-24 | Administrador / Cajero | Abrir caja | Sesión autenticada; datos iniciales válidos. | Registra el balance inicial y crea una caja abierta. | Se rechaza un balance inválido o una operación no permitida. |
| CU-25 | Administrador / Cajero | Cerrar caja o cerrar y abrir el siguiente turno | Existe una caja abierta. | Consulta el balance esperado y registra el cierre. La operación de cierre-apertura también admite efectivo contado, notas y balance inicial de la nueva caja. | El backend calcula ventas, gastos, propinas y diferencia; rechaza cierres repetidos o una caja que no esté abierta. La pantalla móvil de cierre no solicita efectivo contado ni notas. |
| CU-26 | Administrador / Cajero / Mesero | Consultar y administrar movimientos de venta | Sesión autenticada; caja abierta para crear movimientos. | Consulta movimientos y sus detalles; el backend permite registrar y actualizar ventas. Web y móvil resumen ventas/gastos por periodo, y permiten desactivar una venta activa mientras su caja esté abierta. | Se rechazan asociaciones con cajas cerradas, barras inválidas o movimientos inexistentes. Desactivar requiere confirmación en las interfaces que lo ofrecen. |
| CU-27 | Administrador / Cajero / Mesero | Consultar gastos y balance | Sesión autenticada. | Consulta gastos y balances asociados en las pantallas de caja y movimientos. | La pantalla de movimientos web y la vista móvil muestran gastos, pero no ofrecen allí alta/edición. La gestión de gastos está disponible en el backend. |
| CU-28 | Administrador / Cajero / Mesero | Registrar, editar o eliminar gastos | Sesión autenticada; permisos definidos por la ruta. | Consulta y mantiene registros de gastos; el gasto se refleja en los cálculos de caja y resúmenes financieros. | Se rechaza un registro inexistente o una operación sin permiso. |
| CU-29 | Administrador / Cajero | Consultar y mantener proveedores | Sesión autenticada. | Consulta proveedores; Administrador puede crear y Administrador/Cajero pueden actualizarlos. | No se implementa eliminación de proveedores. |
| CU-30 | Administrador / Cajero | Consultar y mantener métodos de pago | Sesión autenticada. | Consulta métodos de pago; Administrador crea y Administrador/Cajero actualizan. | No se implementa eliminación de métodos de pago. |

## Funciones anunciadas, incompletas o de plantilla

| ID | Superficie | Función visible | Estado observado |
|---|---|---|---|
| NA-01 | Web | Empleados/usuarios, reportes/estadística y configuración | El menú presenta algunos destinos, pero las plantillas web de usuarios, reportes y configuración están vacías; no se identificó un flujo funcional de generación de reportes en esta interfaz. |
| NA-02 | Web | Proveedores, clientes y carta | El menú los muestra como “Próximamente”; no son flujos implementados desde esas pantallas web. |
| NA-03 | Móvil | Estadística | Aparece en el menú, pero no tiene una pantalla o acción funcional asociada. |
| NA-04 | Móvil | Explore | Conserva contenido demostrativo de la plantilla Expo; no representa un proceso de negocio del restaurante. |

## Trazabilidad por componente

- **Backend:** [backend/main.py](./backend/main.py), [backend/modules/](./backend/modules/) y [backend/core/](./backend/core/).
- **Aplicación web:** [frontend/templates/](./frontend/templates/) y [frontend/static/js/](./frontend/static/js/).
- **Aplicación móvil:** [mobile/src/app/](./mobile/src/app/), [mobile/src/components/](./mobile/src/components/) y [mobile/src/constants/](./mobile/src/constants/).
