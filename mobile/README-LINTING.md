# Guía de Linting con JSLint

Este proyecto utiliza JSLint para validar la calidad del código JavaScript/TypeScript en el frontend móvil.

## Instalación

JSLint ya está instalado como dependencia de desarrollo en el proyecto.

## Uso

### Ejecutar validación básica
```bash
npm run lint
```
Ejecuta JSLint en todos los archivos JavaScript/TypeScript del proyecto.

### Ejecutar en archivos específicos
```bash
npm run lint nombre-archivo.tsx
npm run lint directorio/
```

### Generar reporte Checkstyle
```bash
npm run lint:check
```
Genera un archivo `jslint-report.xml` con el reporte en formato Checkstyle.

## Configuración

La configuración de JSLint está definida en `.jslintrc.json` con las siguientes características:

- **ES6+**: Soporte completo para características modernas de JavaScript
- **React Native**: Configuración específica para desarrollo móvil
- **React**: Reglas específicas para componentes React
- **Variables globales**: Definidas las variables globales comunes (React, __DEV__, etc.)
- **Indentación**: 2 espacios
- **Estilo**: Permite algunas flexibilidades para desarrollo ágil

## Reglas principales

- Uso estricto de igualdad (`===` en lugar de `==`)
- Variables deben estar definidas antes de usarlas
- Funciones deben usar capitalización correcta
- Espacios en blanco apropiados
- Límites en errores (máximo 50 errores)

## Integración con desarrollo

JSLint se ejecuta automáticamente como parte del proceso de desarrollo. Se recomienda:

1. Ejecutar `npm run lint` antes de hacer commits
2. Corregir los errores reportados
3. Usar `npm run lint:check` para generar reportes formales

## Solución de problemas comunes

- **Variables no definidas**: Asegúrate de importar correctamente los módulos
- **Problemas de indentación**: Usa 2 espacios consistentemente
- **Errores de funciones**: Verifica la capitalización de nombres de funciones
