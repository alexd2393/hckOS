# AleXim OS v8 — Guía de Testing Completa

## CÓMO ABRIR EL JUEGO
1. Extraé el ZIP en una carpeta
2. Abrí `index.html` directamente en Chrome o Edge (Firefox puede tener restricciones de audio)
3. Hacé clic en cualquier parte para activar pantalla completa y audio

---

## SETUP DEL NAVEGADOR (IMPORTANTE)

Para que todo funcione correctamente:
- Usá **Google Chrome** o **Edge** (no Firefox ni Safari)
- Abrí la consola con `F12 → Console` para ver logs de error
- Si algo no carga, recargá con `Ctrl+Shift+R` (hard reload)

---

## CHECKLIST DE TESTING SISTEMA POR SISTEMA

### ✅ BOOT Y OS
- [ ] La pantalla de boot aparece y el progreso avanza
- [ ] Aparece el texto parpadeante "CLIC PARA PANTALLA COMPLETA"
- [ ] Al hacer clic entra en fullscreen
- [ ] El escritorio muestra **2 columnas de íconos** visibles y scrolleables
- [ ] La HUD superior muestra: INV / CR / CALOR / nodo actual / mute
- [ ] La terminal se abre automáticamente al boot

**En consola F12 deberías ver:**
```
→ PersonGenerator OK
→ WorldPopulation OK
[WorldPopulation] Ecosistema digital activo:
  → XX ciudadanos
  → XX relaciones
  → XX posts en NodoSocial
```

---

### ✅ RED — HACKING (NUEVO SISTEMA v8)

**Flujo correcto completo:**
```
scan
connect 192.168.1.1
recon 192.168.1.1         ← ver puertos, OS, capas
bypass FIREWALL firewall  ← bypassear primer capa
ls                        ← listar archivos
download access.log       ← robar archivo
wipelog                   ← borrar huellas
disconnect
```

**Verificar:**
- [ ] `scan` muestra router.local (192.168.1.1) al inicio
- [ ] `connect 192.168.1.1` conecta y muestra las capas detectadas
- [ ] `recon 192.168.1.1` muestra puertos abiertos (22, 80, 443), OS, y lista de capas
- [ ] `bypass FIREWALL firewall` lanza animación y muestra resultado (éxito o fallo)
- [ ] Al bypasear todas las capas: aparece "█ ACCESO COMPLETO OBTENIDO █"
- [ ] `ls` muestra archivos SIN precios, con permisos Unix
- [ ] `traverse` lista nodos internos del servidor
- [ ] `traverse [id]` navega a un nodo interno
- [ ] `wipelog` reduce el heat y confirma borrado
- [ ] `disconnect` sin wipelog previo muestra advertencia de rastros

**Si `bypass` siempre falla:** usá herramientas de mayor nivel (comprá en DarkMarket)

---

### ✅ RED — FLUJO LEGACY (aún funcional)
```
connect 192.168.1.1
breach        ← redirige al nuevo sistema, no hace nada automático
```
- [ ] `breach` muestra instrucciones del nuevo sistema sin ejecutar nada

---

### ✅ DARKMARKET — ECONOMÍA
```
scan → connect → recon → bypass FIREWALL firewall → ls
download clientes.csv      ← si existe
sell clientes.csv
offers                     ← esperar 15-90 segundos
accept [offer-id]          ← desde la terminal O desde app Mensajes
```
- [ ] `sell [archivo]` dice "compradores contactados"
- [ ] Después de ~30 segundos llega notificación en el OS (no en la terminal)
- [ ] La app Mensajes muestra la oferta con botón Aceptar
- [ ] Al aceptar, la app MP registra el movimiento

---

### ✅ APP MENSAJES
- [ ] Abrí doble clic en "Mensajes" en el escritorio
- [ ] Sidebar muestra DarkMarket, NEXUS, SHADOW como contactos
- [ ] Al llegar una oferta aparece badge rojo en el ícono del escritorio
- [ ] Los mensajes tienen botones Aceptar/Rechazar integrados

---

### ✅ APP NODOSOCIAL
- [ ] Doble clic en el ícono NodoSocial
- [ ] Debería mostrar posts de ciudadanos argentinos procedurales
- [ ] Si está vacío → hacé clic en "🔄 Recargar feed"
- [ ] Si sigue vacío → abrí la consola y ejecutá:
  ```javascript
  PersonGenerator.getAll().length   // debería ser > 20
  SocialContentGenerator.count()    // debería ser > 0
  ```
- [ ] Tab "Buscar" permite filtrar por nombre/ciudad/empresa
- [ ] Tab "Filtraciones" muestra posts con info sensible

**Forzar generación desde consola si falla:**
```javascript
PersonGenerator.generate(20)
SocialContentGenerator.init()
window.dispatchEvent(new CustomEvent('nodo-social-update'))
```

---

### ✅ APP PEOPLESEARCH
- [ ] Muestra lista de ciudadanos generados
- [ ] El buscador filtra en tiempo real
- [ ] Hacer clic en un ciudadano abre Identity Profiler

---

### ✅ APP IDENTITY PROFILER
- [ ] Al abrir desde PeopleSearch muestra: nombre, edad, ciudad, trabajo
- [ ] Tab "Intel" muestra vulnerabilidades de la persona
- [ ] Tab "NodoSocial" muestra sus publicaciones

---

### ✅ APP DARKFORUM
- [ ] Muestra posts del foro underground
- [ ] Los posts son expandibles (clic en el título)
- [ ] Al hacer un breach exitoso aparece un post reactivo

---

