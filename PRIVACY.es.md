# Privacidad — CyberClock

CyberClock funciona en tu PC y guarda tus datos en tu PC. **No tiene cuenta, telemetría, SDK de analítica ni anuncios.** Nunca envía tu ajustes, sonidos de alarma o copias de seguridad a su autor ni a nadie más.

Todo lo que sabe (ajustes, sonidos de alarma o copias de seguridad) se queda en `%APPDATA%\com.cybergems.cyberclock\` (ajustes, sonidos de alarma y copias). Las versiones portables lo guardan todo en una carpeta `data` junto al ejecutable. El instalador ofrece la casilla **Delete app data**; al marcarla en una instalación nueva elimina las carpetas de datos de la app.

## Cuándo CyberClock se conecta a internet

Estas son todas las conexiones que CyberClock hace por su cuenta. Ninguna envía tu ajustes, sonidos de alarma o copias de seguridad. Como en cualquier petición de internet, el servidor ve tu dirección IP.

| Cuándo | Dónde | Para qué | Cómo desactivarlo |
|---|---|---|---|
| 8 segundos después de iniciar | `github.com` (latest.json) | Consultar GitHub Releases para detectar una versión nueva | `autoUpdate` en Configuración |
| Al iniciar y cada 6 horas con la precisión del reloj activada | `pool.ntp.org`, `time.windows.com`, `time.google.com` (UDP/123) y, como respaldo, `www.cloudflare.com` o `www.google.com` (TCP/80) | Medir la desviación del reloj. La hora solo se cambia si está activada la sincronización automática | Comprobación periódica: `clockAccuracyEnabled`. La ráfaga inicial de hasta 10 comprobaciones no tiene ajuste específico |
| Solo durante la instalación | `go.microsoft.com` | Descargar WebView2 si Windows no lo tiene | Sin ajuste; solo en el instalador |

Los enlaces que abres tú no están en esta lista.

## Qué lee CyberClock de tu PC

CyberClock lee el reloj del sistema y, si activas la sincronización automática, ajusta la hora local. Esa información se queda en pantalla. Todo lo que cambia el sistema pide confirmación antes y, cuando es posible, guarda una copia para poder deshacerlo.

## Dudas

Abre un issue: https://github.com/CyberGems/CyberClock/issues

Para una pregunta concreta sobre privacidad, usa la [página de contacto](https://cybergems.org/contact). La declaración general de la suite está en [cybergems.org/es/privacy](https://cybergems.org/es/privacy).
