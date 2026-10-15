# ARCA Control - Guía de Deployment a Vercel

## Paso 1: Agregar Endpoints al Google Apps Script

1. **Abre tu proyecto** en `script.google.com/home/projects/1AhkP8dUA...`
2. **Copia el contenido** de `endpoints-gas-code.gs` 
3. **Pégalo al final** de tu archivo `V2_Emision.gs` o crea un nuevo archivo `V2_API_Endpoints.gs`
4. **Guarda** el proyecto (Ctrl+S)

## Paso 2: Implementar (Deploy) el Script

1. Haz clic en **"Implementar"** (botón azul arriba)
2. Selecciona **"Nueva implementación"**
3. Tipo: **"Aplicación web"**
4. Ejecutar como: **Tu cuenta de Google**
5. Acceso: **"Cualquiera"** (para que Vercel pueda llamarlo)
6. **Deploy**
7. **Copia la URL** que te da - será algo como:
   ```
   https://script.google.com/macros/d/1AhkP8dUA.../usercopy
   ```

## Paso 3: Clonar y Subir a GitHub

```bash
# En tu computadora
git clone https://github.com/yourusername/arca-web-app.git
cd arca-web-app

# Pega los archivos aquí (app-page.tsx, package.json, etc.)
git add .
git commit -m "Initial commit: ARCA Control web app"
git push origin main
```

## Paso 4: Conectar a Vercel

1. **Ve a** [vercel.com](https://vercel.com)
2. **Login** con tu cuenta de Google
3. **"New Project"**
4. **Selecciona tu repositorio** `arca-web-app`
5. **Framework**: Next.js
6. **Environment Variables**:
   ```
   NEXT_PUBLIC_SCRIPT_URL=https://script.google.com/macros/d/1AhkP8dUA.../usercopy
   NEXT_PUBLIC_SCRIPT_ID=1AhkP8dUA...
   ```
7. **Deploy**

## Paso 5: Probar

1. Abre la URL que Vercel te proporciona (algo como `arca-control.vercel.app`)
2. Verifica que cargue correctamente
3. Prueba:
   - Cambiar tema (claro/oscuro) → debe persistir
   - Hacer clic en botones → debe mostrar alertas
   - Consola del navegador (F12) → no debe haber errores

## Actualizar la App

Si haces cambios locales:
```bash
git add .
git commit -m "Descripción del cambio"
git push origin main
# Vercel se redeploya automáticamente
```

## URLs Clave

- **Dashboard**: `https://tuapp.vercel.app/`
- **Google Script**: `https://script.google.com/macros/d/1AhkP8dUA.../usercopy`

## Troubleshooting

### "CORS error" en la consola
- El Script debe tener acceso público
- Ve a Implementar → selecciona la versión actual → Ejecutar como "Cualquiera"

### "ARCA_DB_ID no configurado"
- Verifica que en tu Script Properties esté guardado el ID del Google Sheet
- En `V2_Config.gs`, busca donde se carga con `PropertiesService.getScriptProperties()`

### No se ve el tema guardado
- Verifica que localStorage esté habilitado en el navegador
- En modo incógnito no se guarda

---

**¡Listo!** La web app está en Vercel y conectada a tu Script de Google.
