# Deuda visual aceptada — responsive del panel

Ítems aceptados conscientemente al cerrar la auditoría de consistencia visual y
responsive del panel administrativo y los portales (julio 2026). Ninguno fue
introducido por ese trabajo: los tres son preexistentes y se documentan porque
la auditoría los midió por primera vez y decidió no corregirlos.

Mismo criterio que [`riesgo-residual-acceso.md`](./riesgo-residual-acceso.md):
este documento no propone trabajo nuevo, dimensiona lo que ya se decidió
postergar y deja escrita la condición que lo reactiva.

Alcance de la auditoría que los encontró: `/admin` (10 rutas × 360 y 1440px) y
los cuatro portales (`TEACHER`, `GUARDIAN`, `STUDENT`, `SUPER_ADMIN`; 9 rutas ×
360, 768, 1024 y 1440px).

## 1. El `min-content` del root de `Tabs` desborda tres vistas de asignaciones

**Descripción**: `TabsTrigger` lleva `whitespace-nowrap`, así que el
`min-content` de un `TabsList` es el ancho completo de sus etiquetas — 356px en
las tres vistas de asignaciones. Cuando ese `Tabs` vive dentro de un
`CardHeader`, cuyo contenido útil a 360px es de 326px, el mínimo intrínseco no
cabe y el documento desborda 38px.

El viewport de scroll que `apps/web/components/ui/tabs.tsx` envuelve alrededor
de `TabsList` **no reduce ese mínimo**. Se verificó en vivo: ni siquiera
agregando `min-width: 0` sobre el viewport baja de 356px, porque Chrome no
propaga el mínimo cero de un scroll container en el eje transversal de un flex
column. El viewport sí resuelve el caso donde `Tabs` es hijo directo del
contenedor de página (`/admin/calendario`: 159px → 0; `/admin/configuracion`:
87px → 0), que era su objetivo.

Rutas afectadas, todas a 360px:

| Ruta | Desborde | Vía por la que se escapa el mínimo |
| --- | --- | --- |
| `/admin/asignaciones` | 38px | `CardHeader` en `flex` + `items-start` → hijos por `fit-content` |
| `/profesor/asignaciones` | 38px | idéntica |
| `/alumno/asignaciones` | 38px | `CardHeader` queda en `grid`; el mínimo de la pista es el `min-content` del hijo |

**Contraste de markup entre las vistas gemelas** (se verificó explícitamente
porque la simetría fue argumento para aceptar la deuda): el wrapper de la fila
de filtros es idéntico carácter por carácter —
`flex flex-col gap-3 sm:flex-row sm:items-center` en
`app/admin/asignaciones/page.tsx:143` y en
`app/profesor/asignaciones/page.tsx:181` — pero **los hijos difieren**: admin
tiene cuatro (combobox de profesor `w-full sm:w-64`, select de clase
`w-full sm:min-w-[250px] sm:max-w-sm`, el `Tabs`, y un botón condicional de
limpiar filtros) y profesor tiene dos (select `w-full sm:min-w-[300px]
sm:max-w-md` y el `Tabs`). La simetría vale a 360px, donde ambas filas se
apilan y el único driver es el `min-content` del `Tabs`; no vale por encima de
`sm`, donde admin carga dos controles más.

**Impacto**: bajo. Afecta a la fila de filtros de tres rutas por debajo de
~400px de viewport. El contenido sigue siendo alcanzable con scroll horizontal
y no se pierde ninguna función. El resto de las 19 rutas auditadas mide cero
desborde en las cuatro anchuras.

**Opciones evaluadas y descartadas**:

- *Parchear el síntoma en cada consumidor* (`flex-wrap`, `items-stretch`, o
  `grid-cols-1` según la vía de escape de cada uno): son tres arreglos
  distintos para una causa única, y ninguno impide que la próxima vista que
  meta un `Tabs` en un `CardHeader` estrecho reproduzca el defecto. Ya ocurrió
  tres veces sin que nadie lo buscara.
- *Corregir `items-start` en `CardHeader`* (`apps/web/components/ui/card.tsx:23`):
  arregla dos de las tres rutas — se midió que con `align-items: stretch` el
  desborde cae a 0 en admin y profesor, pero **no en alumno**, cuyo `CardHeader`
  se resuelve como `grid`. Y toca 101 consumidores de `CardHeader` (24 pasan
  `display` propio, 38 pasan `className` sin `display`, 39 no pasan nada), de
  los cuales 77 dependen del `grid` por defecto. Ver ítem 2.
- *Arreglar solo una de las rutas gemelas*: introduce asimetría deliberada
  entre dos archivos cuya fila de filtros comparte wrapper, y deja la de admin
  —que tiene más controles— sin corregir.

**Condición para priorizar**: cuando se abra trabajo sobre el `min-content` del
primitivo `Tabs`, o cuando una vista nueva reproduzca el desborde y eleve el
conteo por encima de tres. La salida correcta es una fase propia sobre
`ui/tabs.tsx` que mida el impacto en sus 6 consumidores y en los 101 de
`CardHeader`, no un parche por vista.

## 2. `CardHeader` fuerza `fit-content` en sus hijos vía `items-start`

**Descripción**: `apps/web/components/ui/card.tsx:23` incluye `items-start` en
la cadena base de `CardHeader`. En los consumidores que le pasan `display: flex`
propio, eso dimensiona a los hijos por `fit-content`, que nunca baja del
`min-content` — el mecanismo por el que se escapa el ítem 1 en dos de sus tres
rutas.

Nota de diagnóstico, por si vuelve a revisarse: **no hay conflicto de cascada
entre el `grid` de la base y el `flex` del consumidor**. `cn()` es
`twMerge(clsx(...))` (`apps/web/lib/utils.ts:5`) y ya resuelve el grupo
`display` a favor del consumidor; se verificó midiendo el `display` computado.
Lo que sobrevive son `auto-rows-min` y `grid-rows-[auto_auto]`, inertes sobre un
contenedor flex.

**Impacto**: acotado al ítem 1. No se detectó ninguna otra vista donde
`items-start` produzca desborde.

**Condición para priorizar**: junto con el ítem 1, o si aparece una tercera
vista afectada por el mismo mecanismo. Cualquier cambio exige verificar los 101
consumidores: los 77 que hoy dependen del `grid` por defecto pasarían de
encogerse a su contenido a ocupar el ancho completo.

## 3. Limpieza bloqueada: restos inertes en 24 `CardHeader`

**Descripción**: los 24 consumidores que pasan `display: flex` propio reciben
igualmente `auto-rows-min grid-rows-[auto_auto]` desde la cadena base, sin
efecto alguno sobre un contenedor flex.

**Impacto**: nulo en render. Es ruido de DOM.

**Condición para priorizar**: solo tiene sentido resolverlo junto al ítem 2,
tocando el primitivo. Quitarlo por consumidor exigiría que cada uno de los 24
pasara `grid-rows-none auto-rows-auto` — dos clases nuevas para neutralizar dos
inertes, en archivos entre los que está `app/admin/asignaciones/page.tsx`.
