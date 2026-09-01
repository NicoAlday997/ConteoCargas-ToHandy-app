# Handy Conteo App

App interna para digitalizar el conteo de carga inicial y recargas de las rutas de venta, con doble verificación (vendedor + contador) e integración automatizada con la API de Handy.

## Documentación

Toda la documentación del proyecto vive en [`/docs`](./docs):

1. [Definición y Requisitos](./docs/01-definicion-y-requisitos.md)
2. [Documento Técnico y de Diseño](./docs/02-documento-tecnico-y-diseno.md)
3. [Guía de Entorno de Desarrollo](./docs/03-guia-entorno-desarrollo.md)
4. [API Interna](./docs/04-api-interna.md)
5. [Estrategia de Pruebas](./docs/05-estrategia-pruebas.md)
6. [Documento Visual y de Experiencia](./docs/06-documento-visual-y-experiencia.md)

## Estructura del repositorio

```
handy-conteo-app/
├── apps/
│   ├── backend/       # API propia (NestJS + TypeScript)
│   └── mobile/        # App móvil (React Native + TypeScript)
├── packages/
│   └── shared-types/  # Interfaces/DTOs compartidos entre backend y app
└── docs/              # Documentación del proyecto
```

## Empezar a desarrollar

Sigue la [Guía de Entorno de Desarrollo](./docs/03-guia-entorno-desarrollo.md) para instalar y configurar todo lo necesario (Node, Docker, PostgreSQL, NestJS, React Native para Android e iOS).

## Stack

- **Backend:** NestJS + TypeScript + PostgreSQL (Prisma)
- **App móvil:** React Native + TypeScript (Android + iOS)
- **Integración externa:** API REST v2 de Handy (`hub.handy.la`)
