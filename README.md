# Juan Fran · Vanderlande Fleet & Site Control

[Demo de presentación para el cliente](https://sanchomik46.github.io/juan-fran-fleet-control/)

PWA en español personalizada para Juan Fran. La interfaz usa una sola columna móvil, navegación inferior con escáner, controles táctiles amplios y formularios con acciones fijas al pie. En pantallas grandes, la aplicación mantiene un ancho máximo de 480 píxeles. La flota inicial, los números de serie, las referencias SKU, las ubicaciones y las evidencias son datos de demostración. Las familias del catálogo siguen la nomenclatura del encargo.

Los proyectos, movimientos y métricas iniciales son fixtures sintéticas para esta presentación. Las marcas y ciudades proceden de las referencias del encargo. Los supervisores de ejemplo se identifican como demo y el histórico inicial usa coordenadas sin registrar. Juan Fran es el nombre solicitado para personalizar la aplicación.

## Publicar la demo en GitHub Pages

1. Descomprime el ZIP del código y sube su contenido a la rama principal del repositorio. Deja `package.json` y `.github/` en la raíz del repositorio.
2. En el repositorio abre **Settings → Pages** y elige **GitHub Actions** en **Source**.
3. En **Actions → Publicar demo en GitHub Pages**, pulsa **Run workflow**. GitHub mostrará la URL HTTPS en el entorno `github-pages` cuando termine.
4. Abre ese enlace en el móvil. En Android usa **Instalar aplicación** en el menú del navegador. En Safari para iPhone usa **Compartir → Añadir a pantalla de inicio**.

La publicación se ejecuta manualmente. El workflow adapta la ruta de la PWA a la del repositorio. El primer acceso debe hacerse con conexión para descargar la aplicación y el OCR. Cada navegador conserva sus propios datos y adjuntos en IndexedDB. Para la presentación, usa el albarán de prueba y las fotos de ejemplo.

## Desarrollo local

Requiere Node.js 22.12 o posterior y npm.

```sh
npm ci
npm run dev
```

Para probar el service worker y la instalación:

```sh
npm run build
npm run preview
```

Abre la URL que muestra el terminal. La cámara y el GPS dependen de los permisos del navegador y requieren HTTPS o localhost. El selector de archivo admite fotos ya tomadas. Si el GPS está desactivado, se indica en el sello.

## Probar el flujo

1. Desde la vista general, selecciona **Registrar entrada** o **Salida a proyecto**. En la entrada puedes dar de alta una serie nueva.
2. Selecciona activos o utiliza el escáner QR y de barras. El pasaporte permite descargar el QR de una unidad para probar la lectura desde una foto.
3. Añade una foto o elige **Albarán de prueba** y pulsa **Analizar con IA/OCR**. Revisa las referencias y cantidades detectadas.
4. Anota una incidencia sobre una foto y asigna el activo afectado para que pase a cuarentena al guardar.
5. Firma en pantalla. Guarda el movimiento y usa **Imprimir / PDF** en el albarán. Puedes reabrir el documento desde **Movimientos**.

## Integraciones opcionales

| Variable | Contrato |
| --- | --- |
| `VITE_VISION_ENDPOINT` | POST JSON con `image` como URL de datos Base64 y `catalog` con referencias y alias. Devuelve `{ "materials": [...] }` con `sku`, `description`, `category`, `quantity` y `box_condition` por línea. El servidor puede llamar a Gemini Vision u otro proveedor. Si el servicio está inactivo o el dispositivo está sin conexión, Tesseract lee la foto localmente y busca SKU o alias del catálogo. |
| `VITE_SYNC_ENDPOINT` | POST JSON de cada movimiento con `robots` en su estado tras el movimiento, fotos y firma en Base64. El servidor debe usar `Idempotency-Key` como clave por movimiento y devolver 2xx tras guardar sus datos. La app elimina la entrada de la cola solo tras el acuse de recibo. |

Los endpoints son configuraciones públicas del frontend. Mantén las credenciales en el servidor e implementa allí el acceso corporativo y las políticas de almacenamiento. Gestiona los tickets desde el canal oficial de Vanderlande con el informe que prepara el pasaporte.


## Imagen de portada

`public/warehouse.webp` se generó con ImageGen para ilustrar el entorno de demostración.

> Use case: photorealistic-natural. Asset type: widescreen hero background photograph for an industrial warehouse fleet-control dashboard. Ultra-wide cinematic horizontal composition, clean editorial documentary photography of a real, huge automated high-bay intralogistics warehouse with very tall dense graphite steel rack aisles, subtle safety-orange crossbars, raised conveyor lines, and a compact orange autonomous shuttle in the right third. Dramatic perspective and repetition. Put all strongest details and lighting in the right and center thirds. Left third falls into natural near-black industrial shadow to accept a web heading over it later. Cool charcoal slate palette warmed with muted burnt orange, realistic white ceiling lights, crisp materials, professional technical aesthetic, dark overall exposure. Full bleed, suitable for a 5:1 center crop, no people, no signage, no typography, no watermarks, do not draw any UI.
