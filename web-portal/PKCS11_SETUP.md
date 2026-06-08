# Guia PKCS#11 para firma con token USB

Esta version del portal firma con certificados de hardware de dos maneras:

- Primero detecta certificados con clave privada en el almacen de Windows. Este es el camino recomendado para tokens que Windows ya reconoce.
- Tambien intenta PKCS#11 con pyHanko/OpenSC cuando el token expone una DLL PKCS#11 compatible.

El token debe estar conectado en la maquina donde corre `web-backend`.

## Requisitos

1. Token USB o smart card compatible con PKCS#11.
2. Driver del token instalado en Windows.
3. Certificado visible en el almacen de Windows o DLL PKCS#11 del fabricante.
4. OpenSC instalado si vas a usar PKCS#11 directo.
5. PIN del token.
6. Certificado de firma dentro del token.

## Variables de entorno del backend

En `web-backend/.env`, estas variables son opcionales pero utiles si queres fijar una DLL, certificado o Python de pyHanko por defecto:

```powershell
PKCS11_TOOL_PATH="pkcs11-tool"
PKCS11_MODULE_PATH="C:\Windows\System32\eTPKCS11.dll"
PKCS11_CERT_ID="01"
PYHANKO_PYTHON_PATH="C:\Users\santi\Desktop\Escencial\firmaDigital\web-backend\.venv-pyhanko\Scripts\python.exe"
```

Si `PKCS11_MODULE_PATH` no esta configurado, el backend prueba rutas conocidas. Si `PKCS11_CERT_ID` no esta configurado, el admin puede elegir el certificado detectado desde el modal.

## Buscar la DLL PKCS#11

```powershell
Get-ChildItem -Path "C:\Windows\System32" -Filter "*PKCS*.dll" -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Program Files*" -Filter "*pkcs*.dll" -Recurse -ErrorAction SilentlyContinue
```

DLLs frecuentes:

| Token | DLL usual |
| --- | --- |
| ePass2003 | `eTPKCS11.dll` |
| Aladdin/eToken | `aetpkss.dll` |
| Gemalto/SafeNet | `gclib.dll` |
| OpenSC | `opensc-pkcs11.dll` |

## Ver certificados del token

```powershell
pkcs11-tool --module "C:\Windows\System32\eTPKCS11.dll" --list-slots
pkcs11-tool --module "C:\Windows\System32\eTPKCS11.dll" --login --pin "123456" --list-objects --type cert
```

Copiar el `ID` del certificado y usarlo como `PKCS11_CERT_ID` o ingresarlo en el modal.

## Firmar desde el portal

1. Iniciar `web-backend` con las variables configuradas.
2. Iniciar `web-portal`.
3. Entrar con un usuario `ADMIN` u `ORGANIZATION_ADMIN`.
4. Subir un PDF en "Mis documentos".
5. Click en `PKCS#11`.
6. La app detecta certificados de Windows y tokens PKCS#11.
7. Elegir el certificado. Para el token actual, usar `Certificados de Windows`.
8. Firmar. Si Windows necesita PIN, abre su propio prompt.
9. El backend crea una nueva version del PDF firmada criptograficamente.

## Seguridad

- El PIN no se guarda en base de datos.
- La clave privada no sale del token.
- La firma se ejecuta en el servidor donde esta conectado el token.
- Para produccion, usar HTTPS y restringir este flujo a administradores autorizados.
