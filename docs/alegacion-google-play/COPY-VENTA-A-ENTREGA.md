# Copy visible: venta → entrega (reversible)

Fecha: 2026-11-20  
Ámbito: **solo textos visibles en la UI** de la app Ionic (`src/app/**/*.html` y mensajes/títulos en `historial.page.ts`).  
**No** se renombraron rutas, clases CSS, variables, servicios ni endpoints (`/venta`, `ventas.service`, `rolActual === 'vendedor'`, `esVendedor()`, etc.).

## Mapa de términos

| Antes (UI) | Ahora (UI) |
|------------|------------|
| Vender | Entregar |
| Venta | Entrega |
| Ventas | Entregas |
| Venta QR / Venta por QR | Entrega QR / Entrega por QR |
| historial de ventas | historial de entregas |
| Gestiona la venta… | Gestiona la entrega… |
| para la venta | para la entrega |
| Disponibles para vender | Disponibles para entregar |
| Va a vender | Va a entregar |
| Venta registrada con éxito | Entrega registrada con éxito |
| nueva venta | nueva entrega |
| Ventas registradas | Entregas registradas |
| solo para vendedores | solo para colaboradores |
| Vendedor (rol / etiqueta) | Colaborador |
| Vendedores (menú gestor) | Colaboradores |
| Añadir Vendedor / Nuevo Vendedor | Añadir colaborador / Nuevo colaborador |
| Inicio Vendedor | Inicio colaborador |
| Configuración de Ventas | Configuración de entregas |

## Archivos tocados

### HTML
- `app.component.html`
- `tabs/tabs.page.html`
- `venta/venta.page.html`
- `venta-qr/venta-qr.page.html`
- `venta-manual/venta-manual.page.html`
- `vendedor/vendedor.page.html`
- `escaner/escaner.page.html`
- `perfil/perfil.page.html`
- `historial/historial.page.html`
- `cuenta-cobro/cuenta-cobro.page.html`
- `gestor-home/gestor-home.page.html`
- `gestor-vendedores/gestor-vendedores.page.html`
- `gestor-devolucion/gestor-devolucion.page.html`
- `gestor-participaciones/gestor-participaciones.page.html`
- `gestor-pago/gestor-pago.page.html`
- `gestor-asignacion/gestor-asignacion.page.html`
- `tab3/tab3.page.html`, `loteria-social/loteria-social.page.html`, `cartera/cartera.page.html`, `resultados/resultados.page.html` (rol «Colaborador»)
- `notificaciones/notificaciones.page.html`, `notificacion-detalle/notificacion-detalle.page.html`

### TypeScript (solo copy visible)
- `historial/historial.page.ts` — `getTituloTipo`, `getDescripcion`, `getTituloVenta`, mensaje de error del historial

### Scripts de apoyo (en esta carpeta)
- `_apply_copy_entrega.py` / `_apply_copy_entrega2.py` / `_apply_copy_entrega3.py` — aplicación por lotes  
- `_scan_copy.py` — búsqueda de restos visibles  

## Cómo revertir

```bash
cd h:/Users/Jorge/proyectos/sipart
# Si aún no hay commit dedicado, restaurar los HTML/TS listados:
git checkout -- src/app/app.component.html src/app/tabs/tabs.page.html \
  src/app/venta src/app/venta-qr src/app/venta-manual src/app/vendedor \
  src/app/escaner src/app/perfil src/app/historial \
  src/app/cuenta-cobro src/app/gestor-home src/app/gestor-vendedores \
  src/app/gestor-devolucion src/app/gestor-participaciones src/app/gestor-pago \
  src/app/gestor-asignacion src/app/tab3 src/app/loteria-social \
  src/app/cartera src/app/resultados src/app/notificaciones src/app/notificacion-detalle
```

O `git revert <commit>` si este cambio va en un commit propio.

La lógica interna (`venta`, `vendedor`, APIs) **no** cambia al revertir el copy.

## Nota producto

La app sigue registrando entregas/asignaciones; el dinero queda fuera. El disclaimer *«Registro de entregas realizadas fuera de la app…»* se mantiene.
