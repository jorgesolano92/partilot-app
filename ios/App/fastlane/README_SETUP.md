# Partilot · Build, firma y publicación iOS con Fastlane

App: **Partilot** · Bundle ID: `com.partilot.app` · App Store Connect App ID: `6781750302`
Framework: **Ionic + Angular 19 + Capacitor** (NO Expo — Expo/EAS no puede compilar este proyecto).
Equipo Apple: **PARTILOT SOCIEDAD LIMITADA** (Team ID `LZSGVZAVLQ`).

`match` genera y gestiona automáticamente los certificados y provisioning profiles de iOS
(equivalente Capacitor a lo que hace EAS en Expo). Los guarda **cifrados** en un repo Git privado.

---

## 1. Estado actual (ya hecho y verificado ✅)

| Componente | Estado |
|---|---|
| Node/npm + `npm install` | ✅ |
| Angular build → carpeta `www` | ✅ |
| Plataforma iOS Capacitor (`ios/App/App.xcworkspace`) | ✅ |
| CocoaPods 1.16.2 + 10 pods | ✅ |
| Fastlane 2.236.1 | ✅ |
| Xcode 26.6 (compila para simulador y dispositivo) | ✅ |
| Deployment target iOS **15.0** (lo exige el plugin de biometría) | ✅ |
| Certificado **Apple Distribution** + perfil App Store (match) | ✅ en repo privado cifrado |
| Certificado **Apple Development** + perfil dev (con dispositivo) | ✅ en repo privado cifrado |
| **Subida a TestFlight** (`fastlane beta`) | ✅ hecho |
| **Instalación directa en iPhone** (`fastlane device`) | ✅ hecho |

Repo de certificados (privado): `https://github.com/jorgesolano92/partilot-app-ios-certs`

---

## 2. Requisitos del sistema (instalar una vez)

```bash
# Herramientas nativas (Homebrew)
brew install cocoapods fastlane

# Xcode completo desde la Mac App Store, y luego:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

## 3. Secretos y credenciales

Todo vive en `ios/App/fastlane/` y está protegido por `.gitignore` (no se sube al repo):

- `fastlane/.env` — variables de entorno (IDs de la API Key, Team ID, URL y contraseña de match).
- `fastlane/secrets/AuthKey_HP46LXMXH9.p8` — App Store Connect API Key (¡solo se descarga una vez!).
- `fastlane/secrets/asc_api_key.json` — la misma API Key en formato JSON (usada por `revoke_dev_certs`).

Valores actuales del `.env`:

| Variable | Valor |
|---|---|
| `ASC_KEY_ID` | `HP46LXMXH9` |
| `ASC_ISSUER_ID` | `ef956c6b-9b7c-4b62-a872-24b213418751` |
| `ASC_KEY_PATH` | `./fastlane/secrets/AuthKey_HP46LXMXH9.p8` |
| `FASTLANE_TEAM_ID` | `LZSGVZAVLQ` |
| `MATCH_GIT_URL` | `https://github.com/jorgesolano92/partilot-app-ios-certs.git` |
| `MATCH_PASSWORD` | (secreto — guardado en gestor de contraseñas) |

> ⚠️ **Guarda `MATCH_PASSWORD` en un gestor de contraseñas.** Es la clave que descifra el repo
> de certificados; sin ella no podrás recuperar los certificados en otra máquina.

### Acceso a GitHub (repo privado de certificados)
git accede por HTTPS con un token guardado en el llavero de macOS (osxkeychain). Si el token
caduca o se revoca, vuelve a guardarlo:
```bash
printf "protocol=https\nhost=github.com\nusername=jorgesolano92\npassword=TU_TOKEN\n\n" | git credential approve
```
El token es un **fine-grained PAT** con permiso *Contents: Read and write* solo sobre el repo de certificados.

---

## 4. Uso diario

Siempre desde `ios/App/` y cargando el `.env` primero:

```bash
cd ios/App
export $(grep -v '^#' fastlane/.env | xargs)
```

Antes de cualquier build, si cambiaste código web, reconstruye y sincroniza (desde la raíz del proyecto):
```bash
npm run build && npx cap sync ios
```

### Lanes disponibles

| Comando | Qué hace |
|---|---|
| `fastlane certificates` | Sincroniza/crea el certificado de **distribución** y el perfil **App Store** (para publicar). |
| `fastlane certificates_dev` | Sincroniza/crea el certificado y perfil de **desarrollo** (requiere ≥1 dispositivo registrado). |
| `fastlane device` | Registra el iPhone conectado, firma en desarrollo, compila e **instala en el dispositivo**. |
| `fastlane build` | Genera un `.ipa` firmado para App Store, **sin subir**. |
| `fastlane beta` | Compila y **sube a TestFlight** (sube el nº de build automáticamente). |
| `fastlane release` | Compila, sube el binario y lo **envía a revisión de App Store** (publicación automática al aprobarse). |
| `fastlane submit_review` | Envía a revisión el **último build ya subido** (p.ej. por `beta`), **sin recompilar**. |
| `fastlane revoke_dev_certs` | Revoca los certificados de **desarrollo** (libera cupo). NO toca los de distribución. |