### ✅ THREAT MONITOR (AGENTES IA)
- [ ] Abrí el ícono ☣ "Amenazas" en el escritorio
- [ ] Tab "Agentes": muestra los 6 agentes con su estado
- [ ] Tab "Log": historial de acciones (al inicio estará vacío)
- [ ] Los agentes policiales están INACTIVOS hasta que el heat supere 55%
- [ ] Los rivales (phantom_ba, z3r0x_ar) están en modo ESCANEANDO

**Para testear los agentes forzadamente (consola F12):**
```javascript
// Activar agente policial manualmente
AdversarialSystem.forceAction('uec_rivas', 'honeypot')

// Subir heat para activar agentes
ReputationSystem.addHeat(60, 'test')

// Ver todos los agentes
AdversarialSystem.getAgents()
```

---

### ✅ APP MP (WALLET)
- [ ] Doble clic en "MP" muestra saldo actual
- [ ] Número de cuenta formato MP-XXXXXXXX
- [ ] Sección de movimientos: aparece al vender datos o comprar tools
- [ ] Botones de acceso rápido funcionan

---

### ✅ APP MI PC
- [ ] Tab "Estado": calor, reputación, VPN, red
- [ ] Tab "Inventario": datos robados (vacío al inicio)
- [ ] Tab "Monitor": barras de CPU/RAM/Red en vivo

---

### ✅ APP CRÓNICALDIGITAL
- [ ] Muestra noticias base al inicio
- [ ] Al hackear un nodo aparecen noticias dinámicas después de ~30 segundos
- [ ] Badge rojo en el ícono del escritorio al llegar noticias no leídas
- [ ] Clic en una noticia abre el artículo completo

---

### ✅ AJUSTES / TEMAS
- [ ] Doble clic en "Ajustes"
- [ ] Tab "Temas": 6 temas visibles con preview
- [ ] Clic en un tema cambia los colores inmediatamente
- [ ] Al recargar el juego el tema persiste (localStorage)

---

### ✅ TERMINAL — COMANDOS COMPLETOS
Ejecutá `help` para ver todos. Los más importantes:

| Comando | Debería hacer |
|---------|--------------|
| `scan` | Descubrir nodos de red |
| `recon [ip]` | Analizar un nodo objetivo |
| `bypass [CAPA] [tool]` | Hackear una capa de seguridad |
| `traverse` | Ver/navegar nodos internos |
| `wipelog` | Borrar huellas y reducir heat |
| `ls` | Listar archivos (con carpetas y permisos) |
| `download [archivo]` | Robar archivo al inventario |
| `sell [archivo]` | Listar en DarkMarket |
| `offers` | Ver ofertas pendientes |
| `accept [id]` | Aceptar oferta |
| `heat` | Estado del calor policial |
| `whois [nombre]` | Buscar ciudadano en el mundo |
| `feed` | Ver NodoSocial en la terminal |
| `agents` | Estado de agentes adversariales |
| `scan-threats` | Escanear amenazas activas |
| `people` | Estadísticas del ecosistema humano |

---

## ERRORES CONOCIDOS Y SOLUCIONES

### "El mundo se está generando..." en NodoSocial que no carga
**Causa:** timing entre PersonGenerator y SocialContentGenerator
**Solución:** Cerrar y reabrir la app NodoSocial, o usar el botón "Recargar feed"
**Solución desde consola:**
```javascript
PersonGenerator.generate(15)
SocialContentGenerator.init()
window.dispatchEvent(new CustomEvent('nodo-social-update'))
```

### `bypass` siempre falla
**Causa:** herramienta de bajo nivel contra capa de alta seguridad
**Solución:** Comprá mejores herramientas en DarkMarket (FW-Ghost, ProxyChain AR)
**Verificar desde consola:** `GameState.getSoftware()`

### Agentes no aparecen en Threat Monitor
**Causa:** AdversarialSystem se inicializa 3.5s después del boot
**Verificar:** `AdversarialSystem.getAgents()` en consola
**Si retorna array vacío:** `AdversarialSystem.init()` manual

### Las notificaciones aparecen muchas veces
**Causa:** múltiples listeners. Recargar el juego con `SaveSystem.reset()` desde consola

### Sin audio
**Solución:** Hacé clic en cualquier parte del OS primero (requerimiento del navegador)

---

## FLUJO DE TESTING RÁPIDO (5 minutos)

```bash
# 1. Boot
Clic para fullscreen → esperar boot

# 2. Tutorial de red
scan → connect 192.168.1.1 → recon 192.168.1.1 → bypass FIREWALL firewall
→ (si falla, repetir) → ls → download access.log → wipelog → disconnect

# 3. Economía
sell access.log → esperar 30s → app Mensajes → aceptar oferta → app MP (verificar movimiento)

# 4. Mundo humano
App NodoSocial → verificar posts
App PeopleSearch → clic en alguien → Identity Profiler

# 5. Enemigos
App Threat Monitor → Tab Agentes (verificar 6 agentes)
Consola: ReputationSystem.addHeat(60,'test') → ver activación de agentes

# 6. Misceláneos
App CrónicaDigital → App DarkForum → App MP → App Mi PC
Ajustes → cambiar tema → verificar que persiste
```

---

## CONSOLA — COMANDOS DE DEBUG ÚTILES

```javascript
// Estado general
WorldPopulation.getStats()
AdversarialSystem.getAgents()
PersonGenerator.getAll().length
SocialContentGenerator.count()

// Forzar situaciones
ReputationSystem.addHeat(70, 'test')       // activar agentes policiales
AdversarialSystem.forceAction('uec_rivas', 'honeypot')  // plantar trampa
EconomySystem.triggerEvent('kirchner_corruption')       // evento económico
EventSystem.trigger('kirchner_vialidad')               // evento mundial

// Resetear
SaveSystem.reset()    // limpia todo y recarga

// Ver dinero y tools
GameState.getMoney()
GameState.getSoftware()
```