Ejemplos:
```bash
fastlane beta      # publicar nueva versión a TestFlight
fastlane device    # instalar en el iPhone conectado por cable
```

---

## 5. Instalar en un iPhone físico

1. Conecta el iPhone por cable y confía en el ordenador.
2. `fastlane device` (registra el dispositivo, firma en desarrollo, compila e instala).
3. En el iPhone, la primera vez:
   - **Ajustes → General → VPN y gestión de dispositivos** → *PARTILOT SOCIEDAD LIMITADA* → **Confiar**.
   - Si hace falta: **Ajustes → Privacidad y seguridad → Modo de desarrollador** → ON (reinicia).

### Registrar un dispositivo nuevo
Edita la lane `device` en el `Fastfile` (o crea una entrada) con el nuevo nombre y UDID:
```ruby
register_devices(devices: { "iPhone de X" => "UDID_DEL_DISPOSITIVO" }, api_key: key)
```
Obtén el UDID con: `xcrun xctrace list devices` (columna entre paréntesis del dispositivo físico).
Luego `fastlane device` regenerará el perfil de desarrollo incluyendo el nuevo dispositivo.

---

## 6. Publicar en TestFlight / App Store

- `fastlane beta` sube el build a **TestFlight**. Apple lo procesa unos minutos; después aparece en
  **App Store Connect → TestFlight**, donde puedes invitar testers.
- **Enviar a revisión de App Store:**
  - `fastlane release` — compila una versión nueva, sube el binario y lo envía a revisión.
  - `fastlane submit_review` — envía a revisión el último build que ya subiste (p.ej. con `beta`), sin recompilar.

> ⚠️ **Requisito previo:** antes de enviar a revisión, la ficha de la app debe estar completa en
> **App Store Connect** (nombre, descripción, palabras clave, **capturas de pantalla**, categoría,
> clasificación por edad, **URL de política de privacidad**, precio/disponibilidad y "qué hay de nuevo").
> Las lanes usan `skip_metadata`/`skip_screenshots`, es decir, **no** suben metadatos ni capturas:
> toman lo que ya haya cargado en App Store Connect. Si falta algo obligatorio, Apple rechazará el
> envío con un error indicando qué campo falta.
>
> Ambas lanes usan `automatic_release: true` (se publica sola al aprobarse) y declaran
> `add_id_info_uses_idfa: false` (la app no usa IDFA/publicidad). Si en el futuro integras
> publicidad/tracking, cambia ese valor en el `Fastfile`.
>
> Para gestionar metadatos y capturas también desde Fastlane más adelante, se puede usar `deliver`
> con una carpeta `fastlane/metadata` y `fastlane/screenshots` (quitando los `skip_*`).

---

## 7. Problemas resueltos durante la configuración (referencia)

- **Podfile / deployment target 14.0 → 15.0**: el plugin `@aparajita/capacitor-biometric-auth`
  exige iOS 15.0. Se subió en `ios/App/Podfile` y en `App.xcodeproj/project.pbxproj`.
- **Perfil de desarrollo requería dispositivos**: crear un perfil `development` sin ningún
  dispositivo registrado da error 409 (`relationship 'devices' is required`). Por eso la lane
  `certificates` solo hace `appstore`; el perfil de desarrollo se crea en `device`/`certificates_dev`
  cuando ya hay un dispositivo registrado.
- **"maximum number of Development certificates"**: un primer intento fallido dejó un certificado de
  desarrollo huérfano en el portal (sin clave privada en git). Se resolvió con `fastlane revoke_dev_certs`
  (revoca vía API) y luego `fastlane device`. `match nuke` no sirve aquí porque su confirmación
  interactiva falla en modo desatendido.
- **Popup del llavero al firmar**: si macOS pide permiso para usar la clave al firmar, pulsa
  **"Permitir siempre"**.

---

## 8. Notas

- Aviso de versión ya resuelto: `@capacitor/core` y `@capacitor/cli` alineados a `7.6.7`.
- `.gitignore` de `ios/` excluye `.env`, `secrets/`, `*.p8`, `*.ipa`, `*.p12`, `*.mobileprovision`
  y artefactos de fastlane.
- Si cambias de máquina: clona el proyecto, `npm install`, coloca `secrets/AuthKey_*.p8` y `.env`
  (con la `MATCH_PASSWORD` correcta), `npx cap sync ios`, y `fastlane certificates` descargará los
  certificados desde el repo privado.
